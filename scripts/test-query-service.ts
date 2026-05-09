import 'dotenv/config';
import { workspaceRepository } from '../src/repositories/workspaceRepository';
import { skillService } from '../src/services/skillService';
import { queryService } from '../src/services/queryService';

const log = (label: string, data: unknown) =>
  console.log(`\n✓ ${label}\n`, JSON.stringify(data, null, 2));

const fail = (label: string, err: unknown) =>
  console.log(`\n✗ ${label}\n`, err instanceof Error ? err.message : err);

async function run() {
  // Setup: workspace + two active skills
  const workspace = await workspaceRepository.create({ name: 'Query Test Workspace' });
  const wsId = workspace.id;

  const refundSkill = await skillService.create({
    workspace_id: wsId,
    name: 'Refund Request',
    trigger_condition: 'customer wants a refund or money back for a charge',
    decision: 'Verify the charge and issue a refund within 3–5 business days',
    escalation_required: false,
    confidence: 0.9,
  });
  await skillService.approve(refundSkill.id);

  const passwordSkill = await skillService.create({
    workspace_id: wsId,
    name: 'Password Reset',
    trigger_condition: 'customer cannot log in or needs to reset their password',
    decision: 'Send a password reset email and whitelist the account',
    escalation_required: false,
    confidence: 0.95,
  });
  await skillService.approve(passwordSkill.id);

  console.log('\n--- Skills created and approved ---');

  // 1. Clear match — refund query
  const refundResult = await queryService.run({
    query: 'I want my money back for the charge last month',
    workspace_id: wsId,
  });
  log('Refund query result', refundResult);

  // 2. Clear match — password query
  const passwordResult = await queryService.run({
    query: 'I cannot log in to my account and need to reset my password',
    workspace_id: wsId,
  });
  log('Password reset query result', passwordResult);

  // 3. No keyword overlap — should return NO_MATCH without calling OpenAI
  const noMatchResult = await queryService.run({
    query: 'What are your business hours?',
    workspace_id: wsId,
  });
  log('No-match query (should escalate, skill_id null)', noMatchResult);
  console.assert(noMatchResult.skill_id === null, 'skill_id should be null for no-match');
  console.assert(noMatchResult.escalate === true, 'escalate should be true for no-match');

  // 4. Empty workspace — fresh workspace with no skills
  const emptyWs = await workspaceRepository.create({ name: 'Empty Workspace' });
  const emptyResult = await queryService.run({
    query: 'I need help',
    workspace_id: emptyWs.id,
  });
  log('Empty workspace result (should be NO_MATCH)', emptyResult);

  // 5. Empty query — should throw 400
  try {
    await queryService.run({ query: '   ', workspace_id: wsId });
    console.log('\n✗ Should have thrown on empty query');
  } catch (err) {
    fail('Empty query blocked correctly (expect 400)', err);
  }

  console.log('\n--- All checks done ---\n');
}

run().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
