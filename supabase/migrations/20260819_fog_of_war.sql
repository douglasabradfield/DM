-- Fase 7 — Fog of War para mapas.
-- Uma linha por imagem (tipo='mapa') com fog ativo, guardando só as células
-- reveladas (índice = linha * colunas + coluna) — mantém o payload pequeno
-- enquanto a maior parte do mapa está oculta, que é o caso comum.

create table if not exists mapa_fog (
  id uuid primary key default gen_random_uuid(),
  imagem_id uuid not null unique references imagens(id) on delete cascade,
  campanha_id uuid not null references campanhas(id) on delete cascade,
  ativo boolean not null default true,
  colunas integer not null,
  linhas integer not null,
  reveladas integer[] not null default '{}',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references profiles(id)
);

create index if not exists idx_mapa_fog_campanha on mapa_fog(campanha_id);

alter table mapa_fog enable row level security;

-- Leitura: DM da campanha ou membro ativo (mesmo padrão de sessoes/sessao_log).
drop policy if exists mapa_fog_select on mapa_fog;
create policy mapa_fog_select on mapa_fog for select using (
  campanha_id in (select id from campanhas where dm_id = auth.uid())
  or campanha_id in (select campanha_id from campanha_membros where user_id = auth.uid() and status = 'ativo')
);

-- Sem policy de INSERT/UPDATE/DELETE para authenticated — toda escrita passa
-- pela API (/api/mapa/fog), que usa o service role e ignora RLS. Isso garante
-- que a operação de conjunto (revelar/ocultar) sempre roda no servidor, nunca
-- como um UPDATE direto do cliente que poderia sobrescrever outra aba/DM.

-- Realtime — alter publication não suporta "IF NOT EXISTS" para ADD TABLE,
-- então checa antes via pg_publication_tables.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'mapa_fog'
  ) then
    alter publication supabase_realtime add table mapa_fog;
  end if;
end $$;

-- REPLICA IDENTITY FULL: sem isso o payload de UPDATE do Realtime não traz
-- os valores antigos e a reconciliação no cliente fica cega.
alter table mapa_fog replica identity full;
