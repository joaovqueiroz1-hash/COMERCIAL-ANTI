import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Tabelas adicionadas manualmente ainda não estão no schema gerado pelo Supabase CLI.
// Usamos `db` (untyped) apenas para essas tabelas novas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
type Material = Database['public']['Tables']['materiais']['Row'];
type MaterialInsert = Database['public']['Tables']['materiais']['Insert'];
type MaterialUpdate = Database['public']['Tables']['materiais']['Update'];

export type {
  Lead, LeadInsert, LeadUpdate,
  Interacao, InteracaoInsert,
  ProximaAcao, ProximaAcaoInsert,
  Profile, PipelineLog,
  NotaCRM, NotaCRMInsert,
  Material, MaterialInsert, MaterialUpdate,
};

// ── LEADS ────────────────────────────────────────────────────────────────────

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

// ── INTERAÇÕES ────────────────────────────────────────────────────────────────

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

// ── PRÓXIMAS AÇÕES ────────────────────────────────────────────────────────────

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

// ── PROFILES ──────────────────────────────────────────────────────────────────

export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('nome');
  if (error) throw error;
  return data;
}

// ── PIPELINE LOGS ─────────────────────────────────────────────────────────────

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

// ── NOTAS CRM ─────────────────────────────────────────────────────────────────

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

// ── Z-API CONFIG ──────────────────────────────────────────────────────────────

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

// ── WHATSAPP MESSAGES ─────────────────────────────────────────────────────────

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

export async function fetchRecentWhatsAppContacts() {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('phone, sender_name, timestamp')
    .order('timestamp', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data;
}

export async function createWhatsAppMessage(msg: WhatsAppMessageInsert) {
  const { data, error } = await supabase.from('whatsapp_messages').insert(msg).select().single();
  if (error) throw error;
  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL MENTORIA — BUSINESS CLUB
// ══════════════════════════════════════════════════════════════════════════════

// ── ALUNOS ────────────────────────────────────────────────────────────────────

export async function fetchAlunos() {
  const { data, error } = await supabase
    .from('alunos')
    .select(`
      *,
      profiles (nome, email, perfil, ativo),
      leads (nome_completo, whatsapp)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

type AlunoRow = Database['public']['Tables']['alunos']['Row'];

export async function fetchAlunoLogado(profileId: string): Promise<AlunoRow | null> {
  const { data, error } = await supabase
    .from('alunos')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateAluno(id: string, updates: { fase_atual?: string; pontuacao_total?: number }) {
  const { data, error } = await supabase.from('alunos').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── SPRINTS ───────────────────────────────────────────────────────────────────

export async function fetchSprints() {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .order('ordem', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSprint(titulo: string, descricao?: string, ordem: number = 0) {
  const { data, error } = await supabase.from('sprints').insert({ titulo, descricao, ordem }).select().single();
  if (error) throw error;
  return data;
}

// ── SPRINT TAREFAS ────────────────────────────────────────────────────────────

export async function fetchSprintTarefas(alunoId: string) {
  const { data, error } = await supabase
    .from('sprint_tarefas')
    .select('*, sprints(titulo, ordem)')
    .eq('aluno_id', alunoId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSprintTarefa(tarefa: {
  sprint_id: string;
  aluno_id: string;
  titulo: string;
  xp_recompensa?: number;
  prazo?: string;
}) {
  const { data, error } = await supabase.from('sprint_tarefas').insert(tarefa).select().single();
  if (error) throw error;
  return data;
}

export async function marcarTarefaConcluida(tarefaId: string) {
  const { data, error } = await supabase
    .from('sprint_tarefas')
    .update({ concluida: true })
    .eq('id', tarefaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function aprovarTarefa(tarefaId: string, alunoId: string, xp: number) {
  const { error: err1 } = await supabase
    .from('sprint_tarefas')
    .update({ concluida: true, aprovada_por_equipe: true })
    .eq('id', tarefaId);
  if (err1) throw err1;

  const { data: aluno, error: err2 } = await supabase
    .from('alunos')
    .select('pontuacao_total')
    .eq('id', alunoId)
    .single();
  if (err2) throw err2;

  const { error: err3 } = await supabase
    .from('alunos')
    .update({ pontuacao_total: (aluno.pontuacao_total || 0) + xp })
    .eq('id', alunoId);
  if (err3) throw err3;
}

export async function rejeitarTarefa(tarefaId: string) {
  const { error } = await supabase
    .from('sprint_tarefas')
    .update({ concluida: false, aprovada_por_equipe: false })
    .eq('id', tarefaId);
  if (error) throw error;
}

// ── CHAT INTERNO ──────────────────────────────────────────────────────────────

export async function fetchChatInterno(alunoId: string) {
  const { data, error } = await supabase
    .from('mensagens_internas')
    .select('*, profiles(nome, perfil)')
    .eq('aluno_id', alunoId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function enviaMensagemInterna(aluno_id: string, remetente_id: string, mensagem: string) {
  const { data, error } = await supabase
    .from('mensagens_internas')
    .insert({ aluno_id, remetente_id, mensagem })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── MATERIAIS ─────────────────────────────────────────────────────────────────

export async function fetchMateriaisAluno(alunoId: string) {
  const { data, error } = await supabase
    .from('materiais')
    .select('*, sprints(titulo)')
    .or(`aluno_id.is.null,aluno_id.eq.${alunoId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchTodosMateriais() {
  const { data, error } = await supabase
    .from('materiais')
    .select('*, sprints(titulo), alunos(profiles(nome))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMaterial(material: MaterialInsert) {
  const { data, error } = await supabase.from('materiais').insert(material).select().single();
  if (error) throw error;
  return data;
}

export async function updateMaterial(id: string, updates: MaterialUpdate) {
  const { data, error } = await supabase.from('materiais').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMaterial(id: string) {
  const { error } = await supabase.from('materiais').delete().eq('id', id);
  if (error) throw error;
}

// ── EVENTOS ───────────────────────────────────────────────────────────────────

export type Evento = Database['public']['Tables']['eventos']['Row'];
export type EventoInsert = Database['public']['Tables']['eventos']['Insert'];

export async function fetchEventosAluno(alunoId: string) {
  const { data, error } = await db
    .from('eventos')
    .select('*, sprints(titulo)')
    .or(`aluno_id.is.null,aluno_id.eq.${alunoId}`)
    .gte('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Evento[];
}

export async function fetchTodosEventos() {
  const { data, error } = await db
    .from('eventos')
    .select('*, sprints(titulo), alunos(profiles(nome))')
    .order('data_hora', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Evento[];
}

export async function createEvento(evento: EventoInsert) {
  const { data, error } = await db.from('eventos').insert(evento).select().single();
  if (error) throw error;
  return data as Evento;
}

export async function deleteEvento(id: string) {
  const { error } = await db.from('eventos').delete().eq('id', id);
  if (error) throw error;
}

// ── SPRINTS: busca tarefas de todos os alunos (visão equipe) ──────────────────

export async function fetchTodasTarefasSprint(sprintId: string) {
  const { data, error } = await supabase
    .from('sprint_tarefas')
    .select('*, alunos(profiles(nome))')
    .eq('sprint_id', sprintId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function deleteSprint(id: string) {
  const { error } = await supabase.from('sprints').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteSprintTarefa(id: string) {
  const { error } = await supabase.from('sprint_tarefas').delete().eq('id', id);
  if (error) throw error;
}

// ── TAGS SISTEMA ──────────────────────────────────────────────────────────────

export type TagSistema = Database['public']['Tables']['tags_sistema']['Row'];
export type TagSistemaInsert = Database['public']['Tables']['tags_sistema']['Insert'];

export async function fetchTagsSistema() {
  const { data, error } = await db
    .from('tags_sistema')
    .select('*')
    .order('tipo')
    .order('nome');
  if (error) {
    console.warn('[fetchTagsSistema]', error.message);
    return [] as TagSistema[];
  }
  return (data ?? []) as TagSistema[];
}

export async function createTagSistema(tag: TagSistemaInsert) {
  const { data, error } = await db.from('tags_sistema').insert(tag).select().single();
  if (error) {
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      throw new Error(`Já existe uma tag com o nome "${tag.nome}".`);
    }
    throw error;
  }
  return data as TagSistema;
}

export async function deleteTagSistema(id: string) {
  const { error } = await db.from('tags_sistema').delete().eq('id', id);
  if (error) throw error;
}

// ── LEAD TAGS ─────────────────────────────────────────────────────────────────

export async function fetchLeadTags(leadId: string) {
  const { data, error } = await db
    .from('lead_tags')
    .select('tag_id, tags_sistema(id, nome, cor, tipo)')
    .eq('lead_id', leadId);
  if (error) throw error;
  return ((data ?? []) as any[]).map(r => r.tags_sistema as TagSistema).filter(Boolean);
}

export async function addLeadTag(leadId: string, tagId: string) {
  const { error } = await db.from('lead_tags').insert({ lead_id: leadId, tag_id: tagId });
  if (error && !String(error.message).includes('duplicate')) throw error;
}

export async function removeLeadTag(leadId: string, tagId: string) {
  const { error } = await db.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId);
  if (error) throw error;
}

// Returns a map of leadId → TagSistema[] for all leads (single query for the pipeline)
export async function fetchAllLeadTagsMap(): Promise<Record<string, TagSistema[]>> {
  const { data, error } = await db
    .from('lead_tags')
    .select('lead_id, tags_sistema(id, nome, cor, tipo)');
  if (error) {
    console.warn('[fetchAllLeadTagsMap]', error.message);
    return {};
  }
  const map: Record<string, TagSistema[]> = {};
  for (const row of (data ?? []) as any[]) {
    const tag = row.tags_sistema as TagSistema;
    if (!tag) continue;
    if (!map[row.lead_id]) map[row.lead_id] = [];
    map[row.lead_id].push(tag);
  }
  return map;
}
