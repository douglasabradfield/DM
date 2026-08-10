-- Fase 4 — Migração de personagens.inventario (jsonb) para inventario_itens
--
-- IMPORTANTE:
-- - personagens.inventario NÃO é apagado aqui. Fica congelado, como legado,
--   até a UI ser migrada para a tabela nova (migration separada no futuro).
-- - Idempotente: o INSERT (passo 2) só atinge personagens que ainda não têm
--   nenhuma linha em inventario_itens — rodar duas vezes não duplica.
-- - Rode o passo 1 sozinho primeiro e confira a coluna itens_no_jsonb contra
--   o que os jogadores esperam ver. Só depois rode o passo 2.

-- =============================================================================
-- 1. CONFERÊNCIA (rodar sozinho, antes do INSERT) — quantos itens cada
-- personagem tem no jsonb hoje, e quantos já existem em inventario_itens
-- (deve ser 0 para todo mundo na primeira execução).
-- =============================================================================

select
  p.id as personagem_id,
  p.nome,
  jsonb_array_length(coalesce(p.inventario, '[]'::jsonb)) as itens_no_jsonb,
  (select count(*) from inventario_itens ii where ii.personagem_id = p.id) as itens_ja_migrados
from personagens p
where jsonb_array_length(coalesce(p.inventario, '[]'::jsonb)) > 0
order by p.nome;

-- =============================================================================
-- 2. MIGRAÇÃO — um INSERT por elemento do array, só para personagens sem
-- nenhuma linha em inventario_itens ainda. item_ref preserva o "id" original
-- do jsonb como texto (slug de compêndio ou número avulso, tanto faz).
-- =============================================================================

insert into inventario_itens (personagem_id, item_ref, nome, tipo, raridade, descricao, quantidade)
select
  p.id,
  elem->>'id' as item_ref,
  elem->>'nome' as nome,
  elem->>'tipo' as tipo,
  elem->>'raridade' as raridade,
  elem->>'descricao' as descricao,
  coalesce((elem->>'quantidade')::integer, 1) as quantidade
from personagens p
cross join lateral jsonb_array_elements(coalesce(p.inventario, '[]'::jsonb)) as elem
where not exists (select 1 from inventario_itens ii where ii.personagem_id = p.id)
  and coalesce(elem->>'nome', '') <> '';

-- =============================================================================
-- 3. PÓS-CONFERÊNCIA (rodar depois do INSERT) — compara o total migrado com
-- o total esperado do jsonb. itens_no_jsonb e itens_migrados devem bater.
-- =============================================================================

select
  p.id as personagem_id,
  p.nome,
  jsonb_array_length(coalesce(p.inventario, '[]'::jsonb)) as itens_no_jsonb,
  (select count(*) from inventario_itens ii where ii.personagem_id = p.id) as itens_migrados
from personagens p
where jsonb_array_length(coalesce(p.inventario, '[]'::jsonb)) > 0
order by p.nome;
