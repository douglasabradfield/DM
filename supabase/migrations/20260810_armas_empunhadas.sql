-- Armas empunhadas — dois slots (esquerda/direita) que o jogador escolhe
-- na /mesa. Guarda o objeto do ataque inteiro (nome, bônus, dano), não um
-- índice — a ficha pode mudar no meio da campanha.

ALTER TABLE batalha_combatentes
  ADD COLUMN IF NOT EXISTS arma_esquerda jsonb,
  ADD COLUMN IF NOT EXISTS arma_direita jsonb;

COMMENT ON COLUMN batalha_combatentes.arma_esquerda IS 'Ataque empunhado no slot esquerdo, copiado de personagens.ataques';
COMMENT ON COLUMN batalha_combatentes.arma_direita IS 'Ataque empunhado no slot direito, copiado de personagens.ataques';

-- =========================================================================
-- Permissão de escrita para jogadores — só armas empunhadas
-- =========================================================================
-- Até aqui só o DM tinha UPDATE em batalha_combatentes (policy
-- batalha_combatentes_update, escopada por campanhas.dm_id). A /mesa
-- precisa que o dono do personagem grave sua própria escolha de arma.
--
-- RLS não restringe por COLUNA, só por LINHA — e authenticated já tem
-- GRANT UPDATE na tabela inteira (padrão do Supabase), então uma policy
-- que libere "o jogador atualiza sua própria linha" abriria a linha
-- inteira: PV, condições, morto etc. Por isso a policy abaixo (liberação
-- por linha) vem acompanhada de um trigger que recusa qualquer UPDATE de
-- não-DM que altere algo além de arma_esquerda/arma_direita.

CREATE POLICY "batalha_combatentes_update_jogador_arma" ON "public"."batalha_combatentes" FOR UPDATE USING (
    personagem_id IN (SELECT id FROM "public"."personagens" WHERE user_id = auth.uid())
) WITH CHECK (
    personagem_id IN (SELECT id FROM "public"."personagens" WHERE user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION "public"."restringir_update_combatente_a_armas"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eh_dm boolean;
BEGIN
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

CREATE TRIGGER "trg_restringir_update_combatente_a_armas"
  BEFORE UPDATE ON "public"."batalha_combatentes"
  FOR EACH ROW EXECUTE FUNCTION "public"."restringir_update_combatente_a_armas"();
