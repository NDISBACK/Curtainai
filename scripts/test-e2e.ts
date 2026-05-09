/**
 * End-to-end smoke test — exercises all 5 phases against a running server.
 *
 * Prerequisites:
 *   1. Migrations 001–005 applied to Supabase
 *   2. Server running: npm run dev
 *   3. A workspace + API key created via: npx tsx scripts/bootstrap-workspace.ts "Test Co"
 *
 * Usage:
 *   WS_ID=<workspace-id> API_KEY=<cai_...> npx tsx scripts/test-e2e.ts
 */

const BASE = 'http://localhost:3000/api/v1';
const MCP_BASE = 'http://localhost:3000/mcp/v1';

const WS_ID   = process.env['WS_ID'];
const API_KEY = process.env['API_KEY'];

if (!WS_ID || !API_KEY) {
  console.error('Set WS_ID and API_KEY environment variables first.');
  console.error('Run: npx tsx scripts/bootstrap-workspace.ts "Test Co"');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function post(path: string, body: unknown, base = BASE) {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json['error'] ?? json)}`);
  return json;
}

async function get(path: string, base = BASE) {
  const res = await fetch(`${base}${path}`, { headers });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json['error'] ?? json)}`);
  return json;
}

async function patch(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json['error'] ?? json)}`);
  return json;
}

async function run() {
  console.log('\n══════════════════════════════════════');
  console.log('  CurtainAI End-to-End Smoke Test');
  console.log('══════════════════════════════════════\n');

  // ── Phase 1: Auth & CRUD ────────────────────────────────────────────────────
  console.log('Phase 1 — Auth & CRUD');

  let workspace: Record<string, unknown>;
  await check('GET /workspaces/:id — returns authenticated workspace', async () => {
    const res = await get(`/workspaces/${WS_ID}`);
    workspace = res['data'] as Record<string, unknown>;
    assert(workspace['id'] === WS_ID, 'workspace id mismatch');
    assert(typeof (workspace['settings'] as Record<string, unknown>)['top_k'] === 'number', 'settings.top_k missing');
  });

  await check('PATCH /workspaces/:id — update settings.top_k', async () => {
    const res = await patch(`/workspaces/${WS_ID}`, { settings: { top_k: 5 } });
    const updated = res['data'] as Record<string, unknown>;
    assert((updated['settings'] as Record<string, unknown>)['top_k'] === 5, 'top_k not updated');
    // reset
    await patch(`/workspaces/${WS_ID}`, { settings: { top_k: 3 } });
  });

  await check('GET /workspaces/:id/api-keys — lists keys without key_hash', async () => {
    const res = await get(`/workspaces/${WS_ID}/api-keys`);
    const keys = res['data'] as Array<Record<string, unknown>>;
    assert(keys.length > 0, 'no api keys found');
    assert(!('key_hash' in keys[0]), 'key_hash must not be returned');
  });

  await check('Auth rejects invalid key', async () => {
    const res = await fetch(`${BASE}/skills`, {
      headers: { 'Authorization': 'Bearer cai_invalid_key_000000000000000000000000000000000000000000000000000000' },
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  // ── Phase 1: Skill CRUD ─────────────────────────────────────────────────────
  console.log('\nPhase 1 — Skill CRUD');

  let skillId: string;
  await check('POST /skills — creates pending_review skill', async () => {
    const res = await post('/skills', {
      name: 'Refund Request',
      trigger_condition: 'customer wants a refund for a subscription charge',
      decision: 'Verify the charge and issue a refund within 3–5 business days',
      escalation_required: false,
      confidence: 0.9,
    });
    const skill = res['data'] as Record<string, unknown>;
    skillId = skill['id'] as string;
    assert(skill['status'] === 'pending_review', 'should be pending_review');
  });

  await check('GET /skills/:id — returns skill', async () => {
    const res = await get(`/skills/${skillId}`);
    assert((res['data'] as Record<string, unknown>)['id'] === skillId, 'id mismatch');
  });

  await check('PATCH /skills/:id/approve — activates skill', async () => {
    const res = await patch(`/skills/${skillId}/approve`, {});
    assert((res['data'] as Record<string, unknown>)['status'] === 'active', 'should be active');
  });

  await check('PATCH /skills/:id — edit resets to pending_review', async () => {
    const res = await patch(`/skills/${skillId}`, { decision: 'Updated: verify and refund in 5 business days' });
    assert((res['data'] as Record<string, unknown>)['status'] === 'pending_review', 'edit should reset status');
    await patch(`/skills/${skillId}/approve`, {}); // re-approve for query tests
  });

  await check('PATCH /skills/:id/disable then enable', async () => {
    await patch(`/skills/${skillId}/disable`, {});
    const res = await patch(`/skills/${skillId}/enable`, {});
    assert((res['data'] as Record<string, unknown>)['status'] === 'pending_review', 'enable should → pending_review');
    await patch(`/skills/${skillId}/approve`, {}); // re-approve
  });

  // Also add a password reset skill for richer query testing
  let passwordSkillId: string;
  await check('POST /skills — creates second skill', async () => {
    const res = await post('/skills', {
      name: 'Password Reset',
      trigger_condition: 'customer cannot log in and needs to reset their password',
      decision: 'Send password reset email and whitelist the account',
      escalation_required: false,
      confidence: 0.95,
    });
    passwordSkillId = (res['data'] as Record<string, unknown>)['id'] as string;
    await patch(`/skills/${passwordSkillId}/approve`, {});
  });

  // ── Phase 2: Hybrid Search via query ────────────────────────────────────────
  console.log('\nPhase 2 — Hybrid Search');

  let queryId: string;
  await check('POST /query — matches refund skill', async () => {
    const res = await post('/query', { query: 'I want my money back for the charge last month' });
    const result = res['data'] as Record<string, unknown>;
    queryId = result['query_id'] as string;
    assert(typeof result['decision'] === 'string', 'missing decision');
    assert(typeof result['confidence'] === 'number', 'missing confidence');
    console.log(`    → skill_id: ${result['skill_id']}, confidence: ${result['confidence']}, escalate: ${result['escalate']}`);
  });

  await check('POST /query — semantic match "I need my money back" (vector catches this)', async () => {
    const res = await post('/query', { query: 'I need my money back urgently' });
    const result = res['data'] as Record<string, unknown>;
    assert(typeof result['decision'] === 'string', 'missing decision');
    console.log(`    → escalate: ${result['escalate']}, method in output: ${JSON.stringify((result['output'] as Record<string, unknown>)?.['pipeline'])}`);
  });

  await check('POST /query — no match escalates', async () => {
    const res = await post('/query', { query: 'What are your business hours on public holidays?' });
    const result = res['data'] as Record<string, unknown>;
    assert(result['escalate'] === true, 'no-match should escalate');
    assert(result['skill_id'] === null, 'no-match should have null skill_id');
  });

  // ── Phase 2: Override (also exercises extraction pipeline) ──────────────────
  await check('POST /query/override — creates pending_review skill from correction', async () => {
    const res = await post('/query/override', {
      query_id: queryId,
      corrected_decision: 'Check account history, issue a full refund within 48 hours, and send a confirmation email.',
    });
    const result = res['data'] as Record<string, unknown>;
    assert(typeof (result['override'] as Record<string, unknown>)['id'] === 'string', 'missing override id');
    console.log(`    → generated_skills: ${result['generated_skills'] as number}, skipped_duplicates: ${result['skipped_duplicates']}`);
  });

  // ── Phase 3: Export ──────────────────────────────────────────────────────────
  console.log('\nPhase 3 — Export / Import / Versions');

  await check('GET /skills/export?format=json — returns active skills', async () => {
    const res = await get('/skills/export?format=json&status=active');
    const skills = res['data'] as unknown[];
    assert(Array.isArray(skills), 'should be array');
    assert(skills.length >= 1, 'should have at least the refund skill');
    console.log(`    → ${skills.length} active skill(s) exported`);
  });

  await check('GET /skills/export?format=openai_functions — valid function defs', async () => {
    const res = await get('/skills/export?format=openai_functions');
    const fns = res['data'] as Array<Record<string, unknown>>;
    assert(Array.isArray(fns), 'should be array');
    if (fns.length > 0) {
      assert(typeof fns[0]['name'] === 'string', 'missing name');
      assert(typeof fns[0]['description'] === 'string', 'missing description');
      assert(typeof fns[0]['parameters'] === 'object', 'missing parameters');
    }
  });

  await check('GET /skills/export?format=mcp_tools — valid MCP tool defs', async () => {
    const res = await get('/skills/export?format=mcp_tools');
    const tools = res['data'] as Array<Record<string, unknown>>;
    assert(Array.isArray(tools), 'should be array');
    if (tools.length > 0) {
      assert(typeof tools[0]['name'] === 'string', 'missing name');
      assert(typeof tools[0]['inputSchema'] === 'object', 'missing inputSchema');
    }
  });

  await check('POST /skills/import — creates new skills (or skips duplicates)', async () => {
    const res = await post('/skills/import', {
      skills: [
        {
          name: 'Billing Dispute',
          trigger_condition: 'customer disputes an invoice or billing amount charged to their card',
          decision: 'Pull up the invoice, verify the charge, and issue a credit or correction.',
          escalation_required: false,
          confidence: 0.85,
        },
      ],
    });
    const result = res['data'] as Record<string, unknown>;
    assert(typeof result['created'] === 'number', 'missing created count');
    console.log(`    → created: ${result['created']}, skipped_duplicates: ${result['skipped_duplicates']}, errors: ${JSON.stringify(result['errors'])}`);
  });

  await check('GET /skills/:id/versions — returns version history', async () => {
    const res = await get(`/skills/${skillId}/versions`);
    const versions = res['data'] as unknown[];
    assert(Array.isArray(versions), 'should be array');
    console.log(`    → ${versions.length} version(s) recorded`);
  });

  // ── Phase 4: Analytics ───────────────────────────────────────────────────────
  console.log('\nPhase 4 — Analytics');

  await check('GET /workspaces/:id/analytics — returns analytics object', async () => {
    const res = await get(`/workspaces/${WS_ID}/analytics`);
    const data = res['data'] as Record<string, unknown>;
    assert(typeof data['total_queries'] === 'number', 'missing total_queries');
    assert(typeof data['match_rate'] === 'number', 'missing match_rate');
    assert(Array.isArray(data['daily_breakdown']), 'missing daily_breakdown');
    console.log(`    → total: ${data['total_queries']}, match_rate: ${data['match_rate']}, escalation_rate: ${data['escalation_rate']}`);
  });

  await check('GET /skills/:id/analytics — returns skill analytics', async () => {
    const res = await get(`/skills/${skillId}/analytics`);
    const data = res['data'] as Record<string, unknown>;
    assert(typeof data['total_matches'] === 'number', 'missing total_matches');
    assert(typeof data['escalation_rate'] === 'number', 'missing escalation_rate');
  });

  await check('GET /queries — paginated query history', async () => {
    const res = await get(`/queries?limit=5&page=1`);
    const data = res['data'] as Record<string, unknown>;
    assert(Array.isArray(data['data']), 'missing data array');
    assert(typeof data['total'] === 'number', 'missing total');
    console.log(`    → ${data['total']} total queries, ${(data['data'] as unknown[]).length} returned`);
  });

  // ── Phase 5: MCP ─────────────────────────────────────────────────────────────
  console.log('\nPhase 5 — MCP Server');

  const mcpHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` };

  await check('MCP initialize', async () => {
    const res = await fetch(`${MCP_BASE}/`, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    const json = await res.json() as Record<string, unknown>;
    const result = json['result'] as Record<string, unknown>;
    assert(typeof result['protocolVersion'] === 'string', 'missing protocolVersion');
    console.log(`    → protocolVersion: ${result['protocolVersion']}, serverInfo: ${JSON.stringify(result['serverInfo'])}`);
  });

  await check('MCP tools/list — returns workspace skills as tools', async () => {
    const res = await fetch(`${MCP_BASE}/`, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    const json = await res.json() as Record<string, unknown>;
    const tools = (json['result'] as Record<string, unknown>)['tools'] as unknown[];
    assert(Array.isArray(tools), 'tools should be array');
    console.log(`    → ${tools.length} tool(s) available`);
    if (tools.length > 0) {
      console.log(`    → first tool: ${JSON.stringify((tools[0] as Record<string, unknown>)['name'])}`);
    }
  });

  await check('MCP tools/call — routes query through pipeline', async () => {
    const res = await fetch(`${MCP_BASE}/`, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'refund_request',
          arguments: { customer_query: 'I want to get a refund on my last payment' },
        },
      }),
    });
    const json = await res.json() as Record<string, unknown>;
    const result = json['result'] as Record<string, unknown>;
    assert(Array.isArray(result['content']), 'missing content array');
    const text = (result['content'] as Array<Record<string, unknown>>)[0]['text'];
    assert(typeof text === 'string', 'missing text in content');
    console.log(`    → decision: "${String(text).slice(0, 80)}..."`);
  });

  await check('MCP invalid method returns -32601', async () => {
    const res = await fetch(`${MCP_BASE}/`, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'nonexistent/method', params: {} }),
    });
    const json = await res.json() as Record<string, unknown>;
    assert((json['error'] as Record<string, unknown>)['code'] === -32601, 'expected -32601 method not found');
  });

  // ── Clean up test skills ─────────────────────────────────────────────────────
  console.log('\nCleanup');
  await check(`DELETE /skills/${skillId}`, async () => {
    const res = await fetch(`${BASE}/skills/${skillId}`, { method: 'DELETE', headers });
    assert(res.status === 204, `expected 204, got ${res.status}`);
  });
  await check(`DELETE /skills/${passwordSkillId}`, async () => {
    const res = await fetch(`${BASE}/skills/${passwordSkillId}`, { method: 'DELETE', headers });
    assert(res.status === 204, `expected 204, got ${res.status}`);
  });

  // ── Results ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log('══════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
