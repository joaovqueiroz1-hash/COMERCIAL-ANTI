-- =====================================================================
-- FIX: "Database error querying schema" ao logar com membro criado via SQL
-- Causa: create_team_member inseria em auth.users sem preencher as colunas
-- de texto que o GoTrue lê como NOT NULL (email_change, phone_change,
-- phone_change_token). Nessa versão do Supabase elas entram como NULL, e o
-- login falha ao escanear a linha. Agora todas são preenchidas com ''.
-- Também corrige as linhas já existentes com esses campos NULL.
-- Idempotente.
-- =====================================================================

-- ── 1. Corrige linhas já criadas (defensivo) ─────────────────────────
UPDATE auth.users
SET
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR confirmation_token IS NULL
   OR recovery_token IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;

-- ── 2. Patch da função (sobrecarga 4 args, usada pela tela Equipe) ───
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
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token,
      reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_id, p_email, crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nome', p_nome, 'perfil', p_perfil),
      now(), now(), 'authenticated', 'authenticated',
      '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
    VALUES (gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', p_email),
      'email', p_email, now(), now(), now());
  ELSE
    UPDATE auth.users SET
      instance_id                = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
      email_confirmed_at         = COALESCE(email_confirmed_at, now()),
      encrypted_password         = crypt(p_password, gen_salt('bf')),
      confirmation_token         = COALESCE(confirmation_token, ''),
      recovery_token             = COALESCE(recovery_token, ''),
      email_change               = COALESCE(email_change, ''),
      email_change_token_new     = COALESCE(email_change_token_new, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change               = COALESCE(phone_change, ''),
      phone_change_token         = COALESCE(phone_change_token, ''),
      reauthentication_token     = COALESCE(reauthentication_token, '')
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
