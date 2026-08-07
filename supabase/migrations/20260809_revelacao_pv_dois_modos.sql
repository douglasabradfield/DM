-- Revelação de PV — reduz o modo global de 3 para 2 estados.
-- 'oculto' e 'vago' colapsam em 'padrao': o padrão já esconde o PV, e a
-- revelação individual (pv_revelado) já entrega o estado vago quando ligada.
-- Constraint confirmada via pg_constraint: batalhas_revelacao_pv_check.
--
-- A constraint precisa cair ANTES do UPDATE: o check antigo só aceita
-- ('oculto','vago','exato') e rejeitaria a gravação de 'padrao'.

ALTER TABLE batalhas DROP CONSTRAINT batalhas_revelacao_pv_check;

UPDATE batalhas SET revelacao_pv = 'padrao'
  WHERE revelacao_pv IN ('oculto','vago');

ALTER TABLE batalhas ALTER COLUMN revelacao_pv SET DEFAULT 'padrao';

ALTER TABLE batalhas ADD CONSTRAINT batalhas_revelacao_pv_check
  CHECK (revelacao_pv IN ('padrao','exato'));
