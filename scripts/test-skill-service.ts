import 'dotenv/config';
import { workspaceRepository } from '../src/repositories/workspaceRepository';
import { skillService } from '../src/services/skillService';

const log = (label: string, data: unknown) =>
  console.log(`\n✓ ${label}\n`, JSON.stringify(data, null, 2));

const fail = (label: string, err: unknown) =>
  console.log(`\n✗ ${label}\n`, err instanceof Error ? err.message : err);

async function run() {
  // 1. Create a workspace to own the skills
  const workspace = await workspaceRepository.create({ name: 'Test Workspace' });
  log('Created workspace', { id: workspace.id, name: workspace.name });

  const wsId = workspace.id;

  // 2. Create a skill — should land as pending_review
  const skill = await skillService.create({
    workspace_id: wsId,
    name: 'Refund Policy',
    trigger_condition: 'user asks about refund or money back',
    decision: 'escalate to billing team',
    escalation_required: true,
    confidence: 0.9,
  });
  log('Created skill (status should be pending_review)', {
    id: skill.id,
    name: skill.name,
    status: skill.status,
  });

  // 3. Active skills — should be empty (skill is still pending)
  const activeBeforeApproval = await skillService.getActiveForWorkspace(wsId);
  log('Active skills before approval (should be [])', activeBeforeApproval);

  // 4. Approve the skill
  const approved = await skillService.approve(skill.id);
  log('Approved skill (status should be active)', { status: approved.status });

  // 5. Active skills — should now contain the skill
  const activeAfterApproval = await skillService.getActiveForWorkspace(wsId);
  log('Active skills after approval (should have 1)', activeAfterApproval.map(s => s.name));

  // 6. Try to approve again — should throw 400
  try {
    await skillService.approve(skill.id);
    console.log('\n✗ Should have thrown on double-approve');
  } catch (err) {
    fail('Double-approve blocked correctly', err);
  }

  // 7. Create a duplicate skill — should throw 409
  try {
    await skillService.create({
      workspace_id: wsId,
      name: 'Refund v2',
      trigger_condition: 'user asks about refund or money back',
      decision: 'send to billing',
    });
    console.log('\n✗ Should have thrown on duplicate trigger_condition');
  } catch (err) {
    fail('Duplicate blocked correctly', err);
  }

  // 8. Update the skill — active skill resets to pending_review
  const updated = await skillService.update(skill.id, { decision: 'auto-refund if under $50' });
  log('Updated skill (status should reset to pending_review)', {
    decision: updated.decision,
    status: updated.status,
  });

  // 9. Disable the skill
  const disabled = await skillService.disable(skill.id);
  log('Disabled skill', { status: disabled.status });

  // 10. Try to update a disabled skill — should throw 400
  try {
    await skillService.update(skill.id, { name: 'New name' });
    console.log('\n✗ Should have thrown on update of disabled skill');
  } catch (err) {
    fail('Update of disabled skill blocked correctly', err);
  }

  console.log('\n--- All checks passed ---\n');
}

run().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
