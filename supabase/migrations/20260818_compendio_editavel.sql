-- ============================================================
-- Compêndio editável (magias e itens) nas tabelas do SRD
-- ============================================================
-- Mesmo padrão de 20260806_monstros_custom.sql, aplicado a:
--   spells             (alimenta /magias)
--   magic_items        (alimenta a aba "Itens Mágicos" de /itens)
--   equipment_weapons  (alimenta a aba "Armas" de /itens)
--   equipment_armor    (alimenta a aba "Armaduras" de /itens)
--   equipment_gear     (alimenta a aba "Equipamentos" de /itens)
--
-- equipment_tools existe no banco mas NÃO é consumida por nenhuma
-- tela em src/ (grep sem resultados) — fica de fora deste escopo.
--
-- Convenções (iguais a monsters):
--   SRD:    criado_por IS NULL (linhas atuais ficam como estão)
--   Custom: criado_por = quem criou, campanha_id = campanha dona
--
-- Diferença de monsters: aqui visivel_jogadores default é TRUE.
-- Monstro é informação do mestre; magia e item são conteúdo que o
-- jogador precisa consultar para jogar (ficha, inventário). O DM
-- desmarca manualmente se quiser manter algo em segredo.

ALTER TABLE spells
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES campanhas(id),
  ADD COLUMN IF NOT EXISTS visivel_jogadores boolean NOT NULL DEFAULT true;

ALTER TABLE magic_items
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES campanhas(id),
  ADD COLUMN IF NOT EXISTS visivel_jogadores boolean NOT NULL DEFAULT true;

ALTER TABLE equipment_weapons
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES campanhas(id),
  ADD COLUMN IF NOT EXISTS visivel_jogadores boolean NOT NULL DEFAULT true;

ALTER TABLE equipment_armor
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES campanhas(id),
  ADD COLUMN IF NOT EXISTS visivel_jogadores boolean NOT NULL DEFAULT true;

ALTER TABLE equipment_gear
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES campanhas(id),
  ADD COLUMN IF NOT EXISTS visivel_jogadores boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_spells_campanha ON spells(campanha_id);
CREATE INDEX IF NOT EXISTS idx_magic_items_campanha ON magic_items(campanha_id);
CREATE INDEX IF NOT EXISTS idx_equipment_weapons_campanha ON equipment_weapons(campanha_id);
CREATE INDEX IF NOT EXISTS idx_equipment_armor_campanha ON equipment_armor(campanha_id);
CREATE INDEX IF NOT EXISTS idx_equipment_gear_campanha ON equipment_gear(campanha_id);


-- ============================================================
-- RLS — INSERT/UPDATE/DELETE nas 5 tabelas acima
-- ============================================================
-- Descoberta ao investigar (igual ao caso de monsters): RLS está
-- habilitado nas 5 tabelas, mas só existe policy de SELECT
-- ("pub_spells", "pub_magic_items", "pub_equipment_weapons",
-- "pub_equipment_armor", "pub_equipment_gear"). Sem policy de
-- escrita, o Postgres nega por padrão.
--
-- Regra pedida:
--   INSERT: admin OU DM de alguma campanha
--   UPDATE: admin (qualquer linha) OU criador (só as suas)
--   DELETE: admin OU criador, e SOMENTE em linhas com criado_por
--           não nulo (SRD nunca pode ser deletado pela interface)

CREATE POLICY "spells_insert_admin_ou_dm" ON spells
  FOR INSERT
  WITH CHECK (
    criado_por = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      OR EXISTS (SELECT 1 FROM campanhas WHERE dm_id = auth.uid())
    )
  );

CREATE POLICY "spells_update_admin_ou_dono" ON spells
  FOR UPDATE
  USING (
    criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "spells_delete_custom_admin_ou_dono" ON spells
  FOR DELETE
  USING (
    criado_por IS NOT NULL
    AND (
      criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );

CREATE POLICY "magic_items_insert_admin_ou_dm" ON magic_items
  FOR INSERT
  WITH CHECK (
    criado_por = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      OR EXISTS (SELECT 1 FROM campanhas WHERE dm_id = auth.uid())
    )
  );

CREATE POLICY "magic_items_update_admin_ou_dono" ON magic_items
  FOR UPDATE
  USING (
    criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "magic_items_delete_custom_admin_ou_dono" ON magic_items
  FOR DELETE
  USING (
    criado_por IS NOT NULL
    AND (
      criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );

CREATE POLICY "equipment_weapons_insert_admin_ou_dm" ON equipment_weapons
  FOR INSERT
  WITH CHECK (
    criado_por = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      OR EXISTS (SELECT 1 FROM campanhas WHERE dm_id = auth.uid())
    )
  );

CREATE POLICY "equipment_weapons_update_admin_ou_dono" ON equipment_weapons
  FOR UPDATE
  USING (
    criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "equipment_weapons_delete_custom_admin_ou_dono" ON equipment_weapons
  FOR DELETE
  USING (
    criado_por IS NOT NULL
    AND (
      criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );

CREATE POLICY "equipment_armor_insert_admin_ou_dm" ON equipment_armor
  FOR INSERT
  WITH CHECK (
    criado_por = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      OR EXISTS (SELECT 1 FROM campanhas WHERE dm_id = auth.uid())
    )
  );

CREATE POLICY "equipment_armor_update_admin_ou_dono" ON equipment_armor
  FOR UPDATE
  USING (
    criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "equipment_armor_delete_custom_admin_ou_dono" ON equipment_armor
  FOR DELETE
  USING (
    criado_por IS NOT NULL
    AND (
      criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );

CREATE POLICY "equipment_gear_insert_admin_ou_dm" ON equipment_gear
  FOR INSERT
  WITH CHECK (
    criado_por = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
      OR EXISTS (SELECT 1 FROM campanhas WHERE dm_id = auth.uid())
    )
  );

CREATE POLICY "equipment_gear_update_admin_ou_dono" ON equipment_gear
  FOR UPDATE
  USING (
    criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "equipment_gear_delete_custom_admin_ou_dono" ON equipment_gear
  FOR DELETE
  USING (
    criado_por IS NOT NULL
    AND (
      criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );


-- ============================================================
-- Tabela auxiliar: magic_item_spells
-- ============================================================
-- Mesma ausência de policy de escrita encontrada em monster_actions
-- e afins (ver 20260806_monstros_custom.sql). Sem isso, um item
-- mágico custom que referencia magias pelo modal ficaria com o
-- vínculo quebrado do mesmo jeito que o monstro ficou por dois
-- meses. Escrita liberada quando o item mágico dono (via
-- magic_item_id) pertence a quem está editando, ou quando é admin.

CREATE POLICY "magic_item_spells_write_admin_ou_dono" ON magic_item_spells
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM magic_items mi WHERE mi.id = magic_item_spells.magic_item_id
      AND (mi.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM magic_items mi WHERE mi.id = magic_item_spells.magic_item_id
      AND (mi.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ));


-- ============================================================
-- SELECT de conferência (rodar manualmente após aplicar acima)
-- ============================================================
-- SELECT 'spells' AS tabela,
--        count(*) FILTER (WHERE criado_por IS NULL)     AS srd,
--        count(*) FILTER (WHERE criado_por IS NOT NULL) AS custom
-- FROM spells
-- UNION ALL
-- SELECT 'magic_items',
--        count(*) FILTER (WHERE criado_por IS NULL),
--        count(*) FILTER (WHERE criado_por IS NOT NULL)
-- FROM magic_items
-- UNION ALL
-- SELECT 'equipment_weapons',
--        count(*) FILTER (WHERE criado_por IS NULL),
--        count(*) FILTER (WHERE criado_por IS NOT NULL)
-- FROM equipment_weapons
-- UNION ALL
-- SELECT 'equipment_armor',
--        count(*) FILTER (WHERE criado_por IS NULL),
--        count(*) FILTER (WHERE criado_por IS NOT NULL)
-- FROM equipment_armor
-- UNION ALL
-- SELECT 'equipment_gear',
--        count(*) FILTER (WHERE criado_por IS NULL),
--        count(*) FILTER (WHERE criado_por IS NOT NULL)
-- FROM equipment_gear;
