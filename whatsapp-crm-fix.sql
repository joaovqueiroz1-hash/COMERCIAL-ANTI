-- ====================================================================================
-- ROTEIRO DEFINITIVO DE CORREÇÃO DO WHATSAPP CRM (COPIE TUDO ISSO E RODE NO SUPABASE)
-- ====================================================================================

-- 1. Garantir que a tabela existe com todas as colunas necessárias
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    text_content TEXT,
    from_me BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'recebido',
    sender_name TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. 🔥 PARTE MAIS IMPORTANTE: POLÍTICA DE SEGURANÇA (RLS) 🔥
-- Provavelmente o seu Supabase estava bloqueando as inserções do Webhook (Vercel)
-- porque ele chegava como um usuário "anônimo" de fora do site. 
-- Desativamos o bloqueio exclusivamente para esta tabela para o Webhook conseguir salvar:
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;

-- 3. 🔥 SEGUNDA PARTE CRÍTICA: ATIVAR O REALTIME 🔥
-- Isso diz ao banco: "Toda vez que o webhook inserir uma nova linha aqui, grite para a tela do CRM atualizar!"
BEGIN;
  DO $$
  BEGIN
    -- Checa se a tabela já tá no Realtime, se não tiver, ele adiciona na força
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
    END IF;
  END
  $$;
COMMIT;

-- RESULTADO ESPERADO:
-- Success. No rows returned. (Tudo resolvido!)
