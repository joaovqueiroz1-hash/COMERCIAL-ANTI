-- =====================================================================
-- ABA CRIATIVA — bloco de anotações por aluno (refs, docs, links)
-- Compartilhado entre aluno e equipe; cada anotação guarda autor + data.
-- Apagar: autor OU equipe. Depende dos helpers de 20260601000000.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.notas_criativas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id   UUID        NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  autor_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  conteudo   TEXT        NOT NULL,
  tipo       TEXT        NOT NULL DEFAULT 'nota' CHECK (tipo IN ('nota','link')),
  url        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notas_criativas ENABLE ROW LEVEL SECURITY;

-- SELECT: equipe vê tudo; aluno vê só o próprio quadro
DROP POLICY IF EXISTS "notas_criativas_sel" ON public.notas_criativas;
CREATE POLICY "notas_criativas_sel" ON public.notas_criativas FOR SELECT TO authenticated
  USING (public.is_equipe() OR aluno_id = public.current_aluno_id());

-- INSERT: equipe em qualquer quadro; aluno só no próprio e como ele mesmo
DROP POLICY IF EXISTS "notas_criativas_ins" ON public.notas_criativas;
CREATE POLICY "notas_criativas_ins" ON public.notas_criativas FOR INSERT TO authenticated
  WITH CHECK (
    public.is_equipe()
    OR (aluno_id = public.current_aluno_id() AND autor_id = auth.uid())
  );

-- DELETE: autor da anotação ou equipe
DROP POLICY IF EXISTS "notas_criativas_del" ON public.notas_criativas;
CREATE POLICY "notas_criativas_del" ON public.notas_criativas FOR DELETE TO authenticated
  USING (public.is_equipe() OR autor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notas_criativas_aluno   ON public.notas_criativas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_notas_criativas_created ON public.notas_criativas(created_at);

-- Realtime (mesmo padrão de mensagens_internas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notas_criativas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notas_criativas;
  END IF;
END $$;
