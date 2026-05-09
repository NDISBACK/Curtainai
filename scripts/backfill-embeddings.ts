import 'dotenv/config';
import { skillRepository } from '../src/repositories/skillRepository';
import { workspaceRepository } from '../src/repositories/workspaceRepository';
import { embeddingService } from '../src/services/embeddingService';

const BATCH_SIZE = 50;

async function run() {
  console.log('Starting embedding backfill...\n');

  const workspaces = await workspaceRepository.findAll(1, 100);
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const ws of workspaces) {
    let page = 1;
    while (true) {
      const skills = await skillRepository.findAllByWorkspace(ws.id, page, BATCH_SIZE);
      if (skills.length === 0) break;

      const toEmbed = skills.filter(s => !s.embedding && s.trigger_condition);

      if (toEmbed.length > 0) {
        const texts = toEmbed.map(s => s.trigger_condition!);
        let embeddings: number[][];
        try {
          embeddings = await embeddingService.embedBatch(texts);
        } catch (err) {
          console.error(`  [ERROR] batch embed failed for workspace ${ws.id}:`, err);
          totalFailed += toEmbed.length;
          page++;
          continue;
        }

        for (let i = 0; i < toEmbed.length; i++) {
          const skill = toEmbed[i];
          const embedding = embeddings[i];
          try {
            await skillRepository.update(skill.id, { embedding } as never);
            totalProcessed++;
            console.log(`  ✓ ${skill.name} (${skill.id.slice(0, 8)})`);
          } catch (err) {
            console.error(`  ✗ ${skill.name}:`, err);
            totalFailed++;
          }
        }
      }

      totalSkipped += skills.length - toEmbed.length;
      if (skills.length < BATCH_SIZE) break;
      page++;
    }
  }

  console.log(`\nDone. Embedded: ${totalProcessed}, Already had embedding: ${totalSkipped}, Failed: ${totalFailed}`);
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
