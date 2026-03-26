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
    throw new Error(`Erro na função proxy: ${fnError.message}`);
  }
  if (!result) {
    throw new Error('Resposta vazia do proxy');
  }
  if (!result.ok) {
    const s = result.status;
    const detail = result.data ? JSON.stringify(result.data) : '';
    throw new Error(
      s === 400 ? `Credenciais inválidas (400). Verifique o Instance ID e o Token.${detail ? ' Detalhe: ' + detail : ''}`
      : s === 401 ? 'Não autorizado (401). Token incorreto.'
      : s === 404 ? 'Instância não encontrada (404). Verifique o Instance ID.'
      : `Erro Z-API ${s}${detail ? ': ' + detail : ''}`,
    );
  }
  return result.data;
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a Brazilian WhatsApp number to E.164 format (no +). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}
