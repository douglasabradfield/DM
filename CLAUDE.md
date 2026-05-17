# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
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

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase, Stripe, Anthropic SDK, Zustand.

**Language:** The entire codebase and UI are in Brazilian Portuguese. Keep all variable names, comments, and user-facing text in Portuguese.

### Route Structure

- `src/app/(auth)/` — Login and sign-up pages (public)
- `src/app/(dashboard)/` — All main app pages; the layout server component redirects unauthenticated users to `/login`
- `src/app/api/ia/` — Claude AI endpoints: `chat` (streaming), `resumo-batalha`, `resumo-campanha`
- `src/app/api/aventura/processar/` — Adventure PDF/MD/TXT processing endpoint
- `src/app/api/campanhas/[id]/` — Campaign management: `membros`, `convidar`, `link-entrada`
- `src/app/api/convites/` — Invite acceptance: `aceitar`, `entrar`
- `src/app/api/stripe/` — Checkout session creation and webhook handling
- `src/app/api/admin/` — Admin-only user management and plan override

Auth is enforced in two places: the `(dashboard)` layout server component and `src/proxy.ts` (middleware-style guard for routes outside the route group). Admin routes additionally call `verificarAdmin(userId)` from `src/lib/admin/verificar-admin.ts`, which checks `profiles.is_admin`.

### Supabase Clients

- `src/lib/supabase/client.ts` — Browser client (ANON key); use in Client Components
- `src/lib/supabase/server.ts` — Async server client (`createClient`) and admin client (`createAdminClient` with service role key, bypasses RLS); use in Server Components and Route Handlers

### State Management

Battle tracker state lives entirely in the browser via `src/store/batalha.ts` (Zustand + Immer). It is **not persisted** automatically — state is reset on page reload. On battle end, `encerrarBatalha()` writes a technical summary, AI narrative, and combat log to `diario_entradas`, then updates the `sessoes` record with status and XP.

Campaign/session selection is persisted to `localStorage` via `src/store/campanha.ts` (Zustand persist middleware, key `dungeon-desk-campanha`). It loads campaigns the user owns (as DM) plus campaigns they joined (via `campaign_members`).

### Claude AI Integration

`src/lib/claude/client.ts` exports a singleton `getClaudeClient()` and the constant `MODELO_CLAUDE`. The chat route streams responses using the Anthropic SDK's `.messages.stream()` API.

`src/lib/claude/prompts.ts` contains `buildSystemPrompt(contextoAventura?, grupoPJs?)` which injects the current adventure and party context, and `PROMPTS_RAPIDOS` — an array of 8 quick-prompt templates (NPC improv, location description, random encounter, battle tip, session summary, plot twist, item rewards, monster tactics).

Monthly IA message usage is tracked in the `uso_ia` table (keyed by user, month, year). The `/api/ia/chat` route reads the user's plan, looks up the limit from `src/lib/ia/limites.ts` (`LIMITES_IA`: free=0, solo=100, mesa_pro=500, guild_master=∞), and returns 429 if the cap is reached.

### Aventura (PDF Processing) Flow

1. Client uploads file to Supabase Storage (`aventuras` bucket)
2. Client calls `POST /api/aventura/processar` with `storagePath` and `campanhaId`
3. Route fetches the file via `createAdminClient`, extracts text (PDF via `pdf-parse`, MD/TXT direct), truncates to 400K characters
4. Sends to Claude with a structured D&D parsing prompt
5. Stores the result in `aventuras.conteudo_json` as `AventuraConteudo` (chapters → locations → NPCs + encounters)

### Subscription Plans

Five tiers defined in `src/lib/stripe/produtos.ts`:

| id | Name | Price |
|---|---|---|
| `free` | Aventureiro | Free — no IA, no adventure upload |
| `heroi` | Herói | R$9/mo — up to 3 campaigns, no IA |
| `solo` | DM Solo | R$19/mo — 3 campaigns, 100 IA msgs/mo |
| `mesa_pro` | Mesa Pro | R$59/mo — unlimited campaigns, 500 IA msgs/mo |
| `guild_master` | Guild Master | R$129/mo — up to 5 DMs, unlimited IA |

`profiles.plano` is the canonical plan value. The Stripe webhook (`/api/stripe/webhook`) maps `stripe_price_id` to plan tier via `PLANOS_STRIPE` and updates both `profiles.plano` and the `assinaturas` table. On cancellation, plan reverts to `free`. Admins can override via `PATCH /api/admin/usuarios/[id]/plano` without touching Stripe.

### Design System

Tailwind v4 with a custom theme defined via CSS variables in `src/app/globals.css`. All design tokens use the `dd-` prefix (e.g., `bg-dd-surface`, `text-dd-text`, `border-dd-border`). Fonts: `Cinzel` (headings/UI) and `Crimson Pro` (body text). Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional class names.

### Component Organization

- `src/components/ui/` — Generic design-system primitives (buttons, panels, badges, dividers)
- `src/components/layout/` — App shell: `Sidebar`, `Header`, `ProvedorSessao` (context provider that loads campaigns and user profile on mount)
- `src/components/batalha/` — All battle tracker components; state is consumed from `useBatalha` store
- `src/components/personagem/` — Character sheet and mini-card components
- `src/types/` — Shared TypeScript types (`database.ts` for DB entities, `batalha.ts` for combat, `dnd.ts` for D&D primitives)
- `src/lib/dados-dnd/` — Static D&D data (damage types, conditions, spell slots, XP tables)

### Key Database Entities

- `profiles` — Extended auth user; holds `plano`, `is_admin`, `stripe_customer_id`
- `assinaturas` — Stripe subscription records; status: `ativo | cancelado | pendente | trial`
- `campanhas` — DM-owned campaigns; `link_token` enables open join links
- `campaign_members` — Links users to campaigns with `papel: 'dm' | 'jogador'`
- `aventuras` — Uploaded adventures; `conteudo_json` holds parsed structure
- `sessoes` — Campaign sessions; `resumo_ia` populated by `/api/ia/resumo-campanha`
- `diario_entradas` — Journal entries; auto-created on battle end via `encerrarBatalha()`
- `uso_ia` — Monthly IA message counter per user (columns: `user_id`, `mes`, `ano`, `total_mensagens`)
