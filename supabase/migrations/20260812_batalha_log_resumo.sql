ALTER TABLE batalha_log
  ADD COLUMN IF NOT EXISTS resumo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN batalha_log.resumo IS 'Entrada contábil (dano/cura por alvo) gerada junto de uma entrada narrativa que já descreve a mesma ação — existe para a agregação de estatísticas (diário/futura tela de estatísticas); a UI do log ao vivo esconde as marcadas true para não repetir a narrativa.';
