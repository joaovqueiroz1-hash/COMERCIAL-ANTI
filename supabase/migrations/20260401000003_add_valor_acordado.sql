-- Campo para registrar o valor fechado/acordado individualmente por lead
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_acordado NUMERIC DEFAULT NULL;

-- Permitir admins excluírem leads
CREATE POLICY "Admin can delete leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (public.get_user_perfil(auth.uid()) = 'admin');

-- SQL auxiliar: excluir usuários fictícios (execute manualmente no SQL Editor)
-- DELETE FROM auth.users WHERE email IN ('contato@movifydigital.com.br', 'joao@...');
-- Ou via profiles: DELETE FROM public.profiles WHERE nome IN ('Contato Movify', 'João') AND perfil = 'vendedor';
