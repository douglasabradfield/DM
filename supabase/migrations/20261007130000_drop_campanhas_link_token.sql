-- ============================================================
-- Remove campanhas.link_token
-- ============================================================
-- Era o token do link de entrada do sistema de convite B (/entrar?c=),
-- removido do código. Sem leitor, e nenhuma campanha com valor preenchido.
--
-- Não confundir com campanha_membros.token_convite, o token do convite
-- que funciona (/convite/<token>), que continua em uso.
--
-- Executar manualmente no SQL Editor do Supabase (sem supabase db push).

alter table public.campanhas drop column if exists link_token;
