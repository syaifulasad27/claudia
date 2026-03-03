import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { ReplizClient } from './scripts/repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function publishApprovedReply() {
  console.log('Publishing approved reply...\n');
  
  const client = new ReplizClient();
  await client.init();
  
  // The comment that was approved
  const commentId = '69a6b0da4c63adf0837d75ff';
  const replyText = "Sorry kalo sebelumnya kurang jelas ya. Maksudku di post ini: basically XAUUSD ada setup di level tertentu, tapi nunggu konfirmasi dulu. Kalau ada spesifik yang mau ditanyain, langsung aja — I will answer properly.";
  
  console.log('Comment ID:', commentId);
  console.log('Reply:', replyText);
  console.log('\nPublishing...\n');
  
  const result = await client.replyToComment(commentId, replyText);
  
  if (result.ok) {
    console.log('✅ Reply published successfully!');
    console.log('Result:', result);
  } else {
    console.log('❌ Failed to publish:', result.error || result.reason);
  }
}

publishApprovedReply().catch(console.error);
