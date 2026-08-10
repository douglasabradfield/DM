-- Fase 4 — Padroniza personagens.moedas para { pc, pp, pe, po, pl, custom }
--
-- Achado: o jsonb tinha "platina" (campo que FichaPersonagem.tsx sempre leu
-- e gravou) E "pl" (campo que a Fase 3.5 já gravava via
-- /api/mesa/acao → ajuste_ouro, ver MoedasDb em src/app/api/mesa/acao/route.ts
-- e ModalOuro/ajustarOuroSessao em src/components/mesa/MesaCliente.tsx).
-- Resultado: ajustes de platina feitos pela tela de mesa gravavam em "pl" e
-- nunca apareciam na ficha (que só lê "platina"), e vice-versa — dois saldos
-- de platina fantasmas por personagem. Corrigido no código (FichaPersonagem
-- agora lê/grava "pl", igual à API) — este script consolida os dados.
--
-- "custom" é mantido: é lido/escrito por FichaPersonagem.tsx (moeda especial
-- nomeável por campanha, campanhas.moeda_custom_nome) — não é campo fantasma.
--
-- Idempotente: se "platina" não existir mais e "pl" já estiver certo, o
-- UPDATE não muda nada.

-- =============================================================================
-- 1. ANTES — moedas atuais de todos os personagens (para conferência)
-- =============================================================================

select id, nome, moedas from personagens where moedas is not null order by nome;

-- =============================================================================
-- 2. PRÉVIA DO DEPOIS (só leitura, não grava) — pl = coalesce(pl, platina,
-- 0); remove "platina"; pc/pp/pe/po/custom preservados como estão.
-- =============================================================================

select
  id, nome,
  jsonb_build_object(
    'pc',     coalesce((moedas->>'pc')::integer, 0),
    'pp',     coalesce((moedas->>'pp')::integer, 0),
    'pe',     coalesce((moedas->>'pe')::integer, 0),
    'po',     coalesce((moedas->>'po')::integer, 0),
    'pl',     coalesce((moedas->>'pl')::integer, (moedas->>'platina')::integer, 0),
    'custom', coalesce((moedas->>'custom')::integer, 0)
  ) as moedas_depois
from personagens
where moedas is not null
order by nome;

-- =============================================================================
-- 3. APLICA
-- =============================================================================

update personagens
set moedas = jsonb_build_object(
  'pc',     coalesce((moedas->>'pc')::integer, 0),
  'pp',     coalesce((moedas->>'pp')::integer, 0),
  'pe',     coalesce((moedas->>'pe')::integer, 0),
  'po',     coalesce((moedas->>'po')::integer, 0),
  'pl',     coalesce((moedas->>'pl')::integer, (moedas->>'platina')::integer, 0),
  'custom', coalesce((moedas->>'custom')::integer, 0)
)
where moedas is not null;

-- =============================================================================
-- 4. CONFERÊNCIA FINAL
-- =============================================================================

select id, nome, moedas from personagens where moedas is not null order by nome;
