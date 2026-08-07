-- O trigger restringir_update_combatente_a_armas (20260810_armas_empunhadas.sql)
-- checa `c.dm_id = auth.uid()` para decidir se o UPDATE pode tocar qualquer
-- coluna. Chamadas feitas com a service role key (a rota /api/batalha/acao,
-- que já valida autorização em código antes de escrever) não carregam um
-- JWT de usuário: auth.uid() vem NULL, então `eh_dm` sempre dava falso e o
-- trigger recusava qualquer coisa fora de arma_esquerda/arma_direita —
-- inclusive dano, cura, reacao_usada e espacos_magia gravados pela API.

CREATE OR REPLACE FUNCTION "public"."restringir_update_combatente_a_armas"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eh_dm boolean;
BEGIN
  -- Rotas de servidor (service role) já validam autorização em código de
  -- aplicação antes de chegar aqui — sem JWT de usuário para checar dm_id.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM batalhas b
    JOIN campanhas c ON c.id = b.campanha_id
    WHERE b.id = NEW.batalha_id AND c.dm_id = auth.uid()
  ) INTO eh_dm;

  -- DM continua com escrita total na linha (comportamento já existente).
  IF eh_dm THEN
    RETURN NEW;
  END IF;

  -- Não-DM: qualquer diferença fora de arma_esquerda/arma_direita é recusada.
  IF (to_jsonb(OLD) - 'arma_esquerda' - 'arma_direita')
     IS DISTINCT FROM
     (to_jsonb(NEW) - 'arma_esquerda' - 'arma_direita') THEN
    RAISE EXCEPTION 'Jogadores só podem alterar as armas empunhadas';
  END IF;

  RETURN NEW;
END;
$$;
