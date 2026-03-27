import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function getCfg() {
  const req = await fetch(`${SUPABASE_URL}/rest/v1/zapi_config?select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const data = await req.json();
  return data[0];
}

async function testZapi() {
  const cfg = await getCfg();
  if (!cfg) return console.log('No config');

  const instance = cfg.instance_id.trim();
  const token = cfg.token.trim();

  // Test getChats
  console.log('Fetching chats...');
  const chatRes = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/chats?page=1&pageSize=5`);
  const chatsText = await chatRes.text();
  console.log('CHATS:', chatsText.substring(0, 500));

  let chats;
  try { chats = JSON.parse(chatsText); } catch(e){}

  let phoneToTest;
  if (Array.isArray(chats) && chats.length > 0) phoneToTest = chats[0].phone;
  else if (chats?.chats && chats.chats.length > 0) phoneToTest = chats.chats[0].phone;

  if (phoneToTest) {
    console.log('\nFetching messages for', phoneToTest, '...');
    const msgRes = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/chat-messages/${phoneToTest}?page=1&pageSize=5`);
    const msgsText = await msgRes.text();
    console.log('MESSAGES:', msgsText.substring(0, 1000));
  }
}

testZapi();
