#!/usr/bin/env node
import { ReplizClient } from './repliz-client.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node repliz-client/scripts/reply-override.js <commentId> "<replyText>" [--dry-run]');
    process.exit(1);
  }

  const commentId = args[0];
  const replyText = args[1];
  const dryRun = args.includes('--dry-run');

  const client = new ReplizClient();
  const init = await client.init();
  if (!init.ok) {
    console.error('Init failed:', init.error || 'unknown');
    process.exit(1);
  }

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      commentId,
      replyPreview: replyText.slice(0, 180),
      length: replyText.length
    }, null, 2));
    return;
  }

  const res = await client.replyToComment(commentId, replyText);
  console.log(JSON.stringify(res, null, 2));

  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
