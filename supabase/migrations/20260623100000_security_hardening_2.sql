-- =====================================================================
-- SECURITY HARDENING 2 — correções da auditoria de 2026-06-23
-- Idempotente.
--
-- CRÍTICO 1: whatsapp_messages e messages estavam com RLS DESLIGADO e o
--            papel anon (chave pública, embarcada no site) tinha SELECT.
--            => qualquer pessoa na internet lia as conversas de WhatsApp
--            com os leads sem nem logar. Ligar RLS resolve (as policies de
--            whatsapp_messages já existiam, só não valiam sem RLS).
-- CRÍTICO 2: profiles permitia o próprio usuário alterar sua linha sem
--            restrição de coluna => aluno/vendedor se auto-promovia a admin
--            (perfil='admin'), quebrando TODA a autorização. Trigger bloqueia
--            alteração de perfil/ativo por quem não é equipe.
-- MÉDIO 3:   funções SECURITY DEFINER sem search_path fixo + admin podia ter
--            a senha resetada por operacional/gestor (takeover).
-- =====================================================================

-- ── CRÍTICO 1: liga RLS nas tabelas de WhatsApp ──────────────────────
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;

-- messages não tinha nenhuma policy; sem policy + RLS on = nega tudo.
-- Libera apenas para o comercial (mesma regra de whatsapp_messages).
DROP POLICY IF EXISTS "messages_comercial_sel" ON public.messages;
CREATE POLICY "messages_comercial_sel" ON public.messages FOR SELECT TO authenticated
  USING (public.get_user_perfil(auth.uid()) IN ('admin','gestor','vendedor'));
DROP POLICY IF EXISTS "messages_comercial_ins" ON public.messages;
CREATE POLICY "messages_comercial_ins" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.get_user_perfil(auth.uid()) IN ('admin','gestor','vendedor'));

-- ── CRÍTICO 2: impede auto-escalonamento de papel via profiles ───────
-- WITH CHECK no RLS não consegue comparar valor antigo x novo; usamos trigger.
-- Só a equipe (admin/gestor/operacional) pode alterar perfil ou ativo de
-- qualquer linha; um aluno/vendedor não muda o próprio perfil (nem o de
-- ninguém). Continua podendo editar nome/email da própria conta.
CREATE OR REPLACE FUNCTION public.prevent_profile_priv_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.perfil IS DISTINCT FROM OLD.perfil) OR (NEW.ativo IS DISTINCT FROM OLD.ativo) THEN
    IF NOT public.is_equipe() THEN
      RAISE EXCEPTION 'Não autorizado a alterar perfil ou status da conta.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_priv_esc ON public.profiles;
CREATE TRIGGER trg_prevent_profile_priv_esc
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_priv_escalation();

-- ── MÉDIO 3a: pin de search_path em funções SECURITY DEFINER ─────────
ALTER FUNCTION public.create_team_member(text, text, text, text)
  SET search_path = public, auth, extensions;

-- ── MÉDIO 3b: reset de senha — pin search_path + proteção anti-takeover
CREATE OR REPLACE FUNCTION public.admin_update_user_password(p_user_id uuid, p_new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  IF public.get_user_perfil(auth.uid()) NOT IN ('admin','gestor','operacional') THEN
    RAISE EXCEPTION 'Não autorizado: apenas a equipe pode alterar senhas.';
  END IF;
  -- Ninguém que não seja admin pode resetar a senha de um admin (evita takeover)
  IF public.get_user_perfil(p_user_id) = 'admin'
     AND public.get_user_perfil(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Apenas um admin pode alterar a senha de outro admin.';
  END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;
