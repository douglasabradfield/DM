import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'

export const maxDuration = 60

// Esta rota só EXTRAI. Não grava nada: o resultado abre o
// ModalAdminEditarMonstro em modo criar, e o mestre salva por lá.

const LIMITE_CARACTERES = 20_000

// Mesmas listas das restrições CHECK de monster_actions / monster_saves /
// monster_damage_modifiers — valor fora delas faz o insert falhar no modal.
const ACTION_TYPES = ['action', 'bonus_action', 'reaction', 'legendary_action', 'lair_action', 'multiattack', 'trait']
const ATTACK_TYPES = ['melee_weapon', 'ranged_weapon', 'melee_spell', 'ranged_spell']
const ATRIBUTOS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const MODIFIER_TYPES = ['resistance', 'immunity', 'vulnerability']
const IDS_DANO = TIPOS_DANO.map(t => t.id as string)
const CONDICOES_EN = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'stunned', 'unconscious',
]

const PROMPT = `Você extrai blocos de estatísticas de criaturas de D&D 5ª Edição (edições 2014 e 2024, em português) para um banco de dados.

Se o texto NÃO for um bloco de estatísticas de criatura, retorne apenas:
{ "erro": "explicação curta em português" }

Caso contrário, retorne APENAS um JSON válido (sem markdown, sem texto extra) neste formato:
{
  "name_pt": string, "name_en": string ("" se não houver nome em inglês),
  "size_pt": string (ex.: "Médio"), "type_pt": string (ex.: "humanoide", "morto-vivo"), "alignment_pt": string (ex.: "neutro e mau"),
  "armor_class": number, "hit_points": number, "hit_dice": string (ex.: "4d8+4") ou null,
  "challenge_rating": string (ex.: "1/4", "5"), "xp": number, "proficiency_bonus": string (ex.: "+2"),
  "str_score": number, "dex_score": number, "con_score": number, "int_score": number, "wis_score": number, "cha_score": number,
  "speed_pt": string (sempre em metros, ex.: "9 m, escalada 6 m"),
  "senses_pt": string (sempre em metros) ou "",
  "languages_pt": string ou "",
  "passive_perception": number ou null,
  "darkvision_ft": number ou null, "blindsight_ft": number ou null, "tremorsense_ft": number ou null, "truesight_ft": number ou null,
  "traits_rules_pt": string ou "",
  "acoes": [ {
    "action_type": string, "name_pt": string, "name_en": string ou null,
    "attack_type": string ou null, "attack_bonus": number ou null,
    "reach_ft": number ou null, "range_normal_ft": number ou null, "range_long_ft": number ou null,
    "target_pt": string ou null,
    "damage_dice": string ou null, "damage_type_pt": string ou null,
    "damage2_dice": string ou null, "damage2_type_pt": string ou null,
    "save_ability": string ou null, "save_dc": number ou null, "save_effect_pt": string ou null,
    "recharge": string ou null, "condition_applied_pt": string ou null, "legendary_cost": number ou null,
    "description_pt": string
  } ],
  "saves": [ { "ability": string, "bonus": number } ],
  "skills": [ { "skill_pt": string, "skill_en": string, "bonus": number } ],
  "damage_modifiers": [ { "modifier_type": string, "damage_type_pt": string, "note_pt": string ou null } ],
  "condition_immunities": [ { "condition_en": string } ]
}

VALORES PERMITIDOS — use exatamente estes, nada fora destas listas:
- action_type: action | bonus_action | reaction | legendary_action | lair_action | multiattack | trait
- attack_type: melee_weapon | ranged_weapon | melee_spell | ranged_spell
- save_ability e saves.ability: str | dex | con | int | wis | cha (minúsculo)
- damage_type_pt e damage2_type_pt e damage_modifiers.damage_type_pt: acido | contundente | cortante | eletrico | fogo | forca | frio | necrotico | perfurante | psiquico | radiante | trovejante | veneno
  (é o id, sem acento e minúsculo; "concussão" = contundente, "relâmpago" = eletrico, "trovão" = trovejante)
- modifier_type: resistance | immunity | vulnerability
- condition_en: ${CONDICOES_EN.join(' | ')}

UNIDADES:
- Os campos terminados em _ft são SEMPRE em PÉS. A unidade de origem NÃO é fixa: detecte-a pela marcação de cada medida no texto.
- Medida marcada em metros ("m", "metro", "metros"): converta para pés pela regra do jogo, 1,5 m = 5 pés (multiplique os metros por 10/3 e arredonde). Ex.: 1,5 m → 5; 3 m → 10; 9 m → 30; 18 m → 60; 36 m → 120.
- Medida marcada em pés ("ft", "ft.", "feet", "foot", "-foot", "pés"): mantenha o número como está, SEM conversão. Ex.: "5 ft." → 5; "reach 10 ft." → 10; "20-foot radius" → 20; "120 feet" → 120; "range 80/320 ft." → 80 e 320.
- Alcance corpo a corpo vai em reach_ft. Distância "x/y" de ataque à distância vai em range_normal_ft / range_long_ft.
- speed_pt e senses_pt são texto SEMPRE em metros, no formato do livro em português. Se a origem estiver em pés, converta pela mesma regra (5 pés = 1,5 m) e escreva em português. Ex.: "30 ft., climb 30 ft." → "9 m, escalada 9 m"; "darkvision 60 ft., passive Perception 10" → "visão no escuro 18 m, Percepção passiva 10". Se já estiver em metros, mantenha como está.

AÇÕES:
- Cada traço passivo (ex.: "Resistência à Magia", "Faro Aguçado") vira uma ação com action_type "trait" e o texto em description_pt.
- Multiataque vira action_type "multiattack" com o texto em description_pt.
- Ação lendária: action_type "legendary_action"; legendary_cost = custo (1 se não indicado). O parágrafo introdutório das ações lendárias vai em traits_rules_pt.
- Ação de covil: action_type "lair_action".
- Ataque: attack_type pelo texto ("Ataque Corpo a Corpo com Arma" → melee_weapon; na edição 2024 "Ataque Corpo a Corpo" sem "com magia" → melee_weapon e "Ataque à Distância" → ranged_weapon). damage_dice com o modificador, sem espaços (ex.: "7 (1d8 + 3)" → "1d8+3"). Dano adicional de outro tipo vai em damage2_dice/damage2_type_pt.
- Teste de resistência: save_ability, save_dc e save_effect_pt (resumo do efeito na falha/sucesso).
- recharge: só para "Recarga X–Y" → "5-6" ou "6". Limites como "1/Dia" ou "3/Dia" ficam no name_pt, ex.: "Sopro Venenoso (1/Dia)".
- condition_applied_pt: nome da condição em português, se a ação impõe uma.
- description_pt: o texto completo da ação como está no livro (sempre preencha, mesmo quando os campos estruturados já cobrem o ataque).

CONJURAÇÃO (edição 2024 e criaturas com magias por frequência):
- Registre como UMA ação, action_type "action", name_pt "Conjuração", attack_type null, attack_bonus null, save_ability null.
- save_dc = CD de resistência de magia.
- description_pt = atributo de conjuração, CD, bônus de ataque de magia se houver, e a lista de magias agrupada por frequência, ex.: "Usa Inteligência (CD 15, +7 para atingir com magia). À vontade: Mãos Mágicas, Prestidigitação. 2/dia cada: Bola de Fogo, Invisibilidade. 1/dia: Teletransporte."
- NUNCA invente espaços de magia nem níveis de espaço. Se o bloco (edição 2014) listar espaços por nível, copie como texto na description_pt.

ATRIBUTOS, SALVAGUARDAS, PERÍCIAS:
- saves: só os atributos com proficiência (bônus diferente do modificador do atributo). bonus = valor total.
- skills: skill_pt como no livro, skill_en em inglês (ex.: "Percepção" → "Perception").
- Se XP ou bônus de proficiência não aparecerem, use os valores da tabela de ND do D&D 5e.

O QUE NÃO COUBER:
- Qualquer trecho que você não souber classificar em um campo vai para traits_rules_pt, com o texto original. Nunca descarte texto em silêncio.

Texto colado pelo mestre:
"""
`

type Json = Record<string, unknown>

function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function inteiro(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace('+', ''))
  return Number.isFinite(n) ? Math.round(n) : null
}

function lista(v: unknown): Json[] {
  return Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []
}

function idDano(v: unknown): string | null {
  const t = texto(v)
  if (!t) return null
  const norm = t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return IDS_DANO.includes(norm) ? norm : null
}

// Valor fora das listas permitidas não pode ir para o banco (CHECK), mas
// também não pode sumir: vira uma nota na descrição para o mestre revisar.
function sanitizar(bruto: Json) {
  const sobras: string[] = []
  const tracos = texto(bruto.traits_rules_pt)
  if (tracos) sobras.push(tracos)

  const acoes = lista(bruto.acoes).filter(a => texto(a.name_pt)).map(a => {
    const notas: string[] = []
    let actionType = texto(a.action_type) ?? 'action'
    if (!ACTION_TYPES.includes(actionType)) { notas.push(`tipo de ação: ${actionType}`); actionType = 'action' }
    let attackType = texto(a.attack_type)
    if (attackType && !ATTACK_TYPES.includes(attackType)) { notas.push(`tipo de ataque: ${attackType}`); attackType = null }
    let saveAbility = texto(a.save_ability)?.toLowerCase() ?? null
    if (saveAbility && !ATRIBUTOS.includes(saveAbility)) { notas.push(`resistência: ${saveAbility}`); saveAbility = null }
    const dano1 = idDano(a.damage_type_pt)
    if (!dano1 && texto(a.damage_type_pt)) notas.push(`tipo de dano: ${texto(a.damage_type_pt)}`)
    const dano2 = idDano(a.damage2_type_pt)
    if (!dano2 && texto(a.damage2_type_pt)) notas.push(`tipo de dano 2: ${texto(a.damage2_type_pt)}`)

    const descricao = texto(a.description_pt) ?? ''
    return {
      action_type: actionType,
      name_pt: texto(a.name_pt)!,
      name_en: texto(a.name_en),
      attack_type: attackType,
      attack_bonus: inteiro(a.attack_bonus),
      reach_ft: inteiro(a.reach_ft),
      range_normal_ft: inteiro(a.range_normal_ft),
      range_long_ft: inteiro(a.range_long_ft),
      target_pt: texto(a.target_pt),
      damage_dice: texto(a.damage_dice)?.replace(/\s+/g, '') ?? null,
      damage_type_pt: dano1,
      damage2_dice: texto(a.damage2_dice)?.replace(/\s+/g, '') ?? null,
      damage2_type_pt: dano2,
      save_ability: saveAbility,
      save_dc: inteiro(a.save_dc),
      save_effect_pt: texto(a.save_effect_pt),
      recharge: texto(a.recharge),
      condition_applied_pt: texto(a.condition_applied_pt),
      legendary_cost: actionType === 'legendary_action' ? (inteiro(a.legendary_cost) ?? 1) : inteiro(a.legendary_cost),
      description_pt: notas.length > 0
        ? `${descricao}${descricao ? '\n' : ''}[Revisar — valor não reconhecido: ${notas.join('; ')}]`
        : descricao,
    }
  })

  const saves = lista(bruto.saves).flatMap(s => {
    const ability = texto(s.ability)?.toLowerCase()
    const bonus = inteiro(s.bonus)
    if (!ability || bonus === null) return []
    if (!ATRIBUTOS.includes(ability)) { sobras.push(`Salvaguarda: ${ability} ${bonus >= 0 ? '+' : ''}${bonus}`); return [] }
    return [{ ability, bonus }]
  })

  const skills = lista(bruto.skills).flatMap(s => {
    const skillPt = texto(s.skill_pt)
    if (!skillPt) return []
    return [{ skill_pt: skillPt, skill_en: texto(s.skill_en) ?? '', bonus: inteiro(s.bonus) ?? 0 }]
  })

  const damage_modifiers = lista(bruto.damage_modifiers).flatMap(d => {
    const tipo = texto(d.modifier_type)
    const dano = idDano(d.damage_type_pt)
    const nota = texto(d.note_pt)
    if (!tipo || !MODIFIER_TYPES.includes(tipo) || !dano) {
      sobras.push(`Modificador de dano não reconhecido: ${[tipo, texto(d.damage_type_pt), nota].filter(Boolean).join(' ')}`)
      return []
    }
    return [{ modifier_type: tipo, damage_type_pt: dano, note_pt: nota }]
  })

  const condition_immunities = lista(bruto.condition_immunities).flatMap(c => {
    const en = texto(c.condition_en)?.toLowerCase()
    if (!en) return []
    if (!CONDICOES_EN.includes(en)) { sobras.push(`Imunidade a condição não reconhecida: ${en}`); return [] }
    return [{ condition_en: en }]
  })

  return {
    name_pt: texto(bruto.name_pt),
    name_en: texto(bruto.name_en),
    size_pt: texto(bruto.size_pt),
    type_pt: texto(bruto.type_pt),
    alignment_pt: texto(bruto.alignment_pt),
    armor_class: inteiro(bruto.armor_class),
    hit_points: inteiro(bruto.hit_points),
    hit_dice: texto(bruto.hit_dice)?.replace(/\s+/g, '') ?? null,
    challenge_rating: texto(String(bruto.challenge_rating ?? '')),
    xp: inteiro(bruto.xp),
    proficiency_bonus: texto(String(bruto.proficiency_bonus ?? '')),
    str_score: inteiro(bruto.str_score),
    dex_score: inteiro(bruto.dex_score),
    con_score: inteiro(bruto.con_score),
    int_score: inteiro(bruto.int_score),
    wis_score: inteiro(bruto.wis_score),
    cha_score: inteiro(bruto.cha_score),
    speed_pt: texto(bruto.speed_pt),
    senses_pt: texto(bruto.senses_pt),
    languages_pt: texto(bruto.languages_pt),
    passive_perception: inteiro(bruto.passive_perception),
    darkvision_ft: inteiro(bruto.darkvision_ft),
    blindsight_ft: inteiro(bruto.blindsight_ft),
    tremorsense_ft: inteiro(bruto.tremorsense_ft),
    truesight_ft: inteiro(bruto.truesight_ft),
    traits_rules_pt: sobras.join('\n\n') || null,
    acoes,
    saves,
    skills,
    damage_modifiers,
    condition_immunities,
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  let corpo: { texto?: unknown; campanhaId?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const textoColado = typeof corpo.texto === 'string' ? corpo.texto.trim() : ''
  if (!textoColado) return NextResponse.json({ erro: 'Cole o bloco de estatísticas da criatura' }, { status: 400 })
  if (textoColado.length > LIMITE_CARACTERES)
    return NextResponse.json({ erro: `Texto muito grande (máx. ${LIMITE_CARACTERES.toLocaleString('pt-BR')} caracteres)` }, { status: 413 })

  // Mesma permissão do botão "Criar Monstro": mestre da campanha ativa.
  const campanhaId = typeof corpo.campanhaId === 'string' ? corpo.campanhaId : null
  if (!campanhaId) return NextResponse.json({ erro: 'Selecione uma campanha' }, { status: 400 })
  const admin = createAdminClient()
  const { data: campanha } = await admin
    .from('campanhas')
    .select('id')
    .eq('id', campanhaId)
    .eq('dm_id', user.id)
    .maybeSingle()
  if (!campanha) return NextResponse.json({ erro: 'Apenas o mestre da campanha pode importar criaturas' }, { status: 403 })

  const claude = getClaudeClient()
  let respostaTexto: string
  try {
    const resposta = await claude.messages.create({
      model: MODELO_CLAUDE,
      max_tokens: 8000,
      messages: [{ role: 'user', content: `${PROMPT}${textoColado}\n"""` }],
    })
    if (resposta.stop_reason === 'max_tokens')
      return NextResponse.json({ erro: 'A criatura é grande demais para extrair de uma vez. Tente colar só parte do bloco.' }, { status: 422 })
    respostaTexto = resposta.content[0]?.type === 'text' ? resposta.content[0].text : ''
  } catch (e) {
    console.error('Erro na extração de criatura:', e)
    return NextResponse.json({ erro: 'Falha ao contatar a IA. Tente de novo em instantes.' }, { status: 502 })
  }

  let bruto: Json
  try {
    const inicio = respostaTexto.indexOf('{')
    const fim = respostaTexto.lastIndexOf('}')
    bruto = JSON.parse(respostaTexto.slice(inicio, fim + 1))
  } catch {
    return NextResponse.json({ erro: 'Não foi possível interpretar a resposta da IA. Tente de novo.' }, { status: 422 })
  }

  if (typeof bruto.erro === 'string' && bruto.erro.trim())
    return NextResponse.json({ erro: `Não parece um bloco de criatura: ${bruto.erro}` }, { status: 422 })

  const dados = sanitizar(bruto)
  if (!dados.name_pt || dados.armor_class === null || dados.hit_points === null)
    return NextResponse.json({ erro: 'Extração incompleta: não encontrei nome, CA e PV da criatura no texto.' }, { status: 422 })

  return NextResponse.json({ dados })
}
