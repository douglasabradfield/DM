-- ============================================================
-- Remove tabelas mortas: espacos_magia, locais, campaign_members
-- ============================================================
-- As três tinham zero linhas e zero políticas de RLS. campaign_members era
-- a tabela de membro do sistema de convite B (/convite?token= e
-- /entrar?c=), removido do código: o app lê associação só de
-- campanha_membros. Os slots de magia vivem em personagens.slots_magia.
--
-- campaign_invites fica de fora de propósito: tem 3 linhas a revisar.
--
-- Executar manualmente no SQL Editor do Supabase (sem supabase db push).

drop table if exists public.espacos_magia;
drop table if exists public.locais;
drop table if exists public.campaign_members;
