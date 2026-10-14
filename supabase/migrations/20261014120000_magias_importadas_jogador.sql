-- ============================================================
-- Importador de magias liberado para jogadores + revisão do admin
-- ============================================================
-- A gravação passa por /api/magias/importar (service role, valida usuário
-- e payload). Nenhuma policy nova em spells: o INSERT do importador não usa
-- RLS (service role) e as policies atuais de UPDATE/DELETE não mudam.
--
-- Colunas novas em spells:
--   origem        text    — 'importada_jogador' nas magias importadas; NULL nas demais
--   importada_por uuid    — quem importou
--   revisada      boolean — magias já existentes ficam true; o importador grava false
--
-- notificacoes JÁ EXISTE (user_id, tipo, titulo, mensagem, link, lida, criado_em,
-- RLS "notificacoes_proprio"). Nada muda nela, a não ser entrar na publicação
-- Realtime para o sino atualizar sem polling. Não restringimos INSERT a service
-- role porque vários fluxos do app inserem notificações pelo client.

-- 1) Colunas. ADD COLUMN com DEFAULT true marca todas as linhas existentes como
--    revisadas; depois o DEFAULT passa a false para linhas novas, como pedido.
ALTER TABLE spells
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS importada_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisada boolean NOT NULL DEFAULT true;

ALTER TABLE spells ALTER COLUMN revisada SET DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_spells_pendentes_revisao ON spells(id) WHERE revisada = false;

-- 2) Realtime para o sino de notificações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notificacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
  END IF;
END $$;

-- Conferência (rodar depois):
-- SELECT count(*) FILTER (WHERE revisada) AS revisadas, count(*) FILTER (WHERE NOT revisada) AS pendentes FROM spells;
