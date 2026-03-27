import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // O Z-API envia um JSON no corpo
    const body = await req.json();
    console.log("Z-API Webhook Header/Body received:", body);

    // Estruturas possiveis: on-message-received, etc
    // Exemplo: body { phone: "5511999999999", messageId: "...", text: { message: "Olá" }, fromMe: false, momment: 167... }
    
    // Tratando no formato que ZAPI envia (Message recebida)
    const phone = body.phone || body.senderPhone || "";
    const messageId = body.messageId || body.id || "";
    const fromMe = body.fromMe || false;
    let textMsg = body.text?.message || body.message || "";
    
    // Tratativa para arquivos de mídia (Áudio, Imagem, Vídeo)
    if (!textMsg) {
       if (body.type === 'Image' || body.image) textMsg = "📷 Imagem recebida";
       else if (body.type === 'Audio' || body.audio) textMsg = "🎤 Áudio recebido";
       else if (body.type === 'Video' || body.video) textMsg = "🎥 Vídeo recebido";
       else if (body.type === 'Document' || body.document) textMsg = "📄 Documento recebido";
       else if (body.type === 'Sticker' || body.sticker) textMsg = "🖼️ Figurinha";
       else textMsg = "Mensagem ou anexo"; // Fallback absoluto
    }

    const senderName = body.senderName || "";
    const status = body.status || (fromMe ? "enviado" : "recebido");
    
    // Convertendo `momment` da Z-API (Unix ms) para ISO, se existir
    const timestamp = body.momment 
      ? new Date(body.momment).toISOString() 
      : new Date().toISOString();

    if (!phone || !messageId) {
       console.log("Missing phone or messageId, skipping...");
       return new Response(JSON.stringify({ ok: true, notice: "ignored" }), { headers:corsHeaders });
    }

    // 1. Procurar o Lead pelo WhatsApp (com ou sem o "55")
    // Formato E.164 no banco sem símbolo de '+' - como foi salvo no CRM.
    
    // Normalizar telefone (remover todos \D)
    const cleanPhone = phone.replace(/\D/g, '');
    let searchPhones = [cleanPhone];
    
    // Se começar com 55 e tiver 12 ou 13 digitos, pode estar no banco com ou sem 55.
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      searchPhones.push(cleanPhone.substring(2)); // Pega sem o 55
    } else {
      searchPhones.push('55' + cleanPhone); // Adiciona 55
    }

    // Query do Supabase - Buscar 1 match
    const { data: leads, error: leadSearchErr } = await supabaseClient
      .from('leads')
      .select('id, whatsapp')
      .or(searchPhones.map(p => `whatsapp.ilike.%${p}%`).join(','))
      .limit(1);

    if (leadSearchErr) {
      console.error("Erro ao buscar lead:", leadSearchErr);
      return new Response(JSON.stringify({ error: leadSearchErr.message }), { status: 500, headers: corsHeaders });
    }

    let leadId = null;
    if (leads && leads.length > 0) {
      leadId = leads[0].id;
    }

    // 2. Verificar se a mensagem já existe (para atualizar status em vez de sobrescrever dados otimistas)
    const { data: existingMsg } = await supabaseClient
      .from('whatsapp_messages')
      .select('id, status')
      .eq('message_id', messageId)
      .maybeSingle();

    let insertData, insertErr;

    if (existingMsg) {
       // Atualiza apenas status pra não sobrescrever coisas inseridas pelo CRM (como sender_name "Você")
       const { data, error } = await supabaseClient
         .from('whatsapp_messages')
         .update({ status: status })
         .eq('message_id', messageId)
         .select();
       insertData = data;
       insertErr = error;
    } else {
       // Insere Mensagem nova
       const { data, error } = await supabaseClient
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
         })
         .select();
       insertData = data;
       insertErr = error;
    }

    if (insertErr) {
      console.error("Erro ao inserir mensagem:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: corsHeaders });
    }

    console.log("Mensagem processada via Webhook:", insertData);
    
    return new Response(JSON.stringify({ ok: true, id: messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
