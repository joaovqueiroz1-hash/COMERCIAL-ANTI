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
          id: string
          created_at: string
          updated_at: string
          nome_completo: string
          whatsapp: string | null
          email: string | null
          cidade: string | null
          estado: string | null
          eh_empresario: boolean | null
          nome_empresa: string | null
          instagram_empresa: string | null
          quantidade_funcionarios: number | null
          maior_dor: string | null
          faturamento_anual: number | null
          valor_acordado: number | null
          capacidade_investimento: boolean | null
          observacoes_iniciais: string | null
          status_pipeline: string
          gestor_id: string | null
          vendedor_id: string | null
          prioridade: string
          fit_mentoria: number | null
          probabilidade_fechamento: number | null
          ultimo_contato: string | null
          proximo_followup: string | null
          tags: string[] | null
          observacoes_estrategicas: string | null
          origem: string | null
        }
        Insert: Partial<Database['public']['Tables']['leads']['Row']> & { nome_completo: string }
        Update: Partial<Database['public']['Tables']['leads']['Row']>
      }
      interacoes: {
        Row: { id: string; lead_id: string; created_at: string; tipo: string; realizado_por: string | null; resumo: string | null; objecoes: string | null; interesse_demonstrado: string | null; proximo_passo: string | null; data_proximo_followup: string | null }
        Insert: Partial<Database['public']['Tables']['interacoes']['Row']> & { lead_id: string; tipo: string }
        Update: Partial<Database['public']['Tables']['interacoes']['Row']>
      }
      proximas_acoes: {
        Row: { id: string; lead_id: string; created_at: string; titulo: string; descricao: string | null; data_hora: string; tipo: string | null; responsavel_id: string | null; concluida: boolean | null }
        Insert: Partial<Database['public']['Tables']['proximas_acoes']['Row']> & { lead_id: string; titulo: string; data_hora: string }
        Update: Partial<Database['public']['Tables']['proximas_acoes']['Row']>
      }
      profiles: {
        Row: { id: string; nome: string; email: string; perfil: string; ativo: boolean; created_at: string; updated_at: string }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; nome: string; email: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      pipeline_logs: {
        Row: { id: string; lead_id: string; status_anterior: string | null; status_novo: string; alterado_por: string | null; alterado_em: string }
        Insert: Partial<Database['public']['Tables']['pipeline_logs']['Row']> & { lead_id: string; status_novo: string }
        Update: Partial<Database['public']['Tables']['pipeline_logs']['Row']>
      }
      notas_crm: {
        Row: { id: string; lead_id: string; user_id: string | null; conteudo: string; is_fixed: boolean; created_at: string; updated_at: string }
        Insert: Partial<Database['public']['Tables']['notas_crm']['Row']> & { lead_id: string; conteudo: string }
        Update: Partial<Database['public']['Tables']['notas_crm']['Row']>
      }
      zapi_config: {
        Row: { id: string; instance_id: string; token: string; client_token: string | null; created_at: string; updated_at: string }
        Insert: Partial<Database['public']['Tables']['zapi_config']['Row']> & { instance_id: string; token: string }
        Update: Partial<Database['public']['Tables']['zapi_config']['Row']>
      }
      whatsapp_messages: {
        Row: {
          id: string
          lead_id: string | null
          message_id: string
          phone: string
          text_content: string | null
          from_me: boolean
          status: string
          sender_name: string | null
          timestamp: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['whatsapp_messages']['Row']> & { message_id: string; phone: string }
        Update: Partial<Database['public']['Tables']['whatsapp_messages']['Row']>
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
