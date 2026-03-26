-- CRM Notes table for WhatsApp CRM module
-- Stores notes, messages and reminders linked to leads

CREATE TABLE IF NOT EXISTS notas_crm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nota' CHECK (tipo IN ('nota', 'lembrete', 'mensagem_enviada', 'mensagem_recebida')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE notas_crm ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view all notes"
  ON notas_crm FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notes"
  ON notas_crm FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Authors can update their notes"
  ON notas_crm FOR UPDATE
  TO authenticated
  USING (auth.uid() = autor_id);

CREATE POLICY "Authors can delete their notes"
  ON notas_crm FOR DELETE
  TO authenticated
  USING (auth.uid() = autor_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS notas_crm_lead_id_idx ON notas_crm(lead_id);
CREATE INDEX IF NOT EXISTS notas_crm_created_at_idx ON notas_crm(created_at DESC);
