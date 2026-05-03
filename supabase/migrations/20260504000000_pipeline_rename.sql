-- ═══════════════════════════════════════════════════════════════
-- ATENÇÃO: Execute cada bloco separado no Supabase SQL Editor.
-- Cada ALTER TYPE ADD VALUE deve ser commitado antes do UPDATE.
-- ═══════════════════════════════════════════════════════════════

-- Bloco 1: Adicionar novos valores ao enum (rodar SEPARADO, um por vez, dar Run entre cada)
ALTER TYPE public.pipeline_status ADD VALUE IF NOT EXISTS 'entrada_lead';
ALTER TYPE public.pipeline_status ADD VALUE IF NOT EXISTS 'em_atendimento';
ALTER TYPE public.pipeline_status ADD VALUE IF NOT EXISTS 'vendido';

-- Bloco 2: Migrar leads existentes (rodar DEPOIS dos ALTER TYPE acima)
UPDATE public.leads SET status_pipeline = 'entrada_lead'      WHERE status_pipeline = 'novo_lead';
UPDATE public.leads SET status_pipeline = 'tentativa_contato' WHERE status_pipeline IN ('contato_instagram', 'contato_whatsapp');
UPDATE public.leads SET status_pipeline = 'em_atendimento'    WHERE status_pipeline = 'contato_realizado';
UPDATE public.leads SET status_pipeline = 'vendido'           WHERE status_pipeline = 'fechado';

-- Bloco 3: Adicionar campo atividades
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS atividades JSONB DEFAULT '[]'::jsonb;
