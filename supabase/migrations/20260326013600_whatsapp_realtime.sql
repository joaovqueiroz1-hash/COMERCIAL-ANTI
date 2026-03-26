-- 1. Z-API CONFIG
CREATE TABLE IF NOT EXISTS public.zapi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL,
  token TEXT NOT NULL,
  client_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zapi_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view zapi config" ON public.zapi_config;
CREATE POLICY "Authenticated users can view zapi config"
  ON public.zapi_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert/update zapi config" ON public.zapi_config;
CREATE POLICY "Authenticated users can insert/update zapi config"
  ON public.zapi_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  message_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  text_content TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'recebido',
  sender_name TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated users can view whatsapp_messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated users can insert whatsapp_messages"
  ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (true);

-- 3. HABILITAR MENSAGENS EM TEMPO REAL
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE public.whatsapp_messages;
END $$;
