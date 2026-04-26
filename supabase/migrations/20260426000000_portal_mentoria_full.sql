-- =====================================================
-- PORTAL MENTORIA COMPLETO
-- Roles + Tabelas: alunos, sprints, sprint_tarefas,
-- mensagens_internas, materiais
-- =====================================================

-- 1. Adiciona roles faltantes ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aluno';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacional';

-- 2. Tabela Alunos (mentorados vinculados a um lead + profile)
CREATE TABLE IF NOT EXISTS public.alunos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  profile_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  fase_atual    TEXT NOT NULL DEFAULT 'Onboarding',
  pontuacao_total INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alunos_authenticated" ON public.alunos;
CREATE POLICY "alunos_authenticated" ON public.alunos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabela Sprints (módulos do programa de mentoria)
CREATE TABLE IF NOT EXISTS public.sprints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sprints_authenticated" ON public.sprints;
CREATE POLICY "sprints_authenticated" ON public.sprints FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Tabela Sprint Tarefas (metas alocadas por aluno em cada sprint)
CREATE TABLE IF NOT EXISTS public.sprint_tarefas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sprint_id           UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  aluno_id            UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo              TEXT NOT NULL,
  xp_recompensa       INTEGER NOT NULL DEFAULT 50,
  prazo               TIMESTAMPTZ,
  concluida           BOOLEAN NOT NULL DEFAULT false,
  aprovada_por_equipe BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.sprint_tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sprint_tarefas_authenticated" ON public.sprint_tarefas;
CREATE POLICY "sprint_tarefas_authenticated" ON public.sprint_tarefas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Tabela Mensagens Internas (chat 1-a-1 aluno ↔ equipe)
CREATE TABLE IF NOT EXISTS public.mensagens_internas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  aluno_id      UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  remetente_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mensagem      TEXT NOT NULL
);
ALTER TABLE public.mensagens_internas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mensagens_internas_authenticated" ON public.mensagens_internas;
CREATE POLICY "mensagens_internas_authenticated" ON public.mensagens_internas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Tabela Materiais (biblioteca de conteúdo: vídeos, PDFs, docs, links)
CREATE TABLE IF NOT EXISTS public.materiais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  tipo          TEXT NOT NULL CHECK (tipo IN ('video', 'pdf', 'documento', 'link')),
  url           TEXT NOT NULL,
  thumbnail_url TEXT,
  aluno_id      UUID REFERENCES public.alunos(id) ON DELETE CASCADE, -- NULL = global (todos os alunos)
  sprint_id     UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  criado_por    UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materiais_authenticated" ON public.materiais;
CREATE POLICY "materiais_authenticated" ON public.materiais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Realtime para mensagens_internas (protegido contra duplicata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensagens_internas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_internas;
  END IF;
END $$;
