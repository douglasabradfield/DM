-- ============================================================
-- Policy de UPDATE ausente em magias_personagem
-- ============================================================
-- A tabela tem RLS habilitado e policies de SELECT/INSERT/DELETE
-- (dono do personagem ou DM da campanha), mas NENHUMA policy de
-- UPDATE. Com RLS ligado e sem policy de UPDATE, todo UPDATE é
-- negado silenciosamente: o PostgREST não acha nenhuma linha para
-- atualizar e devolve 204 sem erro.
--
-- Efeito no app: o toggle "preparada" (ModalPrepararMagias na mesa
-- e togglePreparada na FichaPersonagem) fazia update otimista na UI,
-- o banco descartava a escrita sem erro, e no reload todas as magias
-- voltavam a preparada = false. Resultado: a degradação graciosa em
-- selecionarMagiasExibidas() sempre caía no fallback "nenhuma
-- preparada → mostra todas", e os jogadores conjuravam qualquer
-- magia conhecida mesmo tendo preparado só algumas.
--
-- Mesmo predicado das policies magias_personagem_select/insert/delete:
-- dono do personagem OU DM da campanha.

DROP POLICY IF EXISTS "magias_personagem_update" ON "public"."magias_personagem";
CREATE POLICY "magias_personagem_update" ON "public"."magias_personagem"
  FOR UPDATE
  USING (
    personagem_id IN (
      SELECT personagens.id
      FROM personagens
      WHERE personagens.user_id = auth.uid()
         OR personagens.campanha_id IN (
              SELECT campanhas.id FROM campanhas WHERE campanhas.dm_id = auth.uid()
            )
    )
  )
  WITH CHECK (
    personagem_id IN (
      SELECT personagens.id
      FROM personagens
      WHERE personagens.user_id = auth.uid()
         OR personagens.campanha_id IN (
              SELECT campanhas.id FROM campanhas WHERE campanhas.dm_id = auth.uid()
            )
    )
  );
