-- Fase 3.5 — complemento: /mesa em modo sessão assina Realtime na tabela
-- personagens (para refletir PV/condições/slots editados por outro cliente
-- sem reload). A publicação supabase_realtime ainda não incluía essa tabela.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'personagens'
  ) then
    alter publication supabase_realtime add table personagens;
  end if;
end $$;
