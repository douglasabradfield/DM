-- ============================================================
-- Monstros customizados na tabela monsters (mesma tabela do SRD)
-- ============================================================
-- Convenções:
--   SRD:    criado_por IS NULL (as 283 linhas atuais ficam como estão)
--   Custom: criado_por = quem criou, campanha_id = campanha dona

ALTER TABLE monsters
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES campanhas(id),
  ADD COLUMN IF NOT EXISTS visivel_jogadores boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_monsters_campanha ON monsters(campanha_id);


-- ============================================================
-- RLS — INSERT/UPDATE/DELETE em monsters e nas 5 tabelas
-- auxiliares (monster_actions, monster_saves, monster_skills,
-- monster_damage_modifiers, monster_condition_immunities)
-- ============================================================
-- Descoberta ao investigar: RLS está habilitado em todas as 6
-- tabelas, mas só existem policies de SELECT ("pub_monsters" e as
-- "Leitura pública ..."). Sem policy de escrita, o Postgres nega
-- por padrão — ou seja, mesmo o UPDATE que o ModalAdminEditarMonstro
-- já fazia hoje (edição de monstro do SRD pelo admin, via client do
-- navegador) provavelmente já falhava silenciosamente antes desta
-- migration. As policies abaixo implementam exatamente a regra
-- pedida: editar = admin (qualquer monstro) OU criador (só os seus);
-- excluir = mesma regra, mas só para monstros custom.

CREATE POLICY "monsters_insert_proprio" ON monsters
  FOR INSERT
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "monsters_update_admin_ou_dono" ON monsters
  FOR UPDATE
  USING (
    criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "monsters_delete_custom_admin_ou_dono" ON monsters
  FOR DELETE
  USING (
    criado_por IS NOT NULL
    AND (
      criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );

-- Tabelas auxiliares: escrita liberada quando o monstro dono (via
-- monster_id) pertence a quem está editando, ou quando é admin.
-- Cobre INSERT/UPDATE/DELETE (SELECT já é público pelas policies
-- existentes, então FOR ALL não restringe leitura).

CREATE POLICY "monster_actions_write_admin_ou_dono" ON monster_actions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_actions.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_actions.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ));

CREATE POLICY "monster_saves_write_admin_ou_dono" ON monster_saves
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_saves.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_saves.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ));

CREATE POLICY "monster_skills_write_admin_ou_dono" ON monster_skills
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_skills.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_skills.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ));

CREATE POLICY "monster_damage_modifiers_write_admin_ou_dono" ON monster_damage_modifiers
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_damage_modifiers.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_damage_modifiers.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ));

CREATE POLICY "monster_condition_immunities_write_admin_ou_dono" ON monster_condition_immunities
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_condition_immunities.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM monsters m WHERE m.id = monster_condition_immunities.monster_id
      AND (m.criado_por = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  ));
