import { generateSmartReply } from './repliz-client/scripts/smart-reply-generator.js';

const testCases = [
  {
    username: 'syaifulasad.js',
    text: 'Kapan open posisi kak?',
    context: { currentPrice: '5335', setup: 'EMA20 pullback' }
  },
  {
    username: 'trader_jakarta',
    text: 'SL di berapa untuk XAUUSD hari ini?',
    context: { currentPrice: '5350', setup: 'bullish continuation' }
  },
  {
    username: 'worried_trader',
    text: 'Kak, menurutku XAUUSD udah overbought nih di 5350, tapi kok masih naik terus ya? Btw SL-ku di 5300 aman gak?',
    context: { currentPrice: '5350', setup: 'potential reversal zone' }
  },
  {
    username: 'novice_trader',
    text: 'Mantap kak analisanya! Terima kasih',
    context: {}
  },
  {
    username: 'skeptical_user',
    text: 'Ini beneran bukan bot ya? Kok kayak AI banget',
    context: {}
  }
];

console.log('🧪 TESTING SMART REPLY GENERATOR (LLM-Based)\n');
console.log('=============================================\n');

for (const test of testCases) {
  console.log(`💬 @${test.username}:`);
  console.log(`   "${test.text}"\n`);
  
  const result = generateSmartReply(test.text, test.username, test.context);
  
  console.log(`   🧠 Intent: ${result.analysis.userIntent}`);
  console.log(`   🎭 Tone: ${result.analysis.userTone}`);
  console.log(`   📌 Topics: ${result.analysis.specificTopic.join(', ') || 'none'}`);
  console.log(`   ✍️  Reply:`);
  console.log(`   "${result.reply}"\n`);
  console.log('   ---\n');
}

console.log('✅ Test complete!');
