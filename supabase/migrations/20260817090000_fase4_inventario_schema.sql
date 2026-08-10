-- Fase 4 — Inventário como tabela própria
-- Cria inventario_itens (ao lado de personagens.inventario, que fica
-- congelado como legado até a UI migrar — não é apagado aqui) e
-- transferencias (histórico de item/moeda entre personagens). RLS: leitura
-- para dono do personagem/DM, escrita só service role — toda alteração
-- passa por /api/mesa/acao (mesmo padrão de sessao_log/batalha_log em
-- 20260815_sessao_estado.sql).
--
-- Rode no SQL Editor do Supabase, na ordem. Depois rode
-- 20260817091000_fase4_inventario_migrar_dados.sql para popular a partir
-- do jsonb existente, e 20260817092000_fase4_moedas_limpeza.sql para
-- padronizar personagens.moedas.
--
-- Idempotente: seguro rodar de novo (IF NOT EXISTS / DROP POLICY IF EXISTS
-- em todo lugar barato de fazer isso).

-- =============================================================================
-- 1. inventario_itens
-- item_ref é TEXT de propósito: o jsonb legado mistura slug (compêndio) e
-- número (id avulso). Sem FK — os itens vêm de tabelas diferentes
-- (equipment_*, magic_items) e alguns são avulsos criados pelo DM.
-- =============================================================================

create table if not exists inventario_itens (
  id uuid primary key default gen_random_uuid(),
  personagem_id uuid not null references personagens(id) on delete cascade,
  item_ref text,
  nome text not null,
  tipo text,
  raridade text,
  descricao text,
  quantidade integer not null default 1 check (quantidade >= 0),
  equipado boolean not null default false,
  notas text,
  criado_em timestamptz not null default now()
);

create index if not exists inventario_itens_personagem_id_idx on inventario_itens (personagem_id);

alter table inventario_itens enable row level security;
alter table inventario_itens replica identity full;

drop policy if exists inventario_itens_select on inventario_itens;
create policy inventario_itens_select on inventario_itens for select using (
  personagem_id in (
    select id from personagens where user_id = auth.uid()
    union
    select id from personagens where campanha_id in (select id from campanhas where dm_id = auth.uid())
  )
);
-- Sem policy de insert/update/delete para authenticated — toda escrita
-- (dono ou DM) passa pelo service role via /api/mesa/acao.

-- =============================================================================
-- 2. transferencias — histórico de item/moeda entre personagens
-- =============================================================================

create table if not exists transferencias (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid references sessoes(id),
  de_personagem_id uuid references personagens(id) on delete set null,
  para_personagem_id uuid references personagens(id) on delete set null,
  de_nome text,
  para_nome text,
  tipo text not null check (tipo in ('item', 'moeda')),
  item_nome text,
  quantidade integer,
  moedas jsonb,
  criado_por uuid references profiles(id),
  criado_em timestamptz not null default now()
);

alter table transferencias enable row level security;

-- Visibilidade via sessao_id (mesmo padrão de sessao_log) — de_/para_
-- personagem_id são desnormalizados só para sobreviver à exclusão do
-- personagem (ON DELETE SET NULL), não usados para RLS.
drop policy if exists transferencias_select on transferencias;
create policy transferencias_select on transferencias for select using (
  sessao_id in (
    select id from sessoes where campanha_id in (select id from campanhas where dm_id = auth.uid())
    union
    select id from sessoes where campanha_id in (select campanha_id from campanha_membros where user_id = auth.uid() and status = 'ativo')
  )
);
-- Sem policy de insert/update/delete para authenticated — mesma razão acima.

-- =============================================================================
-- 3. Realtime — inventario_itens
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inventario_itens'
  ) then
    alter publication supabase_realtime add table inventario_itens;
  end if;
end $$;

-- =============================================================================
-- 4. Default de personagens.moedas para o novo schema padronizado
-- (pc/pp/pe/po/pl/custom) — a migração dos dados existentes está em
-- 20260817092000_fase4_moedas_limpeza.sql.
-- =============================================================================

alter table personagens alter column moedas set default '{"pc": 0, "pp": 0, "pe": 0, "po": 0, "pl": 0, "custom": 0}'::jsonb;
