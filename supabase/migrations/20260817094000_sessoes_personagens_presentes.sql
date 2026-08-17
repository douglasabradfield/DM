-- Presença de jogadores na sessão (fora de combate). null = todos presentes
-- (compatível com sessões existentes); array = só os personagens listados
-- aparecem na barra de participantes e como alvo de transferência na /mesa.
alter table sessoes add column personagens_presentes uuid[];
