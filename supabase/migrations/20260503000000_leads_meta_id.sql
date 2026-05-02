-- Adicionar meta_id na tabela leads para vincular leads fechados a metas
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_id UUID REFERENCES public.metas(id) ON DELETE SET NULL;
