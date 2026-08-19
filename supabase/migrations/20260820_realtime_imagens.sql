-- Fase 7 — complemento: telas de Mapas e Imagens assinam Realtime na
-- tabela imagens (upload/toggle de visibilidade de outra aba/usuário sem
-- precisar de reload). A publicação supabase_realtime ainda não incluía
-- essa tabela — mesmo padrão de 20260816_realtime_personagens.sql.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'imagens'
  ) then
    alter publication supabase_realtime add table imagens;
  end if;
end $$;

-- REPLICA IDENTITY FULL: sem isso o payload de UPDATE/DELETE do Realtime
-- não traz os valores antigos (ex.: tipo/visivel_jogadores em um DELETE),
-- e a reconciliação no cliente fica cega.
alter table imagens replica identity full;
