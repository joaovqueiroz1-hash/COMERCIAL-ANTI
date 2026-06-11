-- =====================================================================
-- ENTREGAS DE TAREFA COM HISTÓRICO (append-only)
-- Antes a entrega do aluno era um campo único (sprint_tarefas.link_entrega):
-- sem histórico, sem arquivo, e o aluno perdia acesso após enviar.
-- Agora cada entrega (link ou arquivo) vira uma linha imutável em
-- tarefa_entregas. "Trocar" = acrescentar nova versão; nada se perde.
-- link_entrega segue preenchido com a última URL (compat com telas antigas).
-- Depende dos helpers is_equipe()/current_aluno_id() de 20260601000000.
-- Idempotente: pode rodar de novo sem erro.
-- =====================================================================

-- ── 1. TABELA ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarefa_entregas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id      UUID        NOT NULL REFERENCES public.sprint_tarefas(id) ON DELETE CASCADE,
  autor_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  tipo           TEXT        NOT NULL DEFAULT 'link' CHECK (tipo IN ('link','arquivo')),
  url            TEXT        NOT NULL,
  nome           TEXT,
  observacao     TEXT,
  apos_aprovacao BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefa_entregas_tarefa  ON public.tarefa_entregas(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tarefa_entregas_created ON public.tarefa_entregas(created_at);

ALTER TABLE public.tarefa_entregas ENABLE ROW LEVEL SECURITY;

-- SELECT: equipe vê tudo; aluno vê as entregas das próprias tarefas
DROP POLICY IF EXISTS "tarefa_entregas_sel" ON public.tarefa_entregas;
CREATE POLICY "tarefa_entregas_sel" ON public.tarefa_entregas FOR SELECT TO authenticated
  USING (
    public.is_equipe()
    OR EXISTS (
      SELECT 1 FROM public.sprint_tarefas st
      WHERE st.id = tarefa_id AND st.aluno_id = public.current_aluno_id()
    )
  );

-- INSERT: equipe em qualquer tarefa; aluno só na própria e como ele mesmo
DROP POLICY IF EXISTS "tarefa_entregas_ins" ON public.tarefa_entregas;
CREATE POLICY "tarefa_entregas_ins" ON public.tarefa_entregas FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      public.is_equipe()
      OR EXISTS (
        SELECT 1 FROM public.sprint_tarefas st
        WHERE st.id = tarefa_id AND st.aluno_id = public.current_aluno_id()
      )
    )
  );

-- Sem policy de UPDATE/DELETE: histórico é imutável para todos via API.

-- ── 2. RPC: aluno registra entrega ───────────────────────────────────
-- O aluno não tem UPDATE em sprint_tarefas (RLS). Esta função:
--   • valida que a tarefa é dele;
--   • marca concluida e atualiza link_entrega (última URL, p/ compat);
--   • insere a entrega no histórico (se houver url);
--   • marca apos_aprovacao quando a tarefa já tinha sido aprovada.
CREATE OR REPLACE FUNCTION public.aluno_registrar_entrega(
  p_tarefa_id  uuid,
  p_url        text DEFAULT NULL,
  p_nome       text DEFAULT NULL,
  p_tipo       text DEFAULT 'link',
  p_observacao text DEFAULT NULL
)
RETURNS SETOF public.tarefa_entregas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_aluno    uuid;
  v_aprovada boolean;
BEGIN
  v_aluno := public.current_aluno_id();
  IF v_aluno IS NULL THEN
    RAISE EXCEPTION 'Sem vínculo de aluno.';
  END IF;

  SELECT aprovada_por_equipe INTO v_aprovada
  FROM public.sprint_tarefas
  WHERE id = p_tarefa_id AND aluno_id = v_aluno;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada para este aluno.';
  END IF;

  IF p_tipo NOT IN ('link','arquivo') THEN
    RAISE EXCEPTION 'Tipo de entrega inválido.';
  END IF;

  UPDATE public.sprint_tarefas
  SET concluida = true,
      link_entrega = COALESCE(p_url, link_entrega)
  WHERE id = p_tarefa_id;

  IF p_url IS NOT NULL THEN
    RETURN QUERY
    INSERT INTO public.tarefa_entregas (tarefa_id, autor_id, tipo, url, nome, observacao, apos_aprovacao)
    VALUES (p_tarefa_id, auth.uid(), p_tipo, p_url, p_nome, p_observacao, v_aprovada)
    RETURNING *;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.aluno_registrar_entrega(uuid, text, text, text, text) TO authenticated;

-- ── 3. BACKFILL: link_entrega existente vira a 1ª versão do histórico ─
INSERT INTO public.tarefa_entregas (tarefa_id, autor_id, tipo, url, observacao)
SELECT st.id, a.profile_id, 'link', st.link_entrega, 'Entrega registrada antes do histórico.'
FROM public.sprint_tarefas st
JOIN public.alunos a ON a.id = st.aluno_id
WHERE st.link_entrega IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.tarefa_entregas te WHERE te.tarefa_id = st.id);

-- ── 4. STORAGE: bucket "entregas" (upload de arquivo pelo aluno) ─────
-- Caminho: <aluno_id>/<nome aleatório>. Aluno só insere na própria pasta;
-- ninguém atualiza/deleta via API (histórico imutável). Leitura pública
-- (mesmo modelo do bucket materiais; URLs não-adivinháveis).
INSERT INTO storage.buckets (id, name, public)
VALUES ('entregas', 'entregas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura pública de entregas" ON storage.objects;
CREATE POLICY "Leitura pública de entregas"
ON storage.objects FOR SELECT
USING ( bucket_id = 'entregas' );

DROP POLICY IF EXISTS "Upload de entregas" ON storage.objects;
CREATE POLICY "Upload de entregas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'entregas'
  AND (
    public.is_equipe()
    OR (storage.foldername(name))[1] = public.current_aluno_id()::text
  )
);
-- Sem policy de UPDATE/DELETE no bucket entregas: arquivos imutáveis.

-- ── 5. HARDENING: bucket "materiais" — delete/update só para equipe ──
-- Antes qualquer autenticado (inclusive aluno) podia apagar/sobrescrever
-- arquivos da equipe. O app nunca chama delete/update de storage, então
-- restringir à equipe não quebra nada.
DROP POLICY IF EXISTS "Delete de materiais para autenticados" ON storage.objects;
CREATE POLICY "Delete de materiais para autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'materiais' AND public.is_equipe() );

DROP POLICY IF EXISTS "Update de materiais para autenticados" ON storage.objects;
CREATE POLICY "Update de materiais para autenticados"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'materiais' AND public.is_equipe() );
