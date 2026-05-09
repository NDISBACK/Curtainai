import 'dotenv/config';
import { extractionService } from '../src/services/extractionService';

const log = (label: string, data: unknown) =>
  console.log(`\n✓ ${label}\n`, JSON.stringify(data, null, 2));

const fail = (label: string, err: unknown) =>
  console.log(`\n✗ ${label}\n`, err instanceof Error ? err.message : err);

const SAMPLE_CONVERSATION = `
Agent: Hi there! How can I help you today?
Customer: I've been trying to reset my password for the past hour and I'm not getting the email.
Agent: I'm sorry about that. Let me look into your account. I can see your email on file is correct. Sometimes these emails can end up in spam — could you check there?
Customer: I checked, nothing there.
Agent: No problem. I'll manually trigger a password reset from our end and also whitelist your email. You should receive it within 2 minutes.
Customer: Got it, thank you!
Agent: You're welcome. While I have you, your account also shows a failed payment from last week — would you like me to look into that too?
Customer: Oh yes please, I didn't even notice.
Agent: It looks like your card expired. If you update your payment method in Account Settings, the system will automatically retry the charge.
Customer: Perfect, I'll do that now.
`.trim();

const SMALL_TALK_CONVERSATION = `
Customer: Hey, how's your day going?
Agent: It's going well, thank you for asking! How about yours?
Customer: Pretty good, just browsing. Thanks!
Agent: Anytime, have a great day!
`.trim();

async function run() {
  // 1. Valid conversation — should extract 2 skills (password reset + payment retry)
  const result = await extractionService.extractFromConversation(SAMPLE_CONVERSATION);
  log('Extracted skills', result);
  console.log(`  → extracted_count: ${result.extracted_count}`);

  // 2. Small-talk conversation — should return empty skills array
  const empty = await extractionService.extractFromConversation(SMALL_TALK_CONVERSATION);
  log('No-skill conversation (should be [])', empty.skills);

  // 3. Empty string — should throw 400
  try {
    await extractionService.extractFromConversation('   ');
    console.log('\n✗ Should have thrown on empty input');
  } catch (err) {
    fail('Empty input blocked correctly (expect 400)', err);
  }

  // 4. Oversized input — should throw 400
  try {
    await extractionService.extractFromConversation('x'.repeat(50_001));
    console.log('\n✗ Should have thrown on oversized input');
  } catch (err) {
    fail('Oversized input blocked correctly (expect 400)', err);
  }

  console.log('\n--- All checks done ---\n');
}

run().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
