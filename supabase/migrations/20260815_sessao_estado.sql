-- Fase 3.5 — Sessão como estado de primeira classe
-- Desacopla sessoes de batalhas (uma sessão pode conter 0..N batalhas),
-- adiciona sessao_log (ações fora de combate), condições/dados de vida
-- persistentes em personagens, e vínculo direto de diario_entradas a
-- batalha_id (para não depender de "1 batalha por sessão").
--
-- Rode no SQL Editor do Supabase, na ordem. O passo 1b é só leitura —
-- confira o resultado antes de deixar o 1c rodar.
--
-- Idempotente: seguro rodar de novo do zero se algum passo falhar no meio
-- (usa IF EXISTS/IF NOT EXISTS em todo lugar barato de fazer isso).

-- =============================================================================
-- 1. Normaliza sessoes.status e reforça o enum
-- IMPORTANTE: o constraint precisa cair ANTES de qualquer UPDATE que grave
-- 'encerrada' — senão o UPDATE viola o constraint antigo (só aceitava
-- 'ativa'/'pausada'/'concluida'). Essa era a ordem errada da primeira
-- tentativa desta migration; corrigido aqui.
-- =============================================================================

alter table sessoes drop constraint if exists sessoes_status_check;

update sessoes set status = 'encerrada' where status = 'concluida';

-- 1b. PRÉVIA (rodar sozinha, conferir antes de seguir) — mostra campanhas
-- com mais de uma sessão 'ativa'/'pausada' simultânea (resquício do modelo
-- antigo, em que cada batalha criava sua própria sessão). Já considera que
-- 'concluida' virou 'encerrada' acima, então filtra direto por ativa/pausada
-- em vez de reproduzir esse detalhe de novo.
--
-- select s.campanha_id, c.nome as campanha_nome, s.id, s.numero, s.titulo,
--        s.data, s.iniciada_em, s.status
-- from sessoes s
-- join campanhas c on c.id = s.campanha_id
-- where s.status in ('ativa', 'pausada')
--   and s.campanha_id in (
--     select campanha_id from sessoes where status in ('ativa', 'pausada')
--     group by campanha_id having count(*) > 1
--   )
-- order by s.campanha_id, coalesce(s.iniciada_em, s.data) desc;
--
-- Verificado em 2026-08-09: só a campanha "Vecna" tem duas sessões 'ativa'
-- simultâneas (90e0153c-da85-4abb-86a3-bf482c421450, iniciada 2026-07-16, e
-- d2938967-1905-4fef-a58c-6843d5958d38, iniciada 2026-06-26). A 1c abaixo
-- mantém a mais recente e encerra a mais antiga.

-- 1c. Limpeza — encerra todas as sessões 'ativa'/'pausada' exceto a mais
-- recente de cada campanha (por iniciada_em/data, desempatando por numero),
-- para não violar o índice único da etapa 2. Idempotente: na segunda
-- execução não sobra nenhuma linha 'ativa'/'pausada' duplicada para pegar.
update sessoes s
   set status = 'encerrada',
       concluida_em = coalesce(concluida_em, now())
 where status <> 'encerrada'
   and id <> (
     select s2.id from sessoes s2
      where s2.campanha_id = s.campanha_id
        and s2.status <> 'encerrada'
      order by coalesce(s2.iniciada_em, s2.data) desc nulls last,
               s2.numero desc nulls last
      limit 1
   );

-- Reconstrói o constraint só depois dos dados já estarem limpos.
alter table sessoes add constraint sessoes_status_check
  check (status in ('ativa', 'pausada', 'encerrada'));

-- =============================================================================
-- 2. No máximo uma sessão viva por campanha
-- =============================================================================

create unique index if not exists sessoes_uma_ativa_por_campanha
  on sessoes (campanha_id) where status <> 'encerrada';

-- =============================================================================
-- 3. RLS de sessoes: leitura para DM + membros ativos, escrita só DM
-- (mesmo padrão já usado em batalhas/batalha_log)
-- =============================================================================

drop policy if exists "Users can manage own sessions" on sessoes;

drop policy if exists sessoes_select on sessoes;
create policy sessoes_select on sessoes for select using (
  campanha_id in (select id from campanhas where dm_id = auth.uid())
  or campanha_id in (select campanha_id from campanha_membros where user_id = auth.uid() and status = 'ativo')
);
drop policy if exists sessoes_insert on sessoes;
create policy sessoes_insert on sessoes for insert with check (
  campanha_id in (select id from campanhas where dm_id = auth.uid())
);
drop policy if exists sessoes_update on sessoes;
create policy sessoes_update on sessoes for update using (
  campanha_id in (select id from campanhas where dm_id = auth.uid())
);
drop policy if exists sessoes_delete on sessoes;
create policy sessoes_delete on sessoes for delete using (
  campanha_id in (select id from campanhas where dm_id = auth.uid())
);

-- =============================================================================
-- 4. Log de ações fora de combate — separado de diario_entradas (narrativo,
-- curado, com visibilidade granular) pelo mesmo motivo que batalha_log é
-- separado de diario_entradas hoje: log bruto de mecânica não pode poluir
-- o diário. Sem rodada/turno (não existem fora de combate).
-- =============================================================================

create table if not exists sessao_log (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references sessoes(id) on delete cascade,
  tipo text not null,
  autor_id uuid,
  autor_nome text,
  personagem_id uuid references personagens(id),
  valor integer,
  tipo_dano text,
  descricao text,
  criado_em timestamptz not null default now()
);

alter table sessao_log enable row level security;

drop policy if exists sessao_log_select on sessao_log;
create policy sessao_log_select on sessao_log for select using (
  sessao_id in (
    select id from sessoes where campanha_id in (select id from campanhas where dm_id = auth.uid())
    union
    select id from sessoes where campanha_id in (select campanha_id from campanha_membros where user_id = auth.uid() and status = 'ativo')
  )
);
drop policy if exists sessao_log_insert on sessao_log;
create policy sessao_log_insert on sessao_log for insert with check (
  sessao_id in (select id from sessoes where campanha_id in (select id from campanhas where dm_id = auth.uid()))
);
-- Escritas de jogador (via /api/mesa/acao) usam o service role, que ignora RLS.

-- =============================================================================
-- 5. Condições fora de combate (hoje só existem em batalha_combatentes,
-- que morre quando a batalha acaba)
-- =============================================================================

alter table personagens add column if not exists condicoes text[] not null default '{}';

-- 5b. Dados de vida (descanso) — versão simples, sem rastrear tipo de dado
-- por classe; dados_vida_total nulo assume = nivel do personagem no app.
alter table personagens
  add column if not exists dados_vida_total integer,
  add column if not exists dados_vida_usados integer not null default 0;

-- =============================================================================
-- 6. Vincula entrada de diário de batalha à batalha, não só à sessão —
-- necessário porque uma sessão agora pode conter N batalhas, e o
-- encerramento de batalha precisa achar a entrada de diário certa.
-- =============================================================================

alter table diario_entradas add column if not exists batalha_id uuid references batalhas(id) on delete set null;

-- =============================================================================
-- 7. Realtime — alter publication não suporta "IF NOT EXISTS" para ADD
-- TABLE, então checa antes via pg_publication_tables.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sessoes'
  ) then
    alter publication supabase_realtime add table sessoes;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sessao_log'
  ) then
    alter publication supabase_realtime add table sessao_log;
  end if;
end $$;
