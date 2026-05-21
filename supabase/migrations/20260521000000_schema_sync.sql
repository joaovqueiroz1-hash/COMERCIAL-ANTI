-- =====================================================
-- SCHEMA SYNC — colunas e tabela faltantes
-- Alinha o banco com tudo que o código já usa.
-- Todas as operações são idempotentes (ADD COLUMN IF NOT EXISTS).
-- =====================================================

-- ── 1. leads ─────────────────────────────────────────
-- data_fechamento: preenchida automaticamente ao fechar/vender um lead
-- arquivado: flag para esconder leads antigos sem excluí-los
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado       BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_arquivado ON public.leads(arquivado);

-- ── 2. sprints ────────────────────────────────────────
-- aluno_id NULL = template global; non-null = sprint personalizado do aluno
ALTER TABLE public.sprints
  ADD COLUMN IF NOT EXISTS aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sprints_aluno_id ON public.sprints(aluno_id);

-- ── 3. sprint_tarefas ─────────────────────────────────
ALTER TABLE public.sprint_tarefas
  ADD COLUMN IF NOT EXISTS responsavel_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_entrega     TEXT,
  ADD COLUMN IF NOT EXISTS descricao_equipe TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_url      TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_nome     TEXT,
  ADD COLUMN IF NOT EXISTS link_externo     TEXT;

CREATE INDEX IF NOT EXISTS idx_sprint_tarefas_responsavel_id ON public.sprint_tarefas(responsavel_id);

-- ── 4. alunos ─────────────────────────────────────────
-- Campos de prêmio/meta de XP exibidos no portal do aluno
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS premio_titulo    TEXT,
  ADD COLUMN IF NOT EXISTS premio_descricao TEXT,
  ADD COLUMN IF NOT EXISTS premio_xp_meta  INTEGER;

CREATE INDEX IF NOT EXISTS idx_alunos_lead_id ON public.alunos(lead_id);

-- ── 5. materiais ──────────────────────────────────────
-- pasta: agrupamento visual de materiais na biblioteca
ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS pasta TEXT;

CREATE INDEX IF NOT EXISTS idx_materiais_pasta    ON public.materiais(pasta);
CREATE INDEX IF NOT EXISTS idx_materiais_aluno_id ON public.materiais(aluno_id);

-- ── 6. eventos ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_eventos_aluno_id  ON public.eventos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_eventos_data_hora ON public.eventos(data_hora);

-- ── 7. diagnosticos (tabela nova) ─────────────────────
-- Um diagnóstico por aluno; upsert usa onConflict: 'aluno_id'
CREATE TABLE IF NOT EXISTS public.diagnosticos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      UUID        NOT NULL UNIQUE REFERENCES public.alunos(id) ON DELETE CASCADE,
  dados         JSONB       NOT NULL DEFAULT '{}',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diagnosticos_authenticated" ON public.diagnosticos;
CREATE POLICY "diagnosticos_authenticated" ON public.diagnosticos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_aluno_id ON public.diagnosticos(aluno_id);
