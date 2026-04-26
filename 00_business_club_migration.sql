-- ==========================================
-- BUSINES CLUB: MENTORING PORTAL MIGRATION
-- ==========================================

-- 1. Atualizar o Perfil (Enum)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'aluno';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'operacional';

-- 2. Tabela de Alunos (Vinculada ao Lead que virou cliente e ao Profile de Login)
CREATE TABLE IF NOT EXISTS public.alunos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    fase_atual TEXT DEFAULT 'Onboarding',
    pontuacao_total INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de Sprints (O "Esqueleto" das Trilhas/Classes)
CREATE TABLE IF NOT EXISTS public.sprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de Tarefas dos Alunos (Validação + Gamificação)
CREATE TABLE IF NOT EXISTS public.sprint_tarefas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sprint_id UUID REFERENCES public.sprints(id) ON DELETE CASCADE,
    aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    xp_recompensa INTEGER DEFAULT 10,
    concluida BOOLEAN DEFAULT false,
    aprovada_por_equipe BOOLEAN DEFAULT false,
    prazo TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Tabela do Chat Interno (Comunicação Individual: Time <-> Aluno)
CREATE TABLE IF NOT EXISTS public.mensagens_internas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
    remetente_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Quem enviou (pode ser o aluno, ou um operacional)
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Liberação de RLS para desenvolvimento rápido focado (opcional, ajustável dps)
ALTER TABLE public.alunos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_tarefas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_internas DISABLE ROW LEVEL SECURITY;

-- 7. Avisar o Supabase para disparar mudanças no Chat Interno para dar tempo real!
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mensagens_internas'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_internas;
    END IF;
  END
  $$;
COMMIT;
