ALTER TABLE personagens ADD COLUMN IF NOT EXISTS slots_magia jsonb DEFAULT '{}';
