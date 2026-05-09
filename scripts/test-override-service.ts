import 'dotenv/config';
import { workspaceRepository } from '../src/repositories/workspaceRepository';
import { queryRepository } from '../src/repositories/queryRepository';
import { overrideService } from '../src/services/overrideService';

const log = (label: string, data: unknown) =>
  console.log(`\n✓ ${label}\n`, JSON.stringify(data, null, 2));

const fail = (label: string, err: unknown) =>
  console.log(`\n✗ ${label}\n`, err instanceof Error ? err.message : err);

async function run() {
  const workspace = await workspaceRepository.create({ name: 'Override Test Workspace' });

  // Simulate a query that was logged (no matched skill — the engine missed it)
  const query = await queryRepository.create({
    workspace_id: workspace.id,
    input: 'My account got locked after too many login attempts',
    output: null,
    confidence: null,
    matched_skill_id: null,
  });
  log('Logged query (simulates a missed match)', { id: query.id, input: query.input });

  // Human submits a correction: here's what the agent should have done
  const result = await overrideService.submit({
    query_id: query.id,
    corrected_decision: 'Unlock the account, reset failed attempt counter, and send a security notification email to the user',
  });

  log('Override stored', {
    override_id: result.override.id,
    corrected_decision: result.override.corrected_decision,
  });

  log(`Generated ${result.generated_skills.length} skill(s) (all pending_review)`,
    result.generated_skills.map(s => ({
      name: s.name,
      status: s.status,
      trigger_condition: s.trigger_condition,
      decision: s.decision,
    }))
  );

  console.log(`  → Skipped duplicates: ${result.skipped_duplicates}`);

  // Submitting the same override again should skip the duplicate skill
  const result2 = await overrideService.submit({
    query_id: query.id,
    corrected_decision: 'Unlock the account, reset failed attempt counter, and send a security notification email to the user',
  });
  log('Second override (same correction — skill should be skipped as duplicate)', {
    generated: result2.generated_skills.length,
    skipped_duplicates: result2.skipped_duplicates,
  });

  // Fetch all overrides for the query
  const overrides = await overrideService.getByQueryId(query.id);
  log(`All overrides for query (expect 2)`, overrides.map(o => o.corrected_decision));

  // Missing query_id should throw 400
  try {
    await overrideService.submit({ query_id: '', corrected_decision: 'something' });
    console.log('\n✗ Should have thrown on empty query_id');
  } catch (err) {
    fail('Empty query_id blocked correctly (expect 400)', err);
  }

  console.log('\n--- All checks done ---\n');
}

run().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
