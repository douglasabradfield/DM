-- iniciarBatalha() criava a linha com status 'preparacao'; a promoção para
-- 'ativa' só acontecia em confirmarIniciativa(), que a mesa por cartas nunca
-- chama (ela sorteia a ordem por cartas físicas, não pelo botão de
-- iniciativa). Resultado: a batalha ficava presa em 'preparacao' e a rota
-- /api/batalha/acao recusava toda ação de jogador com "não está ativa" — o
-- DM não percebia nada porque TabelaCombate escreve direto no banco.
--
-- iniciarBatalha() agora cria a linha já 'ativa'; esta migration corrige as
-- batalhas existentes que ficaram presas no estado antigo.

UPDATE batalhas SET status = 'ativa'
 WHERE status = 'preparacao';
