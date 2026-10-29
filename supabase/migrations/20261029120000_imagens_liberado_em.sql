-- imagens.liberado_em — quando o mestre liberou o item para os jogadores.
-- Usado para listar primeiro, na aba Mapa do celular, o que foi liberado por último.
--
-- NÃO aplicado em produção. Rode no SQL Editor do Supabase ANTES de publicar o
-- código desta branch (a aba Mapa da /mesa passa a ler imagens.liberado_em).
--
-- ROLLBACK:
--   drop trigger if exists trg_imagens_liberado_em on imagens;
--   drop function if exists imagens_define_liberado_em();
--   alter table imagens drop column if exists liberado_em;
--
-- Itens já liberados ficam com liberado_em = null (não são reescritos); na
-- ordenação caem depois dos que têm data e entre si seguem criado_em desc.

begin;

alter table imagens add column if not exists liberado_em timestamptz;

create or replace function imagens_define_liberado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.visivel_jogadores is true
     and (tg_op = 'INSERT' or old.visivel_jogadores is distinct from true) then
    new.liberado_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_imagens_liberado_em on imagens;
create trigger trg_imagens_liberado_em
  before insert or update of visivel_jogadores on imagens
  for each row execute function imagens_define_liberado_em();

commit;
