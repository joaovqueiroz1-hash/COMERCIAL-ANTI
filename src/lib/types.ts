export type PipelineStatus =
  | 'entrada_lead'
  | 'tentativa_contato'
  | 'em_atendimento'
  | 'reuniao_agendada'
  | 'reuniao_realizada'
  | 'negociacao'
  | 'followup'
  | 'vendido'
  | 'perdido'
  | 'congelado'
  // legado — mantidos para dados históricos
  | 'novo_lead'
  | 'contato_instagram'
  | 'contato_whatsapp'
  | 'contato_realizado'
  | 'fechado';

export type Prioridade = 'alta' | 'media' | 'baixa';
export type Perfil = 'admin' | 'gestor' | 'vendedor';
export type TipoInteracao = 'whatsapp' | 'ligacao' | 'reuniao' | 'email';
export type InteresseDemonstrado = 'baixo' | 'medio' | 'alto';

export const MOTIVOS_PERDA = [
  'Sem recursos financeiros',
  'Sem contato',
  'Sócio não aprovou',
  'No-show',
  'Escolheu concorrente',
  'Não é o momento certo',
  'Não atende ao perfil',
  'Outro',
] as const;

export type MotivoPerdaType = typeof MOTIVOS_PERDA[number];

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
  // Novos campos
  nicho: string | null;
  reuniao_agendada: boolean | null;
  motivo_perda: string | null;
  lista_origem: string | null;
  valor_acordado: number | null;
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
  { key: 'entrada_lead',      label: 'Entrada de Lead',      color: 'hsl(50,9%,72%)' },
  { key: 'tentativa_contato', label: 'Tentativa de Contato', color: 'hsl(50,7%,68%)' },
  { key: 'em_atendimento',    label: 'Em Atendimento',       color: 'hsl(50,7%,64%)' },
  { key: 'reuniao_agendada',  label: 'Reunião Agendada',     color: 'hsl(29,16%,48%)' },
  { key: 'reuniao_realizada', label: 'Reunião Realizada',    color: 'hsl(29,16%,44%)' },
  { key: 'negociacao',        label: 'Negociação',           color: 'hsl(29,16%,40%)' },
  { key: 'followup',          label: 'Follow-Up',            color: 'hsl(23,4%,49%)' },
  { key: 'vendido',           label: 'Vendido',              color: 'hsl(29,16%,33%)' },
  { key: 'perdido',           label: 'Perdido',              color: 'hsl(0,0%,35%)' },
  { key: 'congelado',         label: 'Congelado',            color: 'hsl(0,0%,50%)' },
];

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  entrada_lead:      'Entrada de Lead',
  tentativa_contato: 'Tentativa de Contato',
  em_atendimento:    'Em Atendimento',
  reuniao_agendada:  'Reunião Agendada',
  reuniao_realizada: 'Reunião Realizada',
  negociacao:        'Negociação',
  followup:          'Follow-Up',
  vendido:           'Vendido',
  perdido:           'Perdido',
  congelado:         'Congelado',
  // legado
  novo_lead:         'Novo Lead',
  contato_instagram: 'Contato Instagram',
  contato_whatsapp:  'Contato WhatsApp',
  contato_realizado: 'Contato Realizado',
  fechado:           'Fechado',
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
