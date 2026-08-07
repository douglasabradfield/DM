-- Revelação de PV — controle do DM sobre o quanto os jogadores enxergam
-- do PV de monstros e NPCs.

ALTER TABLE batalhas
  ADD COLUMN IF NOT EXISTS revelacao_pv text NOT NULL DEFAULT 'oculto'
    CHECK (revelacao_pv IN ('oculto','vago','exato'));

ALTER TABLE batalha_combatentes
  ADD COLUMN IF NOT EXISTS pv_revelado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN batalhas.revelacao_pv IS 'Modo global de revelação de PV de monstros/NPCs para jogadores. PJs sempre veem PV exato uns dos outros.';
COMMENT ON COLUMN batalha_combatentes.pv_revelado IS 'Revelação individual: mostra o estado deste combatente mesmo com o modo global oculto.';
