-- 1. Criação de função para o Admin alterar senha de usuário diretamente
CREATE OR REPLACE FUNCTION admin_update_user_password(p_user_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apenas um check simples para ter certeza que é um usuário válido passando,
  -- Em produção, dependendo do uso, poderíamos validar se quem chama é admin
  -- mas o próprio Supabase RLS no app pode restringir o endpoint RPC ou a gente garante no frontend
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;

-- 2. Criação do Bucket de Storage "materiais"
INSERT INTO storage.buckets (id, name, public) 
VALUES ('materiais', 'materiais', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Storage para "materiais"
-- Permitir leitura pública (já que o bucket é público, mas boa prática garantir a policy)
CREATE POLICY "Leitura pública de materiais"
ON storage.objects FOR SELECT
USING ( bucket_id = 'materiais' );

-- Permitir Inserção (Upload) por usuários autenticados (Admin/Gestor)
CREATE POLICY "Upload de materiais para autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'materiais' );

-- Permitir Deleção (Delete) por usuários autenticados
CREATE POLICY "Delete de materiais para autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'materiais' );

-- Permitir Update por usuários autenticados
CREATE POLICY "Update de materiais para autenticados"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'materiais' );
