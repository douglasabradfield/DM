# DUNGEON DESK — Documento de Contexto Completo
# Atualizado em 02/06/2026 — Use este documento para continuar o desenvolvimento em um novo chat

---

## 1. OBJETIVO DO APP

Dungeon Desk é uma plataforma SaaS para Dungeon Masters de D&D 5e brasileiros.
Todo o texto é em PT-BR. O foco é resolver as dores do DM:
- Gerenciar batalhas em tempo real (iniciativa, HP, condições)
- Fichas de personagens integradas
- Bestiário, magias e itens do SRD 5.2.1 em português
- Diário de campanha compartilhado
- Aventuras estruturadas por capítulo/local
- Assistente IA para NPCs, encontros e resumos
- Módulo de jogadores com acesso por campanha

---

## 2. STACK TÉCNICA

- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **Banco de dados:** Supabase (PostgreSQL + Auth + Storage)
- **Pagamentos:** Stripe (já integrado)
- **IA:** Anthropic API (claude-sonnet-4-5)
- **Estilo:** Tailwind CSS
- **Estado:** Zustand + persist
- **Drag and drop:** @dnd-kit
- **Deploy:** Vercel (plano Hobby — timeout 60s)
- **Repositório:** https://github.com/douglasabradfield/DM
- **URL produção:** https://dm-gules-one.vercel.app
- **Supabase URL:** https://fjikjxoqeljzvvfyrfey.supabase.co

---

## 3. ARQUITETURA

### Estrutura de pastas
```
src/
├── app/
│   ├── (auth)/          # login, cadastro, convite
│   ├── (dashboard)/     # páginas principais
│   │   ├── batalha/
│   │   ├── personagens/
│   │   │   └── criar/   # wizard de criação guiada
│   │   ├── bestiario/
│   │   ├── magias/
│   │   ├── itens/
│   │   ├── aventura/
│   │   ├── diario/
│   │   ├── imagens/
│   │   ├── mapas/
│   │   ├── ia/
│   │   ├── campanhas/
│   │   ├── configuracoes/
│   │   └── admin/
│   ├── api/
│   │   ├── campanhas/minhas/
│   │   ├── campanha/convidar/
│   │   ├── usuarios/buscar/
│   │   ├── aventura/processar/
│   │   ├── personagem/importar-ficha/
│   │   └── ia/chat/
│   └── convite/[token]/
├── components/
│   ├── layout/Sidebar.tsx
│   ├── layout/Header.tsx
│   ├── batalha/
│   │   ├── TabelaCombate.tsx   # tracker principal + ModalRegistrarAcao
│   │   └── LinhaCombatente.tsx # linha do combatente + painel conjuração
│   ├── personagem/FichaPersonagem.tsx
│   ├── galeria/GaleriaImagens.tsx
│   ├── diario/
│   │   ├── EditorComMencoes.tsx
│   │   └── TextoComMencoes.tsx
│   └── ui/BloqueioPlano.tsx
├── store/
│   ├── campanha.ts
│   ├── batalha.ts              # Zustand — combatentes, log, ações
│   └── auth.ts
├── hooks/
│   ├── usePlanoEfetivo.ts
│   └── usePermissao.ts
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   └── planos.ts
└── types/
    ├── database.ts
    ├── batalha.ts              # Combatente, EntradaLog, TipoEntradaLog
    └── dnd.ts                  # Monster, MonsterAction, MonsterDetailed, etc.
```

---

## 4. BANCO DE DADOS

### Tabelas principais
```
profiles          — id, email, nome, username, plano, is_admin (boolean),
                    stripe_customer_id, avatar_url, telefone, criado_em
campanhas         — id, dm_id, nome, status, sistema, moeda_custom_nome,
                    sessao_data, sessao_formato, sessao_local, deletada
campanha_membros  — id, campanha_id, user_id, email, papel, plano_efetivo,
                    status ('ativo'|'convidado'|'removido'), token_convite,
                    criado_em, aceito_em
personagens       — id, campanha_id, user_id, nome, classe, nivel, raca,
                    antecedente, forca/des/con/int/sab/car, ca, iniciativa,
                    deslocamento, pv_maximo/atual/temporarios, bonus_proficiencia,
                    inspiracao, salvaguardas, pericias, ataques jsonb,
                    equipamento, outras_proficiencias, tracos_personalidade,
                    ideais, vinculos, fraquezas, caracteristicas_talentos,
                    imagem_url, moedas jsonb, inventario jsonb,
                    percepcao_passiva, resistencias/imunidades/vulnerabilidades jsonb,
                    tipo_personagem, ativo, visibilidade, visibilidade_jogador_id,
                    slots_magia jsonb,   ← NOVO: { "1": { total: 4, usados: 2 } }
                    criado_em
magias_personagem — id, personagem_id, spell_id (bigint), magia_id (uuid, legado),
                    nome, nivel, preparada, classe_conjuradora, criado_em
sessoes           — batalha_estado jsonb (combatentes, log, rodadaAtual, turnoAtual)
diario_entradas   — id, campanha_id, sessao_id, tipo, titulo, conteudo,
                    visibilidade ('dm'|'grupo'|'privado'|'jogador_especifico'),
                    visibilidade_jogador_id, criado_por, criado_em
notificacoes      — id, user_id, tipo, titulo, mensagem, lida, link, criado_em
imagens           — id, campanha_id, nome, url, storage_path, tipo,
                    visivel_jogadores, compartilhado, criado_em
feedbacks         — id, user_id, tipo, mensagem, resposta, respondido_em,
                    respondido_por, criado_em
```

### Tabelas SRD
```
spells            — ~319 magias PT-BR
                    NOVOS CAMPOS: damage_dice, damage_type_en/pt, damage2_dice,
                    damage2_type_en/pt, save_ability, save_effect, attack_type,
                    roller, upcast_dice, conditions_applied_pt, heal_dice,
                    aoe_type, aoe_size_ft
monsters          — ~291 monstros PT-BR
                    NOVOS CAMPOS: hit_dice, passive_perception,
                    darkvision_ft, blindsight_ft, tremorsense_ft, truesight_ft
monster_saves     — monster_id, ability, bonus
monster_skills    — monster_id, skill_en, skill_pt, bonus
monster_damage_modifiers — monster_id, modifier_type, damage_type_en/pt, note_pt
monster_condition_immunities — monster_id, condition_en, condition_pt
monster_actions   — monster_id, action_type, name_pt, name_en, attack_type,
                    attack_bonus, reach_ft, range_normal_ft, range_long_ft,
                    target_pt, damage_dice, damage_type_en/pt, damage2_dice,
                    damage2_type_en/pt, save_ability, save_dc, save_effect_pt,
                    recharge, condition_applied_pt, legendary_cost, description_pt
equipment_weapons, equipment_armor, equipment_tools, equipment_gear
magic_items, magic_item_spells
racas, subracas, classes, antecedentes
conteudo_personalizado — monstros/magias/itens do plano DM Supremo
```

### Monstros com dados estruturados (monster_actions preenchido)
```
adult-black-dragon (CR 14) — 9 ações incluindo lendárias
assassin (CR 8)
clay-golem (CR 9)
ghoul (CR 1)
goblin (CR 1/4)
skeleton (CR 1/4)
treant (CR 9)
troll (CR 5)
vampire-spawn (CR 5)
veteran (CR 3)
werewolf (CR 3)
zombie (CR 1/4)
```

### Magias com dados estruturados
```
acid-splash, fire-bolt, chill-touch, eldritch-blast (truques)
burning-hands, cure-wounds, healing-word, thunderwave (nível 1)
fireball, lightning-bolt, hold-person (nível 3)
hold-monster, mass-cure-wounds (nível 5)
```

### Storage Buckets
- `dungeon-desk-imagens`: público, 5MB, jpeg/png/gif/webp
- `aventuras`: pdf/text/markdown/octet-stream

---

## 5. PLANOS

| Plano ID | Nome | Preço | Personagens | Campanhas | IA msgs | Aventura |
|----------|------|-------|-------------|-----------|---------|---------|
| free | Aventureiro | Grátis | 6 | 1 | 0 | ❌ |
| solo | Herói | R$14,90 | ∞ | 1 (3 meses) | 30 | limitada |
| mesa_pro | Mestre | R$29,90 | ∞ | 3 | 100 | ∞ |
| guild_master | Guilda | R$59,90 | ∞ | ∞ | ∞ | ∞ |
| dm_supremo | DM Supremo | R$99,90 | ∞ | ∞ | ∞ | ∞ + personalizado |

---

## 6. FUNCIONALIDADES IMPLEMENTADAS

### Batalha (store/batalha.ts + TabelaCombate.tsx + LinhaCombatente.tsx)
- Tracker completo: iniciativa, CA, PV, condições
- **Fluxo principal:** botão "⚔️ Registrar Ação" — seleciona tipo, quem fez,
  alvos múltiplos com valor por alvo, aplica dano/cura automaticamente
- **25 tipos de ação:** ataque, magia, bônus, reação, contra-magia, etc.
- **Slots de magia:** desconto automático ao registrar magia (jogadores via banco,
  monstros/NPCs via painel de conjuração na linha — ícone varinha)
- **Numeração automática:** Goblin → Goblin 2 → Goblin 3
- **Editar nome inline:** lápis hover na célula do nome
- **Ajuste manual de PV:** campo "Ajuste PV" discreto na linha (uso secundário)
- **Botão "💚 Aplicar Cura"** em múltiplos combatentes simultaneamente
- **Campo dano limpa** automaticamente após aplicar
- **Sincronização batalha→ficha:** alterações de PV salvam no banco (personagem_id)
- **Ataques estruturados:** combatente recebe monster_actions ao ser adicionado
- Log com ícones por tipo de ação
- Resumo de batalha com seção "Ações Registradas" agrupadas por categoria
- XP automático, distribuição de XP, badge de dificuldade
- Resistências/imunidades/vulnerabilidades calculam automaticamente no dano

### Personagens
- Ficha D&D 5e 3 folhas completa
- **Círculos de magia clicáveis** para jogador (toggle usado/disponível)
- **Slots sincronizados** com a batalha via atualizarCombatentePorPersonagem
- Visibilidade filtrada no banco (não frontend)
- **Dropdown de visibilidade:** nomes dos jogadores corretos, seta não navega mais
- Criação guiada 10 passos, importar PDF, copiar, transferir

### Bestiário (BestiarioCliente.tsx)
- **Badge "✓ Dados completos"** nos monstros com monster_actions preenchido
- **Detalhe estruturado:** cabeçalho, atributos, saves, skills, sentidos,
  resistências/imunidades com chips coloridos, ações agrupadas por tipo
- **AcaoMonstroItem:** formata ataque com bônus, alcance, dano, save, condição,
  badge de recarga, custo de ação lendária
- **Fallback:** texto corrido para monstros sem dados estruturados
- Ataques estruturados passados ao adicionarCombatente

### Diário
- **@ menções clicáveis:** formato `@[Nome](personagem:id)`, popup com detalhes
  (nome, tipo, raça/classe/nível, CA, PV com barra)
- **Autor visível** em toda entrada (join com profiles)
- **Privado do jogador** não aparece para o DM
- Tipos, visibilidade, filtros no banco

### Imagens/Mapas
- Upload funcionando (coluna `nome`, não `titulo`)
- Bucket público, getPublicUrl

### Notificações
- Persistem após clicar (não somem)
- "Marcar todas como lidas"
- Badge conta apenas não lidas
- Não lidas primeiro, lidas depois com opacidade reduzida

### Feedbacks
- Confirmação inline verde após envio (5s)
- Seção "Minhas mensagens" com status de resposta
- Admin pode responder via PainelFeedbacks.tsx
- Campos: resposta, respondido_em, respondido_por

---

## 7. PRÓXIMO PASSO IMEDIATO

### Edição admin no bestiário (prompt pronto para usar)

```
Leia os arquivos completos:
- src/app/(dashboard)/bestiario/BestiarioCliente.tsx
- src/types/dnd.ts

Preciso de duas melhorias:

## 1. SAVES — mostrar todos os 6 atributos sempre

Atualmente os saves mostram apenas os atributos que têm
bônus explícito em monster_saves. Precisa mostrar sempre
os 6 atributos, calculando o valor correto para cada um:

Lógica:
- Modificador do atributo = Math.floor((score - 10) / 2)
- Se tiver registro em monster_saves para aquele atributo:
  valor = monster_saves.bonus (já inclui proficiência)
- Se NÃO tiver: valor = modificador do atributo (sem prof)

Mapeamento: str→str_score, dex→dex_score, con→con_score,
            int→int_score, wis→wis_score, cha→cha_score
Labels PT: FOR, DES, CON, INT, SAB, CAR

Exibir em grid de 6 colunas. Valores com bônus de proficiência
em destaque (cor diferente) para diferenciar dos calculados.

## 2. EDIÇÃO ADMIN — modal completo

Verificar admin: profiles.is_admin === true

No detalhe do monstro, se isAdmin: botão "✏️ Editar"
Ao clicar: modal de edição com todas as seções:

DADOS BÁSICOS (tabela monsters):
name_pt, name_en, size_pt, type_pt, alignment_pt,
armor_class, hit_points, hit_dice, speed_pt,
str_score, dex_score, con_score, int_score, wis_score, cha_score,
challenge_rating, xp, proficiency_bonus, passive_perception,
darkvision_ft, blindsight_ft, tremorsense_ft, truesight_ft,
senses_pt, languages_pt

SAVES (monster_saves):
Grid editável dos 6 atributos — checkbox "tem bônus de prof"
por atributo; se marcado: input do bônus total

PERÍCIAS (monster_skills):
Lista editável + botão "+ Adicionar" + remover

RESISTÊNCIAS/IMUNIDADES/VULNERABILIDADES (monster_damage_modifiers):
Lista agrupada editável + botão "+ Adicionar" + remover

IMUNIDADES A CONDIÇÕES (monster_condition_immunities):
Checkboxes das 14 condições padrão D&D:
amedrontado, agarrado, atordoado, caído, cego,
enfeitiçado, envenenado, exausto, incapacitado,
invisível, paralisado, petrificado, surdo, inconsciente

AÇÕES (monster_actions):
Lista editável com todos os campos do schema + botão
"+ Adicionar ação" + remover

TEXTO LEGADO:
traits_rules_pt e actions_rules_pt (textareas)

SALVAR:
1. UPDATE monsters (dados básicos)
2. DELETE + INSERT nas tabelas auxiliares
3. Toast de sucesso + recarregar dados

ABAS ADMIN (preparar estrutura):
"Monstros" | "Magias" (em breve) | "Itens" (em breve)

IMPORTANTE:
- isAdmin verificado uma vez no mount
- Modal max-h-[90vh] overflow-y-auto
- Não alterar fluxo de não-admin
- Rode npm run build ao final
```

---

## 8. PENDÊNCIAS APÓS EDIÇÃO ADMIN

### 🟡 Próximas features planejadas
- [ ] Seed das criaturas exclusivas do Vecna (Apêndice A/B do PDF)
- [ ] Mais monstros SRD estruturados (aumentar cobertura além dos 12 atuais)
- [ ] Edição admin de magias (campos damage_dice, save_ability, etc.)
- [ ] Restrições de plano (Free ainda vê magias/itens)
- [ ] Plano DM Supremo: aba "Personalizado" no bestiário/magias/itens
  (separado da edição admin — DM cria sem propagar para base global)
- [ ] Convite por email/link (hoje só por username)

### 🟢 Planejado
- [ ] PWA para mobile
- [ ] Vercel Pro para processar aventuras grandes
- [ ] Email notifications via Resend
- [ ] Gravação de sessão + transcrição Whisper

### Criaturas do Vecna a criar (uso pessoal via SQL)
Apêndice A — 40+ criaturas exclusivas (CR 1–21)
Apêndice B — Chefões: Strahd (CR15), Lord Soth (CR19), Tasha (CR19),
             Alustriel (CR21), Kas (CR23), Miska (CR24), Vecna (CR26)

---

## 9. DECISÕES TÉCNICAS IMPORTANTES

1. **RLS campanhas:** SELECT usa `dm_id = auth.uid() OR id IN (campanha_membros)`

2. **Campanhas via service role:** `/api/campanhas/minhas` bypassa RLS

3. **magias_personagem:** sempre usar `spell_id` (bigint), não `magia_id` (uuid legado)

4. **diario_entradas:** coluna de autor é `criado_por` (não `user_id`)

5. **Zustand persist:** partialize retorna `{}` — não persiste no localStorage

6. **Imagens:** coluna é `nome` (não `titulo`). Bucket público, getPublicUrl

7. **Batalha:** dados em memória (Zustand), pausar salva JSON em `sessoes.batalha_estado`
   Sincronização PV via fire-and-forget ao banco quando personagem_id existe

8. **Slots de magia:** salvos como jsonb em personagens `{ "1": { total: 4, usados: 2 } }`

9. **Admin:** verificado via `profiles.is_admin = true` (não há coluna `role`)

10. **Bestiário:** monstros sem monster_actions mostram texto corrido como fallback

11. **Monstros ausentes no banco:** stone-golem e vampire não existem
    (usar clay-golem e vampire-spawn como substitutos do SRD)

---

## 10. USUÁRIOS E CAMPANHAS DE TESTE

- Douglas (admin/DM): `e8ee7f2e-1ced-4706-b9d4-4373855fafc1` | `douglasabradfield@gmail.com`
- Dara: `19014bc1-8a1e-4f81-a18a-8b7971af736d` | @dara

### Campanhas
- Vecna: `2ac7dc83-3013-4bb4-9e7f-8b809d47e2fc`
- Teste: `20781895-ebfc-4cb5-a31f-95301b54b12c`
- Dara: `016cd277-df72-431b-96e0-141846e4dc82`

---

## 11. COMO CONTINUAR

### Comandos padrão
```bash
# Commitar
cd C:\Users\dougl\dungeon-desk
git add .
git commit -m "descrição"
git push

# Ver logs de erro
# vercel.com → projeto dm → Logs → filtrar Error
```

### Regras para prompts no Claude Code
1. Sempre ler arquivos antes de alterar
2. Sempre rodar `npm run build` ao final
3. Sempre commitar e fazer push no último prompt
4. SQLs: executar no Supabase SQL Editor antes do código
5. Usar esforço alto para features grandes (SRD, batalha)
