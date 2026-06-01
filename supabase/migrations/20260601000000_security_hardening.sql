-- =====================================================================
-- SECURITY HARDENING
-- 1. Helpers de papel (is_equipe / current_aluno_id)
-- 2. Fix CRÍTICO: admin_update_user_password exige equipe
-- 3. Fix: create_team_member (ambas sobrecargas) exige admin
-- 4. Fix: handle_new_user não permite auto-escalonamento de papel
-- 5. RLS por papel em todas as tabelas do portal + zapi/whatsapp
-- 6. RPC para o aluno concluir tarefa sem poder fraudar XP/aprovação
-- Idempotente: pode rodar de novo sem erro.
-- =====================================================================

-- ── 1. HELPERS ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_equipe()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.get_user_perfil(auth.uid()) IN ('admin','gestor','operacional');
$$;

CREATE OR REPLACE FUNCTION public.current_aluno_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.alunos WHERE profile_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_equipe()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_aluno_id()  TO authenticated;

-- ── 2. FIX CRÍTICO: troca de senha só por equipe ─────────────────────
-- Antes: qualquer autenticado (até aluno) podia resetar a senha de qualquer
-- usuário e tomar a conta. Agora exige perfil de equipe.
CREATE OR REPLACE FUNCTION public.admin_update_user_password(p_user_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF public.get_user_perfil(auth.uid()) NOT IN ('admin','gestor','operacional') THEN
    RAISE EXCEPTION 'Não autorizado: apenas a equipe pode alterar senhas.';
  END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;

-- ── 3. FIX: criação de membro da equipe só por admin ─────────────────
-- Antes: qualquer autenticado podia chamar create_team_member e criar uma
-- conta admin nova. Agora exige perfil admin. Também sincroniza user_roles
-- (necessário para has_role, ex.: policy de DELETE em leads).

-- Sobrecarga 3 args
CREATE OR REPLACE FUNCTION public.create_team_member(p_nome text, p_email text, p_perfil text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF public.get_user_perfil(auth.uid()) <> 'admin' THEN
    RETURN jsonb_build_object('error', 'Não autorizado.');
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado no Auth.');
  END IF;

  UPDATE auth.users SET email_confirmed_at = now() WHERE id = v_id;

  INSERT INTO public.profiles (id, nome, email, perfil, ativo)
  VALUES (v_id, p_nome, p_email, p_perfil::app_role, true)
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome, email = EXCLUDED.email,
      perfil = EXCLUDED.perfil, ativo = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_id, p_perfil::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Sobrecarga 4 args (usada pela tela Equipe)
CREATE OR REPLACE FUNCTION public.create_team_member(p_nome text, p_email text, p_perfil text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_id uuid;
BEGIN
  IF public.get_user_perfil(auth.uid()) <> 'admin' THEN
    RETURN jsonb_build_object('error', 'Não autorizado.');
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, role, aud,
      confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current,
      reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_id, p_email, crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nome', p_nome, 'perfil', p_perfil),
      now(), now(), 'authenticated', 'authenticated',
      '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
    VALUES (gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', p_email),
      'email', p_email, now(), now(), now());
  ELSE
    UPDATE auth.users SET
      instance_id            = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
      email_confirmed_at     = COALESCE(email_confirmed_at, now()),
      encrypted_password     = crypt(p_password, gen_salt('bf')),
      confirmation_token     = COALESCE(confirmation_token, ''),
      recovery_token         = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
    WHERE id = v_id;
  END IF;

  INSERT INTO public.profiles (id, nome, email, perfil, ativo)
  VALUES (v_id, p_nome, p_email, p_perfil::app_role, true)
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome, email = EXCLUDED.email, perfil = EXCLUDED.perfil, ativo = true;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_id, p_perfil::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN others THEN RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ── 4. FIX: cadastro não pode auto-conceder papel de equipe ──────────
-- Cadastro via cliente (signUp) só pode resultar em 'aluno' ou 'vendedor'.
-- Papéis elevados (admin/gestor/operacional) só por create_team_member,
-- que é admin-gated e seta o perfil server-side após o signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_perfil public.app_role;
BEGIN
  BEGIN
    v_perfil := COALESCE((NEW.raw_user_meta_data->>'perfil')::public.app_role, 'aluno');
  EXCEPTION WHEN invalid_text_representation THEN
    v_perfil := 'aluno';
  END;

  IF v_perfil NOT IN ('aluno','vendedor') THEN
    v_perfil := 'vendedor';
  END IF;

  INSERT INTO public.profiles (id, nome, email, perfil)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email, v_perfil)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome, email = EXCLUDED.email, perfil = EXCLUDED.perfil;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_perfil)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 5. RPC: aluno conclui tarefa (sem fraudar XP/aprovação) ──────────
-- O aluno deixa de ter UPDATE direto em sprint_tarefas. Esta função seta
-- apenas concluida + link_entrega, e só na própria tarefa.
CREATE OR REPLACE FUNCTION public.aluno_marcar_tarefa_concluida(p_tarefa_id uuid, p_link text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_aluno uuid;
BEGIN
  v_aluno := public.current_aluno_id();
  IF v_aluno IS NULL THEN
    RAISE EXCEPTION 'Sem vínculo de aluno.';
  END IF;
  UPDATE public.sprint_tarefas
  SET concluida = true,
      link_entrega = COALESCE(p_link, link_entrega)
  WHERE id = p_tarefa_id AND aluno_id = v_aluno;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada para este aluno.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.aluno_marcar_tarefa_concluida(uuid, text) TO authenticated;

-- ── 6. RLS POR PAPEL ─────────────────────────────────────────────────

-- alunos: equipe total; aluno só lê a própria linha (não edita XP/fase)
DROP POLICY IF EXISTS "alunos_authenticated" ON public.alunos;
DROP POLICY IF EXISTS "alunos_sel" ON public.alunos;
DROP POLICY IF EXISTS "alunos_write" ON public.alunos;
CREATE POLICY "alunos_sel"   ON public.alunos FOR SELECT TO authenticated
  USING (public.is_equipe() OR profile_id = auth.uid());
CREATE POLICY "alunos_write" ON public.alunos FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- sprints: equipe total; aluno lê os próprios + globais (aluno_id null)
DROP POLICY IF EXISTS "sprints_authenticated" ON public.sprints;
DROP POLICY IF EXISTS "sprints_sel" ON public.sprints;
DROP POLICY IF EXISTS "sprints_write" ON public.sprints;
CREATE POLICY "sprints_sel"   ON public.sprints FOR SELECT TO authenticated
  USING (public.is_equipe() OR aluno_id IS NULL OR aluno_id = public.current_aluno_id());
CREATE POLICY "sprints_write" ON public.sprints FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- sprint_tarefas: equipe total; aluno só lê as próprias (escreve via RPC)
DROP POLICY IF EXISTS "sprint_tarefas_authenticated" ON public.sprint_tarefas;
DROP POLICY IF EXISTS "sprint_tarefas_sel" ON public.sprint_tarefas;
DROP POLICY IF EXISTS "sprint_tarefas_write" ON public.sprint_tarefas;
CREATE POLICY "sprint_tarefas_sel"   ON public.sprint_tarefas FOR SELECT TO authenticated
  USING (public.is_equipe() OR aluno_id = public.current_aluno_id());
CREATE POLICY "sprint_tarefas_write" ON public.sprint_tarefas FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- mensagens_internas: equipe total; aluno lê a própria thread e só envia como ele mesmo
DROP POLICY IF EXISTS "mensagens_internas_authenticated" ON public.mensagens_internas;
DROP POLICY IF EXISTS "mensagens_internas_sel" ON public.mensagens_internas;
DROP POLICY IF EXISTS "mensagens_internas_ins" ON public.mensagens_internas;
DROP POLICY IF EXISTS "mensagens_internas_mod" ON public.mensagens_internas;
CREATE POLICY "mensagens_internas_sel" ON public.mensagens_internas FOR SELECT TO authenticated
  USING (public.is_equipe() OR aluno_id = public.current_aluno_id());
CREATE POLICY "mensagens_internas_ins" ON public.mensagens_internas FOR INSERT TO authenticated
  WITH CHECK (public.is_equipe() OR (aluno_id = public.current_aluno_id() AND remetente_id = auth.uid()));
CREATE POLICY "mensagens_internas_mod" ON public.mensagens_internas FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- materiais: equipe total; aluno lê os próprios + globais
DROP POLICY IF EXISTS "materiais_authenticated" ON public.materiais;
DROP POLICY IF EXISTS "materiais_sel" ON public.materiais;
DROP POLICY IF EXISTS "materiais_write" ON public.materiais;
CREATE POLICY "materiais_sel"   ON public.materiais FOR SELECT TO authenticated
  USING (public.is_equipe() OR aluno_id IS NULL OR aluno_id = public.current_aluno_id());
CREATE POLICY "materiais_write" ON public.materiais FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- eventos: equipe total; aluno lê os próprios + globais
DROP POLICY IF EXISTS "eventos_authenticated" ON public.eventos;
DROP POLICY IF EXISTS "eventos_sel" ON public.eventos;
DROP POLICY IF EXISTS "eventos_write" ON public.eventos;
CREATE POLICY "eventos_sel"   ON public.eventos FOR SELECT TO authenticated
  USING (public.is_equipe() OR aluno_id IS NULL OR aluno_id = public.current_aluno_id());
CREATE POLICY "eventos_write" ON public.eventos FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- diagnosticos: equipe total; aluno só lê o próprio
DROP POLICY IF EXISTS "diagnosticos_authenticated" ON public.diagnosticos;
DROP POLICY IF EXISTS "diagnosticos_sel" ON public.diagnosticos;
DROP POLICY IF EXISTS "diagnosticos_write" ON public.diagnosticos;
CREATE POLICY "diagnosticos_sel"   ON public.diagnosticos FOR SELECT TO authenticated
  USING (public.is_equipe() OR aluno_id = public.current_aluno_id());
CREATE POLICY "diagnosticos_write" ON public.diagnosticos FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- metas / tags_sistema / lead_tags: módulo comercial, nunca aluno
DROP POLICY IF EXISTS "metas_authenticated" ON public.metas;
DROP POLICY IF EXISTS "metas_all" ON public.metas;
CREATE POLICY "metas_all" ON public.metas FOR ALL TO authenticated
  USING (public.get_user_perfil(auth.uid()) <> 'aluno')
  WITH CHECK (public.get_user_perfil(auth.uid()) <> 'aluno');

DROP POLICY IF EXISTS "tags_sistema_authenticated" ON public.tags_sistema;
DROP POLICY IF EXISTS "tags_sistema_all" ON public.tags_sistema;
CREATE POLICY "tags_sistema_all" ON public.tags_sistema FOR ALL TO authenticated
  USING (public.get_user_perfil(auth.uid()) <> 'aluno')
  WITH CHECK (public.get_user_perfil(auth.uid()) <> 'aluno');

DROP POLICY IF EXISTS "lead_tags_authenticated" ON public.lead_tags;
DROP POLICY IF EXISTS "lead_tags_all" ON public.lead_tags;
CREATE POLICY "lead_tags_all" ON public.lead_tags FOR ALL TO authenticated
  USING (public.get_user_perfil(auth.uid()) <> 'aluno')
  WITH CHECK (public.get_user_perfil(auth.uid()) <> 'aluno');

-- zapi_config: credenciais do WhatsApp — só equipe
DROP POLICY IF EXISTS "Authenticated users can view zapi config" ON public.zapi_config;
DROP POLICY IF EXISTS "Authenticated users can insert/update zapi config" ON public.zapi_config;
DROP POLICY IF EXISTS "zapi_config_all" ON public.zapi_config;
CREATE POLICY "zapi_config_all" ON public.zapi_config FOR ALL TO authenticated
  USING (public.is_equipe()) WITH CHECK (public.is_equipe());

-- whatsapp_messages: conversas com leads — só comercial
DROP POLICY IF EXISTS "Authenticated users can view whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_sel" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_ins" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_sel" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.get_user_perfil(auth.uid()) IN ('admin','gestor','vendedor'));
CREATE POLICY "whatsapp_messages_ins" ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (public.get_user_perfil(auth.uid()) IN ('admin','gestor','vendedor'));
