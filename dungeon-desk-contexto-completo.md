# DUNGEON DESK — Documento de Contexto Completo
# Atualizado em 06/08/2026 — consolidado a partir do repositório real (75 commits), dos chats anteriores e da revisão de código
# Substitui a versão de 02/06/2026

---

## 0. O QUE MUDOU NESTA REVISÃO (leia primeiro)

| Item | Estava documentado | Realidade no repositório |
|------|-------------------|--------------------------|
| Framework | Next.js 14 | **Next.js 16.2.6 + React 19.2.4 + Tailwind v4** |
| Middleware | `middleware.ts` | **`src/proxy.ts`** (Next 16 renomeou middleware → proxy) |
| Sidebar minimizável | pendente | **implementado** (17/06) |
| Espaços de magia | tabela fixa full caster | **`spell_slots_db.json` por classe** (PR do colaborador, 15/07) |
| Tradução de aventura | não existia | **`/api/aventura/traduzir` + botão por capítulo** (05/08) |
| Colaborador | não documentado | **gustavodsantana23** — 1 PR mergeado |
| `src/store/auth.ts` | listado | **não existe** |
| Arquivos de agente | não documentado | **`CLAUDE.md` e `AGENTS.md` na raiz do repo** |

---

## 1. OBJETIVO DO APP

Dungeon Desk é uma plataforma SaaS para Dungeon Masters de D&D 5e brasileiros. Todo o texto é em PT-BR.

- Batalha em tempo real (iniciativa, PV, condições, log, XP)
- Fichas de personagem integradas à batalha
- Bestiário, magias e itens do SRD 5.2.1 em português
- Diário de campanha com visibilidade por papel
- Aventuras estruturadas por capítulo/local, com processamento e tradução por IA
- Assistente IA (NPCs, encontros, resumos)
- Módulo de jogadores com acesso por campanha e plano herdado

---

## 2. STACK TÉCNICA (verificada em package.json)

- **Framework:** Next.js **16.2.6** (App Router)
- **React:** 19.2.4 · **TypeScript** 5 · **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Banco:** Supabase (PostgreSQL + Auth + Storage) — `@supabase/ssr` 0.10.3, `supabase-js` 2.105.4
- **Estado:** Zustand 5 + **Immer**
- **UI:** Radix UI (dialog, popover, progress, select, tabs, tooltip), lucide-react, framer-motion, react-hot-toast
- **Forms:** react-hook-form + zod + @hookform/resolvers
- **Drag and drop:** @dnd-kit
- **Pagamentos:** Stripe 22 + @stripe/stripe-js
- **IA:** `@anthropic-ai/sdk` 0.96 — modelo `claude-sonnet-4-5`
- **PDF:** pdf-parse 2.4
- **Deploy:** Vercel (Hobby — timeout 60s), auto-deploy na `main`
- **Repositório:** https://github.com/douglasabradfield/DM (público, 75 commits)
- **Produção:** https://dm-gules-one.vercel.app
- **Supabase:** https://fjikjxoqeljzvvfyrfey.supabase.co

### ⚠️ Next.js 16 — regra de ouro
O `AGENTS.md` do repo avisa: *"This is NOT the Next.js you know"*. Há breaking changes em relação ao Next 14/15 que os modelos conhecem de treino. **Antes de escrever código que toque em roteamento, params, cache, middleware ou APIs de servidor, ler `node_modules/next/dist/docs/`.**
Consequência prática já visível: `middleware.ts` virou **`src/proxy.ts`**, exportando `proxy(request)` + `config.matcher`.

### Scripts
```bash
npm run dev      # localhost:3000
npm run build    # sempre antes de commitar
npm run start
```
Não há lint nem testes configurados.

### Variáveis de ambiente (.env.local)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_HEROI`, `NEXT_PUBLIC_STRIPE_PRICE_SOLO`, `NEXT_PUBLIC_STRIPE_PRICE_MESA_PRO`, `NEXT_PUBLIC_STRIPE_PRICE_GUILD_MASTER`

---

## 3. ARQUITETURA REAL (árvore extraída do repo)

```
raiz/
├── AGENTS.md                     # regras Next 16 para agentes
├── CLAUDE.md                     # memória do Claude Code (importa @AGENTS.md)
├── dungeon-desk-contexto-completo.md
├── next.config.ts · tsconfig.json · postcss.config.mjs
├── supabase/migrations/          # 4 migrations versionadas
└── src/
    ├── proxy.ts                  # auth guard (ex-middleware)
    ├── app/
    │   ├── (auth)/login · cadastro
    │   ├── (dashboard)/
    │   │   ├── page.tsx (home) · layout.tsx
    │   │   ├── batalha · personagens · personagens/[id] · personagens/criar
    │   │   ├── bestiario (BestiarioCliente.tsx) · magias (MagiasCliente.tsx) · itens (ItensCliente.tsx)
    │   │   ├── aventura · diario · imagens · mapas · ia
    │   │   ├── campanhas · conta · configuracoes
    │   │   ├── ajuda · legal · feedback
    │   │   └── admin · admin/feedbacks
    │   ├── api/
    │   │   ├── aventura/processar · aventura/traduzir
    │   │   ├── campanhas/minhas · campanhas/[id]/membros · [id]/convidar · [id]/link-entrada
    │   │   ├── campanha/convidar · campanha/link-convite
    │   │   ├── convites/aceitar · convites/entrar
    │   │   ├── usuarios/buscar
    │   │   ├── personagem/importar-ficha
    │   │   ├── ia/chat · ia/resumo-batalha · ia/resumo-campanha
    │   │   ├── admin/usuarios · admin/usuarios/[id]/plano · [id]/admin
    │   │   ├── stripe/criar-checkout · stripe/webhook
    │   │   └── feedback/notificar
    │   ├── convite/[token] · convite · entrar
    │   └── layout.tsx · page.tsx · globals.css
    ├── components/
    │   ├── layout/ Sidebar · Header · ProvedorSessao
    │   ├── batalha/ TabelaCombate · LinhaCombatente · LogBatalha · BarraVida ·
    │   │            DadosVirtuais · EspacosMagia · PopupCondicao · SeletorTipoDano ·
    │   │            SidebarMonstros · TooltipCombatente
    │   ├── personagem/ FichaPersonagem · MiniCard · ModalLevelUp ·
    │   │               BotaoCopiarPersonagem · BotaoImportarFicha
    │   ├── diario/ EditorComMencoes · TextoComMencoes
    │   ├── galeria/ GaleriaImagens
    │   ├── convite/ AceitarConvite · AceitarConviteEfetivo · EntrarCampanha
    │   ├── admin/ PainelAdmin · PainelFeedbacks
    │   └── ui/ Badge · BloqueioPlano · BotaoAdicionarPersonagem · BotaoReportar ·
    │           BotaoRunico · DivisorOrnamentado · PainelGrimorio
    ├── hooks/ usePermissao · usePlanoEfetivo
    ├── lib/
    │   ├── supabase/client.ts (anon) · server.ts (server + createAdminClient service role)
    │   ├── admin/verificar-admin.ts        # checa profiles.is_admin
    │   ├── claude/client.ts · prompts.ts
    │   ├── dados-dnd/ espacos-magia.ts · spell_slots_db.json · condicoes.ts ·
    │   │              tipos-dano.ts · xp-encontro.ts · xp-niveis.ts
    │   ├── ia/limites.ts · planos.ts · tema.ts · utils.ts
    │   └── stripe/client.ts · produtos.ts
    ├── store/ batalha.ts · campanha.ts        # NÃO existe auth.ts
    └── types/ database.ts · batalha.ts · dnd.ts
```

### Migrations versionadas (`supabase/migrations/`)
```
20260518_add_aventura_bloqueada_ate.sql
20260601_add_resposta_feedbacks.sql
20260601_add_slots_magia_personagens.sql
20260601_add_titulo_imagens.sql      ⚠️ ver seção 9, item 3
```
A maior parte do schema foi aplicada direto no SQL Editor do Supabase, **não** está versionada aqui.

---

## 4. BANCO DE DADOS

### Tabelas da aplicação
```
profiles          — id, email, nome, username, plano, is_admin (boolean),
                    stripe_customer_id, avatar_url, telefone, criado_em
campanhas         — id, dm_id, nome, status, sistema, moeda_custom_nome,
                    sessao_data, sessao_formato, sessao_local, deletada
campanha_membros  — id, campanha_id, user_id, email, papel, plano_efetivo,
                    status ('ativo'|'convidado'|'removido'), token_convite,
                    criado_em, aceito_em
                    UNIQUE (campanha_id, user_id)
personagens       — id, campanha_id, user_id, nome, classe, nivel, raca, antecedente,
                    atributos, ca, iniciativa, deslocamento, pv_maximo/atual/temporarios,
                    bonus_proficiencia, inspiracao, salvaguardas, pericias,
                    ataques jsonb, equipamento, outras_proficiencias,
                    tracos_personalidade, ideais, vinculos, fraquezas,
                    caracteristicas_talentos, imagem_url, moedas jsonb,
                    inventario jsonb, percepcao_passiva,
                    resistencias/imunidades/vulnerabilidades jsonb,
                    tipo_personagem, ativo, visibilidade, visibilidade_jogador_id,
                    slots_magia jsonb { "1": { total: 4, usados: 2 } }, criado_em
magias_personagem — id, personagem_id, spell_id (bigint, ATUAL),
                    magia_id (uuid, LEGADO), nome, nivel, preparada,
                    classe_conjuradora, criado_em
sessoes           — batalha_estado jsonb (combatentes, log, rodadaAtual, turnoAtual)
aventuras         — campanha_id, conteudo_json (capítulos → locais), bloqueada_ate
diario_entradas   — id, campanha_id, sessao_id, tipo, titulo, conteudo,
                    visibilidade ('dm'|'grupo'|'privado'|'jogador_especifico'),
                    visibilidade_jogador_id, criado_por, criado_em
notificacoes      — id, user_id, tipo, titulo, mensagem, lida, link, criado_em
imagens           — id, campanha_id, nome, url, storage_path, tipo,
                    visivel_jogadores, compartilhado, criado_em (+ titulo órfão)
feedbacks         — id, user_id, tipo, mensagem, resposta, respondido_em,
                    respondido_por, criado_em
condicoes         — 16 condições D&D 5e
```

### Forma REAL de `aventuras.conteudo_json` (verificada na linha do Vecna)
```
capitulos[] → { numero, titulo, traduzido?, locais[] }
locais[]    → { nome, codigo, notas_dm, texto_narrativo,
                tesouros: string[], armadilhas: string[], criaturas: string[] }
```
**Não existem** por local: `npcs[]`, `encontros[]`, `detalhes_ocultos`, `id`, `ordem`.
`src/types/database.ts` e `api/aventura/processar/route.ts` ainda assumem a forma antiga → seção 9, item 2.

### Tabelas SRD
```
spells   — ~319 magias PT-BR + damage_dice, damage_type_en/pt, damage2_*,
           save_ability, save_effect, attack_type, roller, upcast_dice,
           conditions_applied_pt, heal_dice, aoe_type, aoe_size_ft
monsters — ~291 monstros PT-BR + hit_dice, passive_perception,
           darkvision_ft, blindsight_ft, tremorsense_ft, truesight_ft
monster_saves · monster_skills · monster_damage_modifiers ·
monster_condition_immunities · monster_actions
equipment_weapons/armor/tools/gear · magic_items · magic_item_spells
racas · subracas · classes · antecedentes
conteudo_personalizado (plano DM Supremo)
```

**Monstros com `monster_actions` preenchido (12):** adult-black-dragon, assassin, clay-golem, ghoul, goblin, skeleton, treant, troll, vampire-spawn, veteran, werewolf, zombie.
**Magias estruturadas:** acid-splash, fire-bolt, chill-touch, eldritch-blast, burning-hands, cure-wounds, healing-word, thunderwave, fireball, lightning-bolt, hold-person, hold-monster, mass-cure-wounds.

> Números de cobertura não foram reconferidos no banco nesta revisão — o conector Supabase está sem permissão de leitura no momento (`list_projects` retorna vazio). Revalidar antes de decisões que dependam da contagem.

### Storage
- `dungeon-desk-imagens` — público, 5MB, jpeg/png/gif/webp
- `aventuras` — pdf/text/markdown/octet-stream

---

## 5. PLANOS

| Plano ID | Nome | Preço | Personagens | Campanhas | IA msgs | Aventura |
|----------|------|-------|-------------|-----------|---------|---------|
| free | Aventureiro | Grátis | 6 | 1 | 0 | ❌ |
| solo | Herói | R$14,90 | ∞ | 1 (3 meses) | 30 | limitada |
| mesa_pro | Mestre | R$29,90 | ∞ | 3 | 100 | ∞ |
| guild_master | Guilda | R$59,90 | ∞ | ∞ | ∞ | ∞ |
| dm_supremo | DM Supremo | R$99,90 | ∞ | ∞ | ∞ | ∞ + personalizado |

Hierarquia de acesso: **plano → campanha → DM ou jogador**. O jogador herda o plano do DM naquela campanha via `campanha_membros.plano_efetivo`, exposto em `campanhaAtiva.plano_efetivo` e consumido pelo hook `usePlanoEfetivo()`.

---

## 6. FUNCIONALIDADES IMPLEMENTADAS

### Batalha
- Tracker completo: iniciativa, CA, PV, condições, log com ícones
- **Fluxo principal:** botão "⚔️ Registrar Ação" — tipo de ação, autor, alvos múltiplos com valor por alvo, aplica dano/cura automaticamente
- 25 tipos de ação; resistências/imunidades/vulnerabilidades aplicadas no cálculo
- Slots de magia descontados automaticamente (jogador → banco; monstro/NPC → painel de conjuração na linha, ícone varinha)
- Numeração automática (Goblin → Goblin 2), renomear inline, ajuste manual de PV, "💚 Aplicar Cura" em massa
- Sincronização batalha → ficha (PV grava no banco quando há `personagem_id`)
- Ataques estruturados vindos de `monster_actions` ao adicionar combatente
- Resumo de batalha com ações agrupadas, XP automático e badge de dificuldade
- Componentes de apoio: `DadosVirtuais`, `SeletorTipoDano`, `PopupCondicao`, `SidebarMonstros`, `TooltipCombatente`, `BarraVida`, `EspacosMagia`

### Personagens
- Ficha 5e em 3 folhas, criação guiada em 10 passos, importar PDF/JSON, copiar, transferir para jogador
- Círculos de magia clicáveis (toggle usado/disponível), sincronizados com a batalha
- **Espaços de magia por classe** via `getEspacosMagiaPorClasse(classe, nivel)` lendo `spell_slots_db.json` (contribuição do colaborador)
- `ModalLevelUp` — animação de confete em canvas ao subir de nível
- Visibilidade filtrada no banco, dropdown com nomes reais dos jogadores

### Bestiário
- Badge "✓ Dados completos" para monstros com `monster_actions`
- Detalhe estruturado: cabeçalho, atributos, **6 saves sempre visíveis** (proficiência destacada), perícias, sentidos, resistências/imunidades em chips, ações agrupadas por tipo com bônus/alcance/dano/save/recarga/custo lendário
- Fallback em texto corrido para monstros sem dados estruturados
- **Modal admin de edição** (`is_admin`): abas Básico · Saves · Perícias · Resistências · Condições · Ações · Legado. Salva com UPDATE em `monsters` + DELETE/INSERT nas auxiliares. Abas de magias/itens foram removidas — cada um edita no seu próprio módulo

### Aventura
- Processamento de PDF/MD/TXT por IA → capítulos e locais
- **Tradução incremental por capítulo** (`/api/aventura/traduzir`, service role): 6 locais por chamada, preserva `codigo` e slugs de `criaturas[]` verbatim, marca `capitulo.traduzido = true`, devolve offset intacto em falha de parse para retomar, botão DM-only "🌐 Traduzir capítulo" / "Retraduzir" com progresso `X/Y` e ✓ na lista lateral
- Vecna carregado: 11 capítulos, 233 locais, campanha `2ac7dc83-3013-4bb4-9e7f-8b809d47e2fc`

### Diário
- @ menções clicáveis `@[Nome](personagem:id)` com popup via `createPortal`
- Autor visível (join com `profiles` por `criado_por`)
- Entradas privadas do jogador invisíveis ao DM; jogador não pode escolher visibilidade `dm`

### Outros
- Sidebar **minimizável** (14px ↔ 220px, estado em `localStorage` chave `sidebar-minimizada`)
- Imagens/mapas com upload, bucket público, toggle de visibilidade para jogadores
- Notificações persistentes, "marcar todas como lidas", não lidas primeiro
- Feedbacks com resposta do admin e status para o usuário
- Convites por username, link de entrada multi-uso, aceitar convite
- Admin: painel de usuários, alterar plano, alternar `is_admin`, painel de feedbacks
- Stripe: checkout + webhook
- Páginas de ajuda, legal e conta

---

## 7. COLABORAÇÃO — DOIS DEVS NO MESMO REPO

### Quem é quem
| Pessoa | GitHub | Como trabalha |
|--------|--------|---------------|
| Douglas (dono, admin/DM) | `douglasabradfield` | Claude Code no VS Code, commit direto na `main` |
| Gustavo (eng. de software, amigo) | `gustavodsantana23` | Branch + Pull Request |

### Histórico de contribuição do Gustavo
- **PR #2** — `bug/espacos-de-magia-por-classe` → `main`, mergeado em **15/07/2026**
  - `src/lib/dados-dnd/spell_slots_db.json` (novo, 1228 linhas) — progressão por classe: Bard, Cleric, Druid, Sorcerer, Wizard, Paladin, Ranger, Warlock, Eldritch_Knight, Arcane_Trickster
  - `src/lib/dados-dnd/espacos-magia.ts` (+38) — `getEspacosMagiaPorClasse()`
  - `src/components/personagem/FichaPersonagem.tsx` (+3/-3) — passa a usar a função por classe
- Branch `bug/espacos-de-magia-por-classe` **continua aberta** no remoto (merged, pode ser deletada)
- Único commit dele desde então: nenhum. Último commit do repo é do Douglas (05/08).

### Regras de convivência (adotar)
1. **Antes de qualquer sessão de dev:** `git fetch origin && git log HEAD..origin/main --oneline`. Se tiver commit, `git pull --rebase origin main`.
2. **Nunca** `git push --force` nesta `main`.
3. Push rejeitado por non-fast-forward = proteção do git, não erro. Puxar e repetir.
4. Gustavo trabalha em branch `feat/*` ou `bug/*` e abre PR; Douglas revisa e mergeia.
5. Avisar o outro após qualquer push na `main` — a Vercel deploya automaticamente em produção.
6. Arquivo de maior risco de conflito: `src/components/personagem/FichaPersonagem.tsx` e `src/app/(dashboard)/aventura/page.tsx`.
7. `CLAUDE.md` e `AGENTS.md` são compartilhados: mudança de convenção entra ali, não só neste documento.

---

## 8. DECISÕES TÉCNICAS

1. **Service role API route é o padrão** para qualquer leitura/escrita cross-user. RLS é a causa raiz mais comum de "dado não aparece". Exemplos canônicos: `/api/campanhas/minhas`, `/api/usuarios/buscar`, `/api/aventura/traduzir`.
2. **RLS campanhas:** SELECT usa `dm_id = auth.uid() OR id IN (campanha_membros)`.
3. `magias_personagem`: sempre `spell_id` (bigint). `magia_id` (uuid) é legado.
4. `diario_entradas`: autor é **`criado_por`**, não `user_id`.
5. `imagens`: coluna é **`nome`**, não `titulo`. Bucket público → `getPublicUrl`.
6. **Zustand batalha:** em memória, com Immer, não persiste. Pausar grava JSON em `sessoes.batalha_estado`. Fim de batalha grava em `diario_entradas` e atualiza `sessoes`.
7. **Zustand campanha:** campanha ativa persistida por ID em `localStorage` (`dungeon-desk-campanha`); lista sempre recarregada de `/api/campanhas/minhas`.
8. Slots de magia: jsonb em `personagens.slots_magia` `{ "1": { total, usados } }`.
9. Admin: `profiles.is_admin = true` (não há coluna `role`); rotas usam `verificarAdmin(userId)`.
10. Bestiário: sem `monster_actions` → fallback em texto corrido.
11. Monstros ausentes no banco: `stone-golem` e `vampire` (usar `clay-golem` e `vampire-spawn`).
12. Jogador adicionado por `@username`, entra direto como `status = 'ativo'` e recebe notificação interna.
13. `.select()` sem argumentos gera `?select=*` e quebra com 400 quando há coluna inexistente — sempre listar colunas.

---

## 9. INCONSISTÊNCIAS E BUGS CONHECIDOS (não corrigidos)

**1. 🔴 Bruxo fica com ZERO espaços de magia.**
No `spell_slots_db.json`, Warlock usa a forma `{ slots: 3, slot_level: 5 }` (Pact Magic), mas `getEspacosMagiaPorClasse()` lê as chaves `'1st'..'9th'`. Para Bruxo todas retornam `undefined → 0`. Afeta o Plut do Prado na mesa do Vecna.

**2. 🔴 Classe não conjuradora recebe slots de full caster.**
`CLASSE_CONJURADORA_MAP` não mapeia guerreiro, ladino, bárbaro, monge, artífice nem Eldritch Knight / Arcane Trickster. Sem match, a função cai no fallback `getEspacosMagia(nivel)` — que é a tabela de **full caster**. Resultado: um Bárbaro nível 13 aparece com 4/3/3/3/2/1/1 espaços.

**3. 🟠 Schema de aventura desalinhado.**
`src/types/database.ts` (linhas ~63–81) e `api/aventura/processar/route.ts` declaram `npcs[]`, `encontros[]`, `detalhes_ocultos` por local — campos que **não existem** no `conteudo_json`. A IA gera esse conteúdo, você paga o token e o dado é descartado no INSERT. `aventura/page.tsx` e `aventura/traduzir/route.ts` já usam a forma correta.

**4. 🟠 Coluna `titulo` órfã em `imagens`.**
A migration `20260601_add_titulo_imagens.sql` adiciona `titulo text`, mas toda a doutrina e o código usam `nome`. Coluna morta — remover ou a migration, ou a coluna.

**5. 🟡 Migrations incompletas.**
Só 4 arquivos em `supabase/migrations/`. O resto do schema (SRD, RLS, tabelas auxiliares de monstro) existe só no banco. Um `db pull` recuperaria a paridade e destravaria o Gustavo para rodar o projeto localmente.

**6. 🟡 Branch merged não deletada:** `bug/espacos-de-magia-por-classe`.

**7. 🟡 Conector Supabase sem permissão** nesta sessão (`list_projects` vazio, `execute_sql` bloqueado). Reautorizar se quiser diagnóstico direto no banco pelo chat.

---

## 10. PENDÊNCIAS

### 🟡 Próximas features
- [ ] Corrigir Bruxo e classes não conjuradoras nos espaços de magia (itens 1 e 2 acima)
- [ ] Alinhar `database.ts` + `processar/route.ts` com o schema real de aventura
- [ ] Seed das criaturas exclusivas do Vecna (Apêndices A e B) via SQL
- [ ] Ampliar cobertura de `monster_actions` além dos 12 monstros
- [ ] Edição admin de magias (damage_dice, save_ability, etc.)
- [ ] Restrições de plano — Free ainda vê magias e itens
- [ ] Aba "Personalizado" do DM Supremo em bestiário/magias/itens
- [ ] Convite por e-mail/link (hoje só por username)

### 🟢 Planejado
- [ ] PWA mobile
- [ ] Vercel Pro para aventuras grandes (timeout)
- [ ] E-mails transacionais (Resend)
- [ ] Gravação de sessão + transcrição

### Criaturas do Vecna (uso pessoal, via SQL)
Apêndice A — 40+ criaturas CR 1–21.
Apêndice B — Strahd (CR15), Lord Soth (CR19), Tasha (CR19), Alustriel (CR21), Kas (CR23), Miska (CR24), Vecna (CR26).

---

## 11. MESA DE TESTE E CAMPANHA REAL

- Douglas (admin/DM): `e8ee7f2e-1ced-4706-b9d4-4373855fafc1` — douglasabradfield@gmail.com
- Dara (jogadora de teste): `19014bc1-8a1e-4f81-a18a-8b7971af736d` — @dara

### Campanhas
- Vecna: `2ac7dc83-3013-4bb4-9e7f-8b809d47e2fc`
- Teste: `20781895-ebfc-4cb5-a31f-95301b54b12c`
- Dara: `016cd277-df72-431b-96e0-141846e4dc82`

### Grupo real (Vecna: Eve of Ruin — nível 13, capítulo 4)
Dino Luz do Leste (Paladino meio-orc, CA 20, 113 PV) · 7 Palmos (Clérigo aasimar, SAB 20, CA 19) · Alvarez Penteado (Clérigo, 131 PV, CA 18) · Pércules (Bardo meio-orc, CAR 18) · Brisa D. Vento (Druida élfica, CA 13) · Tobias Marvolo Riddle (Mago alto-elfo, INT 20, CA 13, 80 PV) · Plut do Prado (Bruxo). NPCs: Eldon Chaveiro, Salazar.

---

## 12. COMO CONTINUAR

### Fluxo de trabalho
Arquitetura, diagnóstico e redação de prompts acontecem no chat do claude.ai. A implementação vai para o **Claude Code no VS Code**. Prompts entregues como `.md` em `/mnt/user-data/outputs/`.

```bash
cd C:\Users\dougl\dungeon-desk
git fetch origin && git log HEAD..origin/main --oneline   # antes de começar
git pull --rebase origin main                              # se houver commits
# ... trabalho ...
npm run build
git add . && git commit -m "descrição" && git push
```

### Regras para prompts no Claude Code
1. Sempre ler os arquivos inteiros antes de alterar.
2. Em qualquer coisa que toque roteamento/params/cache/proxy: consultar `node_modules/next/dist/docs/` (Next 16).
3. Sempre `npm run build` ao final.
4. `git add/commit/push` **só no último prompt do lote**.
5. SQL antes do código — executar no SQL Editor do Supabase e, quando fizer sentido, salvar em `supabase/migrations/`.
6. Esforço alto para features grandes (SRD, batalha, aventura).
7. Manter `CLAUDE.md` atualizado quando uma convenção mudar.
