/**
 * Z-API Integration — LV Business Club CRM
 *
 * All requests go through the Supabase Edge Function "zapi-proxy" to avoid
 * browser CORS restrictions when calling api.z-api.io directly.
 *
 * Credentials are stored in localStorage (never sent to our own servers,
 * only forwarded by the proxy to Z-API on each call).
 */

import { supabase } from '@/integrations/supabase/client';

export interface ZApiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
}


// ── Internal proxy caller ────────────────────────────────────────────────────

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
  // PRIMEIRA TENTATIVA: Acesso direto do navegador (Funciona na Z-API moderna com CORS liberado)
  try {
    let url = `https://api.z-api.io/instances/${cfg.instanceId.trim()}/token/${cfg.token.trim()}/${path}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      url += '?' + new URLSearchParams(queryParams).toString();
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const ct = cfg.clientToken?.trim();
    if (ct && ct !== cfg.token.trim()) {
      headers['Client-Token'] = ct;
    }
    
    // Teste de chamada direta
    const res = await fetch(url, { 
      method, 
      headers, 
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined 
    });
    
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    
    if (!res.ok) {
      const s = res.status;
      // Erros legítimos da API Z-API
      if (s === 400) throw new Error('Credenciais inválidas ou requisição mal formatada (400). Verifique Instance ID e Token.');
      if (s === 401) throw new Error('Não autorizado (401). O Token está incorreto.');
      if (s === 404) throw new Error('Instância ou rota não encontrada (404). Verifique o Instance ID.');
      throw new Error(`Erro Z-API ${s}: ${JSON.stringify(data)}`);
    }
    return data;
  } catch (err: any) {
    // Se o erro foi um dos nossos (400, 401, 404 jogados acima), não faça fallback para o Supabase, pois a credencial de fato está errada!
    if (err.message.includes('(400)') || err.message.includes('(401)') || err.message.includes('(404)')) {
      throw err;
    }
    
    // SEGUNDA TENTATIVA: CORS bloqueou o acesso direto, tenta via Edge Function do Supabase (Proxy)
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
      // Se a função não foi publicada (o usuário não rodou deploy), e a primeira tentativa também falhou:
      if (fnError.message.includes('Function not found') || fnError.message.includes('not found') || fnError.message.includes('404')) {
        throw new Error(`As credenciais falharam no teste direto e o Proxy de retaguarda não está ativado no Supabase (Edge Functions ausentes). Certifique-se de que os dados estão 100% corretos ou publique as funções.`);
      }
      throw new Error(`Falha no proxy de segurança: ${fnError.message}`);
    }
    
    if (!result) throw new Error('Resposta vazia do servidor proxy de segurança.');
    
    if (!result.ok) {
      const s = result.status;
      if (s === 400) throw new Error('Credenciais inválidas (400) via Proxy. Verifique Instance ID e Token.');
      if (s === 401) throw new Error('Não autorizado (401) via Proxy. O Token está incorreto.');
      if (s === 404) throw new Error('Instância não encontrada (404) via Proxy. Verifique o Instance ID.');
      throw new Error(`Erro desconhecido via Proxy Z-API (Status ${s})`);
    }
    
    return result.data;
  }
}

// ── Status ───────────────────────────────────────────────────────────────────

export interface ZApiStatus {
  connected: boolean;
  session?: string;
  smartphoneConnected?: boolean;
  // Z-API may also return { value: true } in some versions
  value?: boolean;
}

export async function getZApiStatus(cfg: ZApiConfig): Promise<ZApiStatus> {
  const data = await proxy<ZApiStatus>(cfg, 'status');
  // Normalise: some versions return { value: true } instead of { connected: true }
  if (typeof data.connected === 'undefined' && typeof data.value !== 'undefined') {
    data.connected = data.value;
  }
  return data;
}

// ── Send text message ────────────────────────────────────────────────────────

export interface SendTextPayload {
  phone: string;   // E.164 without +, e.g. "5511999999999"
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

// ── Get messages for a phone number ──────────────────────────────────────────

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
  const result = await proxy<ZApiMessage[] | { messages?: ZApiMessage[] }>(
    cfg,
    'messages',
    'GET',
    undefined,
    { phone, page: String(page), pageSize: '50' },
  );
  // Handle both array response and { messages: [...] } object response
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a Brazilian WhatsApp number to E.164 format (no +). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}
