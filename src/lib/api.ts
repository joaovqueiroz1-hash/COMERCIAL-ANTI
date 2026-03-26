import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];
type Interacao = Database['public']['Tables']['interacoes']['Row'];
type InteracaoInsert = Database['public']['Tables']['interacoes']['Insert'];
type ProximaAcao = Database['public']['Tables']['proximas_acoes']['Row'];
type ProximaAcaoInsert = Database['public']['Tables']['proximas_acoes']['Insert'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type PipelineLog = Database['public']['Tables']['pipeline_logs']['Row'];
type NotaCRM = Database['public']['Tables']['notas_crm']['Row'];
type NotaCRMInsert = Database['public']['Tables']['notas_crm']['Insert'];

export type { Lead, LeadInsert, LeadUpdate, Interacao, InteracaoInsert, ProximaAcao, ProximaAcaoInsert, Profile, PipelineLog, NotaCRM, NotaCRMInsert };

// LEADS
export async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchLead(id: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createLead(lead: LeadInsert) {
  const { data, error } = await supabase.from('leads').insert(lead).select().single();
  if (error) throw error;
  return data;
}

export async function createLeadsBatch(leads: LeadInsert[]) {
  const { data, error } = await supabase.from('leads').insert(leads).select();
  if (error) throw error;
  return data;
}

export async function updateLead(id: string, updates: LeadUpdate) {
  const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}

// INTERAÇÕES
export async function fetchInteracoes(leadId: string) {
  const { data, error } = await supabase
    .from('interacoes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInteracao(interacao: InteracaoInsert) {
  const { data, error } = await supabase.from('interacoes').insert(interacao).select().single();
  if (error) throw error;
  return data;
}

// PRÓXIMAS AÇÕES
export async function fetchProximasAcoes(leadId?: string) {
  let query = supabase.from('proximas_acoes').select('*').order('data_hora', { ascending: true });
  if (leadId) query = query.eq('lead_id', leadId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createProximaAcao(acao: ProximaAcaoInsert) {
  const { data, error } = await supabase.from('proximas_acoes').insert(acao).select().single();
  if (error) throw error;
  return data;
}

export async function updateProximaAcao(id: string, updates: Partial<ProximaAcaoInsert>) {
  const { data, error } = await supabase.from('proximas_acoes').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// PROFILES
export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('nome');
  if (error) throw error;
  return data;
}

// PIPELINE LOGS
export async function createPipelineLog(log: { lead_id: string; status_anterior: string | null; status_novo: string; alterado_por: string }) {
  const { error } = await supabase.from('pipeline_logs').insert({
    lead_id: log.lead_id,
    status_anterior: log.status_anterior as any,
    status_novo: log.status_novo as any,
    alterado_por: log.alterado_por,
  });
  if (error) throw error;
}

export async function fetchPipelineLogs(leadId: string) {
  const { data, error } = await supabase
    .from('pipeline_logs')
    .select('*')
    .eq('lead_id', leadId)
    .order('alterado_em', { ascending: false });
  if (error) throw error;
  return data;
}

// NOTAS CRM
export async function fetchNotasCRM(leadId: string) {
  const { data, error } = await supabase
    .from('notas_crm')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createNotaCRM(nota: NotaCRMInsert) {
  const { data, error } = await supabase.from('notas_crm').insert(nota).select().single();
  if (error) throw error;
  return data;
}

export async function deleteNotaCRM(id: string) {
  const { error } = await supabase.from('notas_crm').delete().eq('id', id);
  if (error) throw error;
}

// Z-API CONFIG (Supabase)
export type ZApiConfigRow = Database['public']['Tables']['zapi_config']['Row'];
export type ZApiConfigInsert = Database['public']['Tables']['zapi_config']['Insert'];

export async function fetchZApiConfigGlobally() {
  const { data, error } = await supabase.from('zapi_config').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertZApiConfigGlobally(config: ZApiConfigInsert) {
  const existing = await fetchZApiConfigGlobally();
  if (existing) {
    const { data, error } = await supabase.from('zapi_config').update(config).eq('id', existing.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('zapi_config').insert(config).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteZApiConfigGlobally() {
  const { error } = await supabase.from('zapi_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

// WHATSAPP MESSAGES (Realtime CRM)
export type WhatsAppMessage = Database['public']['Tables']['whatsapp_messages']['Row'];
export type WhatsAppMessageInsert = Database['public']['Tables']['whatsapp_messages']['Insert'];

export async function fetchWhatsAppMessages(phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${cleanPhone.startsWith('55') ? cleanPhone.substring(2) : cleanPhone}%`)
    .order('timestamp', { ascending: true })
    .limit(200);
    
  if (error) throw error;
  return data;
}

export async function createWhatsAppMessage(msg: WhatsAppMessageInsert) {
  const { data, error } = await supabase.from('whatsapp_messages').insert(msg).select().single();
  if (error) throw error;
  return data;
}
