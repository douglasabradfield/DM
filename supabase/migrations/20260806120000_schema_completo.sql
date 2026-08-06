


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, new.raw_user_meta_data->>'nome');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usuario_pode_ver_campanha"("campanha_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campanhas 
    WHERE id = campanha_id AND dm_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.campanha_membros
    WHERE campanha_membros.campanha_id = campanha_id
    AND user_id = auth.uid()
    AND status = 'ativo'
  );
$$;


ALTER FUNCTION "public"."usuario_pode_ver_campanha"("campanha_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."antecedentes" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "skills_en" "text" NOT NULL,
    "skills_pt" "text" NOT NULL,
    "tools_en" "text",
    "tools_pt" "text",
    "languages_count" integer DEFAULT 0,
    "equipment_en" "text",
    "equipment_pt" "text",
    "feature_name_en" "text",
    "feature_name_pt" "text",
    "feature_desc_en" "text",
    "feature_desc_pt" "text",
    "trait_suggestions_pt" "text",
    "ideal_suggestions_pt" "text",
    "bond_suggestions_pt" "text",
    "flaw_suggestions_pt" "text",
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."antecedentes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."antecedentes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."antecedentes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."antecedentes_id_seq" OWNED BY "public"."antecedentes"."id";



CREATE TABLE IF NOT EXISTS "public"."assinaturas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "plano" "text" NOT NULL,
    "status" "text" NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "periodo_inicio" timestamp with time zone,
    "periodo_fim" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "assinaturas_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'cancelado'::"text", 'pendente'::"text", 'trial'::"text"])))
);


ALTER TABLE "public"."assinaturas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aventuras" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campanha_id" "uuid",
    "titulo" "text" NOT NULL,
    "titulo_original" "text",
    "idioma_original" "text" DEFAULT 'pt'::"text",
    "conteudo_json" "jsonb",
    "arquivo_url" "text",
    "processada" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."aventuras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batalhas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sessao_id" "uuid",
    "nome" "text",
    "rodada_atual" integer DEFAULT 1,
    "turno_atual" integer DEFAULT 0,
    "ativa" boolean DEFAULT true,
    "estado_json" "jsonb",
    "iniciada_em" timestamp with time zone DEFAULT "now"(),
    "encerrada_em" timestamp with time zone
);


ALTER TABLE "public"."batalhas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campanha_id" "uuid",
    "email" "text" NOT NULL,
    "token" "text" NOT NULL,
    "usado" boolean DEFAULT false,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campanha_id" "uuid",
    "user_id" "uuid",
    "papel" "text" DEFAULT 'jogador'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "campaign_members_papel_check" CHECK (("papel" = ANY (ARRAY['dm'::"text", 'jogador'::"text"])))
);


ALTER TABLE "public"."campaign_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campanha_membros" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campanha_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "papel" "text" DEFAULT 'jogador'::"text" NOT NULL,
    "plano_efetivo" "text" DEFAULT 'free'::"text" NOT NULL,
    "status" "text" DEFAULT 'convidado'::"text" NOT NULL,
    "token_convite" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "aceito_em" timestamp with time zone,
    CONSTRAINT "campanha_membros_papel_check" CHECK (("papel" = ANY (ARRAY['dm'::"text", 'jogador'::"text"]))),
    CONSTRAINT "campanha_membros_status_check" CHECK (("status" = ANY (ARRAY['convidado'::"text", 'ativo'::"text", 'removido'::"text"])))
);


ALTER TABLE "public"."campanha_membros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campanhas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "dm_id" "uuid",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "sistema" "text" DEFAULT 'dnd5e'::"text",
    "ativa" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'ativa'::"text",
    "encerrada_em" timestamp with time zone,
    "moeda_custom_nome" "text" DEFAULT 'Especial'::"text",
    "resumo_final" "text",
    "link_token" "uuid",
    "aventura_bloqueada_ate" timestamp with time zone,
    "deletada" boolean DEFAULT false,
    "sessao_data" timestamp with time zone,
    "sessao_formato" "text",
    "sessao_local" "text",
    CONSTRAINT "campanhas_sessao_formato_check" CHECK (("sessao_formato" = ANY (ARRAY['presencial'::"text", 'online'::"text"]))),
    CONSTRAINT "campanhas_status_check" CHECK (("status" = ANY (ARRAY['ativa'::"text", 'encerrada'::"text"])))
);


ALTER TABLE "public"."campanhas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "hit_die" integer NOT NULL,
    "armor_proficiencies_en" "text",
    "armor_proficiencies_pt" "text",
    "weapon_proficiencies_en" "text",
    "weapon_proficiencies_pt" "text",
    "tool_proficiencies_en" "text",
    "tool_proficiencies_pt" "text",
    "saving_throws_en" "text",
    "saving_throws_pt" "text",
    "skill_choices_count" integer DEFAULT 2,
    "skill_choices_en" "text",
    "skill_choices_pt" "text",
    "is_spellcaster" boolean DEFAULT false,
    "spellcasting_ability_en" "text",
    "spellcasting_ability_pt" "text",
    "spell_slots_table" "jsonb",
    "equipment_options_en" "text",
    "equipment_options_pt" "text",
    "features_level1_en" "text",
    "features_level1_pt" "text",
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."classes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."classes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."classes_id_seq" OWNED BY "public"."classes"."id";



CREATE TABLE IF NOT EXISTS "public"."combatentes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "batalha_id" "uuid",
    "personagem_id" "uuid",
    "nome" "text" NOT NULL,
    "tipo" "text",
    "iniciativa" integer DEFAULT 0,
    "ca" integer DEFAULT 10,
    "pv_maximo" integer NOT NULL,
    "pv_atual" integer NOT NULL,
    "pv_temporarios" integer DEFAULT 0,
    "ausente" boolean DEFAULT false,
    "morto" boolean DEFAULT false,
    "condicoes" "jsonb" DEFAULT '[]'::"jsonb",
    "resistencias" "jsonb" DEFAULT '[]'::"jsonb",
    "imunidades" "jsonb" DEFAULT '[]'::"jsonb",
    "vulnerabilidades" "jsonb" DEFAULT '[]'::"jsonb",
    "espacos_magia" "jsonb" DEFAULT '{}'::"jsonb",
    "notas" "text",
    "dados_monstro" "jsonb",
    "ordem" integer DEFAULT 0,
    CONSTRAINT "combatentes_tipo_check" CHECK (("tipo" = ANY (ARRAY['jogador'::"text", 'monstro'::"text", 'npc'::"text"])))
);


ALTER TABLE "public"."combatentes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."condicoes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nome" "text" NOT NULL,
    "icone" "text",
    "descricao" "text" NOT NULL,
    "efeitos" "jsonb" DEFAULT '[]'::"jsonb",
    "como_sair" "text",
    "sistema" "text" DEFAULT 'dnd5e'::"text",
    "nome_en" "text"
);


ALTER TABLE "public"."condicoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conteudo_personalizado" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "dados" "jsonb" NOT NULL,
    "publico" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conteudo_personalizado_tipo_check" CHECK (("tipo" = ANY (ARRAY['monstro'::"text", 'magia'::"text", 'item'::"text"])))
);


ALTER TABLE "public"."conteudo_personalizado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diario_entradas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sessao_id" "uuid",
    "campanha_id" "uuid",
    "tipo" "text",
    "titulo" "text",
    "conteudo" "text" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "criado_por" "uuid",
    "visibilidade" "text" DEFAULT 'grupo'::"text",
    "visibilidade_jogador_id" "uuid",
    CONSTRAINT "diario_entradas_tipo_check" CHECK (("tipo" = ANY (ARRAY['nota'::"text", 'batalha'::"text", 'npc'::"text", 'item'::"text", 'plot'::"text"]))),
    CONSTRAINT "diario_entradas_visibilidade_check" CHECK (("visibilidade" = ANY (ARRAY['dm'::"text", 'grupo'::"text", 'privado'::"text", 'jogador_especifico'::"text"])))
);


ALTER TABLE "public"."diario_entradas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment_armor" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "category_en" "text" NOT NULL,
    "category_pt" "text" NOT NULL,
    "base_ac_formula_en" "text" NOT NULL,
    "base_ac_formula_pt" "text" NOT NULL,
    "strength_requirement" integer,
    "stealth_disadvantage" boolean DEFAULT false NOT NULL,
    "weight_lb" numeric(6,2),
    "cost_cp" integer,
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."equipment_armor" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."equipment_armor_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."equipment_armor_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."equipment_armor_id_seq" OWNED BY "public"."equipment_armor"."id";



CREATE TABLE IF NOT EXISTS "public"."equipment_gear" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "category_en" "text" NOT NULL,
    "category_pt" "text" NOT NULL,
    "cost_gp" numeric(10,2),
    "weight_lb" numeric(6,2),
    "description_en" "text",
    "description_pt" "text",
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."equipment_gear" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."equipment_gear_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."equipment_gear_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."equipment_gear_id_seq" OWNED BY "public"."equipment_gear"."id";



CREATE TABLE IF NOT EXISTS "public"."equipment_tools" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "tool_category_en" "text" NOT NULL,
    "tool_category_pt" "text" NOT NULL,
    "ability_en" "text",
    "ability_pt" "text",
    "weight_lb" numeric(6,2),
    "cost_cp" integer,
    "utilize_en" "text",
    "utilize_pt" "text",
    "craft_en" "text",
    "craft_pt" "text",
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."equipment_tools" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."equipment_tools_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."equipment_tools_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."equipment_tools_id_seq" OWNED BY "public"."equipment_tools"."id";



CREATE TABLE IF NOT EXISTS "public"."equipment_weapons" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "category_en" "text" NOT NULL,
    "category_pt" "text" NOT NULL,
    "weapon_group_en" "text" NOT NULL,
    "weapon_group_pt" "text" NOT NULL,
    "damage_dice" "text" NOT NULL,
    "damage_type_en" "text" NOT NULL,
    "damage_type_pt" "text" NOT NULL,
    "properties_en" "text",
    "properties_pt" "text",
    "mastery_en" "text",
    "mastery_pt" "text",
    "weight_lb" numeric(6,2),
    "cost_cp" integer,
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."equipment_weapons" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."equipment_weapons_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."equipment_weapons_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."equipment_weapons_id_seq" OWNED BY "public"."equipment_weapons"."id";



CREATE TABLE IF NOT EXISTS "public"."espacos_magia" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "personagem_id" "uuid",
    "nivel" integer NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "utilizados" integer DEFAULT 0 NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "espacos_magia_nivel_check" CHECK ((("nivel" >= 1) AND ("nivel" <= 9)))
);


ALTER TABLE "public"."espacos_magia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedbacks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "pagina" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "sugestao_correcao" "text",
    "item_referencia" "text",
    "item_tipo" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "resposta_admin" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "resposta" "text",
    "respondido_em" timestamp with time zone,
    "respondido_por" "uuid",
    CONSTRAINT "feedbacks_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'analisando'::"text", 'resolvido'::"text", 'ignorado'::"text"]))),
    CONSTRAINT "feedbacks_tipo_check" CHECK (("tipo" = ANY (ARRAY['problema'::"text", 'sugestao'::"text", 'elogio'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."feedbacks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imagens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campanha_id" "uuid",
    "nome" "text" NOT NULL,
    "url" "text" NOT NULL,
    "tipo" "text" DEFAULT 'imagem'::"text",
    "descricao" "text",
    "compartilhado" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "visivel_jogadores" boolean DEFAULT false,
    "storage_path" "text",
    "tipo_upload" "text" DEFAULT 'url'::"text",
    "titulo" "text",
    CONSTRAINT "imagens_tipo_check" CHECK (("tipo" = ANY (ARRAY['imagem'::"text", 'mapa'::"text"]))),
    CONSTRAINT "imagens_tipo_upload_check" CHECK (("tipo_upload" = ANY (ARRAY['url'::"text", 'storage'::"text"])))
);


ALTER TABLE "public"."imagens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locais" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "aventura_id" "uuid",
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "capitulo" "text",
    "texto_narrativo" "text",
    "notas_dm" "text",
    "encontros" "jsonb",
    "npcs" "jsonb",
    "ordem" integer DEFAULT 0
);


ALTER TABLE "public"."locais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_batalha" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "batalha_id" "uuid",
    "rodada" integer NOT NULL,
    "turno" integer,
    "tipo" "text",
    "origem" "text",
    "alvo" "text",
    "valor" integer,
    "tipo_dano" "text",
    "descricao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "log_batalha_tipo_check" CHECK (("tipo" = ANY (ARRAY['dano'::"text", 'cura'::"text", 'condicao'::"text", 'morte'::"text", 'magia'::"text", 'iniciativa'::"text", 'nota'::"text"])))
);


ALTER TABLE "public"."log_batalha" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."magias_personagem" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "personagem_id" "uuid" NOT NULL,
    "magia_id" "uuid",
    "nome" "text" NOT NULL,
    "nivel" integer DEFAULT 0 NOT NULL,
    "preparada" boolean DEFAULT false,
    "classe_conjuradora" "text" DEFAULT ''::"text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "spell_id" bigint
);


ALTER TABLE "public"."magias_personagem" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."magic_item_spells" (
    "id" bigint NOT NULL,
    "magic_item_id" bigint NOT NULL,
    "spell_id" bigint NOT NULL,
    "spell_name_en" "text" NOT NULL,
    "spell_name_pt" "text" NOT NULL,
    "notes_en" "text",
    "notes_pt" "text"
);


ALTER TABLE "public"."magic_item_spells" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."magic_item_spells_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."magic_item_spells_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."magic_item_spells_id_seq" OWNED BY "public"."magic_item_spells"."id";



CREATE TABLE IF NOT EXISTS "public"."magic_items" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "category" "text" NOT NULL,
    "rarity" "text" NOT NULL,
    "requires_attunement" boolean DEFAULT false NOT NULL,
    "attunement_notes_en" "text",
    "attunement_notes_pt" "text",
    "base_item_type_en" "text",
    "base_item_type_pt" "text",
    "is_consumable" boolean DEFAULT false NOT NULL,
    "is_cursed" boolean DEFAULT false NOT NULL,
    "is_sentient" boolean DEFAULT false NOT NULL,
    "activation_type" "text",
    "activation_notes_en" "text",
    "activation_notes_pt" "text",
    "command_word" boolean,
    "has_charges" boolean DEFAULT false NOT NULL,
    "charges_max" integer,
    "recharge_formula" "text",
    "recharge_timing_en" "text",
    "recharge_timing_pt" "text",
    "gp_value" numeric(12,2),
    "description_en" "text" NOT NULL,
    "description_pt" "text" NOT NULL,
    "mechanics_en" "text",
    "mechanics_pt" "text",
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."magic_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."magic_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."magic_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."magic_items_id_seq" OWNED BY "public"."magic_items"."id";



CREATE TABLE IF NOT EXISTS "public"."monster_actions" (
    "id" bigint NOT NULL,
    "monster_id" bigint NOT NULL,
    "action_type" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "name_en" "text",
    "attack_type" "text",
    "attack_bonus" integer,
    "reach_ft" integer,
    "range_normal_ft" integer,
    "range_long_ft" integer,
    "target_pt" "text",
    "damage_dice" "text",
    "damage_type_en" "text",
    "damage_type_pt" "text",
    "damage2_dice" "text",
    "damage2_type_en" "text",
    "damage2_type_pt" "text",
    "save_ability" "text",
    "save_dc" integer,
    "save_effect_pt" "text",
    "recharge" "text",
    "condition_applied_pt" "text",
    "legendary_cost" integer DEFAULT 1,
    "description_pt" "text" NOT NULL,
    CONSTRAINT "monster_actions_action_type_check" CHECK (("action_type" = ANY (ARRAY['action'::"text", 'bonus_action'::"text", 'reaction'::"text", 'legendary_action'::"text", 'lair_action'::"text", 'multiattack'::"text", 'trait'::"text"]))),
    CONSTRAINT "monster_actions_attack_type_check" CHECK (("attack_type" = ANY (ARRAY['melee_weapon'::"text", 'ranged_weapon'::"text", 'melee_spell'::"text", 'ranged_spell'::"text"]))),
    CONSTRAINT "monster_actions_save_ability_check" CHECK (("save_ability" = ANY (ARRAY['str'::"text", 'dex'::"text", 'con'::"text", 'int'::"text", 'wis'::"text", 'cha'::"text"])))
);


ALTER TABLE "public"."monster_actions" OWNER TO "postgres";


ALTER TABLE "public"."monster_actions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."monster_actions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."monster_condition_immunities" (
    "id" bigint NOT NULL,
    "monster_id" bigint NOT NULL,
    "condition_en" "text" NOT NULL,
    "condition_pt" "text" NOT NULL
);


ALTER TABLE "public"."monster_condition_immunities" OWNER TO "postgres";


ALTER TABLE "public"."monster_condition_immunities" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."monster_condition_immunities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."monster_damage_modifiers" (
    "id" bigint NOT NULL,
    "monster_id" bigint NOT NULL,
    "modifier_type" "text" NOT NULL,
    "damage_type_en" "text" NOT NULL,
    "damage_type_pt" "text" NOT NULL,
    "note_pt" "text",
    CONSTRAINT "monster_damage_modifiers_modifier_type_check" CHECK (("modifier_type" = ANY (ARRAY['resistance'::"text", 'immunity'::"text", 'vulnerability'::"text"])))
);


ALTER TABLE "public"."monster_damage_modifiers" OWNER TO "postgres";


ALTER TABLE "public"."monster_damage_modifiers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."monster_damage_modifiers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."monster_saves" (
    "id" bigint NOT NULL,
    "monster_id" bigint NOT NULL,
    "ability" "text" NOT NULL,
    "bonus" integer NOT NULL,
    CONSTRAINT "monster_saves_ability_check" CHECK (("ability" = ANY (ARRAY['str'::"text", 'dex'::"text", 'con'::"text", 'int'::"text", 'wis'::"text", 'cha'::"text"])))
);


ALTER TABLE "public"."monster_saves" OWNER TO "postgres";


ALTER TABLE "public"."monster_saves" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."monster_saves_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."monster_skills" (
    "id" bigint NOT NULL,
    "monster_id" bigint NOT NULL,
    "skill_en" "text" NOT NULL,
    "skill_pt" "text" NOT NULL,
    "bonus" integer NOT NULL
);


ALTER TABLE "public"."monster_skills" OWNER TO "postgres";


ALTER TABLE "public"."monster_skills" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."monster_skills_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."monsters" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "size_en" "text" NOT NULL,
    "size_pt" "text" NOT NULL,
    "type_en" "text" NOT NULL,
    "type_pt" "text" NOT NULL,
    "alignment_en" "text" NOT NULL,
    "alignment_pt" "text" NOT NULL,
    "armor_class" integer NOT NULL,
    "hit_points" integer NOT NULL,
    "speed_en" "text" NOT NULL,
    "speed_pt" "text" NOT NULL,
    "str_score" integer NOT NULL,
    "dex_score" integer NOT NULL,
    "con_score" integer NOT NULL,
    "int_score" integer NOT NULL,
    "wis_score" integer NOT NULL,
    "cha_score" integer NOT NULL,
    "senses_en" "text",
    "senses_pt" "text",
    "languages_en" "text",
    "languages_pt" "text",
    "challenge_rating" "text" NOT NULL,
    "xp" integer NOT NULL,
    "proficiency_bonus" "text" NOT NULL,
    "traits_en" "text",
    "traits_pt" "text",
    "actions_en" "text",
    "actions_pt" "text",
    "traits_rules_en" "text",
    "traits_rules_pt" "text",
    "actions_rules_en" "text",
    "actions_rules_pt" "text",
    "source_page_start" integer,
    "source_page_end" integer,
    "blindsight_ft" integer,
    "darkvision_ft" integer,
    "tremorsense_ft" integer,
    "truesight_ft" integer,
    "passive_perception" integer,
    "hit_dice" "text"
);


ALTER TABLE "public"."monsters" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."monsters_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."monsters_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."monsters_id_seq" OWNED BY "public"."monsters"."id";



CREATE TABLE IF NOT EXISTS "public"."notificacoes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensagem" "text",
    "lida" boolean DEFAULT false,
    "link" "text",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notificacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personagens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campanha_id" "uuid",
    "jogador_nome" "text" NOT NULL,
    "jogador_email" "text",
    "nome" "text" NOT NULL,
    "classe" "text",
    "nivel" integer DEFAULT 1,
    "antecedente" "text",
    "raca" "text",
    "alinhamento" "text",
    "pontos_experiencia" integer DEFAULT 0,
    "forca" integer DEFAULT 10,
    "destreza" integer DEFAULT 10,
    "constituicao" integer DEFAULT 10,
    "inteligencia" integer DEFAULT 10,
    "sabedoria" integer DEFAULT 10,
    "carisma" integer DEFAULT 10,
    "ca" integer DEFAULT 10,
    "iniciativa" integer DEFAULT 0,
    "deslocamento" integer DEFAULT 9,
    "pv_maximo" integer DEFAULT 10,
    "pv_atual" integer DEFAULT 10,
    "pv_temporarios" integer DEFAULT 0,
    "dado_vida" "text" DEFAULT 'd8'::"text",
    "bonus_proficiencia" integer DEFAULT 2,
    "inspiracao" integer DEFAULT 0,
    "salvaguardas" "jsonb" DEFAULT '{}'::"jsonb",
    "pericias" "jsonb" DEFAULT '{}'::"jsonb",
    "ataques" "jsonb" DEFAULT '[]'::"jsonb",
    "equipamento" "text",
    "outras_proficiencias" "text",
    "tracos_personalidade" "text",
    "ideais" "text",
    "vinculos" "text",
    "fraquezas" "text",
    "caracteristicas_talentos" "text",
    "idade" "text",
    "altura" "text",
    "peso" "text",
    "cor_olhos" "text",
    "cor_pele" "text",
    "cor_cabelo" "text",
    "aparencia" "text",
    "historia" "text",
    "aliados_organizacoes" "text",
    "tesouros" "text",
    "resistencias" "jsonb" DEFAULT '[]'::"jsonb",
    "imunidades" "jsonb" DEFAULT '[]'::"jsonb",
    "vulnerabilidades" "jsonb" DEFAULT '[]'::"jsonb",
    "dndbeyond_url" "text",
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "tipo_personagem" "text" DEFAULT 'jogador'::"text",
    "inventario" "jsonb" DEFAULT '[]'::"jsonb",
    "user_id" "uuid",
    "imagem_url" "text",
    "percepcao_passiva" integer,
    "moedas" "jsonb" DEFAULT '{"pc": 0, "pe": 0, "po": 0, "pp": 0, "custom": 0, "platina": 0}'::"jsonb",
    "visibilidade" "text" DEFAULT 'grupo'::"text",
    "visibilidade_jogador_id" "uuid",
    "slots_magia" "jsonb" DEFAULT '{}'::"jsonb",
    "classe_conjuradora" "text",
    "atributo_conjuracao" "text",
    "cd_magia" integer,
    CONSTRAINT "personagens_tipo_personagem_check" CHECK (("tipo_personagem" = ANY (ARRAY['jogador'::"text", 'npc'::"text", 'monstro'::"text"]))),
    CONSTRAINT "personagens_visibilidade_check" CHECK (("visibilidade" = ANY (ARRAY['privado'::"text", 'grupo'::"text", 'jogador_especifico'::"text"])))
);


ALTER TABLE "public"."personagens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "nome" "text",
    "plano" "text" DEFAULT 'free'::"text",
    "stripe_customer_id" "text",
    "avatar_url" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "is_admin" boolean DEFAULT false NOT NULL,
    "username" "text",
    "telefone" "text",
    CONSTRAINT "profiles_plano_check" CHECK (("plano" = ANY (ARRAY['free'::"text", 'heroi'::"text", 'solo'::"text", 'mesa_pro'::"text", 'guild_master'::"text", 'dm_supremo'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."racas" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "size_en" "text" NOT NULL,
    "size_pt" "text" NOT NULL,
    "speed" integer DEFAULT 30 NOT NULL,
    "str_bonus" integer DEFAULT 0 NOT NULL,
    "dex_bonus" integer DEFAULT 0 NOT NULL,
    "con_bonus" integer DEFAULT 0 NOT NULL,
    "int_bonus" integer DEFAULT 0 NOT NULL,
    "wis_bonus" integer DEFAULT 0 NOT NULL,
    "cha_bonus" integer DEFAULT 0 NOT NULL,
    "traits_en" "text",
    "traits_pt" "text",
    "languages_en" "text",
    "languages_pt" "text",
    "proficiencies_en" "text",
    "proficiencies_pt" "text",
    "darkvision" integer DEFAULT 0,
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."racas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."racas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."racas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."racas_id_seq" OWNED BY "public"."racas"."id";



CREATE TABLE IF NOT EXISTS "public"."sessoes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campanha_id" "uuid",
    "numero" integer,
    "titulo" "text",
    "data" timestamp with time zone DEFAULT "now"(),
    "resumo" "text",
    "resumo_ia" "text",
    "notas_dm" "text",
    "duracao_minutos" integer,
    "encerrada" boolean DEFAULT false,
    "status" "text" DEFAULT 'ativa'::"text",
    "batalha_estado" "jsonb",
    "iniciada_em" timestamp with time zone DEFAULT "now"(),
    "pausada_em" timestamp with time zone,
    "concluida_em" timestamp with time zone,
    "total_rodadas" integer DEFAULT 0,
    CONSTRAINT "sessoes_status_check" CHECK (("status" = ANY (ARRAY['ativa'::"text", 'pausada'::"text", 'concluida'::"text"])))
);


ALTER TABLE "public"."sessoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spells" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "level" integer NOT NULL,
    "school_en" "text" NOT NULL,
    "school_pt" "text" NOT NULL,
    "casting_time_en" "text" NOT NULL,
    "casting_time_pt" "text" NOT NULL,
    "range_en" "text" NOT NULL,
    "range_pt" "text" NOT NULL,
    "components_en" "text" NOT NULL,
    "components_pt" "text" NOT NULL,
    "duration_en" "text" NOT NULL,
    "duration_pt" "text" NOT NULL,
    "concentration" boolean DEFAULT false NOT NULL,
    "ritual" boolean DEFAULT false NOT NULL,
    "description_en" "text" NOT NULL,
    "description_pt" "text" NOT NULL,
    "classes_en" "text" NOT NULL,
    "classes_pt" "text" NOT NULL,
    "source_page_start" integer,
    "source_page_end" integer,
    "damage_dice" "text",
    "damage_type_en" "text",
    "damage_type_pt" "text",
    "damage2_dice" "text",
    "damage2_type_en" "text",
    "damage2_type_pt" "text",
    "save_ability" "text",
    "save_effect" "text",
    "attack_type" "text",
    "roller" "text",
    "upcast_dice" "text",
    "conditions_applied_pt" "text",
    "heal_dice" "text",
    "aoe_type" "text",
    "aoe_size_ft" integer
);


ALTER TABLE "public"."spells" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."spells_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."spells_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."spells_id_seq" OWNED BY "public"."spells"."id";



CREATE TABLE IF NOT EXISTS "public"."subracas" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "raca_id" bigint NOT NULL,
    "name_en" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "str_bonus" integer DEFAULT 0 NOT NULL,
    "dex_bonus" integer DEFAULT 0 NOT NULL,
    "con_bonus" integer DEFAULT 0 NOT NULL,
    "int_bonus" integer DEFAULT 0 NOT NULL,
    "wis_bonus" integer DEFAULT 0 NOT NULL,
    "cha_bonus" integer DEFAULT 0 NOT NULL,
    "traits_en" "text",
    "traits_pt" "text",
    "proficiencies_en" "text",
    "proficiencies_pt" "text",
    "darkvision" integer DEFAULT 0,
    "source_page_start" integer,
    "source_page_end" integer
);


ALTER TABLE "public"."subracas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."subracas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."subracas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."subracas_id_seq" OWNED BY "public"."subracas"."id";



CREATE TABLE IF NOT EXISTS "public"."tipos_dano" (
    "id" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "nome_en" "text" NOT NULL,
    "icone" "text" NOT NULL,
    "cor" "text" NOT NULL,
    "descricao" "text"
);


ALTER TABLE "public"."tipos_dano" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uso_ia" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "mes" integer NOT NULL,
    "ano" integer NOT NULL,
    "total_mensagens" integer DEFAULT 0
);


ALTER TABLE "public"."uso_ia" OWNER TO "postgres";


ALTER TABLE ONLY "public"."antecedentes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."antecedentes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."classes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."classes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."equipment_armor" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."equipment_armor_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."equipment_gear" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."equipment_gear_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."equipment_tools" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."equipment_tools_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."equipment_weapons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."equipment_weapons_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."magic_item_spells" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."magic_item_spells_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."magic_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."magic_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."monsters" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."monsters_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."racas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."racas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."spells" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."spells_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."subracas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."subracas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."antecedentes"
    ADD CONSTRAINT "antecedentes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."antecedentes"
    ADD CONSTRAINT "antecedentes_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."assinaturas"
    ADD CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aventuras"
    ADD CONSTRAINT "aventuras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batalhas"
    ADD CONSTRAINT "batalhas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_invites"
    ADD CONSTRAINT "campaign_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_invites"
    ADD CONSTRAINT "campaign_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_campanha_id_user_id_key" UNIQUE ("campanha_id", "user_id");



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campanha_membros"
    ADD CONSTRAINT "campanha_membros_campanha_id_email_key" UNIQUE ("campanha_id", "email");



ALTER TABLE ONLY "public"."campanha_membros"
    ADD CONSTRAINT "campanha_membros_campanha_user_unique" UNIQUE ("campanha_id", "user_id");



ALTER TABLE ONLY "public"."campanha_membros"
    ADD CONSTRAINT "campanha_membros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campanha_membros"
    ADD CONSTRAINT "campanha_membros_token_convite_key" UNIQUE ("token_convite");



ALTER TABLE ONLY "public"."campanhas"
    ADD CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."combatentes"
    ADD CONSTRAINT "combatentes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."condicoes"
    ADD CONSTRAINT "condicoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conteudo_personalizado"
    ADD CONSTRAINT "conteudo_personalizado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diario_entradas"
    ADD CONSTRAINT "diario_entradas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_armor"
    ADD CONSTRAINT "equipment_armor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_armor"
    ADD CONSTRAINT "equipment_armor_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."equipment_gear"
    ADD CONSTRAINT "equipment_gear_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_gear"
    ADD CONSTRAINT "equipment_gear_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."equipment_tools"
    ADD CONSTRAINT "equipment_tools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_tools"
    ADD CONSTRAINT "equipment_tools_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."equipment_weapons"
    ADD CONSTRAINT "equipment_weapons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_weapons"
    ADD CONSTRAINT "equipment_weapons_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."espacos_magia"
    ADD CONSTRAINT "espacos_magia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imagens"
    ADD CONSTRAINT "imagens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locais"
    ADD CONSTRAINT "locais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_batalha"
    ADD CONSTRAINT "log_batalha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magias_personagem"
    ADD CONSTRAINT "magias_personagem_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_item_spells"
    ADD CONSTRAINT "magic_item_spells_magic_item_id_spell_id_key" UNIQUE ("magic_item_id", "spell_id");



ALTER TABLE ONLY "public"."magic_item_spells"
    ADD CONSTRAINT "magic_item_spells_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_items"
    ADD CONSTRAINT "magic_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_items"
    ADD CONSTRAINT "magic_items_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."monster_actions"
    ADD CONSTRAINT "monster_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monster_condition_immunities"
    ADD CONSTRAINT "monster_condition_immunities_monster_id_condition_en_key" UNIQUE ("monster_id", "condition_en");



ALTER TABLE ONLY "public"."monster_condition_immunities"
    ADD CONSTRAINT "monster_condition_immunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monster_damage_modifiers"
    ADD CONSTRAINT "monster_damage_modifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monster_saves"
    ADD CONSTRAINT "monster_saves_monster_id_ability_key" UNIQUE ("monster_id", "ability");



ALTER TABLE ONLY "public"."monster_saves"
    ADD CONSTRAINT "monster_saves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monster_skills"
    ADD CONSTRAINT "monster_skills_monster_id_skill_en_key" UNIQUE ("monster_id", "skill_en");



ALTER TABLE ONLY "public"."monster_skills"
    ADD CONSTRAINT "monster_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monsters"
    ADD CONSTRAINT "monsters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monsters"
    ADD CONSTRAINT "monsters_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."notificacoes"
    ADD CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personagens"
    ADD CONSTRAINT "personagens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."racas"
    ADD CONSTRAINT "racas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."racas"
    ADD CONSTRAINT "racas_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."subracas"
    ADD CONSTRAINT "subracas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subracas"
    ADD CONSTRAINT "subracas_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tipos_dano"
    ADD CONSTRAINT "tipos_dano_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uso_ia"
    ADD CONSTRAINT "uso_ia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uso_ia"
    ADD CONSTRAINT "uso_ia_user_id_mes_ano_key" UNIQUE ("user_id", "mes", "ano");



CREATE INDEX "idx_monster_actions_monster_id" ON "public"."monster_actions" USING "btree" ("monster_id");



CREATE INDEX "idx_monster_actions_type" ON "public"."monster_actions" USING "btree" ("action_type");



CREATE INDEX "idx_monster_condition_imm_monster_id" ON "public"."monster_condition_immunities" USING "btree" ("monster_id");



CREATE INDEX "idx_monster_damage_mods_monster_id" ON "public"."monster_damage_modifiers" USING "btree" ("monster_id");



CREATE INDEX "idx_monster_saves_monster_id" ON "public"."monster_saves" USING "btree" ("monster_id");



CREATE INDEX "idx_monster_skills_monster_id" ON "public"."monster_skills" USING "btree" ("monster_id");



CREATE UNIQUE INDEX "profiles_username_unique" ON "public"."profiles" USING "btree" ("username") WHERE ("username" IS NOT NULL);



ALTER TABLE ONLY "public"."assinaturas"
    ADD CONSTRAINT "assinaturas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aventuras"
    ADD CONSTRAINT "aventuras_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batalhas"
    ADD CONSTRAINT "batalhas_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_invites"
    ADD CONSTRAINT "campaign_invites_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campanha_membros"
    ADD CONSTRAINT "campanha_membros_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campanha_membros"
    ADD CONSTRAINT "campanha_membros_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campanhas"
    ADD CONSTRAINT "campanhas_dm_id_fkey" FOREIGN KEY ("dm_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."combatentes"
    ADD CONSTRAINT "combatentes_batalha_id_fkey" FOREIGN KEY ("batalha_id") REFERENCES "public"."batalhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."combatentes"
    ADD CONSTRAINT "combatentes_personagem_id_fkey" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagens"("id");



ALTER TABLE ONLY "public"."conteudo_personalizado"
    ADD CONSTRAINT "conteudo_personalizado_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diario_entradas"
    ADD CONSTRAINT "diario_entradas_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diario_entradas"
    ADD CONSTRAINT "diario_entradas_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."diario_entradas"
    ADD CONSTRAINT "diario_entradas_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diario_entradas"
    ADD CONSTRAINT "diario_entradas_visibilidade_jogador_id_fkey" FOREIGN KEY ("visibilidade_jogador_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."espacos_magia"
    ADD CONSTRAINT "espacos_magia_personagem_id_fkey" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagens"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_respondido_por_fkey" FOREIGN KEY ("respondido_por") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."imagens"
    ADD CONSTRAINT "imagens_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locais"
    ADD CONSTRAINT "locais_aventura_id_fkey" FOREIGN KEY ("aventura_id") REFERENCES "public"."aventuras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_batalha"
    ADD CONSTRAINT "log_batalha_batalha_id_fkey" FOREIGN KEY ("batalha_id") REFERENCES "public"."batalhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magias_personagem"
    ADD CONSTRAINT "magias_personagem_personagem_id_fkey" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagens"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magias_personagem"
    ADD CONSTRAINT "magias_personagem_spell_id_fkey" FOREIGN KEY ("spell_id") REFERENCES "public"."spells"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."magic_item_spells"
    ADD CONSTRAINT "magic_item_spells_magic_item_id_fkey" FOREIGN KEY ("magic_item_id") REFERENCES "public"."magic_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magic_item_spells"
    ADD CONSTRAINT "magic_item_spells_spell_id_fkey" FOREIGN KEY ("spell_id") REFERENCES "public"."spells"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monster_actions"
    ADD CONSTRAINT "monster_actions_monster_id_fkey" FOREIGN KEY ("monster_id") REFERENCES "public"."monsters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monster_condition_immunities"
    ADD CONSTRAINT "monster_condition_immunities_monster_id_fkey" FOREIGN KEY ("monster_id") REFERENCES "public"."monsters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monster_damage_modifiers"
    ADD CONSTRAINT "monster_damage_modifiers_monster_id_fkey" FOREIGN KEY ("monster_id") REFERENCES "public"."monsters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monster_saves"
    ADD CONSTRAINT "monster_saves_monster_id_fkey" FOREIGN KEY ("monster_id") REFERENCES "public"."monsters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monster_skills"
    ADD CONSTRAINT "monster_skills_monster_id_fkey" FOREIGN KEY ("monster_id") REFERENCES "public"."monsters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificacoes"
    ADD CONSTRAINT "notificacoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personagens"
    ADD CONSTRAINT "personagens_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personagens"
    ADD CONSTRAINT "personagens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subracas"
    ADD CONSTRAINT "subracas_raca_id_fkey" FOREIGN KEY ("raca_id") REFERENCES "public"."racas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."uso_ia"
    ADD CONSTRAINT "uso_ia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Leitura pública de condições" ON "public"."condicoes" FOR SELECT USING (true);



CREATE POLICY "Leitura pública monster_actions" ON "public"."monster_actions" FOR SELECT USING (true);



CREATE POLICY "Leitura pública monster_condition_immunities" ON "public"."monster_condition_immunities" FOR SELECT USING (true);



CREATE POLICY "Leitura pública monster_damage_modifiers" ON "public"."monster_damage_modifiers" FOR SELECT USING (true);



CREATE POLICY "Leitura pública monster_saves" ON "public"."monster_saves" FOR SELECT USING (true);



CREATE POLICY "Leitura pública monster_skills" ON "public"."monster_skills" FOR SELECT USING (true);



CREATE POLICY "Users can manage own IA usage" ON "public"."uso_ia" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own sessions" ON "public"."sessoes" USING ((EXISTS ( SELECT 1
   FROM "public"."campanhas"
  WHERE (("campanhas"."id" = "sessoes"."campanha_id") AND ("campanhas"."dm_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."antecedentes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assinaturas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aventuras" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "aventuras_insert" ON "public"."aventuras" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campanhas"
  WHERE (("campanhas"."id" = "aventuras"."campanha_id") AND ("campanhas"."dm_id" = "auth"."uid"())))));



CREATE POLICY "aventuras_select" ON "public"."aventuras" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campanhas"
  WHERE (("campanhas"."id" = "aventuras"."campanha_id") AND ("campanhas"."dm_id" = "auth"."uid"())))));



ALTER TABLE "public"."batalhas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campanha_membros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campanhas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campanhas_all" ON "public"."campanhas" USING (("dm_id" = "auth"."uid"()));



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."combatentes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."condicoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conteudo_personalizado" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conteudo_proprio" ON "public"."conteudo_personalizado" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "conteudo_publico_leitura" ON "public"."conteudo_personalizado" FOR SELECT USING (("publico" = true));



CREATE POLICY "delete_magias_personagem" ON "public"."magias_personagem" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."personagens" "p"
     JOIN "public"."campanhas" "c" ON (("c"."id" = "p"."campanha_id")))
  WHERE (("p"."id" = "magias_personagem"."personagem_id") AND ("c"."dm_id" = "auth"."uid"())))));



CREATE POLICY "diario_delete" ON "public"."diario_entradas" FOR DELETE USING (("criado_por" = "auth"."uid"()));



ALTER TABLE "public"."diario_entradas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diario_insert" ON "public"."diario_entradas" FOR INSERT WITH CHECK ((("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))) OR ("campanha_id" IN ( SELECT "campanha_membros"."campanha_id"
   FROM "public"."campanha_membros"
  WHERE (("campanha_membros"."user_id" = "auth"."uid"()) AND ("campanha_membros"."status" = 'ativo'::"text"))))));



CREATE POLICY "diario_select" ON "public"."diario_entradas" FOR SELECT USING ((("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))) OR (("visibilidade" = 'grupo'::"text") AND ("campanha_id" IN ( SELECT "campanha_membros"."campanha_id"
   FROM "public"."campanha_membros"
  WHERE (("campanha_membros"."user_id" = "auth"."uid"()) AND ("campanha_membros"."status" = 'ativo'::"text"))))) OR (("visibilidade" = 'privado'::"text") AND ("criado_por" = "auth"."uid"())) OR (("visibilidade" = 'jogador_especifico'::"text") AND ("visibilidade_jogador_id" = "auth"."uid"()))));



CREATE POLICY "diario_update" ON "public"."diario_entradas" FOR UPDATE USING ((("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))) OR ("criado_por" = "auth"."uid"())));



ALTER TABLE "public"."equipment_armor" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_gear" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_tools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_weapons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."espacos_magia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_insert" ON "public"."feedbacks" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "feedback_select_own" ON "public"."feedbacks" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."feedbacks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."imagens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imagens_delete" ON "public"."imagens" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."campanhas"
  WHERE (("campanhas"."id" = "imagens"."campanha_id") AND ("campanhas"."dm_id" = "auth"."uid"())))));



CREATE POLICY "imagens_insert" ON "public"."imagens" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campanhas"
  WHERE (("campanhas"."id" = "imagens"."campanha_id") AND ("campanhas"."dm_id" = "auth"."uid"())))));



CREATE POLICY "imagens_select" ON "public"."imagens" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."campanhas" "c"
  WHERE (("c"."id" = "imagens"."campanha_id") AND ("c"."dm_id" = "auth"."uid"())))) OR (("visivel_jogadores" = true) AND (EXISTS ( SELECT 1
   FROM "public"."campanha_membros" "cm"
  WHERE (("cm"."campanha_id" = "imagens"."campanha_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'ativo'::"text") AND ("cm"."papel" = 'jogador'::"text")))))));



CREATE POLICY "imagens_update" ON "public"."imagens" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."campanhas" "c"
  WHERE (("c"."id" = "imagens"."campanha_id") AND ("c"."dm_id" = "auth"."uid"())))));



CREATE POLICY "insert_magias_personagem" ON "public"."magias_personagem" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."personagens" "p"
     JOIN "public"."campanhas" "c" ON (("c"."id" = "p"."campanha_id")))
  WHERE (("p"."id" = "magias_personagem"."personagem_id") AND ("c"."dm_id" = "auth"."uid"())))));



ALTER TABLE "public"."locais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_batalha" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."magias_personagem" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "magias_personagem_delete" ON "public"."magias_personagem" FOR DELETE USING (("personagem_id" IN ( SELECT "personagens"."id"
   FROM "public"."personagens"
  WHERE (("personagens"."user_id" = "auth"."uid"()) OR ("personagens"."campanha_id" IN ( SELECT "campanhas"."id"
           FROM "public"."campanhas"
          WHERE ("campanhas"."dm_id" = "auth"."uid"())))))));



CREATE POLICY "magias_personagem_insert" ON "public"."magias_personagem" FOR INSERT WITH CHECK (("personagem_id" IN ( SELECT "personagens"."id"
   FROM "public"."personagens"
  WHERE (("personagens"."user_id" = "auth"."uid"()) OR ("personagens"."campanha_id" IN ( SELECT "campanhas"."id"
           FROM "public"."campanhas"
          WHERE ("campanhas"."dm_id" = "auth"."uid"())))))));



CREATE POLICY "magias_personagem_select" ON "public"."magias_personagem" FOR SELECT USING (("personagem_id" IN ( SELECT "personagens"."id"
   FROM "public"."personagens"
  WHERE (("personagens"."user_id" = "auth"."uid"()) OR ("personagens"."campanha_id" IN ( SELECT "campanhas"."id"
           FROM "public"."campanhas"
          WHERE ("campanhas"."dm_id" = "auth"."uid"())))))));



ALTER TABLE "public"."magic_item_spells" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."magic_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membros_delete" ON "public"."campanha_membros" FOR DELETE USING (("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))));



CREATE POLICY "membros_dm" ON "public"."campanha_membros" USING ((EXISTS ( SELECT 1
   FROM "public"."campanhas"
  WHERE (("campanhas"."id" = "campanha_membros"."campanha_id") AND ("campanhas"."dm_id" = "auth"."uid"())))));



CREATE POLICY "membros_insert" ON "public"."campanha_membros" FOR INSERT WITH CHECK (("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))));



CREATE POLICY "membros_jogador" ON "public"."campanha_membros" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "membros_update" ON "public"."campanha_membros" FOR UPDATE USING (("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))));



ALTER TABLE "public"."monster_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monster_condition_immunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monster_damage_modifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monster_saves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monster_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monsters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificacoes_proprio" ON "public"."notificacoes" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."personagens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "personagens_insert" ON "public"."personagens" FOR INSERT WITH CHECK ((("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))) OR ("campanha_id" IN ( SELECT "campanha_membros"."campanha_id"
   FROM "public"."campanha_membros"
  WHERE (("campanha_membros"."user_id" = "auth"."uid"()) AND ("campanha_membros"."status" = 'ativo'::"text"))))));



CREATE POLICY "personagens_select" ON "public"."personagens" FOR SELECT USING ((("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))) OR ("user_id" = "auth"."uid"()) OR (("visibilidade" = 'grupo'::"text") AND ("campanha_id" IN ( SELECT "campanha_membros"."campanha_id"
   FROM "public"."campanha_membros"
  WHERE (("campanha_membros"."user_id" = "auth"."uid"()) AND ("campanha_membros"."status" = 'ativo'::"text"))))) OR (("visibilidade" = 'jogador_especifico'::"text") AND ("visibilidade_jogador_id" = "auth"."uid"()))));



CREATE POLICY "personagens_update" ON "public"."personagens" FOR UPDATE USING ((("campanha_id" IN ( SELECT "campanhas"."id"
   FROM "public"."campanhas"
  WHERE ("campanhas"."dm_id" = "auth"."uid"()))) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pub_antecedentes" ON "public"."antecedentes" FOR SELECT USING (true);



CREATE POLICY "pub_classes" ON "public"."classes" FOR SELECT USING (true);



CREATE POLICY "pub_equipment_armor" ON "public"."equipment_armor" FOR SELECT USING (true);



CREATE POLICY "pub_equipment_gear" ON "public"."equipment_gear" FOR SELECT USING (true);



CREATE POLICY "pub_equipment_tools" ON "public"."equipment_tools" FOR SELECT USING (true);



CREATE POLICY "pub_equipment_weapons" ON "public"."equipment_weapons" FOR SELECT USING (true);



CREATE POLICY "pub_magic_item_spells" ON "public"."magic_item_spells" FOR SELECT USING (true);



CREATE POLICY "pub_magic_items" ON "public"."magic_items" FOR SELECT USING (true);



CREATE POLICY "pub_monsters" ON "public"."monsters" FOR SELECT USING (true);



CREATE POLICY "pub_racas" ON "public"."racas" FOR SELECT USING (true);



CREATE POLICY "pub_spells" ON "public"."spells" FOR SELECT USING (true);



CREATE POLICY "pub_subracas" ON "public"."subracas" FOR SELECT USING (true);



CREATE POLICY "pub_tipos_dano" ON "public"."tipos_dano" FOR SELECT USING (true);



ALTER TABLE "public"."racas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_magias_personagem" ON "public"."magias_personagem" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."personagens" "p"
     JOIN "public"."campanhas" "c" ON (("c"."id" = "p"."campanha_id")))
  WHERE (("p"."id" = "magias_personagem"."personagem_id") AND ("c"."dm_id" = "auth"."uid"())))));



ALTER TABLE "public"."sessoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spells" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subracas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_dano" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uso_ia" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."usuario_pode_ver_campanha"("campanha_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."usuario_pode_ver_campanha"("campanha_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usuario_pode_ver_campanha"("campanha_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."antecedentes" TO "anon";
GRANT ALL ON TABLE "public"."antecedentes" TO "authenticated";
GRANT ALL ON TABLE "public"."antecedentes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."antecedentes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."antecedentes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."antecedentes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."assinaturas" TO "anon";
GRANT ALL ON TABLE "public"."assinaturas" TO "authenticated";
GRANT ALL ON TABLE "public"."assinaturas" TO "service_role";



GRANT ALL ON TABLE "public"."aventuras" TO "anon";
GRANT ALL ON TABLE "public"."aventuras" TO "authenticated";
GRANT ALL ON TABLE "public"."aventuras" TO "service_role";



GRANT ALL ON TABLE "public"."batalhas" TO "anon";
GRANT ALL ON TABLE "public"."batalhas" TO "authenticated";
GRANT ALL ON TABLE "public"."batalhas" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_invites" TO "anon";
GRANT ALL ON TABLE "public"."campaign_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_invites" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_members" TO "anon";
GRANT ALL ON TABLE "public"."campaign_members" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_members" TO "service_role";



GRANT ALL ON TABLE "public"."campanha_membros" TO "anon";
GRANT ALL ON TABLE "public"."campanha_membros" TO "authenticated";
GRANT ALL ON TABLE "public"."campanha_membros" TO "service_role";



GRANT ALL ON TABLE "public"."campanhas" TO "anon";
GRANT ALL ON TABLE "public"."campanhas" TO "authenticated";
GRANT ALL ON TABLE "public"."campanhas" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."classes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."classes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."classes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."combatentes" TO "anon";
GRANT ALL ON TABLE "public"."combatentes" TO "authenticated";
GRANT ALL ON TABLE "public"."combatentes" TO "service_role";



GRANT ALL ON TABLE "public"."condicoes" TO "anon";
GRANT ALL ON TABLE "public"."condicoes" TO "authenticated";
GRANT ALL ON TABLE "public"."condicoes" TO "service_role";



GRANT ALL ON TABLE "public"."conteudo_personalizado" TO "anon";
GRANT ALL ON TABLE "public"."conteudo_personalizado" TO "authenticated";
GRANT ALL ON TABLE "public"."conteudo_personalizado" TO "service_role";



GRANT ALL ON TABLE "public"."diario_entradas" TO "anon";
GRANT ALL ON TABLE "public"."diario_entradas" TO "authenticated";
GRANT ALL ON TABLE "public"."diario_entradas" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_armor" TO "anon";
GRANT ALL ON TABLE "public"."equipment_armor" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_armor" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equipment_armor_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equipment_armor_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equipment_armor_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_gear" TO "anon";
GRANT ALL ON TABLE "public"."equipment_gear" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_gear" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equipment_gear_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equipment_gear_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equipment_gear_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_tools" TO "anon";
GRANT ALL ON TABLE "public"."equipment_tools" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_tools" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equipment_tools_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equipment_tools_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equipment_tools_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_weapons" TO "anon";
GRANT ALL ON TABLE "public"."equipment_weapons" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_weapons" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equipment_weapons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equipment_weapons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equipment_weapons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."espacos_magia" TO "anon";
GRANT ALL ON TABLE "public"."espacos_magia" TO "authenticated";
GRANT ALL ON TABLE "public"."espacos_magia" TO "service_role";



GRANT ALL ON TABLE "public"."feedbacks" TO "anon";
GRANT ALL ON TABLE "public"."feedbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."feedbacks" TO "service_role";



GRANT ALL ON TABLE "public"."imagens" TO "anon";
GRANT ALL ON TABLE "public"."imagens" TO "authenticated";
GRANT ALL ON TABLE "public"."imagens" TO "service_role";



GRANT ALL ON TABLE "public"."locais" TO "anon";
GRANT ALL ON TABLE "public"."locais" TO "authenticated";
GRANT ALL ON TABLE "public"."locais" TO "service_role";



GRANT ALL ON TABLE "public"."log_batalha" TO "anon";
GRANT ALL ON TABLE "public"."log_batalha" TO "authenticated";
GRANT ALL ON TABLE "public"."log_batalha" TO "service_role";



GRANT ALL ON TABLE "public"."magias_personagem" TO "anon";
GRANT ALL ON TABLE "public"."magias_personagem" TO "authenticated";
GRANT ALL ON TABLE "public"."magias_personagem" TO "service_role";



GRANT ALL ON TABLE "public"."magic_item_spells" TO "anon";
GRANT ALL ON TABLE "public"."magic_item_spells" TO "authenticated";
GRANT ALL ON TABLE "public"."magic_item_spells" TO "service_role";



GRANT ALL ON SEQUENCE "public"."magic_item_spells_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."magic_item_spells_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."magic_item_spells_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."magic_items" TO "anon";
GRANT ALL ON TABLE "public"."magic_items" TO "authenticated";
GRANT ALL ON TABLE "public"."magic_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."magic_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."magic_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."magic_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."monster_actions" TO "anon";
GRANT ALL ON TABLE "public"."monster_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."monster_actions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."monster_actions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."monster_actions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."monster_actions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."monster_condition_immunities" TO "anon";
GRANT ALL ON TABLE "public"."monster_condition_immunities" TO "authenticated";
GRANT ALL ON TABLE "public"."monster_condition_immunities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."monster_condition_immunities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."monster_condition_immunities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."monster_condition_immunities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."monster_damage_modifiers" TO "anon";
GRANT ALL ON TABLE "public"."monster_damage_modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."monster_damage_modifiers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."monster_damage_modifiers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."monster_damage_modifiers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."monster_damage_modifiers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."monster_saves" TO "anon";
GRANT ALL ON TABLE "public"."monster_saves" TO "authenticated";
GRANT ALL ON TABLE "public"."monster_saves" TO "service_role";



GRANT ALL ON SEQUENCE "public"."monster_saves_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."monster_saves_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."monster_saves_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."monster_skills" TO "anon";
GRANT ALL ON TABLE "public"."monster_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."monster_skills" TO "service_role";



GRANT ALL ON SEQUENCE "public"."monster_skills_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."monster_skills_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."monster_skills_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."monsters" TO "anon";
GRANT ALL ON TABLE "public"."monsters" TO "authenticated";
GRANT ALL ON TABLE "public"."monsters" TO "service_role";



GRANT ALL ON SEQUENCE "public"."monsters_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."monsters_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."monsters_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notificacoes" TO "anon";
GRANT ALL ON TABLE "public"."notificacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacoes" TO "service_role";



GRANT ALL ON TABLE "public"."personagens" TO "anon";
GRANT ALL ON TABLE "public"."personagens" TO "authenticated";
GRANT ALL ON TABLE "public"."personagens" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."racas" TO "anon";
GRANT ALL ON TABLE "public"."racas" TO "authenticated";
GRANT ALL ON TABLE "public"."racas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."racas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."racas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."racas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sessoes" TO "anon";
GRANT ALL ON TABLE "public"."sessoes" TO "authenticated";
GRANT ALL ON TABLE "public"."sessoes" TO "service_role";



GRANT ALL ON TABLE "public"."spells" TO "anon";
GRANT ALL ON TABLE "public"."spells" TO "authenticated";
GRANT ALL ON TABLE "public"."spells" TO "service_role";



GRANT ALL ON SEQUENCE "public"."spells_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."spells_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."spells_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subracas" TO "anon";
GRANT ALL ON TABLE "public"."subracas" TO "authenticated";
GRANT ALL ON TABLE "public"."subracas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subracas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subracas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subracas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_dano" TO "anon";
GRANT ALL ON TABLE "public"."tipos_dano" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_dano" TO "service_role";



GRANT ALL ON TABLE "public"."uso_ia" TO "anon";
GRANT ALL ON TABLE "public"."uso_ia" TO "authenticated";
GRANT ALL ON TABLE "public"."uso_ia" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































