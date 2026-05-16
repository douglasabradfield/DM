// D&D 5e XP thresholds per character level
const LIMIARES_XP: Record<number, { facil: number; medio: number; dificil: number; mortal: number }> = {
  1:  { facil: 25,   medio: 50,   dificil: 75,   mortal: 100 },
  2:  { facil: 50,   medio: 100,  dificil: 150,  mortal: 200 },
  3:  { facil: 75,   medio: 150,  dificil: 225,  mortal: 400 },
  4:  { facil: 125,  medio: 250,  dificil: 375,  mortal: 500 },
  5:  { facil: 250,  medio: 500,  dificil: 750,  mortal: 1100 },
  6:  { facil: 300,  medio: 600,  dificil: 900,  mortal: 1400 },
  7:  { facil: 350,  medio: 750,  dificil: 1100, mortal: 1700 },
  8:  { facil: 450,  medio: 900,  dificil: 1400, mortal: 2100 },
  9:  { facil: 550,  medio: 1100, dificil: 1600, mortal: 2400 },
  10: { facil: 600,  medio: 1200, dificil: 1900, mortal: 2800 },
  11: { facil: 800,  medio: 1600, dificil: 2400, mortal: 3600 },
  12: { facil: 1000, medio: 2000, dificil: 3000, mortal: 4500 },
  13: { facil: 1100, medio: 2200, dificil: 3400, mortal: 5100 },
  14: { facil: 1250, medio: 2500, dificil: 3800, mortal: 5700 },
  15: { facil: 1400, medio: 2800, dificil: 4300, mortal: 6400 },
  16: { facil: 1600, medio: 3200, dificil: 4800, mortal: 7200 },
  17: { facil: 2000, medio: 3900, dificil: 5900, mortal: 8800 },
  18: { facil: 2100, medio: 4200, dificil: 6300, mortal: 9500 },
  19: { facil: 2400, medio: 4900, dificil: 7300, mortal: 10900 },
  20: { facil: 2800, medio: 5700, dificil: 8500, mortal: 12700 },
}

// XP by Challenge Rating
const XP_POR_CR: Record<string, number> = {
  '0':   10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1':   200,
  '2':   450,
  '3':   700,
  '4':   1100,
  '5':   1800,
  '6':   2300,
  '7':   2900,
  '8':   3900,
  '9':   5000,
  '10':  5900,
  '11':  7200,
  '12':  8400,
  '13':  10000,
  '14':  11500,
  '15':  13000,
  '16':  15000,
  '17':  18000,
  '18':  20000,
  '19':  22000,
  '20':  25000,
  '21':  33000,
  '22':  41000,
  '23':  50000,
  '24':  62000,
  '30':  155000,
}

export function xpParaCR(cr: string): number {
  return XP_POR_CR[cr] ?? 0
}

export function getMultiplicador(quantidade: number): number {
  if (quantidade === 1) return 1
  if (quantidade === 2) return 1.5
  if (quantidade <= 6) return 2
  if (quantidade <= 10) return 2.5
  if (quantidade <= 14) return 3
  return 4
}

export type NivelDificuldade = 'trivial' | 'facil' | 'medio' | 'dificil' | 'mortal'

export interface ResultadoDificuldade {
  dificuldade: NivelDificuldade
  xpAjustado: number
  xpBruto: number
  multiplicador: number
  limiares: { facil: number; medio: number; dificil: number; mortal: number }
}

export function calcularDificuldade(
  niveis: number[],
  crs: string[],
): ResultadoDificuldade {
  const qtdJogadores = Math.max(1, niveis.length)

  // Sum thresholds for all players
  const limiares = { facil: 0, medio: 0, dificil: 0, mortal: 0 }
  for (const nivel of niveis) {
    const n = Math.max(1, Math.min(20, nivel))
    const t = LIMIARES_XP[n]
    limiares.facil   += t.facil
    limiares.medio   += t.medio
    limiares.dificil += t.dificil
    limiares.mortal  += t.mortal
  }

  // Sum XP for all monsters
  const xpBruto = crs.reduce((acc, cr) => acc + xpParaCR(cr), 0)

  // Apply multiplier (adjusted for party size)
  let mult = getMultiplicador(crs.length)
  if (qtdJogadores < 3) mult = Math.min(mult * 1.5, 4)
  else if (qtdJogadores > 5) mult = Math.max(mult * 0.5, 0.5)

  const xpAjustado = Math.round(xpBruto * mult)

  let dificuldade: NivelDificuldade = 'trivial'
  if (xpAjustado >= limiares.mortal)  dificuldade = 'mortal'
  else if (xpAjustado >= limiares.dificil) dificuldade = 'dificil'
  else if (xpAjustado >= limiares.medio)   dificuldade = 'medio'
  else if (xpAjustado >= limiares.facil)   dificuldade = 'facil'

  return { dificuldade, xpAjustado, xpBruto, multiplicador: mult, limiares }
}
