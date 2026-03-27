/**
 * Z-API Integration — LV Business Club CRM
 *
 * Tenta acesso direto ao Z-API primeiro (CORS liberado nas versões modernas).
 * Se bloqueado por CORS, usa a Edge Function "zapi-proxy" como fallback.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ZApiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
}

// ── Proxy interno ─────────────────────────────────────────────────────────────

interface ProxyResponse<T> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

async function proxy<T>(
  cfg: ZApiConfig,
  path: string,
  method = 'GET',
  body?: unknown,
  queryParams?: Record<string, string>,
): Promise<T> {
  // TENTATIVA 1: Acesso direto (Z-API moderno libera CORS)
  try {
    let url = `https://api.z-api.io/instances/${cfg.instanceId.trim()}/token/${cfg.token.trim()}/${path}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      url += '?' + new URLSearchParams(queryParams).toString();
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const ct = cfg.clientToken?.trim();
    if (ct && ct !== cfg.token.trim()) headers['Client-Token'] = ct;

    const res = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      const s = res.status;
      if (s === 400) throw new Error('Credenciais inválidas (400). Verifique Instance ID e Token.');
      if (s === 401) throw new Error('Não autorizado (401). Token incorreto.');
      if (s === 404) throw new Error('Instância não encontrada (404). Verifique o Instance ID.');
      throw new Error(`Erro Z-API ${s}: ${JSON.stringify(data)}`);
    }
    return data;
  } catch (err: any) {
    // Erros definitivos de credencial: não fazer fallback
    if (err.message.includes('(400)') || err.message.includes('(401)') || err.message.includes('(404)')) {
      throw err;
    }

    // TENTATIVA 2: Via Edge Function Supabase (contorna CORS)
    const { data: result, error: fnError } = await supabase.functions.invoke<ProxyResponse<T>>(
      'zapi-proxy',
      {
        body: {
          instanceId: cfg.instanceId.trim(),
          token: cfg.token.trim(),
          clientToken: cfg.clientToken?.trim() || '',
          path,
          method,
          body,
          queryParams,
        },
      },
    );

    if (fnError) {
      if (fnError.message.includes('Function not found') || fnError.message.includes('404')) {
        throw new Error('Proxy Supabase não encontrado. Certifique-se de ter feito deploy das Edge Functions.');
      }
      throw new Error(`Falha no proxy: ${fnError.message}`);
    }

    if (!result) throw new Error('Resposta vazia do proxy.');

    if (!result.ok) {
      const s = result.status;
      if (s === 400) throw new Error('Credenciais inválidas (400) via Proxy.');
      if (s === 401) throw new Error('Não autorizado (401) via Proxy.');
      if (s === 404) throw new Error('Instância não encontrada (404) via Proxy.');
      throw new Error(`Erro Z-API via Proxy (${s})`);
    }

    return result.data;
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

export interface ZApiStatus {
  connected: boolean;
  session?: string;
  smartphoneConnected?: boolean;
  value?: boolean;
}

export async function getZApiStatus(cfg: ZApiConfig): Promise<ZApiStatus> {
  const data = await proxy<ZApiStatus>(cfg, 'status');
  if (typeof data.connected === 'undefined' && typeof data.value !== 'undefined') {
    data.connected = data.value;
  }
  return data;
}

// ── Enviar mensagem de texto ──────────────────────────────────────────────────

export interface SendTextPayload {
  phone: string;
  message: string;
}

export interface SendTextResult {
  zaapId?: string;
  messageId?: string;
  id?: string;
}

export async function sendTextMessage(
  cfg: ZApiConfig,
  payload: SendTextPayload,
): Promise<SendTextResult> {
  return proxy<SendTextResult>(cfg, 'send-text', 'POST', payload);
}

// ── Buscar mensagens de um contato ────────────────────────────────────────────

export interface ZApiMessage {
  messageId: string;
  phone: string;
  fromMe: boolean;
  momment: number; // unix ms
  status: string;
  chatName?: string;
  senderName?: string;
  text: { message: string } | null;
  type: string;
}

export async function getMessages(
  cfg: ZApiConfig,
  phone: string,
  page = 1,
): Promise<ZApiMessage[]> {
  // Normaliza o telefone: remove sufixos (@s.whatsapp.net etc.) e deixa só dígitos
  const cleanPhone = phone.replace(/@[^@]+$/, '').replace(/\D/g, '');
  const result = await proxy<ZApiMessage[] | { messages?: ZApiMessage[] }>(
    cfg,
    `chat-messages/${cleanPhone}`,
    'GET',
    undefined,
    { page: String(page), pageSize: '50' },
  );
  if (Array.isArray(result)) return result;
  if (result && 'messages' in result && Array.isArray(result.messages)) return result.messages;
  return [];
}

export interface ZApiChat {
  phone: string;
  name: string;
  unreadCount?: number;
}

export async function getChats(cfg: ZApiConfig, page = 1): Promise<ZApiChat[]> {
  const result = await proxy<ZApiChat[] | { chats?: ZApiChat[] }>(
    cfg,
    'chats',
    'GET',
    undefined,
    { page: String(page), pageSize: '20' },
  );
  if (Array.isArray(result)) return result;
  if (result && 'chats' in result && Array.isArray(result.chats)) return result.chats;
  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normaliza número brasileiro para formato E.164 sem '+' */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}
