-- Adiciona coluna de cooldown de aventura por campanha
-- Usada para limitar planos com aventura 'limitado' (ex: DM Solo) a 1 aventura por N meses

ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS aventura_bloqueada_ate timestamptz;
