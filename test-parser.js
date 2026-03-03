import { parseComment } from './repliz-client/agents/comment-parser.js';

async function test() {
  const testComments = [
    {
      id: 'test_001',
      username: 'syaifulasad.js',
      text: 'Kapan open posisi kak?',
      timestamp: '2026-03-03T07:01:47.778Z'
    },
    {
      id: 'test_002',
      username: 'trader_jakarta',
      text: 'SL di berapa untuk XAUUSD hari ini?',
      timestamp: '2026-03-03T08:00:00Z'
    },
    {
      id: 'test_003',
      username: 'novice_trader',
      text: 'Mantap kak analisanya! Terima kasih',
      timestamp: '2026-03-03T08:30:00Z'
    }
  ];
  
  console.log('🧪 TESTING COMMENT PARSER AGENT\n');
  console.log('================================\n');
  
  for (const comment of testComments) {
    console.log(`💬 @${comment.username}: "${comment.text}"`);
    
    const parsed = await parseComment(comment);
    
    console.log(`   Intent: ${parsed.parsed.intent} (${parsed.parsed.intentConfidence})`);
    console.log(`   Topic: ${parsed.parsed.entities.topic || 'none'}`);
    console.log(`   Pair: ${parsed.parsed.entities.pair || 'none'}`);
    console.log(`   Sentiment: ${parsed.parsed.sentiment}`);
    console.log('   ---\n');
  }
  
  console.log('✅ Test complete!');
}

test();
