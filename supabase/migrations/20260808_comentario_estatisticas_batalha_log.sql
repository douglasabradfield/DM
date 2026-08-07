-- batalha_log é a fonte de dados prevista para a futura tela de
-- estatísticas de campanha (dano/cura por combatente, baixas, XP).
-- Nenhuma tela nova foi construída ainda — este comentário só documenta
-- a intenção para quando isso for implementado: os totais devem ser
-- agregados a partir de autor_id/alvo_id/valor/tipo/rodada nesta tabela,
-- nunca dos campos acumulados (dano_total/cura_total) em
-- batalha_combatentes, que existem só para exibição em tempo real.
COMMENT ON TABLE "public"."batalha_log" IS 'Fonte de dados para estatísticas de campanha (dano/cura por combatente, baixas, XP) — agregar a partir de autor_id/alvo_id/valor/tipo/rodada, nunca dos campos acumulados em batalha_combatentes.';
