ALTER TABLE batalha_combatentes
  ADD COLUMN IF NOT EXISTS reacao_usada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS efeitos_ativos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN batalha_combatentes.reacao_usada IS 'Reset automático a cada nova rodada';
COMMENT ON COLUMN batalha_combatentes.efeitos_ativos IS 'Efeitos persistentes do conjurador: [{ nome, rodada_inicio }] — o app lembra, não aplica sozinho (não há grid posicional)';
