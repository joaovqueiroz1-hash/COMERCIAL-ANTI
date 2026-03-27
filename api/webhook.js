import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
     const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
     const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

     if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: 'Supabase credentials missing on Vercel Env' });
     }

     const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
     const body = req.body;
     
     const phone = body.phone || body.senderPhone || "";
     const messageId = body.messageId || body.id || `vcl-${Date.now()}`;
     const fromMe = body.fromMe || false;
     let textMsg = body.text?.message || body.message || "";
     
     if (!textMsg) {
        const t = body.type || 'Anexo';
        textMsg = t === 'Image' ? '📷 Imagem recebida' : t === 'Audio' ? '🎤 Áudio recebido' : t === 'Video' ? '🎥 Vídeo' : `📎 ${t}`;
     }

     const senderName = body.senderName || "";
     const status = body.status || (fromMe ? "enviado" : "recebido");
     const timestamp = body.momment ? new Date(body.momment).toISOString() : new Date().toISOString();

     if (!phone || !messageId) {
        return res.status(200).json({ ok: true, notice: 'ignored - no phone or messageId' });
     }

     const cleanPhone = phone.replace(/\D/g, '');
     let searchPhones = [cleanPhone];
     if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
       searchPhones.push(cleanPhone.substring(2));
     } else {
       searchPhones.push('55' + cleanPhone);
     }

     // 1. Procurar o Lead
     const { data: leads } = await supabase
       .from('leads')
       .select('id, whatsapp')
       .or(searchPhones.map(p => `whatsapp.ilike.%${p}%`).join(','))
       .limit(1);

     let leadId = null;
     if (leads && leads.length > 0) leadId = leads[0].id;

     // 2. Verificar se já existe a mensagem
     const { data: existingMsg } = await supabase
       .from('whatsapp_messages')
       .select('id, status')
       .eq('message_id', messageId)
       .maybeSingle();

     if (existingMsg) {
        await supabase
          .from('whatsapp_messages')
          .update({ status: status })
          .eq('message_id', messageId);
     } else {
        await supabase
          .from('whatsapp_messages')
          .insert({
            message_id: messageId,
            lead_id: leadId,
            phone: cleanPhone,
            text_content: textMsg,
            from_me: fromMe,
            status: status,
            sender_name: senderName,
            timestamp: timestamp
          });
     }

     return res.status(200).json({ ok: true, id: messageId });
  } catch (error) {
     console.error("Vercel Webhook Error:", error);
     return res.status(500).json({ error: String(error) });
  }
}
