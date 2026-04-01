-- Allow admins to update any profile (needed for toggle ativo)
CREATE POLICY "Admin can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.get_user_perfil(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_perfil(auth.uid()) = 'admin');
