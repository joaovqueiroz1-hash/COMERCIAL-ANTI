-- Define contato@movifydigital.com.br como admin
UPDATE public.profiles
SET perfil = 'admin', ativo = true
WHERE email = 'contato@movifydigital.com.br';
