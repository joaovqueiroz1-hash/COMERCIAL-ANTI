-- New lead fields: nicho, reuniao_agendada, motivo_perda, lista_origem
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS nicho TEXT,
  ADD COLUMN IF NOT EXISTS reuniao_agendada BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
  ADD COLUMN IF NOT EXISTS lista_origem TEXT;

-- valor_acordado may already exist from prior migration — idempotent
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_acordado NUMERIC(15, 2);
