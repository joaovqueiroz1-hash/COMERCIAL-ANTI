-- ── 1. Adicionar status 'congelado' (TEXT column, não enum) ──────────────────
-- Move todos os leads em novo_lead para congelado
UPDATE public.leads
SET status_pipeline = 'congelado'
WHERE status_pipeline = 'novo_lead';

-- ── 2. Tabela metas ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.metas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  tipo        TEXT NOT NULL DEFAULT 'receita', -- receita | fechamentos | reunioes | leads
  valor_meta  NUMERIC(15, 2) NOT NULL DEFAULT 0,
  data_inicio DATE,
  data_fim    DATE,
  criado_por  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_authenticated" ON public.metas;
CREATE POLICY "metas_authenticated" ON public.metas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
