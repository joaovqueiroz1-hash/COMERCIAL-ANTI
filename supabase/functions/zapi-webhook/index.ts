import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tipos de eventos Z-API que devem ser ignorados (não são mensagens)
const SKIP_TYPES = new Set([
  'ConnectedCallback',
  'DisconnectedCallback',
  'AllUnreadMessagesCallback',
  'PresenceCallback',
  'ContactsCallback',
  'GroupParticipantsCallback',
  'UpdatedProfilePictureCallback',
  'ReactionCallback',
]);

/** Normaliza telefone para apenas dígitos com código de país 55 */
function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove sufixos do WhatsApp (@s.whatsapp.net, @g.us) e deixa só dígitos
  const digits = phone.replace(/@[^@]+$/, '').replace(/\D/g, '');
  if (!digits) return '';
  // Adiciona DDI 55 se estiver faltando (número brasileiro até 11 dígitos sem código)
  if (!digits.startsWith('55') && digits.length <= 11) return '55' + digits;
  return digits;
}

/** Extrai texto de qualquer tipo de mensagem Z-API */
function extractContent(body: any): string {
  if (body.text?.message) return body.text.message;
  if (body.message) return body.message;
  if (body.image?.caption) return body.image.caption || '📷 Imagem';
  if (body.image) return '📷 Imagem recebida';
  if (body.audio || body.type === 'Audio') return '🎤 Áudio recebido';
  if (body.video?.caption) return body.video.caption || '🎥 Vídeo';
  if (body.video) return '🎥 Vídeo recebido';
  if (body.document?.fileName) return `📄 ${body.document.fileName}`;
  if (body.document) return '📄 Documento recebido';
  if (body.sticker) return '🖼️ Figurinha';
  if (body.location) return `📍 Localização: ${body.location.latitude ?? ''},${body.location.longitude ?? ''}`;
  if (body.contact) return `👤 Contato: ${body.contact.name ?? 'Contato'}`;
  return '';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();
    const eventType: string = payload.type ?? payload.event ?? '';

    console.log("Z-API webhook recebido:", JSON.stringify({
      type: eventType,
      phone: payload.phone,
      messageId: payload.messageId,
      fromMe: payload.fromMe,
    }));

    // Ignorar eventos de sistema que não são mensagens
    if (SKIP_TYPES.has(eventType)) {
      return respond({ ok: true, ignored: eventType });
    }

    const phone: string = payload.phone ?? payload.senderPhone ?? payload.from ?? '';
    const messageId: string = payload.messageId ?? payload.id ?? '';
    const fromMe: boolean = payload.fromMe ?? false;

    if (!phone || !messageId) {
      console.log("Ignorando: sem phone ou messageId");
      return respond({ ok: true, notice: "missing phone or messageId" });
    }

    // Ignorar mensagens de grupo
    if (phone.includes('@g.us') || (phone.includes('-') && phone.includes('@'))) {
      return respond({ ok: true, notice: "group message skipped" });
    }

    // Atualização de status apenas (sem conteúdo novo)
    const isStatusOnly =
      (eventType === 'MessageStatusCallback' || eventType === 'DeliveryCallback') &&
      !payload.text?.message && !payload.message &&
      !payload.image && !payload.audio && !payload.video &&
      !payload.document && !payload.sticker;

    if (isStatusOnly) {
      const newStatus: string = payload.status ?? payload.deliveryStatus ?? 'entregue';
      await supabase
        .from('whatsapp_messages')
        .update({ status: newStatus })
        .eq('message_id', messageId);
      return respond({ ok: true, notice: "status updated" });
    }

    const textContent = extractContent(payload);
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone) return respond({ ok: true, notice: "invalid phone" });

    const status: string = payload.status ?? (fromMe ? 'enviado' : 'recebido');
    const timestamp: string = payload.momment
      ? new Date(payload.momment).toISOString()
      : new Date().toISOString();
    const senderName: string = payload.senderName ?? payload.chatName ?? '';

    // Buscar lead pelo telefone (tenta com e sem DDI 55)
    const variants = [cleanPhone];
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      variants.push(cleanPhone.substring(2));
    } else {
      variants.push('55' + cleanPhone);
    }

    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .or(variants.map(p => `whatsapp.ilike.%${p}%`).join(','))
      .limit(1);

    const leadId: string | null = leads?.[0]?.id ?? null;

    const { error } = await supabase
      .from('whatsapp_messages')
      .upsert(
        {
          message_id: messageId,
          lead_id: leadId,
          phone: cleanPhone,
          text_content: textContent || null,
          from_me: fromMe,
          status,
          sender_name: senderName || null,
          timestamp,
        },
        { onConflict: 'message_id' }
      );

    if (error) {
      console.error("Erro ao salvar no DB:", error.message);
      return respond({ error: error.message }, 500);
    }

    console.log("Mensagem salva:", messageId, "fone:", cleanPhone, "fromMe:", fromMe);
    return respond({ ok: true, id: messageId, leadId });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no webhook:", msg);
    return respond({ error: msg }, 500);
  }
});
