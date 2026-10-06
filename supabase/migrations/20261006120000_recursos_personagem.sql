-- ============================================================
-- Recursos de classe com usos limitados (Canalizar Divindade,
-- Forma Selvagem, Segundo Fôlego, Imposição de Mãos, ...)
-- ============================================================
-- Uma linha por recurso por personagem: total, usados e gatilho de
-- recuperação. Linhas de origem 'classe' são semeadas pela ficha a partir
-- de src/lib/dados-dnd/recursos-classe.ts; 'manual' e 'item' são criadas
-- pelo jogador e nunca apagadas pela semeadura.
--
-- Executar manualmente no SQL Editor do Supabase (sem supabase db push).

create table if not exists public.recursos_personagem (
  id uuid primary key default extensions.uuid_generate_v4(),
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  recurso_id text,              -- id do arquivo de dado; null quando origem = 'manual'
  nome text not null,
  total integer not null default 0,
  usados integer not null default 0,
  recuperacao text not null,    -- 'longo' | 'curto' | 'um_curto_todos_longo'
  unidade text not null default 'usos',  -- 'usos' | 'pontos'
  origem text not null default 'classe', -- 'classe' | 'manual' | 'item'
  ordem integer not null default 0,
  nota text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),

  constraint recursos_personagem_total_check check (total >= 0),
  constraint recursos_personagem_usados_check check (usados >= 0),
  constraint recursos_personagem_usados_total_check check (usados <= total),
  constraint recursos_personagem_recuperacao_check check (recuperacao in ('longo', 'curto', 'um_curto_todos_longo')),
  constraint recursos_personagem_unidade_check check (unidade in ('usos', 'pontos')),
  constraint recursos_personagem_origem_check check (origem in ('classe', 'manual', 'item'))
);

create unique index if not exists recursos_personagem_unico
  on public.recursos_personagem (personagem_id, recurso_id)
  where recurso_id is not null;

create index if not exists recursos_personagem_personagem_idx
  on public.recursos_personagem (personagem_id);

-- ------------------------------------------------------------
-- RLS — as QUATRO policies. Sem policy de UPDATE/INSERT o PostgREST
-- descarta a escrita sem erro (bug de monstros e de magias_personagem,
-- ver 20260907120000_magias_personagem_update_policy.sql).
--
-- Predicado copiado de magias_personagem_select/insert/delete:
-- dono do personagem OU DM da campanha.
-- ------------------------------------------------------------
alter table public.recursos_personagem enable row level security;

drop policy if exists "recursos_personagem_select" on public.recursos_personagem;
create policy "recursos_personagem_select" on public.recursos_personagem
  for select
  using (
    personagem_id in (
      select personagens.id
      from personagens
      where personagens.user_id = auth.uid()
         or personagens.campanha_id in (
              select campanhas.id from campanhas where campanhas.dm_id = auth.uid()
            )
    )
  );

drop policy if exists "recursos_personagem_insert" on public.recursos_personagem;
create policy "recursos_personagem_insert" on public.recursos_personagem
  for insert
  with check (
    personagem_id in (
      select personagens.id
      from personagens
      where personagens.user_id = auth.uid()
         or personagens.campanha_id in (
              select campanhas.id from campanhas where campanhas.dm_id = auth.uid()
            )
    )
  );

drop policy if exists "recursos_personagem_update" on public.recursos_personagem;
create policy "recursos_personagem_update" on public.recursos_personagem
  for update
  using (
    personagem_id in (
      select personagens.id
      from personagens
      where personagens.user_id = auth.uid()
         or personagens.campanha_id in (
              select campanhas.id from campanhas where campanhas.dm_id = auth.uid()
            )
    )
  )
  with check (
    personagem_id in (
      select personagens.id
      from personagens
      where personagens.user_id = auth.uid()
         or personagens.campanha_id in (
              select campanhas.id from campanhas where campanhas.dm_id = auth.uid()
            )
    )
  );

drop policy if exists "recursos_personagem_delete" on public.recursos_personagem;
create policy "recursos_personagem_delete" on public.recursos_personagem
  for delete
  using (
    personagem_id in (
      select personagens.id
      from personagens
      where personagens.user_id = auth.uid()
         or personagens.campanha_id in (
              select campanhas.id from campanhas where campanhas.dm_id = auth.uid()
            )
    )
  );

-- ------------------------------------------------------------
-- Realtime: a mesa mostra os recursos em leitura e precisa refletir o
-- descanso (gravado pela API com service role) e os cliques da ficha.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'recursos_personagem'
  ) then
    alter publication supabase_realtime add table recursos_personagem;
  end if;
end $$;
