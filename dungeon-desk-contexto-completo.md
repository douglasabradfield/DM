# DUNGEON DESK — Documento de Contexto Completo
# Atualizado em 10/08/2026 — após as Fases 0, 0.5, 1, 2, 3 e 3.5
# Substitui a versão de 06/08/2026

---

## 0. O QUE É O DUNGEON DESK HOJE

Aplicação web para mesas de D&D 5e em português. **Não é mais um app de mestre
com anexo para jogadores** — é um app de mesa, onde cada jogador opera o próprio
personagem em tempo real e o DM controla monstros, NPCs e a narrativa.

A mudança de direção aconteceu entre 06 e 10/08/2026, motivada pelo conceito que
a Wizards apresentou para o app oficial: o personagem fica no controle do
jogador o tempo todo, não apenas em combate.

Uso atual: **ferramenta pessoal** da mesa do Douglas (quartas-feiras, campanha
Vecna: Eve of Ruin). Comercialização está desativada por flag, não removida.

---

## 1. ARQUITETURA EM TRÊS CAMADAS

```
CAMPANHA  (permanente)
   └── SESSÃO  (uma noite de jogo — o DM abre e fecha)
          ├── modo livre: gasta slot, usa item, descansa, movimenta ouro
          └── BATALHA  (zero ou mais por sessão)
                 └── turnos, alvos, iniciativa
```

Antes das fases: a batalha vivia na memória do navegador do DM, e "sessão" era
efeito colateral (uma sessão por batalha). Hoje **tudo vive no servidor** com
Supabase Realtime, e cada dispositivo é uma janela para o mesmo estado.

### Princípio de escrita
**O cliente pede, o servidor decide.** Toda ação de jogo passa por
`/api/mesa/acao` (service role), que valida antes de escrever:
identidade → sessão/batalha ativa → controla o combatente → é a vez dele
(exceto reação e DM) → alvos válidos → tem espaço de magia.

O jogador nunca escreve direto em `batalha_combatentes`. A única exceção é a
arma empunhada, protegida por trigger que rejeita alteração de qualquer outra
coluna quando o autor não é o DM.

### Propriedade de campo durante batalha
| Campo | Dono | Na ficha |
|---|---|---|
| pv_atual, pv_temporarios, condições, slots, inspiração | Batalha | leitura, com aviso |
| nome, atributos, equipamento, magias conhecidas | Ficha | editável |

Ao encerrar a batalha, os valores voláteis são gravados na ficha.

---

## 2. STACK

- **Next.js 16.2.6** (App Router) · React 19.2.4 · TypeScript 5 · Tailwind v4
- Supabase (Postgres 17.6 + Auth + Storage + **Realtime**) — `sa-east-1`
- Zustand 5 + Immer · Radix UI · lucide-react · framer-motion · react-hot-toast
- react-hook-form + zod · @dnd-kit · Stripe 22 · `@anthropic-ai/sdk` (claude-sonnet-4-5)
- Deploy: Vercel (Hobby, timeout 60s), auto-deploy da `main`
- Repo: github.com/douglasabradfield/DM · Produção: dm-gules-one.vercel.app
- Supabase project: `fjikjxoqeljzvvfyrfey`

### ⚠️ Next.js 16 — regra de ouro
O `AGENTS.md` do repo avisa: *"This is NOT the Next.js you know"*. Antes de
tocar em roteamento, params, cache ou middleware, **ler
`node_modules/next/dist/docs/`**. Modelos conhecem Next 14/15 de treino e erram
aqui. Exemplo concreto: `middleware.ts` virou **`src/proxy.ts`**.

### Scripts
```bash
npm run dev · npm run build (sempre antes de commitar) · npm run start
```
Não há lint nem testes configurados.

---

## 3. BANCO DE DADOS — 41 tabelas

### Núcleo da mesa (fases 1–3.5)
```
sessoes (16 col, 4 policies)
  campanha_id, numero, titulo, status ('ativa'|'pausada'|'encerrada'),
  iniciada_em, concluida_em, batalha_estado (LEGADO, não usar)
  Índice único parcial: uma sessão não encerrada por campanha

batalhas (13 col, 4 policies)
  campanha_id, sessao_id, nome,
  status ('preparacao'|'ativa'|'pausada'|'encerrada'),
  rodada_atual, turno_combatente_id, iniciativa_confirmada, xp_distribuido,
  revelacao_pv ('padrao'|'exato')
  Índice único parcial: uma batalha não encerrada por campanha

batalha_combatentes (36 col, 5 policies)
  batalha_id, personagem_id (SET NULL), monster_id (SET NULL), controlado_por,
  nome, tipo ('jogador'|'monstro'|'npc'|'aliado'), ordem, iniciativa,
  ca, pv_maximo/atual/temporarios, condicoes[], espacos_magia, slots_monstro,
  ataques_estruturados, dados_monstro, dados_personagem, nivel, notas,
  resistencias/imunidades/vulnerabilidades, morto, ausente, vantagem,
  inspiracao, dano_total, cura_total,
  pv_revelado, arma_esquerda, arma_direita, reacao_usada, efeitos_ativos

batalha_log (14 col, 4 policies)
  batalha_id, rodada, turno, tipo (CHECK com 30 valores de TipoEntradaLog),
  autor_id + autor_nome, alvo_id + alvo_nome, valor, tipo_dano, descricao,
  resumo (bool)

sessao_log (10 col, 2 policies)
  sessao_id, tipo, autor_id + autor_nome, personagem_id, valor, tipo_dano,
  descricao — ações fora de combate
```

**Realtime habilitado** (publication `supabase_realtime`): `batalhas`,
`batalha_combatentes`, `batalha_log`, `sessoes`, `sessao_log`, `personagens`.
Todas com `REPLICA IDENTITY FULL`.

**`batalha_log.resumo`**: entradas contábeis (uma por alvo, tipo `dano`/`cura`,
valor já com resistência aplicada) marcadas `true`; a UI as esconde, a agregação
as usa. A entrada narrativa fica `false`.

### Personagens (68 colunas)
Adicionados nas fases: `classe_conjuradora`, `atributo_conjuracao`, `cd_magia`,
`slots_magia` (jsonb `{"1":{total,usados}}`), `condicoes[]`,
`dados_vida_total`, `dados_vida_usados`.

Visibilidade: **DEFAULT `'privado'`** (era `'grupo'` — toda ficha nascia
pública). Policy de SELECT: DM vê tudo · dono vê o seu · jogador ativo vê
`'grupo'` · alvo vê `'jogador_especifico'`.

### Monstros (46 colunas, 4 policies)
`criado_por`, `campanha_id`, `visivel_jogadores` permitem **homebrew na mesma
tabela do SRD** — auxiliares e batalha funcionam sem alteração. SRD tem
`criado_por IS NULL`.

**As policies de escrita em `monsters` e nas 5 auxiliares não existiam** até a
Fase 0.5 — o modal admin de edição nunca gravou nada desde junho.

### Outras
```
campanhas · campanha_membros · profiles (is_admin) ·
magias_personagem (spell_id bigint = atual; magia_id uuid = legado) ·
diario_entradas (autor = criado_por; + batalha_id) · aventuras ·
imagens (coluna nome) · notificacoes · feedbacks · condicoes ·
conteudo_personalizado · uso_ia ·
SRD: spells(259) · monsters(283) · monster_actions/saves/skills/
damage_modifiers/condition_immunities · equipment_* · magic_items ·
racas · subracas · classes · antecedentes · tipos_dano
```

**Tabelas mortas** (0 linhas, sem código): `assinaturas`, `campaign_invites`,
`campaign_members`, `espacos_magia`, `locais`.

### Storage
`dungeon-desk-imagens` (público, 5MB) · `aventuras` (pdf/text/markdown)

---

## 4. ESTRUTURA DO CÓDIGO

```
src/
├── proxy.ts                        # auth guard (ex-middleware, Next 16)
├── app/
│   ├── (auth)/login · cadastro
│   ├── (dashboard)/
│   │   ├── mesa/                   # ⭐ tela do jogador (e controle remoto do DM)
│   │   ├── batalha/                # cockpit do DM
│   │   ├── personagens · bestiario · magias · itens
│   │   ├── aventura · diario · imagens · mapas · ia
│   │   ├── campanhas · conta · configuracoes · ajuda · legal · feedback
│   │   └── admin · admin/feedbacks
│   └── api/
│       ├── mesa/acao               # ⭐ árbitro de TODA ação de jogo
│       ├── aventura/processar · traduzir
│       ├── campanhas/* · convites/* · usuarios/buscar
│       ├── ia/chat · personagem/importar-ficha
│       └── admin/* · stripe/* · feedback/notificar
├── components/
│   ├── mesa/MesaCliente.tsx        # ⭐ dois modos: sessão e combate
│   ├── batalha/ TabelaCombate · LinhaCombatente · LogBatalha · BarraVida ·
│   │            DadosVirtuais · EspacosMagia · PopupCondicao · SeletorTipoDano ·
│   │            SidebarMonstros · TooltipCombatente · BannerBatalhaAtiva
│   ├── personagem/ FichaPersonagem · MiniCard · ModalLevelUp · Botao*
│   └── diario · galeria · convite · admin · layout · ui
├── lib/
│   ├── batalha/ motor.ts ⭐ · visibilidade-pv.ts · vantagem-por-condicao.ts
│   ├── dados-dnd/ espacos-magia · spell_slots_db.json · condicoes ·
│   │              tipos-dano · xp-encontro · xp-niveis
│   ├── supabase/client · server (createAdminClient) · admin/verificar-admin
│   └── claude · ia/limites · planos · stripe · tema · utils
├── store/ batalha.ts (~900 linhas) · campanha.ts (campanha + sessão + realtime)
├── hooks/ usePermissao · usePlanoEfetivo
└── types/ database.ts · batalha.ts · dnd.ts
```

### Libs puras (sem React, sem Supabase)
- **`motor.ts`** — `calcularDano`, `aplicarCura`, `consumirEspaco`. Usado pelo
  cliente E pelo servidor. Uma função, dois consumidores.
- **`visibilidade-pv.ts`** — o que o jogador vê do PV
- **`vantagem-por-condicao.ts`** — vantagem/desvantagem derivada das condições
- **`espacos-magia.ts`** — tabela por classe (semente, não lei)

### Carga de estado compartilhado
`carregarSessaoAtiva` é chamado **na Sidebar** (envolve todas as telas), não em
telas individuais. Motivo: o store é global, e carregar só na tela do DM fazia o
jogador nunca receber a sessão. Qualquer estado global novo deve seguir isso.

---

## 5. FUNCIONALIDADES

### Tela do jogador (`/mesa`) — mobile-first, sem scroll vertical
Anatomia em altura fixa (`dvh`): barra de participantes → indicador de vez →
cartão do personagem → faixa de vantagem → barra de ações com **armas
empunhadas nos cantos inferiores** (zona do polegar).

**Modo sessão** (sem batalha): ajusta PV, condições, gasta slots, usa item,
movimenta ouro, descansa.
**Modo combate**: ataca, conjura, usa item, reage; alvo escolhido tocando no
avatar. Fora do turno, só reação.

Ergonomia validada na mesa: nada de scroll, toque mínimo 44px (ações 56px),
`dvh` em vez de `vh` (barra de endereço do mobile esconde o rodapé com `vh`).

### Segredo da ordem de iniciativa
A mesa sorteia a ordem **em cartas físicas** a cada rodada. A `/mesa` nunca
mostra a fila — só quem age agora. A barra do jogador lista PJs em ordem
alfabética; ao selecionar alvo, os inimigos aparecem, também alfabéticos.
**Qualquer ordenação por `ordem`/iniciativa na tela do jogador é vazamento.**

O turno é definido pelo DM: seta de próximo turno ou clique direto no
combatente. `confirmarIniciativa` existe mas não é pré-requisito de nada.

### Revelação de PV
Modo global por batalha: `padrao` (jogador vê só o nome) ou `exato` (números).
O olho por combatente revela o **estado vago** de um monstro específico:
Ileso · Ferido · Muito ferido · Quase morrendo. PJs sempre se veem exatos.

### Descanso
**Curto**: o jogador escolhe quantos Dados de Vida gastar e **informa o valor
rolado** (a mesa rola dado físico); Bruxo recupera todos os slots (Pacto Arcano).
**Longo**: PV cheio, todos os slots, metade dos Dados de Vida (mín. 1).

### Reações e efeitos persistentes
Reação sempre disponível, uma por rodada, resetada ao virar a rodada.
Efeitos persistentes (ex.: Guardiões Espirituais) são **lembrete, não
automação** — sem grid posicional o app não sabe quem entrou no raio. Chip no
conjurador e banner na tela do DM ao passar o turno.

### Bestiário
Badge "✓ Dados completos" para monstros com `monster_actions`. Modal admin com
7 abas cria e edita, validando NOT NULLs e CHECKs, espelhando campos `_en` do
PT, saves em minúsculo, e alcance **em metros na UI, pés no banco** (1,5 m =
5 ft, conversão do livro PT-BR, não 0,3048). Badge "✦ Criado por".

### Aventura
Processamento de PDF/MD/TXT por IA no schema canônico, tradução incremental por
capítulo (6 locais por chamada, preservando slugs), validação de slugs contra o
bestiário. Vecna: 11 capítulos, 233 locais.

### Outros
Diário com @menções · imagens e mapas com visibilidade · notificações ·
convites por username e link · admin (usuários, planos, feedbacks) · sidebar
minimizável · 4 temas · assistente IA (chat)

### Removido de propósito
**Narrativa de batalha por IA e resumo de campanha por IA.** Inventavam fatos
para preencher lacunas do log. O diário agora é montado do log numérico: dano
por combatente, cura, baixas, XP, registro cronológico.

---

## 6. DECISÕES TÉCNICAS

1. **Service role API é o padrão** para cross-user e para toda ação de jogo.
   RLS é a causa raiz mais comum de "dado não aparece".
2. **Turno por ID, não por índice** — a mesa reordena a cada rodada.
3. **Escrita otimista**: UI aplica na hora, persiste depois, reverte em erro.
4. **Log com nome desnormalizado** — o histórico sobrevive à remoção do combatente.
5. **`sessao_log` separado de `diario_entradas`** — "gastou slot N2" não é crônica.
6. **Homebrew na mesma tabela do SRD** — auxiliares e batalha sem adaptação.
7. **`MODO_MESA_LIVRE = true`** em `lib/planos.ts` desliga todas as travas de
   plano sem apagar código. Voltar a comercializar = mudar para `false`.
8. `magias_personagem`: sempre `spell_id`. `diario_entradas`: autor é
   `criado_por`. `imagens`: coluna `nome`. Admin: `profiles.is_admin`.
9. Monstros ausentes no SRD: usar `clay-golem` e `vampire-spawn`.
10. `.select()` sem argumentos gera `?select=*` e quebra com 400 se houver
    coluna inexistente — sempre listar colunas.

---

## 7. BUGS SILENCIOSOS ENCONTRADOS (todos corrigidos)

Registrados porque revelam os padrões de falha deste projeto:

| Bug | Tempo em produção | Sintoma |
|---|---|---|
| `monsters` sem policy de escrita | ~2 meses | Modal admin nunca gravou nada |
| `personagens.visibilidade` DEFAULT `'grupo'` | desde sempre | Toda ficha nascia pública |
| `LIMITE_POR_PLANO` duplicado em rotas de convite | — | Trava fora do `planos.ts` |
| Slots gastos em batalha não voltavam à ficha | desde sempre | Jogador terminava com slots intactos |
| Trigger de armas vs. service role (`auth.uid()` NULL) | horas | API do árbitro rejeitaria tudo |
| `tipo: 'magia'` em cura curando ao contrário | horas | Cura tirava PV |
| Modal do DM sem tipo de dano | desde sempre | Resistência/imunidade nunca aplicava |
| `'resistencia'` vs `'Resistência'` (string solta) | desde sempre | Rótulo nunca aparecia no log |
| Aventura importada em schema incompatível | desde sempre | Toda importação renderizava quebrada |
| Bruxo com zero espaços de magia | desde julho | Pacto Arcano lido como tabela normal |
| Classe não conjuradora com slots de full caster | desde julho | Bárbaro 13 com 4/3/3/3/2/1/1 |
| `carregarSessaoAtiva` só na tela do DM | horas | Jogador nunca via a sessão |

**Padrão**: RLS ausente · string literal comparada solta · schema divergente
entre quem escreve e quem lê · estado global carregado em uma tela só.
Verificar os quatro em qualquer bug de "não salva" ou "não aparece".

---

## 8. COLABORAÇÃO

| Pessoa | GitHub | Fluxo |
|---|---|---|
| Douglas (dono, DM, admin) | `douglasabradfield` | Claude Code, branch por fase |
| Gustavo "Dino" (eng. de software) | `gustavodsantana23` | Branch `feat/*` ou `bug/*` + PR |

Contribuição do Dino: PR #2 (15/07) — `spell_slots_db.json` com progressão por
classe. Continua sendo a **semente** dos espaços de magia; os totais hoje são
editáveis pelo jogador, o que cobre multiclasse, Pacto Arcano e itens.

### Regras
1. `git fetch && git log HEAD..origin/main --oneline` antes de qualquer sessão
2. Nunca `push --force` na `main`
3. Divisão por **fase inteira**, nunca por arquivo — fases de batalha tocam os
   mesmos arquivos
4. `main` é produção: a mesa joga nela às quartas
5. Convenções novas vão para `CLAUDE.md`/`AGENTS.md`, não só neste documento

---

## 9. MÉTODO DE TRABALHO

- **Planejamento e prompts** no chat do claude.ai; **implementação** no Claude
  Code (VS Code)
- **Uma branch por fase**, preview automático da Vercel, merge só após teste
- **Prompt de diagnóstico antes do de correção** — achar a causa antes de operar
- `git add/commit/push` só no último prompt do lote
- **Backup antes de toda migration que altera dado existente.** Adicionar coluna
  é seguro; `UPDATE`, `DROP POLICY` e índice único não são. Comando no
  `CLAUDE.md`, destino fora do repo (contém diários privados dos jogadores).
- **Conferir se o deploy testado é o commit certo, por SHA** — já se perdeu uma
  tarde testando código antigo porque um commit não foi deployado.
- Migrations versionadas em `supabase/migrations/`, aplicadas manualmente no
  SQL Editor

---

## 10. PENDÊNCIAS

### Fase 4 — inventário (próxima)
- [ ] `inventario` jsonb → tabela normalizada
- [ ] Transferir item e ouro entre jogadores
- [ ] DM distribui tesouro, XP e inspiração

### Acerto fino acumulado
- [ ] Ficha completa otimizada para celular (fora de combate, pode ter scroll)
- [ ] Auto-save do rascunho do modal de monstro (`localStorage`)
- [ ] Nível de exaustão 1–6 (hoje binário; por isso ficou fora da vantagem derivada)
- [ ] `cura_total` do combatente usa valor bruto; o log usa cura efetiva — reconciliar
- [ ] NPC não tem flag de hostilidade — inimigo aparece com anel de aliado
- [ ] Coluna `titulo` órfã em `imagens`
- [ ] Dropar as 5 tabelas mortas
- [ ] **Verificar se o XP salva na ficha ao distribuir** (bug antigo; pode ter se
      resolvido com a migração para servidor — testar antes de investigar)

### Backlog maior
- [ ] Processar aventura por capítulo (hoje trunca em 8096 tokens numa chamada só)
- [ ] Ampliar `monster_actions` além dos 12 monstros com dados completos
- [ ] Criaturas do Vecna: Apêndice A (40+, CR 1–21) e B (Strahd, Lord Soth,
      Tasha, Alustriel, Kas, Miska, Vecna) — cadastráveis pela UI desde a Fase 0.5
- [ ] PWA instalável
- [ ] Tela de estatísticas de campanha (o log já tem todos os dados)
- [ ] Magias, armas e itens homebrew

---

## 11. MESA REAL

**Douglas** (admin/DM): `e8ee7f2e-1ced-4706-b9d4-4373855fafc1`
**Dara** (jogadora de teste): `19014bc1-8a1e-4f81-a18a-8b7971af736d`

Campanhas: Vecna `2ac7dc83-3013-4bb4-9e7f-8b809d47e2fc` ·
Teste `20781895-ebfc-4cb5-a31f-95301b54b12c` ·
Dara `016cd277-df72-431b-96e0-141846e4dc82`

**Grupo (Vecna: Eve of Ruin, nível 13, capítulo 4)** — joga às quartas:
Dino Luz do Leste (Paladino meio-orc, CA 20, 113 PV) · 7 Palmos (Clérigo
aasimar) · Alvarez Penteado (Clérigo, 131 PV) · Pércules (Bardo meio-orc) ·
Brisa D. Vento (Druida élfica) · Tobias Marvolo Riddle (Mago alto-elfo, 80 PV) ·
Plut do Prado (**Bruxo** — o caso que valida Pacto Arcano no descanso curto).
NPCs: Eldon Chaveiro, Salazar.

⚠️ **Fichas incompletas**: nenhum personagem tem magia marcada como preparada.
Tobias (Mago 13) não tem magias nem ataques cadastrados; Alvarez está sem
classe. O botão de magia degrada com aviso, mas vale completar — agora que a
`/mesa` usa esses dados, o incentivo para cadastrar finalmente existe.
