-- ============================================================
-- Religa magias_personagem legadas (spell_id nulo) por nome
-- ============================================================
-- Linhas do formato antigo têm só magia_id (uuid legado) e spell_id NULL, então
-- o join com spells devolve null e a ficha ignora a magia. Aqui o spell_id é
-- recuperado casando magias_personagem.nome com spells.name_pt.
-- Só religa quando existe EXATAMENTE UM casamento; ambíguos e sem casamento
-- continuam com spell_id NULL (resolver manualmente).

-- 1) CONFERÊNCIA (rode antes; descomente para executar).
--    Uma linha por (registro legado, magia candidata). qtd_casamentos = 0 não
--    tem candidata; > 1 é ambíguo e NÃO será alterado pelo UPDATE.
--
-- SELECT
--   mp.id                AS magias_personagem_id,
--   mp.personagem_id,
--   mp.nome              AS nome_no_personagem,
--   s.id                 AS spell_id_candidato,
--   s.name_pt,
--   s.level,
--   COUNT(*) OVER (PARTITION BY mp.id) AS qtd_casamentos
-- FROM magias_personagem mp
-- LEFT JOIN spells s ON s.name_pt = mp.nome
-- WHERE mp.spell_id IS NULL
-- ORDER BY mp.nome, s.id;

-- 2) UPDATE restrito a casamentos únicos.
UPDATE magias_personagem mp
SET spell_id = s.id
FROM spells s
WHERE mp.spell_id IS NULL
  AND s.name_pt = mp.nome
  AND (SELECT COUNT(*) FROM spells s2 WHERE s2.name_pt = mp.nome) = 1;
