-- =====================================================================
-- RODAR ESTE SQL NO SUPABASE → SQL EDITOR → COLE TUDO → RUN
-- Cria: alunos, sprints, sprint_tarefas, mensagens_internas, materiais,
--        eventos, tags_sistema, lead_tags
-- =====================================================================

-- 0. Enum app_role (adiciona aluno e operacional se não existir)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'vendedor', 'operacional', 'aluno');
  ELSE
    BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacional'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aluno';       EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- 1. Alunos
CREATE TABLE IF NOT EXISTS public.alunos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id          UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  profile_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  fase_atual       TEXT NOT NULL DEFAULT 'Onboarding',
  pontuacao_total  INTEGER NOT NULL DEFAULT 0,
  ativo            BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alunos_authenticated" ON public.alunos;
CREATE POLICY "alunos_authenticated" ON public.alunos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Sprints
CREATE TABLE IF NOT EXISTS public.sprints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo     TEXT NOT NULL,
  descricao  TEXT,
  ordem      INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sprints_authenticated" ON public.sprints;
CREATE POLICY "sprints_authenticated" ON public.sprints
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Sprint Tarefas
CREATE TABLE IF NOT EXISTS public.sprint_tarefas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sprint_id           UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  aluno_id            UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo              TEXT NOT NULL,
  descricao           TEXT,
  xp_recompensa       INTEGER NOT NULL DEFAULT 50,
  concluida           BOOLEAN NOT NULL DEFAULT false,
  aprovada_por_equipe BOOLEAN NOT NULL DEFAULT false,
  prazo               TIMESTAMPTZ
);
ALTER TABLE public.sprint_tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sprint_tarefas_authenticated" ON public.sprint_tarefas;
CREATE POLICY "sprint_tarefas_authenticated" ON public.sprint_tarefas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Mensagens Internas
CREATE TABLE IF NOT EXISTS public.mensagens_internas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  aluno_id     UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mensagem     TEXT NOT NULL
);
ALTER TABLE public.mensagens_internas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mensagens_internas_authenticated" ON public.mensagens_internas;
CREATE POLICY "mensagens_internas_authenticated" ON public.mensagens_internas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime para mensagens
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensagens_internas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_internas;
  END IF;
END $$;

-- 5. Materiais
CREATE TABLE IF NOT EXISTS public.materiais (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo     TEXT NOT NULL,
  descricao  TEXT,
  tipo       TEXT NOT NULL DEFAULT 'link'
             CHECK (tipo IN ('video', 'pdf', 'documento', 'link')),
  url        TEXT NOT NULL,
  aluno_id   UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  sprint_id  UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materiais_authenticated" ON public.materiais;
CREATE POLICY "materiais_authenticated" ON public.materiais
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Eventos
CREATE TABLE IF NOT EXISTS public.eventos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  titulo     TEXT NOT NULL,
  descricao  TEXT,
  data_hora  TIMESTAMPTZ NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'evento'
             CHECK (tipo IN ('reuniao', 'evento', 'checkpoint', 'aula', 'entrega')),
  aluno_id   UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  sprint_id  UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_authenticated" ON public.eventos;
CREATE POLICY "eventos_authenticated" ON public.eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Tags do Sistema
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

-- Tags padrão de produto
INSERT INTO public.tags_sistema (nome, cor, tipo) VALUES
  ('3C',            '#f59e0b', 'produto'),
  ('3C Avançado',   '#f97316', 'produto'),
  ('Mentoria 1 Ano','#8b5cf6', 'produto'),
  ('1 Imersão',     '#06b6d4', 'produto')
ON CONFLICT (nome) DO NOTHING;

-- 8. Lead Tags (N:N)
CREATE TABLE IF NOT EXISTS public.lead_tags (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.tags_sistema(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_tags_authenticated" ON public.lead_tags;
CREATE POLICY "lead_tags_authenticated" ON public.lead_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- FEITO! Agora pode fechar esta janela.
-- =====================================================================
