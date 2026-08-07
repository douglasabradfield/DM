-- Fase 1 — Batalha Viva: schema, RLS e realtime
-- Substitui o design antigo (batalhas/combatentes/log_batalha) por um schema
-- alinhado às interfaces Combatente/EntradaLog de src/types/batalha.ts.
--
-- Nesta fase o store/componentes NÃO são alterados — apenas o schema é criado.

-- =========================================================================
-- 0. Remove tabelas legadas (design abandonado)
-- =========================================================================
-- batalhas/combatentes/log_batalha vinham de um design anterior que nunca
-- chegou a ser usado pelo app (o store persiste via sessoes.batalha_estado).
-- Confirmado antes do DROP: 0 linhas nas três, sem policies, sem views,
-- sem funções/triggers referenciando os nomes, e a única FK de entrada é
-- das próprias tabelas legadas entre si (combatentes/log_batalha -> batalhas).
DROP TABLE IF EXISTS "public"."log_batalha" CASCADE;
DROP TABLE IF EXISTS "public"."combatentes" CASCADE;
DROP TABLE IF EXISTS "public"."batalhas" CASCADE;

-- =========================================================================
-- 1. Tabelas
-- =========================================================================

CREATE TABLE "public"."batalhas" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "campanha_id" uuid NOT NULL REFERENCES "public"."campanhas"(id) ON DELETE CASCADE,
    "sessao_id" uuid REFERENCES "public"."sessoes"(id),
    "nome" text NOT NULL,
    "status" text NOT NULL DEFAULT 'preparacao'
        CHECK (status IN ('preparacao', 'ativa', 'pausada', 'encerrada')),
    "rodada_atual" integer NOT NULL DEFAULT 1,
    "turno_combatente_id" uuid,
    "iniciativa_confirmada" boolean NOT NULL DEFAULT false,
    "xp_distribuido" boolean NOT NULL DEFAULT false,
    "criado_por" uuid REFERENCES "public"."profiles"(id),
    "criado_em" timestamptz NOT NULL DEFAULT now(),
    "encerrada_em" timestamptz
);

COMMENT ON COLUMN "public"."batalhas"."turno_combatente_id" IS 'Quem está agindo — sem FK proposital (batalha_combatentes ainda não existe neste ponto e o combatente pode ser removido sem invalidar o turno)';

-- No máximo uma batalha não encerrada por campanha
CREATE UNIQUE INDEX "idx_batalha_ativa_por_campanha"
    ON "public"."batalhas"(campanha_id) WHERE status <> 'encerrada';


CREATE TABLE "public"."batalha_combatentes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "batalha_id" uuid NOT NULL REFERENCES "public"."batalhas"(id) ON DELETE CASCADE,
    "personagem_id" uuid REFERENCES "public"."personagens"(id),
    "monster_id" bigint REFERENCES "public"."monsters"(id),
    "controlado_por" uuid REFERENCES "public"."profiles"(id),
    "nome" text NOT NULL,
    "tipo" text NOT NULL CHECK (tipo IN ('jogador', 'monstro', 'npc', 'aliado')),
    "ordem" integer NOT NULL DEFAULT 0,
    "iniciativa" integer,
    "ca" integer NOT NULL DEFAULT 10,
    "pv_maximo" integer NOT NULL DEFAULT 1,
    "pv_atual" integer NOT NULL DEFAULT 1,
    "pv_temporarios" integer NOT NULL DEFAULT 0,
    "condicoes" text[] NOT NULL DEFAULT '{}',
    "espacos_magia" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "slots_monstro" jsonb,
    "ataques_estruturados" jsonb,
    "dados_monstro" jsonb,
    "dados_personagem" jsonb,
    "nivel" integer,
    "notas" text,
    "resistencias" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "imunidades" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "vulnerabilidades" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "morto" boolean NOT NULL DEFAULT false,
    "ausente" boolean NOT NULL DEFAULT false,
    "vantagem" text CHECK (vantagem IN ('vantagem', 'desvantagem')),
    "inspiracao" integer NOT NULL DEFAULT 0,
    "dano_total" integer NOT NULL DEFAULT 0,
    "cura_total" integer NOT NULL DEFAULT 0,
    "criado_em" timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN "public"."batalha_combatentes"."slots_monstro" IS 'Slots de magia locais para monstro/NPC sem personagem_id — Record<nivel, restantes>, distinto de espacos_magia (usado quando há personagem vinculado)';
COMMENT ON COLUMN "public"."batalha_combatentes"."ataques_estruturados" IS 'MonsterAction[] copiados do bestiário ao adicionar o combatente';
COMMENT ON COLUMN "public"."batalha_combatentes"."dados_monstro" IS 'DadosMonstroSimples — cr, tipo, habilidades, acoes, atributos, xp, slug (fallback para monstro sem monster_actions estruturado)';
COMMENT ON COLUMN "public"."batalha_combatentes"."dados_personagem" IS '{ nivel, classe, ataques[] } — snapshot do PJ no momento em que entrou na batalha';

CREATE INDEX "idx_batalha_combatentes_batalha_ordem"
    ON "public"."batalha_combatentes"(batalha_id, ordem);


CREATE TABLE "public"."batalha_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "batalha_id" uuid NOT NULL REFERENCES "public"."batalhas"(id) ON DELETE CASCADE,
    "rodada" integer NOT NULL,
    "turno" integer,
    "tipo" text NOT NULL CHECK (tipo IN (
        'dano', 'cura', 'condicao', 'morte', 'magia', 'iniciativa', 'nota', 'sistema',
        'ataque', 'ataque_extra', 'usar_item', 'ajudar', 'agarrar', 'recuar',
        'acao_bonus_ataque', 'acao_bonus_magia', 'cura_bonus', 'forma_alternativa',
        'ataque_oportunidade', 'contra_magia', 'escudo', 'absorver_elementos', 'queda_controlada', 'outra_reacao',
        'pv_temporarios', 'estabilizar', 'condicao_aplicada', 'condicao_removida', 'concentracao',
        'outro'
    )),
    "autor_id" uuid REFERENCES "public"."batalha_combatentes"(id) ON DELETE SET NULL,
    "autor_nome" text,
    "alvo_id" uuid REFERENCES "public"."batalha_combatentes"(id) ON DELETE SET NULL,
    "alvo_nome" text,
    "valor" integer,
    "tipo_dano" text,
    "descricao" text,
    "criado_em" timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN "public"."batalha_log"."autor_nome" IS 'Desnormalizado de propósito: o log é registro histórico e precisa continuar legível se o combatente for removido';
COMMENT ON COLUMN "public"."batalha_log"."alvo_nome" IS 'Desnormalizado de propósito: o log é registro histórico e precisa continuar legível se o combatente for removido';

CREATE INDEX "idx_batalha_log_batalha_criado"
    ON "public"."batalha_log"(batalha_id, criado_em);


-- =========================================================================
-- 2. RLS
-- =========================================================================

ALTER TABLE "public"."batalhas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."batalha_combatentes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."batalha_log" ENABLE ROW LEVEL SECURITY;

-- batalhas: SELECT para DM ou membro ativo; escrita apenas DM (Fase 1)
CREATE POLICY "batalhas_select" ON "public"."batalhas" FOR SELECT USING (
    campanha_id IN (SELECT id FROM "public"."campanhas" WHERE dm_id = auth.uid())
    OR campanha_id IN (SELECT campanha_id FROM "public"."campanha_membros" WHERE user_id = auth.uid() AND status = 'ativo')
);

CREATE POLICY "batalhas_insert" ON "public"."batalhas" FOR INSERT WITH CHECK (
    campanha_id IN (SELECT id FROM "public"."campanhas" WHERE dm_id = auth.uid())
);

CREATE POLICY "batalhas_update" ON "public"."batalhas" FOR UPDATE USING (
    campanha_id IN (SELECT id FROM "public"."campanhas" WHERE dm_id = auth.uid())
);

CREATE POLICY "batalhas_delete" ON "public"."batalhas" FOR DELETE USING (
    campanha_id IN (SELECT id FROM "public"."campanhas" WHERE dm_id = auth.uid())
);

-- batalha_combatentes: mesma regra, via join em batalhas
CREATE POLICY "batalha_combatentes_select" ON "public"."batalha_combatentes" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        WHERE b.id = batalha_combatentes.batalha_id
        AND (
            b.campanha_id IN (SELECT id FROM "public"."campanhas" WHERE dm_id = auth.uid())
            OR b.campanha_id IN (SELECT campanha_id FROM "public"."campanha_membros" WHERE user_id = auth.uid() AND status = 'ativo')
        )
    )
);

CREATE POLICY "batalha_combatentes_insert" ON "public"."batalha_combatentes" FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        JOIN "public"."campanhas" c ON c.id = b.campanha_id
        WHERE b.id = batalha_combatentes.batalha_id AND c.dm_id = auth.uid()
    )
);

CREATE POLICY "batalha_combatentes_update" ON "public"."batalha_combatentes" FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        JOIN "public"."campanhas" c ON c.id = b.campanha_id
        WHERE b.id = batalha_combatentes.batalha_id AND c.dm_id = auth.uid()
    )
);

CREATE POLICY "batalha_combatentes_delete" ON "public"."batalha_combatentes" FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        JOIN "public"."campanhas" c ON c.id = b.campanha_id
        WHERE b.id = batalha_combatentes.batalha_id AND c.dm_id = auth.uid()
    )
);

-- batalha_log: mesma regra, via join em batalhas
CREATE POLICY "batalha_log_select" ON "public"."batalha_log" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        WHERE b.id = batalha_log.batalha_id
        AND (
            b.campanha_id IN (SELECT id FROM "public"."campanhas" WHERE dm_id = auth.uid())
            OR b.campanha_id IN (SELECT campanha_id FROM "public"."campanha_membros" WHERE user_id = auth.uid() AND status = 'ativo')
        )
    )
);

CREATE POLICY "batalha_log_insert" ON "public"."batalha_log" FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        JOIN "public"."campanhas" c ON c.id = b.campanha_id
        WHERE b.id = batalha_log.batalha_id AND c.dm_id = auth.uid()
    )
);

CREATE POLICY "batalha_log_update" ON "public"."batalha_log" FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        JOIN "public"."campanhas" c ON c.id = b.campanha_id
        WHERE b.id = batalha_log.batalha_id AND c.dm_id = auth.uid()
    )
);

CREATE POLICY "batalha_log_delete" ON "public"."batalha_log" FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM "public"."batalhas" b
        JOIN "public"."campanhas" c ON c.id = b.campanha_id
        WHERE b.id = batalha_log.batalha_id AND c.dm_id = auth.uid()
    )
);


-- =========================================================================
-- 3. Realtime
-- =========================================================================
-- Publication confirmada via pg_publication: "supabase_realtime"

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."batalhas";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."batalha_combatentes";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."batalha_log";

-- REPLICA IDENTITY FULL: sem isso o payload de UPDATE do Realtime não traz
-- os valores antigos e a reconciliação no cliente fica cega.
ALTER TABLE "public"."batalhas" REPLICA IDENTITY FULL;
ALTER TABLE "public"."batalha_combatentes" REPLICA IDENTITY FULL;
ALTER TABLE "public"."batalha_log" REPLICA IDENTITY FULL;
