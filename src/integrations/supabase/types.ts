export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string; created_at: string; updated_at: string; nome_completo: string
          whatsapp: string | null; email: string | null; cidade: string | null; estado: string | null
          eh_empresario: boolean | null; nome_empresa: string | null; instagram_empresa: string | null
          quantidade_funcionarios: number | null; maior_dor: string | null; faturamento_anual: number | null
          valor_acordado: number | null; capacidade_investimento: boolean | null; observacoes_iniciais: string | null
          status_pipeline: string; gestor_id: string | null; vendedor_id: string | null; prioridade: string
          fit_mentoria: number | null; probabilidade_fechamento: number | null; ultimo_contato: string | null
          proximo_followup: string | null; tags: string[] | null; observacoes_estrategicas: string | null; origem: string | null
        }
        Insert: {
          id?: string; created_at?: string; updated_at?: string; nome_completo: string
          whatsapp?: string | null; email?: string | null; cidade?: string | null; estado?: string | null
          eh_empresario?: boolean | null; nome_empresa?: string | null; instagram_empresa?: string | null
          quantidade_funcionarios?: number | null; maior_dor?: string | null; faturamento_anual?: number | null
          valor_acordado?: number | null; capacidade_investimento?: boolean | null; observacoes_iniciais?: string | null
          status_pipeline?: string; gestor_id?: string | null; vendedor_id?: string | null; prioridade?: string
          fit_mentoria?: number | null; probabilidade_fechamento?: number | null; ultimo_contato?: string | null
          proximo_followup?: string | null; tags?: string[] | null; observacoes_estrategicas?: string | null; origem?: string | null
        }
        Update: {
          id?: string; created_at?: string; updated_at?: string; nome_completo?: string
          whatsapp?: string | null; email?: string | null; cidade?: string | null; estado?: string | null
          eh_empresario?: boolean | null; nome_empresa?: string | null; instagram_empresa?: string | null
          quantidade_funcionarios?: number | null; maior_dor?: string | null; faturamento_anual?: number | null
          valor_acordado?: number | null; capacidade_investimento?: boolean | null; observacoes_iniciais?: string | null
          status_pipeline?: string; gestor_id?: string | null; vendedor_id?: string | null; prioridade?: string
          fit_mentoria?: number | null; probabilidade_fechamento?: number | null; ultimo_contato?: string | null
          proximo_followup?: string | null; tags?: string[] | null; observacoes_estrategicas?: string | null; origem?: string | null
        }
      }
      interacoes: {
        Row: { id: string; lead_id: string; created_at: string; tipo: string; realizado_por: string | null; resumo: string | null; objecoes: string | null; interesse_demonstrado: string | null; proximo_passo: string | null; data_proximo_followup: string | null }
        Insert: { id?: string; lead_id: string; created_at?: string; tipo: string; realizado_por?: string | null; resumo?: string | null; objecoes?: string | null; interesse_demonstrado?: string | null; proximo_passo?: string | null; data_proximo_followup?: string | null }
        Update: { id?: string; lead_id?: string; created_at?: string; tipo?: string; realizado_por?: string | null; resumo?: string | null; objecoes?: string | null; interesse_demonstrado?: string | null; proximo_passo?: string | null; data_proximo_followup?: string | null }
      }
      proximas_acoes: {
        Row: { id: string; lead_id: string; created_at: string; titulo: string; descricao: string | null; data_hora: string; tipo: string | null; responsavel_id: string | null; concluida: boolean | null }
        Insert: { id?: string; lead_id: string; created_at?: string; titulo: string; descricao?: string | null; data_hora: string; tipo?: string | null; responsavel_id?: string | null; concluida?: boolean | null }
        Update: { id?: string; lead_id?: string; created_at?: string; titulo?: string; descricao?: string | null; data_hora?: string; tipo?: string | null; responsavel_id?: string | null; concluida?: boolean | null }
      }
      profiles: {
        Row: { id: string; nome: string; email: string; perfil: string; ativo: boolean; created_at: string; updated_at: string }
        Insert: { id: string; nome: string; email: string; perfil?: string; ativo?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; nome?: string; email?: string; perfil?: string; ativo?: boolean; created_at?: string; updated_at?: string }
      }
      pipeline_logs: {
        Row: { id: string; lead_id: string; status_anterior: string | null; status_novo: string; alterado_por: string | null; alterado_em: string }
        Insert: { id?: string; lead_id: string; status_anterior?: string | null; status_novo: string; alterado_por?: string | null; alterado_em?: string }
        Update: { id?: string; lead_id?: string; status_anterior?: string | null; status_novo?: string; alterado_por?: string | null; alterado_em?: string }
      }
      notas_crm: {
        Row: { id: string; lead_id: string; user_id: string | null; conteudo: string; is_fixed: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; lead_id: string; user_id?: string | null; conteudo: string; is_fixed?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; lead_id?: string; user_id?: string | null; conteudo?: string; is_fixed?: boolean; created_at?: string; updated_at?: string }
      }
      zapi_config: {
        Row: { id: string; instance_id: string; token: string; client_token: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; instance_id: string; token: string; client_token?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; instance_id?: string; token?: string; client_token?: string | null; created_at?: string; updated_at?: string }
      }
      whatsapp_messages: {
        Row: { id: string; lead_id: string | null; message_id: string; phone: string; text_content: string | null; from_me: boolean; status: string; sender_name: string | null; timestamp: string; created_at: string }
        Insert: { id?: string; lead_id?: string | null; message_id: string; phone: string; text_content?: string | null; from_me?: boolean; status?: string; sender_name?: string | null; timestamp?: string; created_at?: string }
        Update: { id?: string; lead_id?: string | null; message_id?: string; phone?: string; text_content?: string | null; from_me?: boolean; status?: string; sender_name?: string | null; timestamp?: string; created_at?: string }
      }
      alunos: {
        Row: { id: string; created_at: string; lead_id: string | null; profile_id: string | null; fase_atual: string; pontuacao_total: number }
        Insert: { id?: string; created_at?: string; lead_id?: string | null; profile_id?: string | null; fase_atual: string; pontuacao_total?: number }
        Update: { id?: string; created_at?: string; lead_id?: string | null; profile_id?: string | null; fase_atual?: string; pontuacao_total?: number }
      }
      sprints: {
        Row: { id: string; created_at: string; titulo: string; descricao: string | null; ordem: number }
        Insert: { id?: string; created_at?: string; titulo: string; descricao?: string | null; ordem?: number }
        Update: { id?: string; created_at?: string; titulo?: string; descricao?: string | null; ordem?: number }
      }
      sprint_tarefas: {
        Row: { id: string; created_at: string; sprint_id: string; aluno_id: string; titulo: string; xp_recompensa: number; prazo: string | null; concluida: boolean; aprovada_por_equipe: boolean }
        Insert: { id?: string; created_at?: string; sprint_id: string; aluno_id: string; titulo: string; xp_recompensa?: number; prazo?: string | null; concluida?: boolean; aprovada_por_equipe?: boolean }
        Update: { id?: string; created_at?: string; sprint_id?: string; aluno_id?: string; titulo?: string; xp_recompensa?: number; prazo?: string | null; concluida?: boolean; aprovada_por_equipe?: boolean }
      }
      mensagens_internas: {
        Row: { id: string; created_at: string; aluno_id: string; remetente_id: string; mensagem: string }
        Insert: { id?: string; created_at?: string; aluno_id: string; remetente_id: string; mensagem: string }
        Update: { id?: string; created_at?: string; aluno_id?: string; remetente_id?: string; mensagem?: string }
      }
      materiais: {
        Row: { id: string; created_at: string; titulo: string; descricao: string | null; tipo: string; url: string; thumbnail_url: string | null; aluno_id: string | null; sprint_id: string | null; criado_por: string | null }
        Insert: { id?: string; created_at?: string; titulo: string; descricao?: string | null; tipo: string; url: string; thumbnail_url?: string | null; aluno_id?: string | null; sprint_id?: string | null; criado_por?: string | null }
        Update: { id?: string; created_at?: string; titulo?: string; descricao?: string | null; tipo?: string; url?: string; thumbnail_url?: string | null; aluno_id?: string | null; sprint_id?: string | null; criado_por?: string | null }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      app_role: 'admin' | 'gestor' | 'vendedor' | 'aluno' | 'operacional'
      pipeline_status: 'novo_lead' | 'contato_instagram' | 'contato_whatsapp' | 'tentativa_contato' | 'contato_realizado' | 'reuniao_agendada' | 'reuniao_realizada' | 'followup' | 'negociacao' | 'fechado' | 'perdido'
      prioridade_type: 'alta' | 'media' | 'baixa'
      tipo_interacao: 'whatsapp' | 'ligacao' | 'reuniao' | 'email'
      interesse_type: 'baixo' | 'medio' | 'alto'
    }
  }
}
