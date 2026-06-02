ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS resposta text;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS respondido_em timestamptz;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS respondido_por uuid references profiles(id);
