# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server with hot reload (tsx watch)
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled output
npm run lint       # ESLint on src/**/*.ts
```

### Scripts

```bash
# One-time setup — creates workspace + prints raw API key
npx tsx scripts/bootstrap-workspace.ts "Company Name"

# One-time — embed all existing skills with null embeddings (run after migration 003)
npx tsx scripts/backfill-embeddings.ts

# End-to-end test suite — requires WS_ID and API_KEY env vars
WS_ID=<uuid> API_KEY=cai_... npx tsx scripts/test-e2e.ts

# Legacy manual integration scripts
npx tsx scripts/test-skill-service.ts
npx tsx scripts/test-query-service.ts
npx tsx scripts/test-extraction-service.ts
npx tsx scripts/test-override-service.ts
```

## Environment

Copy `.env.example` to `.env`:

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL   # defaults to gpt-4o
```

All vars are required at startup — the app throws immediately if any are missing.

## Architecture

Express API (`/api/v1`) and MCP server (`/mcp/v1`) backed by **Supabase** (Postgres + pgvector) and **OpenAI**.

```
routes → controllers → services → repositories → Supabase
```

- **Routes** (`src/routes/`): thin Express routers per resource
- **Controllers** (`src/controllers/`): validate with Zod, call one service, respond via `src/utils/response.ts`
- **Services** (`src/services/`): all business logic and LLM calls
- **Repositories** (`src/repositories/`): data access only, extend `BaseRepository` (Supabase admin client)
- **Validation** (`src/validation/`): Zod schemas; `validateOrThrow` is standard

### Authentication & tenancy

All routes except `GET /health` and `POST /workspaces` require `Authorization: Bearer cai_...`.

`src/middleware/authenticate.ts` extracts the Bearer token, SHA-256 hashes it, looks it up in `api_keys`, then populates `req.workspace` and `req.apiKeyId`. The `rateLimiter` middleware (100 req/min per workspace, in-memory sliding window) runs immediately after.

Bootstrap flow: `POST /workspaces` (public) → use `scripts/bootstrap-workspace.ts` to create the first API key via direct DB access → all subsequent calls use Bearer token.

Tenant isolation: `skillService.assertOwnership(skillId, workspaceId)` always returns 404 (never 403) on cross-tenant access to prevent ID enumeration.

### Database migrations (apply in order)

| Migration | What it adds |
|-----------|-------------|
| `001_initial_schema.sql` | `workspaces`, `skills`, `queries`, `overrides` |
| `002_api_keys_and_workspace_config.sql` | `api_keys` table; `workspaces.settings JSONB` with defaults `{"top_k":3,"duplicate_threshold":0.75,"hybrid_alpha":0.5}` |
| `003_vector_embeddings.sql` | pgvector extension; `skills.embedding vector(1536)`; IVFFlat index; `match_skills_vector()` and `find_duplicate_skills()` RPCs; `queries.search_method` column with check constraint |
| `004_skill_versions.sql` | `skill_versions` table — immutable snapshots per content-field edit |
| `005_analytics.sql` | `queries.escalated` column; indexes; `workspace_daily_stats` and `skill_daily_stats` materialized views; `refresh_analytics()` and `get_skill_confidence_percentiles()` RPCs |

### Core domain

**Skills** — state machine: `pending_review → active | disabled`. Disabled skills can be re-enabled to `pending_review`. Editing any content field of an `active` skill resets it to `pending_review` and writes a version snapshot to `skill_versions`.

**Query pipeline** (`src/services/queryService.ts`):
1. Fetch all `active` skills for the workspace (up to 200).
2. Embed the query via `embeddingService.embed()`. On failure, fall back to Jaccard-only.
3. If embedding succeeds: run `skillRepository.findByVectorSimilarity()` (2× topK pool), then fuse with Jaccard via RRF in `src/utils/hybridSearch.ts`. `search_method = 'hybrid'`.
4. If no embedding: rank by Jaccard similarity, `search_method = 'jaccard_only'`.
5. If no candidates found after ranking, escalate immediately (`search_method = 'no_keyword_match'`).
6. Send top-K candidates to OpenAI (`temperature: 0`, `json_object` mode) for selection.
7. Persist full `DecisionTrace` as `queries.output` JSONB. Write `escalated` and `search_method` fields.

**Critical**: `search_method` values in code must exactly match the DB check constraint: `'jaccard_only'`, `'hybrid'`, `'no_active_skills'`, `'no_keyword_match'`. Using any other value causes a 500.

**RRF fusion** (`src/utils/hybridSearch.ts`):
```
rrf_score = (1-alpha) * 1/(60+jaccardRank) + alpha * 1/(60+vectorRank)
```
`alpha` comes from `workspace.settings.hybrid_alpha` (default 0.5).

**Embeddings** (`src/services/embeddingService.ts`): `text-embedding-3-small`, 1536 dimensions. Called on skill `create`/`update` (re-embeds only when `trigger_condition` changes). Vector dedup uses `find_duplicate_skills` RPC; falls back to Jaccard if embedding unavailable.

### Export / Import / Versioning

`GET /api/v1/skills/export?format=openai_functions|mcp_tools|langchain|json&status=active`

Converts active skills to the target format. `sanitizeToolName()` lowercases, replaces non-alphanumeric with `_`, truncates to 64 chars (OpenAI/MCP tool name limit).

`POST /api/v1/skills/import` — bulk create; returns `{ created, skipped_duplicates, errors[] }`.

Version history at `GET/POST /api/v1/skills/:id/versions` and `POST /api/v1/skills/:id/versions/:version/restore`.

**Router ordering in `skillRoutes.ts`**: `/export` and `/import` are registered before `/:id` — otherwise Express matches the literal strings as skill IDs.

### MCP Server

`POST /mcp/v1` — JSON-RPC 2.0 interface for AI agent tool use. Same Bearer auth as REST API.

- `initialize` → returns protocol version and capabilities
- `tools/list` → calls `exportService.exportForWorkspace(id, 'mcp_tools')`
- `tools/call` → runs `queryService.run()` with `customer_query` argument; returns MCP content block with decision text + metadata

### Analytics

`GET /api/v1/workspaces/:id/analytics?from=ISO&to=ISO` — reads `workspace_daily_stats` materialized view.

`GET /api/v1/skills/:id/analytics?from=ISO&to=ISO` — reads `skill_daily_stats` + calls `get_skill_confidence_percentiles` RPC for p50/p90/p99.

`GET /api/v1/queries?from=&to=&page=&limit=&escalated=&skill_id=` — paginated query history.

Materialized views refresh every 5 minutes via `setInterval` in `server.ts` calling `supabaseAdmin.rpc('refresh_analytics')`.

### API surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/health` | — | Health check |
| POST | `/api/v1/workspaces` | — | Create workspace (bootstrap) |
| GET | `/api/v1/workspaces/:id` | ✓ | Get workspace |
| PATCH | `/api/v1/workspaces/:id` | ✓ | Update name / settings |
| DELETE | `/api/v1/workspaces/:id` | ✓ | Delete workspace |
| POST | `/api/v1/workspaces/:id/api-keys` | ✓ | Create API key (raw key returned once) |
| GET | `/api/v1/workspaces/:id/api-keys` | ✓ | List API keys (no hashes) |
| DELETE | `/api/v1/workspaces/:id/api-keys/:keyId` | ✓ | Revoke API key |
| GET | `/api/v1/workspaces/:id/analytics` | ✓ | Workspace analytics |
| GET | `/api/v1/skills` | ✓ | List skills |
| POST | `/api/v1/skills` | ✓ | Create skill |
| GET | `/api/v1/skills/:id` | ✓ | Get skill |
| PATCH | `/api/v1/skills/:id` | ✓ | Update skill |
| DELETE | `/api/v1/skills/:id` | ✓ | Delete skill |
| PATCH | `/api/v1/skills/:id/approve` | ✓ | Approve → active |
| PATCH | `/api/v1/skills/:id/disable` | ✓ | Disable |
| PATCH | `/api/v1/skills/:id/enable` | ✓ | Re-enable → pending_review |
| GET | `/api/v1/skills/export` | ✓ | Export skills (multiple formats) |
| POST | `/api/v1/skills/import` | ✓ | Bulk import skills |
| GET | `/api/v1/skills/:id/analytics` | ✓ | Skill analytics |
| GET | `/api/v1/skills/:id/versions` | ✓ | List version history |
| GET | `/api/v1/skills/:id/versions/:v` | ✓ | Get specific version |
| POST | `/api/v1/skills/:id/versions/:v/restore` | ✓ | Restore version as new skill |
| POST | `/api/v1/extract` | ✓ | Extract skills from conversation |
| POST | `/api/v1/query` | ✓ | Run query against active skills |
| POST | `/api/v1/query/override` | ✓ | Submit human correction |
| GET | `/api/v1/queries` | ✓ | Query history (paginated) |
| POST | `/mcp/v1` | ✓ | MCP JSON-RPC endpoint |

### Error handling

`AppError(message, statusCode)` throughout services. `catchAsync` wraps async controllers. Global `errorHandler` includes `correlation_id` (from `src/middleware/correlationId.ts`) in every error response body.
