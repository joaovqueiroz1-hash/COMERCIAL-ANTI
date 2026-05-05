-- =====================================================================
-- FIX: handleMatricular — RLS policies + unique constraint
-- Corrige os dois motivos pelos quais a matrícula falhava silenciosamente:
--   1. Faltava policy UPDATE em profiles para admin atualizar outros usuários
--   2. Faltava unique constraint em alunos.profile_id para o upsert funcionar
-- =====================================================================

-- ── 1. Policy UPDATE em profiles ──────────────────────────────────────
-- A migration 20260401000001 já criou esta policy mas pode não ter sido
-- aplicada em todas as instâncias. Idempotente (DROP IF EXISTS + CREATE).
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
CREATE POLICY "Admin can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING  (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor', 'operacional'))
  WITH CHECK (public.get_user_perfil(auth.uid()) IN ('admin', 'gestor', 'operacional'));

-- ── 2. Unique constraint em alunos.profile_id ─────────────────────────
-- Permite: upsert({ onConflict: "profile_id" }) na matrícula,
-- evitando linhas duplicadas em re-tentativas.
ALTER TABLE public.alunos
  DROP CONSTRAINT IF EXISTS alunos_profile_id_key;
ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_profile_id_key UNIQUE (profile_id);
