export type PipelineStatus =
  | 'novo_lead'
  | 'tentativa_contato'
  | 'contato_realizado'
  | 'reuniao_agendada'
  | 'reuniao_realizada'
  | 'followup'
  | 'negociacao'
  | 'fechado'
  | 'perdido';

export type Prioridade = 'alta' | 'media' | 'baixa';
export type Perfil = 'admin' | 'gestor' | 'vendedor';
export type TipoInteracao = 'whatsapp' | 'ligacao' | 'reuniao' | 'email';
export type InteresseDemonstrado = 'baixo' | 'medio' | 'alto';

export interface Lead {
  id: string;
  created_at: string;
  nome_completo: string;
  whatsapp: string;
  email: string;
  cidade: string;
  estado: string;
  eh_empresario: boolean;
  nome_empresa: string;
  instagram_empresa: string;
  quantidade_funcionarios: number;
  maior_dor: string;
  faturamento_anual: number;
  capacidade_investimento: boolean;
  observacoes_iniciais: string;
  status_pipeline: PipelineStatus;
  gestor_id: string | null;
  vendedor_id: string | null;
  prioridade: Prioridade;
  fit_mentoria: number;
  probabilidade_fechamento: number;
  ultimo_contato: string | null;
  proximo_followup: string | null;
  tags: string[];
  observacoes_estrategicas: string;
  origem: string;
}

export interface Interacao {
  id: string;
  created_at: string;
  lead_id: string;
  tipo: TipoInteracao;
  realizado_por: string;
  resumo: string;
  objecoes: string;
  interesse_demonstrado: InteresseDemonstrado;
  proximo_passo: string;
  data_proximo_followup: string | null;
}

export interface ProximaAcao {
  id: string;
  lead_id: string;
  titulo: string;
  descricao: string;
  data_hora: string;
  tipo: string;
  responsavel_id: string;
  concluida: boolean;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}

export interface PipelineLog {
  id: string;
  lead_id: string;
  status_anterior: string;
  status_novo: string;
  alterado_por: string;
  alterado_em: string;
}

export const PIPELINE_COLUMNS: { key: PipelineStatus; label: string; color: string }[] = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'hsl(213, 94%, 68%)' },
  { key: 'tentativa_contato', label: 'Tentativa de Contato', color: 'hsl(0, 0%, 60%)' },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'hsl(27, 96%, 61%)' },
  { key: 'reuniao_agendada', label: 'Reunião Agendada', color: 'hsl(46, 65%, 52%)' },
  { key: 'reuniao_realizada', label: 'Reunião Realizada', color: 'hsl(46, 65%, 52%)' },
  { key: 'followup', label: 'Follow-up', color: 'hsl(27, 96%, 61%)' },
  { key: 'negociacao', label: 'Negociação', color: 'hsl(213, 94%, 68%)' },
  { key: 'fechado', label: 'Fechado ✅', color: 'hsl(142, 69%, 58%)' },
  { key: 'perdido', label: 'Perdido ❌', color: 'hsl(0, 68%, 62%)' },
];

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  novo_lead: 'Novo Lead',
  tentativa_contato: 'Tentativa de Contato',
  contato_realizado: 'Contato Realizado',
  reuniao_agendada: 'Reunião Agendada',
  reuniao_realizada: 'Reunião Realizada',
  followup: 'Follow-up',
  negociacao: 'Negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

export function isLeadQuente(lead: Lead): boolean {
  return (
    lead.eh_empresario &&
    lead.faturamento_anual > 500000 &&
    lead.capacidade_investimento &&
    lead.fit_mentoria >= 4
  );
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
