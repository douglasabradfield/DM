-- ============================================================
-- personagens.visibilidade — 'privado' por padrão
-- ============================================================
-- Contexto: a coluna tinha DEFAULT 'grupo', então todo personagem
-- novo (ficha de jogador ou NPC/monstro do DM) nascia visível para
-- toda a campanha sem nenhuma ação explícita do DM. A partir de
-- agora, personagens novos nascem 'privado' (só dono + DM veem).
-- 'grupo' e 'jogador_especifico' continuam existindo exatamente
-- como hoje, como compartilhamento explícito feito pelo DM na
-- ficha (botões "Visível:" em CardPersonagem).

-- 1) Muda o default para personagens NOVOS a partir de agora.
ALTER TABLE public.personagens
  ALTER COLUMN visibilidade SET DEFAULT 'privado';


-- ============================================================
-- 2) BACKFILL de personagens já existentes — rodar manualmente
-- ============================================================
-- Regra combinada com o Douglas:
--   - Só personagens de JOGADOR (user_id preenchido e diferente
--     do dm_id da própria campanha) que estejam 'grupo' passam a
--     'privado'.
--   - NPCs e personagens do próprio DM (user_id nulo ou = dm_id)
--     NÃO são tocados — revisão manual depois, caso a caso.

-- 2a) Rode este SELECT primeiro e confira os números por campanha
--     ANTES de rodar o UPDATE da seção 2b:
SELECT
  c.id      AS campanha_id,
  c.nome    AS campanha_nome,
  count(*)  AS personagens_afetados
FROM public.personagens p
JOIN public.campanhas c ON c.id = p.campanha_id
WHERE p.visibilidade = 'grupo'
  AND p.user_id IS NOT NULL
  AND p.user_id <> c.dm_id
GROUP BY c.id, c.nome
ORDER BY personagens_afetados DESC;

-- 2b) Só depois de conferir os números acima, descomente e rode:
--
-- UPDATE public.personagens p
-- SET visibilidade = 'privado'
-- FROM public.campanhas c
-- WHERE c.id = p.campanha_id
--   AND p.visibilidade = 'grupo'
--   AND p.user_id IS NOT NULL
--   AND p.user_id <> c.dm_id;
