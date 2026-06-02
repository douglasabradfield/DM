# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build (always run before committing)
npm run start    # Start production server
```

## Commit padrão
```bash
cd C:\Users\dougl\dungeon-desk
git add .
git commit -m "descrição"
git push
```

There is no lint or test script configured.

## Required Environment Variables

`.env.local` must contain:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PRICE_HEROI`
- `NEXT_PUBLIC_STRIPE_PRICE_SOLO`
- `NEXT_PUBLIC_STRIPE_PRICE_MESA_PRO`
- `NEXT_PUBLIC_STRIPE_PRICE_GUILD_MASTER`

## Architecture

**Stack:** Next.js 14 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase, Stripe, Anthropic SDK, Zustand.

**Language:** The entire codebase and UI are in Brazilian Portuguese. Keep all variable names, comments, and user-facing text in Portuguese.

### Route Structure

- `src/app/(auth)/` — Login and sign-up pages (public)
- `src/app/(dashboard)/` — All main app pages; layout redirects unauthenticated users to `/login`
- `src/app/api/ia/` — Claude AI endpoints: `chat` (streaming), `resumo-batalha`, `resumo-campanha`
- `src/app/api/aventura/processar/` — Adventure PDF/MD/TXT processing endpoint
- `src/app/api/personagem/importar-ficha/` — Character sheet import via Claude document API
- `src/app/api/campanhas/[id]/` — Campaign management: `membros`, `convidar`, `link-entrada`
- `src/app/api/campanha/` — Additional campaign routes
- `src/app/api/convites/` — Invite acceptance: `aceitar`, `entrar`
- `src/app/api/stripe/` — Checkout session creation and webhook handling
- `src/app/api/admin/` — Admin-only user management and plan override

Admin routes call `verificarAdmin(userId)` from `src/lib/admin/verificar-admin.ts`, which checks `profiles.is_admin` (boolean).

### Supabase Clients

- `src/lib/supabase/client.ts` — Browser client (ANON key); use in Client Components
- `src/lib/supabase/server.ts` — Async server client + `createAdminClient` (service role, bypasses RLS)

### State Management

Battle tracker state lives in `src/store/batalha.ts` (Zustand + Immer). **Not persisted** — resets on reload. Pausing saves JSON to `sessoes.batalha_estado`. On battle end, writes to `diario_entradas` and updates `sessoes`.

Campaign selection persisted to `localStorage` via `src/store/campanha.ts` (key `dungeon-desk-campanha`).

### Types

- `src/types/database.ts` — Profile, Campanha, Aventura, Sessao, etc.
- `src/types/batalha.ts` — Combatente, LogEntry, BatalhaState
- `src/types/dnd.ts` — Condicao, Monster, Spell, and other D&D system types

---

## Key Database Tables

### profiles
`id, email, nome, username, plano, is_admin (boolean), stripe_customer_id, avatar_url, telefone`
- Admin check: `profiles.is_admin === true` (no `role` column)

### personagens
Includes `slots_magia jsonb` — spell slots: `{ "1": { total: 4, usados: 2 }, "2": { total: 3, usados: 0 } }`

### diario_entradas
Author column is `criado_por` (NOT `user_id`).
Visibility: `'dm' | 'grupo' | 'privado' | 'jogador_especifico'`
- DM sees all EXCEPT `privado` entries from other users
- Player sees: `grupo`, own `privado`, `jogador_especifico` directed at them

### imagens
Column is `nome` (NOT `titulo`). Bucket `dungeon-desk-imagens` is PUBLIC — use `getPublicUrl`.
Columns: `id, campanha_id, nome, url, storage_path, tipo, visivel_jogadores, compartilhado, criado_em`

### feedbacks
Columns: `id, user_id, tipo, mensagem, resposta, respondido_em, respondido_por, criado_em`

### SRD Tables

**monsters** — includes new columns: `hit_dice, passive_perception, darkvision_ft, blindsight_ft, tremorsense_ft, truesight_ft`

**monster_actions** — structured actions per monster:
`monster_id, action_type, name_pt, attack_type, attack_bonus, reach_ft, target_pt, damage_dice, damage_type_en/pt, damage2_dice, damage2_type_en/pt, save_ability, save_dc, save_effect_pt, recharge, condition_applied_pt, legendary_cost, description_pt`

**monster_saves** — `monster_id, ability, bonus` (only explicit proficiency saves)

**monster_skills** — `monster_id, skill_en, skill_pt, bonus`

**monster_damage_modifiers** — `monster_id, modifier_type (resistance|immunity|vulnerability), damage_type_en/pt, note_pt`

**monster_condition_immunities** — `monster_id, condition_en, condition_pt`

**spells** — new columns: `damage_dice, damage_type_en/pt, save_ability, save_effect, attack_type, roller, upcast_dice, conditions_applied_pt, heal_dice, aoe_type, aoe_size_ft`

---

## D&D Data Libraries (`src/lib/dados-dnd/`)

These are pure-data/math modules — no DB calls, no side effects:

- `condicoes.ts` — 16 D&D conditions with icons, descriptions, and removal rules. Use `CONDICOES` array and `getCondicao(id)`.
- `tipos-dano.ts` — 13 damage types with icons/colors. `aplicarResistencias()` handles immunity/resistance/vulnerability math.
- `espacos-magia.ts` — Spell slot table by class level (1–20). `getEspacosMagia(classe, nivel)`, `calcularModificador()`, `calcularBonusProficiencia()`.
- `xp-niveis.ts` — D&D 5e XP progression. `getNivelPorXP()`, `getProximoNivel()`, `getProgressoXP()` (returns progress bar data).
- `xp-encontro.ts` — Encounter difficulty calculator. `calcularDificuldade(monstros, party)` returns difficulty label + adjusted XP.

---

## Battle Tracker Architecture

### Flow principal (TabelaCombate.tsx)
O botão "⚔️ Registrar Ação" é o fluxo principal:
- Seleciona tipo (25 tipos), quem fez, alvos múltiplos com valor por alvo
- Aplica dano/cura automaticamente via `aplicarDano(id, valor, silencioso=true)`
- Desconta slots de magia automaticamente (jogadores via banco, monstros via store)
- Registra UMA entrada unificada no log

O campo "Ajuste PV" na linha é uso secundário (correções, armadilhas, sem atacante).

### Sincronização batalha → ficha
Quando `aplicarDano` ou `aplicarCura` altera PV de combatente com `personagem_id`:
- Fire-and-forget UPDATE em `personagens` (pv_atual, pv_temporarios)
- FichaPersonagem.tsx lê do store de batalha se combatente ativo

### Slots de magia
- Jogadores: busca `personagens.slots_magia`, decrementa, salva no banco
- Monstros/NPCs: `combatente.slots_monstro?: Record<string, number>` (local ao store)
- Painel de conjuração: ícone varinha na linha, abre via createPortal

### Combatentes
```typescript
interface Combatente {
  personagem_id?: string      // se jogador/NPC vinculado
  slots_monstro?: Record<string, number>  // slots locais para monstros
  ataques_estruturados?: MonsterAction[]  // do bestiário ao adicionar
}
```

---

## Bestiário (BestiarioCliente.tsx)

- Badge "✓" verde em monstros com `monster_actions` preenchido
- Query detalhada com 5 joins quando abre detalhe
- Fallback para texto corrido em monstros sem dados estruturados
- `adicionarCombatente` passa `ataques_estruturados` filtrados por tipo

### Monstros com dados estruturados
`adult-black-dragon, assassin, clay-golem, ghoul, goblin, skeleton, treant, troll, vampire-spawn, veteran, werewolf, zombie`

⚠️ `stone-golem` e `vampire` NÃO existem no banco. Usar `clay-golem` e `vampire-spawn`.

---

## Personagens

### Visibilidade
Filtro feito no banco (não frontend):
- DM: vê todas da campanha
- Jogador: `.or('visibilidade.eq.grupo,and(visibilidade.eq.jogador_especifico,visibilidade_jogador_id.eq.${userId}),user_id.eq.${userId}')`

### Dropdown de visibilidade
Nomes dos jogadores via duas queries separadas (join direto falha por ausência de FK):
1. Busca `user_id` dos membros com `papel = 'jogador'`
2. Busca `profiles.nome ?? profiles.username` por esses IDs

### Slots de magia na ficha
Círculos clicáveis para qualquer usuário com `podeEditar` ou dono do personagem.
Toggle usado/disponível com save imediato no banco.

---

## Diário

### @ Menções
Formato salvo: `@[Nome](personagem:id)`
Legado (sem ID): `@palavra` — renderizado sem clique
Clique abre popup via `createPortal` com: nome, tipo, raça/classe/nível, CA, PV

### Privacidade
- `privado` = visível APENAS para quem criou (`criado_por = auth.uid()`)
- DM usa: `.or('visibilidade.neq.privado,criado_por.eq.${userId}')`

---

## Notificações (Header.tsx)

- Persistem após clicar (não somem)
- `lida: true` ao clicar, mas mantém no dropdown
- Badge conta apenas `lida: false`
- Ordenação: não lidas primeiro, lidas com opacidade reduzida
- "Marcar todas como lidas" — UPDATE em lote
- Polling 30s, limite 20 notificações

---

## Claude AI Integration

`src/lib/claude/client.ts` exports `getClaudeClient()` and `MODELO_CLAUDE`.
`src/lib/claude/prompts.ts` — `buildSystemPrompt()` and `PROMPTS_RAPIDOS` (8 templates).

Monthly usage tracked in `uso_ia` (user_id, mes, ano, total_mensagens).
Limits in `src/lib/ia/limites.ts`: free=0, solo=30, mesa_pro=100, guild_master/dm_supremo=∞.

---

## Subscription Plans

| id | Name | Campaigns | IA msgs/mo |
|---|---|---|---|
| `free` | Aventureiro | 1 | 0 |
| `solo` | Herói | 1 | 30 |
| `mesa_pro` | Mestre | 3 | 100 |
| `guild_master` | Guilda | unlimited | unlimited |
| `dm_supremo` | DM Supremo | unlimited | unlimited + personalizado |

- `src/lib/planos.ts` — feature gating (`getPlano()`, `planoSuficiente()`, `podeUsar()`)
- `src/components/ui/BloqueioPlano.tsx` — upgrade prompt component
- `usePlanoEfetivo()` — always use this hook (players inherit DM's plan)

**DM Supremo:** aba "Personalizado" no bestiário/magias/itens — cria conteúdo próprio
sem propagar para a base global. Diferente da edição admin que altera dados globais.

---

## Design System

Tailwind v4 com CSS variables em `src/app/globals.css`. Prefixo `dd-` (ex: `bg-dd-surface`).
Fonts: `Cinzel` (headings) e `Crimson Pro` (body). Use `cn()` de `src/lib/utils.ts`.

**Temas:** 4 temas visuais — `grimorio` (padrão), `medieval`, `dragao`, `elfico`. Gerenciados por `src/lib/tema.ts`: `getTemaAtual()` / `aplicarTema(nome)`. Persiste em `localStorage` sob a chave `dd-tema`. `aplicarTema()` adiciona/remove classe `tema-{nome}` no `<html>`, que ativa override de CSS variables em `globals.css`.

---

## Important Patterns

### Always read before editing
Sempre leia os arquivos relevantes antes de fazer alterações.

### SQL changes
Execute no Supabase SQL Editor ANTES de alterar o código.
Gere sempre o SQL separado para o dev executar manualmente.

### Build check
`npm run build` obrigatório antes de qualquer commit.

### magias_personagem
Sempre usar `spell_id` (bigint). Nunca `magia_id` (uuid — legado).

### Zustand persist
`partialize` retorna `{}` — store NÃO persiste no localStorage automaticamente.

### Dice rolling
`src/lib/utils.ts` exporta `rolarDado(lados)` e `rolarExpressao(expr)`. `rolarExpressao` aceita notação D&D ("2d6+3") e retorna `{ total, detalhes }` com os valores individuais exibidos. Use para todo cálculo de dados — não reimplemente inline.

### Stripe vs planos
`src/lib/planos.ts` — controle de features (limites por plano, `podeUsar()`, `planoSuficiente()`).
`src/lib/stripe/produtos.ts` — preços em centavos e Stripe Price IDs por plano. Use apenas no checkout; não use para feature gating.
