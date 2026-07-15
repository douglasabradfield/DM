import SPELL_SLOTS_DB from './spell_slots_db.json'

// Espaços de magia por nível de personagem (classes conjuradoras completas)
// [nível1, nível2, nível3, nível4, nível5, nível6, nível7, nível8, nível9]
export const ESPACOS_MAGIA: Record<number, number[]> = {
  1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
}

const CLASSE_CONJURADORA_MAP: Record<string, string> = {
  'bardo': 'Bard',
  'clérigo': 'Cleric',
  'clerigo': 'Cleric',
  'druida': 'Druid',
  'feiticeiro': 'Sorcerer',
  'mago': 'Wizard',
  'paladino': 'Paladin',
  'patrulheiro': 'Ranger',
  'bruxo': 'Warlock',
  'bard': 'Bard',
  'cleric': 'Cleric',
  'druid': 'Druid',
  'sorcerer': 'Sorcerer',
  'wizard': 'Wizard',
  'paladin': 'Paladin',
  'ranger': 'Ranger',
  'warlock': 'Warlock',
}

const NIVEL_CHAVES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'] as const

export function getEspacosMagia(nivel: number): number[] {
  return ESPACOS_MAGIA[Math.min(Math.max(nivel, 1), 20)] || ESPACOS_MAGIA[1]
}

export function getEspacosMagiaPorClasse(classe: string | null | undefined, nivel: number): number[] {
  const classeNormalizada = classe ? classe.trim().toLowerCase() : ''
  const classeKey = CLASSE_CONJURADORA_MAP[classeNormalizada]
  const classeDb = classeKey ? (SPELL_SLOTS_DB as Record<string, any>)[classeKey] : null
  const nivelStr = String(Math.min(Math.max(nivel, 1), 20))
  const nivelDados = classeDb?.levels?.[nivelStr]

  if (!nivelDados) {
    return getEspacosMagia(nivel)
  }

  return NIVEL_CHAVES.map(key => Number(nivelDados[key] ?? 0))
}

export function calcularModificador(valor: number): number {
  return Math.floor((valor - 10) / 2)
}

export function calcularBonusProficiencia(nivel: number): number {
  return Math.ceil(nivel / 4) + 1
}

export function formatarModificador(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}
