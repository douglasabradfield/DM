-- ============================================================
-- Colunas que faltam para o CRUD de itens (equivalente ao que já
-- existe em magias) cobrir os 4 tipos: Arma, Armadura, Item Mágico,
-- Equipamento.
-- ============================================================
-- criado_por / campanha_id / visivel_jogadores já existem nas 4
-- tabelas desde 20260818_compendio_editavel.sql (verificado no
-- banco). Só faltam 2 colunas de dado:

-- Armas não tinham nenhuma coluna de alcance — o pedido de UI é
-- "Arma: dano, tipo de dano, propriedades, alcance (metros na UI)".
-- Guardado em pés (mesmo padrão de monster_actions.reach_ft), convertido
-- na UI (1,5m = 5ft).
ALTER TABLE equipment_weapons
  ADD COLUMN IF NOT EXISTS range_ft integer;

-- magic_items não tinha coluna de peso — o pedido de UI pede "peso"
-- como campo comum a TODOS os tipos de item, inclusive item mágico.
ALTER TABLE magic_items
  ADD COLUMN IF NOT EXISTS weight_lb numeric;

-- Armas e armaduras não tinham nenhuma coluna de descrição (só campos
-- mecânicos: properties_pt/mastery_pt, base_ac_formula_pt) — o pedido
-- de UI pede "descrição" como campo comum a TODOS os tipos, para dar
-- espaço a lore/flavor em itens homebrew (ex.: uma espada custom com
-- uma história, além dos números).
ALTER TABLE equipment_weapons
  ADD COLUMN IF NOT EXISTS description_pt text,
  ADD COLUMN IF NOT EXISTS description_en text;

ALTER TABLE equipment_armor
  ADD COLUMN IF NOT EXISTS description_pt text,
  ADD COLUMN IF NOT EXISTS description_en text;

-- ============================================================
-- Nota sobre bug de moeda encontrado ao investigar (não é DDL,
-- só documentação — nenhuma coluna precisa mudar de nome ou tipo)
-- ============================================================
-- equipment_gear.cost_gp, apesar do nome, está gravado na MESMA escala
-- de "peças de cobre" que equipment_weapons.cost_cp e
-- equipment_armor.cost_cp (ex.: Tocha = 1, Vela = 1, Corda = 100 —
-- exatamente os preços reais do SRD em cobre, não em ouro). A tela
-- /itens exibia esse valor cru como se já fosse ouro ("100 po" para
-- uma corda de 1 po) — bug de exibição 100x, corrigido no código
-- (ItensCliente.tsx), não no banco. Mantido o nome da coluna para não
-- quebrar leituras existentes; só a leitura em código passa a dividir
-- por 100.
COMMENT ON COLUMN equipment_gear.cost_gp IS
  'Apesar do nome, gravado em peças de cobre (mesma escala de cost_cp nas outras tabelas de equipamento) — confirmado comparando com precos reais do SRD (ex: Tocha=1, Corda=100). Dividir por 100 para obter o valor em peças de ouro.';
