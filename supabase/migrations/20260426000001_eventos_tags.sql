-- =====================================================
-- EVENTOS, TAGS DO SISTEMA E TAGS DE LEAD
-- =====================================================

-- 1. Tabela Eventos (reuniões, checkpoints, aulas)
CREATE TABLE IF NOT EXISTS public.eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  data_hora   TIMESTAMPTZ NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'evento'
              CHECK (tipo IN ('reuniao', 'evento', 'checkpoint', 'aula', 'entrega')),
  aluno_id    UUID REFERENCES public.alunos(id) ON DELETE CASCADE, -- NULL = todos
  sprint_id   UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  criado_por  UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_authenticated" ON public.eventos;
CREATE POLICY "eventos_authenticated" ON public.eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Tabela Tags do Sistema (catálogo: produto, vendedor, custom)
CREATE TABLE IF NOT EXISTS public.tags_sistema (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome       TEXT NOT NULL UNIQUE,
  cor        TEXT NOT NULL DEFAULT '#6b7280',
  tipo       TEXT NOT NULL DEFAULT 'custom'
             CHECK (tipo IN ('produto', 'vendedor', 'custom'))
);
ALTER TABLE public.tags_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_sistema_authenticated" ON public.tags_sistema;
CREATE POLICY "tags_sistema_authenticated" ON public.tags_sistema
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabela Lead Tags (vínculo N:N entre leads e tags)
CREATE TABLE IF NOT EXISTS public.lead_tags (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.tags_sistema(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_tags_authenticated" ON public.lead_tags;
CREATE POLICY "lead_tags_authenticated" ON public.lead_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Tags padrão de produto (podem ser editadas/expandidas pelo admin)
INSERT INTO public.tags_sistema (nome, cor, tipo) VALUES
  ('3C',           '#f59e0b', 'produto'),
  ('3C Avançado',  '#f97316', 'produto'),
  ('Mentoria 1 Ano','#8b5cf6', 'produto'),
  ('1 Imersão',    '#06b6d4', 'produto')
ON CONFLICT (nome) DO NOTHING;
