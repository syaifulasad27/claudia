const BOT_TOKEN = '8722620827:AAE0KfwS9lOrSvRR2ZJlghO99fWzxnLFJco';
const CHAT_ID = '380556058';

async function sendTestNotification() {
  const message = `🔴 <b>Reply Approval Needed</b>

💬 <b>Comment from @syaifulasad.js:</b>
"Gw tanya apa jawabnya apa"

✍️ <b>Claudia's Draft Reply:</b>
"Sorry kalo sebelumnya kurang jelas ya. Maksudku di post ini: basically XAUUSD ada setup di level tertentu, tapi nunggu konfirmasi dulu. Kalau ada spesifik yang mau ditanyain, langsung aja — I'll answer properly."

<i>Category: COMPLAINT_UNANSWERED | Priority: HIGH</i>`;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: CHAT_ID,
    text: message,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: 'approve:69a6b0da4c63adf0837d75ff' },
        { text: '✏️ Edit', callback_data: 'edit:69a6b0da4c63adf0837d75ff' },
        { text: '❌ Reject', callback_data: 'reject:69a6b0da4c63adf0837d75ff' }
      ]]
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Telegram notification sent successfully!');
      console.log('Message ID:', data.result.message_id);
    } else {
      console.error('❌ Failed:', data.description);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

sendTestNotification();
