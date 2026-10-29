-- Grava o username enviado no cadastro (options.data.username) ao criar o profile.
-- Antes o trigger só copiava nome, e o upsert feito pelo navegador logo após o signUp
-- rodava sem sessão (confirmação de email) e era bloqueado pelo RLS.
-- Se o username for inválido ou já estiver em uso (corrida), cria o profile sem ele:
-- o app pede para a pessoa definir antes de usar.
create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer
    set search_path = public
    as $$
declare
  v_username text := lower(btrim(new.raw_user_meta_data->>'username'));
begin
  if v_username is null or v_username !~ '^[a-z0-9_]{3,30}$'
     or exists (select 1 from public.profiles where username = v_username) then
    v_username := null;
  end if;

  insert into public.profiles (id, email, nome, username)
  values (new.id, new.email, new.raw_user_meta_data->>'nome', v_username);
  return new;
end;
$$;

-- Checagem de disponibilidade para o cadastro (sem sessão) e para a conta.
-- O SELECT em profiles só enxerga a própria linha, então o cliente não consegue checar sozinho.
create or replace function public.username_disponivel(p_username text) returns boolean
    language sql security definer stable
    set search_path = public
    as $$
  select not exists (
    select 1 from public.profiles
    where username = lower(btrim(p_username)) and id is distinct from auth.uid()
  );
$$;

grant execute on function public.username_disponivel(text) to anon, authenticated;
