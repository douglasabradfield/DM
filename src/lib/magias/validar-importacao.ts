import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'

// Validação do payload de magia importada. Usada pela rota de extração (IA) e,
// de novo, pela rota que grava — o servidor nunca confia no que veio do client.

export const ESCOLAS_MAGIA: { pt: string; en: string }[] = [
  { pt: 'Abjuração', en: 'Abjuration' },
  { pt: 'Adivinhação', en: 'Divination' },
  { pt: 'Conjuração', en: 'Conjuration' },
  { pt: 'Encantamento', en: 'Enchantment' },
  { pt: 'Evocação', en: 'Evocation' },
  { pt: 'Ilusão', en: 'Illusion' },
  { pt: 'Necromancia', en: 'Necromancy' },
  { pt: 'Transmutação', en: 'Transmutation' },
]

const DANO_EN: Record<string, string> = {
  acido: 'acid', contundente: 'bludgeoning', cortante: 'slashing', eletrico: 'lightning',
  fogo: 'fire', forca: 'force', frio: 'cold', necrotico: 'necrotic', perfurante: 'piercing',
  psiquico: 'psychic', radiante: 'radiant', trovejante: 'thunder', veneno: 'poison',
}

const ATRIBUTOS_SAVE = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR']
const REGEX_DADOS = /^\d{1,2}d\d{1,3}([+-]\d{1,3})?$/

export const LIMITE_TEXTO_IMPORTACAO = 8_000

export interface MagiaImportada {
  name_pt: string
  name_en: string
  level: number
  school_pt: string
  school_en: string
  casting_time_pt: string
  range_pt: string
  components_pt: string
  duration_pt: string
  concentration: boolean
  ritual: boolean
  description_pt: string
  classes_pt: string
  damage_dice: string | null
  damage_type_pt: string | null
  damage_type_en: string | null
  heal_dice: string | null
  save_ability: string | null
}

export function normalizarNome(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function gerarSlugBase(nome: string): string {
  return normalizarNome(nome).replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' || t.length > max ? null : t
}

function dados(v: unknown): string | null {
  const t = typeof v === 'string' ? v.replace(/\s+/g, '').toLowerCase() : ''
  return REGEX_DADOS.test(t) ? t : null
}

// Devolve a magia limpa ou a lista de campos com problema (rótulos em PT).
export function validarMagiaImportada(bruto: unknown): { magia: MagiaImportada } | { erros: string[] } {
  if (!bruto || typeof bruto !== 'object') return { erros: ['dados da magia'] }
  const b = bruto as Record<string, unknown>
  const erros: string[] = []

  const name_pt = texto(b.name_pt, 120)
  if (!name_pt) erros.push('nome')

  const level = typeof b.level === 'number' && Number.isInteger(b.level) && b.level >= 0 && b.level <= 9 ? b.level : null
  if (level === null) erros.push('nível (0 a 9)')

  const escola = ESCOLAS_MAGIA.find(e => normalizarNome(e.pt) === normalizarNome(String(b.school_pt ?? '')))
  if (!escola) erros.push('escola')

  const description_pt = texto(b.description_pt, LIMITE_TEXTO_IMPORTACAO)
  if (!description_pt) erros.push('descrição')

  if (erros.length > 0 || !name_pt || level === null || !escola || !description_pt) return { erros }

  const danoId = normalizarNome(String(b.damage_type_pt ?? ''))
  const danoValido = TIPOS_DANO.some(t => t.id === danoId)
  const saveAbility = typeof b.save_ability === 'string' ? b.save_ability.trim().toUpperCase() : ''

  return {
    magia: {
      name_pt,
      name_en: texto(b.name_en, 120) ?? name_pt,
      level,
      school_pt: escola.pt,
      school_en: escola.en,
      casting_time_pt: texto(b.casting_time_pt, 120) ?? '1 ação',
      range_pt: texto(b.range_pt, 120) ?? '9 metros',
      components_pt: texto(b.components_pt, 300) ?? 'V, S',
      duration_pt: texto(b.duration_pt, 120) ?? 'Instantânea',
      concentration: b.concentration === true,
      ritual: b.ritual === true,
      description_pt,
      classes_pt: texto(b.classes_pt, 300) ?? '',
      damage_dice: dados(b.damage_dice),
      damage_type_pt: danoValido ? danoId : null,
      damage_type_en: danoValido ? DANO_EN[danoId] : null,
      heal_dice: dados(b.heal_dice),
      save_ability: ATRIBUTOS_SAVE.includes(saveAbility) ? saveAbility : null,
    },
  }
}
