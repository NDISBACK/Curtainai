/**
 * One-time bootstrap: creates a workspace and its first API key, then prints
 * the raw key so you can use it in curl / Postman / .env.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-workspace.ts "My Company Name"
 */
import 'dotenv/config';
import { workspaceRepository } from '../src/repositories/workspaceRepository';
import { apiKeyRepository } from '../src/repositories/apiKeyRepository';
import { generateApiKey } from '../src/utils/apiKey';

async function run() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error('Usage: npx tsx scripts/bootstrap-workspace.ts "Company Name"');
    process.exit(1);
  }

  // 1. Create workspace
  const workspace = await workspaceRepository.create({ name });
  console.log(`\n✓ Workspace created`);
  console.log(`  id:   ${workspace.id}`);
  console.log(`  name: ${workspace.name}`);

  // 2. Generate API key
  const { raw, hash, prefix } = generateApiKey();
  await apiKeyRepository.create({
    workspace_id: workspace.id,
    key_hash: hash,
    key_prefix: prefix,
    name: 'default',
    last_used_at: null,
    expires_at: null,
    revoked_at: null,
  });

  console.log(`\n✓ API key created`);
  console.log(`  prefix: ${prefix}`);
  console.log(`\n⚠️  Copy this key now — it will NOT be shown again:\n`);
  console.log(`  ${raw}\n`);
  console.log(`Add to your shell:\n`);
  console.log(`  export WS_ID="${workspace.id}"`);
  console.log(`  export API_KEY="${raw}"\n`);
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
