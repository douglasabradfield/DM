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
- `NEXT_PUBLIC_STRIPE_PRICE_SOLO`
- `NEXT_PUBLIC_STRIPE_PRICE_MESA_PRO`
- `NEXT_PUBLIC_STRIPE_PRICE_GUILD_MASTER`

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase, Stripe, Anthropic SDK, Zustand.

**Language:** The entire codebase and UI are in Brazilian Portuguese. Keep all variable names, comments, and user-facing text in Portuguese.

### Route Structure

- `src/app/(auth)/` — Login and sign-up pages (public)
- `src/app/(dashboard)/` — All main app pages; the layout server component redirects unauthenticated users to `/login`
- `src/app/api/ia/chat/` — Streaming Claude API endpoint
- `src/app/api/aventura/processar/` — Adventure PDF processing endpoint
- `src/app/api/stripe/` — Checkout session creation and webhook handling

Auth is enforced in two places: the `(dashboard)` layout server component and `src/proxy.ts` (middleware-style guard for routes outside the route group).

### Supabase Clients

- `src/lib/supabase/client.ts` — Browser client; use in Client Components
- `src/lib/supabase/server.ts` — Async server client (`createClient`) and admin client (`createAdminClient` with service role key); use in Server Components and Route Handlers

### State Management

Battle tracker state lives entirely in the browser via `src/store/batalha.ts` (Zustand + Immer). It is **not persisted** to the database automatically — state is reset on page reload.

Campaign/session selection is persisted to `localStorage` via `src/store/campanha.ts` (Zustand persist middleware, key `dungeon-desk-campanha`).

### Claude AI Integration

`src/lib/claude/client.ts` exports a singleton `getClaudeClient()` and the constant `MODELO_CLAUDE`. The chat route streams responses using the Anthropic SDK's `.messages.stream()` API.

### Subscription Plans

Four tiers defined in `src/lib/stripe/produtos.ts`: `free` (Aventureiro), `solo` (DM Solo, R$19/mo), `mesa_pro` (Mesa Pro, R$59/mo), `guild_master` (Guild Master, R$129/mo). Plan IDs on the `Profile` type map directly to Supabase `profiles.plano`.

### Design System

Tailwind v4 with a custom theme defined via CSS variables in `src/app/globals.css`. All design tokens use the `dd-` prefix (e.g., `bg-dd-surface`, `text-dd-text`, `border-dd-border`). Fonts: `Cinzel` (headings/UI) and `Crimson Pro` (body text). Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional class names.

### Component Organization

- `src/components/ui/` — Generic design-system primitives (buttons, panels, badges, dividers)
- `src/components/layout/` — App shell (Sidebar, Header, ProvedorSessao)
- `src/components/batalha/` — All battle tracker components; state is consumed from `useBatalha` store
- `src/components/personagem/` — Character sheet and mini-card components
- `src/types/` — Shared TypeScript types (`database.ts` for DB entities, `batalha.ts` for combat, `dnd.ts` for D&D primitives)
- `src/lib/dados-dnd/` — Static D&D data (damage types, conditions, spell slots)
