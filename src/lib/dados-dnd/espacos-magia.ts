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

export function getEspacosMagia(nivel: number): number[] {
  return ESPACOS_MAGIA[Math.min(Math.max(nivel, 1), 20)] || ESPACOS_MAGIA[1]
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
