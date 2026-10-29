-- AC automático — armadura, escudo e modificadores derivados dos itens equipados.
--
-- NÃO aplicado em produção. Rode no SQL Editor do Supabase, DEPOIS do backup
-- (ver CLAUDE.md), e confira os dois relatórios do final (seção 8).
-- Aplique ANTES de publicar o código desta branch: o app passa a ler/gravar
-- personagens.ac_manual, inventario_itens.* e batalha_combatentes.ac_override.
--
-- =============================================================================
-- ROLLBACK (rode no SQL Editor para desfazer esta migration)
-- =============================================================================
-- begin;
--   -- devolve a CA manual para a coluna legada antes de apagar ac_manual
--   -- (ca nunca foi alterada por esta migration; isto só preserva edições novas)
--   update personagens set ca = ac_manual where ac_manual is not null;
--   update personagens set ac_manual = null;
--   alter table personagens drop column if exists ac_manual;
--
--   alter table batalha_combatentes drop column if exists ac_override;
--
--   alter table inventario_itens
--     drop constraint if exists inventario_itens_categoria_check,
--     drop constraint if exists inventario_itens_tipo_armadura_check,
--     drop column if exists categoria,
--     drop column if exists equipavel,
--     drop column if exists tipo_armadura,
--     drop column if exists ac_base,
--     drop column if exists max_des,
--     drop column if exists req_for,
--     drop column if exists desv_furtividade,
--     drop column if exists modificadores;
--
--   -- itens mágicos semeados aqui (não existiam antes); apagar ANTES de dropar colunas
--   delete from magic_items where slug in (
--     'armor-plus-1','armor-plus-2','armor-plus-3',
--     'shield-plus-1','shield-plus-2','shield-plus-3',
--     'ring-of-protection','cloak-of-protection');
--
--   alter table magic_items
--     drop column if exists categoria,
--     drop column if exists equipavel,
--     drop column if exists modificadores;
--
--   alter table equipment_armor
--     drop column if exists categoria,
--     drop column if exists tipo_armadura,
--     drop column if exists ac_base,
--     drop column if exists max_des,
--     drop column if exists modificadores;
-- commit;
--
-- =============================================================================
-- O que muda
--   1. personagens.ac_manual (null = usar o AC calculado). personagens.ca fica
--      como coluna legada: sem escrita nova pelo app.
--   2. Campos mecânicos opcionais em inventario_itens (cópia no momento em que
--      o item entra na mochila — o cálculo do AC não depende de joins) e no
--      catálogo (equipment_armor / magic_items).
--   3. batalha_combatentes.ac_override: CA temporária definida pelo mestre na
--      batalha. Vive só na linha do combatente; nunca vai para a ficha.
--   4. Migração de ca -> ac_manual SÓ onde ca <> 10 (ca = 10 é o default, não dá
--      para saber se foi digitado; fica null).
--   5. Seed idempotente de armaduras/escudos do SRD e itens mágicos de AC.
--   6. Backfill das linhas existentes de inventario_itens via item_ref + catálogo.
--
-- Idempotente: seguro rodar de novo. Tudo em uma transação: se qualquer passo
-- falhar, nada é aplicado.
-- =============================================================================

begin;

-- =============================================================================
-- 1. personagens.ac_manual
-- =============================================================================

alter table personagens add column if not exists ac_manual integer;

-- Só copia onde ainda não há ac_manual (re-execução não sobrescreve edição nova).
update personagens
   set ac_manual = ca
 where ac_manual is null
   and ca is not null
   and ca <> 10;

-- =============================================================================
-- 2. Campos mecânicos
--   categoria: 'armadura' | 'escudo' | 'arma' | 'outro'
--   modificadores: lista de { alvo, valor, tipo } — tipo 'soma' (padrão) | 'base'
-- =============================================================================

alter table inventario_itens
  add column if not exists categoria text,
  add column if not exists equipavel boolean not null default false,
  add column if not exists tipo_armadura text,
  add column if not exists ac_base integer,
  add column if not exists max_des integer,
  add column if not exists req_for integer,
  add column if not exists desv_furtividade boolean not null default false,
  add column if not exists modificadores jsonb not null default '[]'::jsonb;

alter table equipment_armor
  add column if not exists categoria text,
  add column if not exists tipo_armadura text,
  add column if not exists ac_base integer,
  add column if not exists max_des integer,
  add column if not exists modificadores jsonb not null default '[]'::jsonb;

alter table magic_items
  add column if not exists categoria text,
  add column if not exists equipavel boolean not null default false,
  add column if not exists modificadores jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventario_itens_categoria_check') then
    alter table inventario_itens add constraint inventario_itens_categoria_check
      check (categoria is null or categoria in ('armadura', 'escudo', 'arma', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventario_itens_tipo_armadura_check') then
    alter table inventario_itens add constraint inventario_itens_tipo_armadura_check
      check (tipo_armadura is null or tipo_armadura in ('leve', 'media', 'pesada'));
  end if;
end $$;

-- =============================================================================
-- 3. batalha_combatentes.ac_override (CA temporária da batalha, só do mestre)
-- Precedência na leitura: ac_override ?? ac_manual ?? AC calculado.
-- =============================================================================

alter table batalha_combatentes add column if not exists ac_override integer;

-- =============================================================================
-- 4. slug único em equipment_armor / magic_items (exigido pelo ON CONFLICT).
-- No banco atual já existem (equipment_armor_slug_key, magic_items_slug_key);
-- o bloco só cria se faltar alguma restrição única sobre (slug).
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['equipment_armor', 'magic_items'] loop
    if not exists (
      select 1
        from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
       where i.indrelid = ('public.' || t)::regclass
         and i.indisunique
         and i.indnatts = 1
         and i.indpred is null
         and a.attname = 'slug'
    ) then
      execute format('alter table public.%I add constraint %I unique (slug)', t, t || '_slug_key');
    end if;
  end loop;
end $$;

-- =============================================================================
-- 5. Catálogo: armaduras e escudos do SRD (equipment_armor)
-- Os 13 registros já existem (carga original); aqui só preenchemos os campos
-- estruturados a partir do slug. strength_requirement e stealth_disadvantage já
-- estão corretos no banco e não são tocados. O DM Supremo pode criar armaduras
-- custom (campanha_id preenchido) — essas também não são tocadas.
-- =============================================================================

update equipment_armor a set
  categoria      = v.categoria,
  tipo_armadura  = v.tipo_armadura,
  ac_base        = v.ac_base,
  max_des        = v.max_des,
  modificadores  = v.modificadores::jsonb
from (values
  -- slug,                   categoria, tipo,    ac, max_des, modificadores
  ('padded-armor',          'armadura', 'leve',   11, null, '[]'),
  ('leather-armor',         'armadura', 'leve',   11, null, '[]'),
  ('studded-leather-armor', 'armadura', 'leve',   12, null, '[]'),
  ('hide-armor',            'armadura', 'media',  12, 2,    '[]'),
  ('chain-shirt',           'armadura', 'media',  13, 2,    '[]'),
  ('scale-mail',            'armadura', 'media',  14, 2,    '[]'),
  ('breastplate',           'armadura', 'media',  14, 2,    '[]'),
  ('half-plate-armor',      'armadura', 'media',  15, 2,    '[]'),
  ('ring-mail',             'armadura', 'pesada', 14, 0,    '[]'),
  ('chain-mail',            'armadura', 'pesada', 16, 0,    '[]'),
  ('splint-armor',          'armadura', 'pesada', 17, 0,    '[]'),
  ('plate-armor',           'armadura', 'pesada', 18, 0,    '[]'),
  ('shield',                'escudo',   null,     null, null,
     '[{"alvo":"ac","valor":2,"tipo":"soma"}]')
) as v(slug, categoria, tipo_armadura, ac_base, max_des, modificadores)
where a.slug = v.slug
  and a.campanha_id is null;

-- =============================================================================
-- 6. Catálogo: itens mágicos de AC (magic_items) — modificadores 'ac'.
-- Não existem no SRD carregado; inseridos com slug próprio, ON CONFLICT para
-- poder rodar duas vezes sem duplicar. category/rarity seguem o vocabulário já
-- usado no banco (armor, wondrous_item...; very_rare com underscore).
-- =============================================================================

insert into magic_items (
  slug, name_en, name_pt, category, rarity, requires_attunement,
  description_en, description_pt, categoria, equipavel, modificadores
)
values
  ('armor-plus-1', 'Armor, +1', 'Armadura +1', 'armor', 'rare', false,
   'You have a +1 bonus to AC while wearing this armor.',
   'Você recebe +1 de bônus na CA enquanto usa esta armadura.',
   'outro', true, '[{"alvo":"ac","valor":1,"tipo":"soma"}]'),
  ('armor-plus-2', 'Armor, +2', 'Armadura +2', 'armor', 'very_rare', false,
   'You have a +2 bonus to AC while wearing this armor.',
   'Você recebe +2 de bônus na CA enquanto usa esta armadura.',
   'outro', true, '[{"alvo":"ac","valor":2,"tipo":"soma"}]'),
  ('armor-plus-3', 'Armor, +3', 'Armadura +3', 'armor', 'legendary', false,
   'You have a +3 bonus to AC while wearing this armor.',
   'Você recebe +3 de bônus na CA enquanto usa esta armadura.',
   'outro', true, '[{"alvo":"ac","valor":3,"tipo":"soma"}]'),
  ('shield-plus-1', 'Shield, +1', 'Escudo +1', 'armor', 'uncommon', false,
   'While holding this shield, you have a +1 bonus to AC. This bonus is in addition to the shield''s normal bonus to AC.',
   'Enquanto empunha este escudo, você recebe +1 na CA, somado ao bônus normal do escudo.',
   'outro', true, '[{"alvo":"ac","valor":1,"tipo":"soma"}]'),
  ('shield-plus-2', 'Shield, +2', 'Escudo +2', 'armor', 'rare', false,
   'While holding this shield, you have a +2 bonus to AC. This bonus is in addition to the shield''s normal bonus to AC.',
   'Enquanto empunha este escudo, você recebe +2 na CA, somado ao bônus normal do escudo.',
   'outro', true, '[{"alvo":"ac","valor":2,"tipo":"soma"}]'),
  ('shield-plus-3', 'Shield, +3', 'Escudo +3', 'armor', 'very_rare', false,
   'While holding this shield, you have a +3 bonus to AC. This bonus is in addition to the shield''s normal bonus to AC.',
   'Enquanto empunha este escudo, você recebe +3 na CA, somado ao bônus normal do escudo.',
   'outro', true, '[{"alvo":"ac","valor":3,"tipo":"soma"}]'),
  ('ring-of-protection', 'Ring of Protection', 'Anel de Proteção', 'wondrous_item', 'rare', true,
   'You gain a +1 bonus to AC and saving throws while wearing this ring.',
   'Você recebe +1 na CA e nos testes de resistência enquanto usa este anel.',
   'outro', true, '[{"alvo":"ac","valor":1,"tipo":"soma"}]'),
  ('cloak-of-protection', 'Cloak of Protection', 'Manto de Proteção', 'wondrous_item', 'uncommon', true,
   'You gain a +1 bonus to AC and saving throws while you wear this cloak.',
   'Você recebe +1 na CA e nos testes de resistência enquanto veste este manto.',
   'outro', true, '[{"alvo":"ac","valor":1,"tipo":"soma"}]')
on conflict (slug) do update set
  categoria = excluded.categoria,
  equipavel = excluded.equipavel,
  modificadores = excluded.modificadores;

-- A parte de saves (+1 em testes de resistência) dos anel/manto de proteção
-- fica fora do escopo da UI: entra na estrutura como alvo 'save_*' mais tarde.

-- =============================================================================
-- 7. Backfill de inventario_itens (item_ref + catálogo). Só toca linhas ainda
-- sem categoria — não sobrescreve item que o jogador editou.
-- =============================================================================

update inventario_itens i set
  categoria        = a.categoria,
  equipavel        = true,
  tipo_armadura    = a.tipo_armadura,
  ac_base          = a.ac_base,
  max_des          = a.max_des,
  req_for          = a.strength_requirement,
  desv_furtividade = a.stealth_disadvantage,
  modificadores    = a.modificadores
from equipment_armor a
where i.item_ref = a.slug
  and i.categoria is null
  and a.categoria is not null;

update inventario_itens i set
  categoria     = m.categoria,
  equipavel     = m.equipavel,
  modificadores = m.modificadores
from magic_items m
where i.item_ref = m.slug
  and i.categoria is null
  and m.categoria is not null;

-- Armas já eram "equipáveis" no sentido de ataque; marca a categoria para a aba
-- Equipados poder listá-las sem depender de i.tipo.
update inventario_itens set categoria = 'arma', equipavel = true
 where categoria is null and tipo = 'arma';

-- Realtime/RLS: nada a fazer — as colunas novas herdam as policies da tabela.
-- Em batalha_combatentes, a trigger restringir_update_combatente_a_armas deixa
-- só o mestre (e o service role) gravar ac_override; jogador não consegue.

commit;

-- =============================================================================
-- 8. RELATÓRIOS PARA REVISÃO (somente leitura). Rode e me mande o resultado.
-- =============================================================================

-- 8a. Personagens com ca = 10: ac_manual ficou null (AC passa a ser calculado).
--     Revise: se o 10 era digitado de propósito, ajuste ac_manual à mão.
-- select p.id, p.nome, p.classe, p.nivel, p.user_id, c.nome as campanha
--   from personagens p left join campanhas c on c.id = p.campanha_id
--  where p.ca = 10 order by c.nome, p.nome;

-- 8b. Linhas de inventario_itens de armadura/escudo/magico sem correspondência
--     no catálogo (sem categoria após o backfill):
-- select i.id, i.personagem_id, i.nome, i.tipo, i.item_ref
--   from inventario_itens i
--  where i.categoria is null and i.tipo in ('armadura', 'magico')
--  order by i.tipo, i.nome;
