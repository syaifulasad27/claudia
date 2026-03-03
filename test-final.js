import { analyzeWithContext, generateContextualReply } from './repliz-client/scripts/smart-reply-generator.js';

// Test case: User complaint about not being answered
const testCases = [
  {
    username: 'syaifulasad.js',
    comment: 'Gw tanya apa jawabnya apa',
    post: 'Jujurly hari ini market-nya vibes-nya anget-anget kue ya. XAUUSD setup bagus di 5335 tapi masih mager nunggu pullback yang proper. Which is, sabar itu rewarding sih kalau discipline. ☕'
  },
  {
    username: 'confused_trader',
    comment: 'Kurang jelas kak, maksudnya gimana?',
    post: 'Basically SL harus sesuai ATR, jangan fixed pip. Risk management is key.'
  },
  {
    username: 'happy_user',
    comment: 'Thanks kak, mantap ilmunya!',
    post: 'Entry di pullback EMA20 dengan konfirmasi volume.'
  }
];

console.log('🧪 TESTING CONTEXTUAL REPLY GENERATOR\n');
console.log('=====================================\n');

for (const test of testCases) {
  console.log(`📱 Post: "${test.post.substring(0, 60)}..."\n`);
  console.log(`💬 @${test.username}: "${test.comment}"\n`);
  
  const analysis = analyzeWithContext(test.comment, test.post, test.username);
  const reply = generateContextualReply(analysis, test.comment, test.post, test.username);
  
  console.log(`🧠 Detected:`);
  console.log(`   Type: ${analysis.commentType}`);
  console.log(`   Emotion: ${analysis.userEmotion.type} (${analysis.userEmotion.intensity})`);
  console.log(`   Is Complaint: ${analysis.isComplaint}\n`);
  
  console.log(`✍️  Contextual Reply:`);
  console.log(`   "${reply}"\n`);
  console.log('   ---\n');
}

console.log('✅ All tests complete!');
