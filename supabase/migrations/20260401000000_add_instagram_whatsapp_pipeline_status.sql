-- Add new pipeline status values for Instagram and WhatsApp contact stages
-- These represent the initial outreach flow: Instagram DM → WhatsApp call → sell

ALTER TYPE public.pipeline_status ADD VALUE IF NOT EXISTS 'contato_instagram' AFTER 'novo_lead';
ALTER TYPE public.pipeline_status ADD VALUE IF NOT EXISTS 'contato_whatsapp' AFTER 'contato_instagram';
