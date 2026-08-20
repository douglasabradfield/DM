-- ============================================================
-- Criação de magia/item personalizado liberada para qualquer
-- jogador autenticado (não só DM/admin)
-- ============================================================
-- Decisão do Douglas: qualquer jogador pode criar magia/item
-- personalizado para o próprio personagem. As policies de INSERT
-- criadas em 20260818_compendio_editavel.sql exigiam DM da campanha
-- ou admin — isso nunca refletiu essa decisão; só "funcionava" no
-- app enquanto todos os usuários estavam temporariamente marcados
-- como is_admin = true (contorno de outro bug, já revertido).
--
-- Sem esta migration, a troca em MagiasCliente.tsx/ItensCliente.tsx
-- (podeCriarMagia/podeCriarItem = !!userId) libera o botão na UI mas
-- o INSERT continua caindo em RLS para quem não é DM nem admin.
--
-- UPDATE/DELETE continuam iguais (dono ou admin) — não mudam aqui.
-- Mesmo padrão já usado em monsters_insert_proprio (só que ali é
-- intencionalmente restrito à ferramenta de mestre; aqui é o oposto).

DROP POLICY IF EXISTS "spells_insert_admin_ou_dm" ON spells;
CREATE POLICY "spells_insert_proprio" ON spells
  FOR INSERT
  WITH CHECK (criado_por = auth.uid());

DROP POLICY IF EXISTS "magic_items_insert_admin_ou_dm" ON magic_items;
CREATE POLICY "magic_items_insert_proprio" ON magic_items
  FOR INSERT
  WITH CHECK (criado_por = auth.uid());

DROP POLICY IF EXISTS "equipment_weapons_insert_admin_ou_dm" ON equipment_weapons;
CREATE POLICY "equipment_weapons_insert_proprio" ON equipment_weapons
  FOR INSERT
  WITH CHECK (criado_por = auth.uid());

DROP POLICY IF EXISTS "equipment_armor_insert_admin_ou_dm" ON equipment_armor;
CREATE POLICY "equipment_armor_insert_proprio" ON equipment_armor
  FOR INSERT
  WITH CHECK (criado_por = auth.uid());

DROP POLICY IF EXISTS "equipment_gear_insert_admin_ou_dm" ON equipment_gear;
CREATE POLICY "equipment_gear_insert_proprio" ON equipment_gear
  FOR INSERT
  WITH CHECK (criado_por = auth.uid());
