-- =====================================================================
-- EXECUTAR TUDO NO SUPABASE → SQL EDITOR → COLE TUDO → RUN
-- Seguro para re-executar (idempotente). Última versão: 2026-04-26
-- =====================================================================

-- ── 0. Roles no enum ─────────────────────────────────────────────────
DO $$ BEGIN
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacional'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aluno';       EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ── 1. Alunos ─────────────────────────────────────────────────────────
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

-- ── 2. Sprints ────────────────────────────────────────────────────────
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

-- ── 3. Sprint Tarefas ─────────────────────────────────────────────────
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

-- ── 4. Mensagens Internas ─────────────────────────────────────────────
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensagens_internas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_internas;
  END IF;
END $$;

-- ── 5. Materiais ──────────────────────────────────────────────────────
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

-- ── 6. Eventos ────────────────────────────────────────────────────────
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

-- ── 7. Tags do Sistema ────────────────────────────────────────────────
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

INSERT INTO public.tags_sistema (nome, cor, tipo) VALUES
  ('3C',            '#f59e0b', 'produto'),
  ('3C Avançado',   '#f97316', 'produto'),
  ('Mentoria 1 Ano','#8b5cf6', 'produto'),
  ('1 Imersão',     '#06b6d4', 'produto')
ON CONFLICT (nome) DO NOTHING;

-- ── 8. Lead Tags (N:N) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_tags (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.tags_sistema(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_tags_authenticated" ON public.lead_tags;
CREATE POLICY "lead_tags_authenticated" ON public.lead_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 9. Política INSERT na tabela profiles ─────────────────────────────
-- Necessário para o upsert manual durante a matrícula de alunos
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
CREATE POLICY "Admin can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor', 'operacional'));

-- ── 10. Função confirm_user_signup ────────────────────────────────────
-- Permite que admin matricule aluno sem precisar de confirmação de email
CREATE OR REPLACE FUNCTION public.confirm_user_signup(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND perfil IN ('admin', 'gestor', 'operacional')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar usuários.';
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_user_signup(uuid) TO authenticated;

-- ── 11. Confirmar todos os usuários já cadastrados ─────────────────────
-- CRÍTICO: corrige alunos que foram matriculados antes da função existir
-- e por isso não conseguem fazer login ("Email not confirmed")
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- ── 12. Trigger handle_new_user robusto ───────────────────────────────
-- Garante que o perfil é criado mesmo se o cast de perfil falhar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_perfil public.app_role;
BEGIN
  BEGIN
    v_perfil := COALESCE((NEW.raw_user_meta_data->>'perfil')::public.app_role, 'vendedor');
  EXCEPTION WHEN invalid_text_representation THEN
    v_perfil := 'vendedor';
  END;

  INSERT INTO public.profiles (id, nome, email, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    v_perfil
  )
  ON CONFLICT (id) DO UPDATE SET
    nome  = EXCLUDED.nome,
    email = EXCLUDED.email,
    perfil = EXCLUDED.perfil;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_perfil)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recria o trigger (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 13. Novos campos em leads ─────────────────────────────────────────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS nicho           TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reuniao_agendada BOOLEAN DEFAULT FALSE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lista_origem    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_acordado  NUMERIC(15, 2);

-- =====================================================================
-- FEITO! Agora o sistema está pronto para uso.
-- =====================================================================
