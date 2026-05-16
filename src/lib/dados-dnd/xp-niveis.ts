export interface NivelInfo {
  nivel: number
  xpNecessario: number
  bonusProficiencia: number
}

export const TABELA_NIVEIS: NivelInfo[] = [
  { nivel: 1,  xpNecessario: 0,       bonusProficiencia: 2 },
  { nivel: 2,  xpNecessario: 300,     bonusProficiencia: 2 },
  { nivel: 3,  xpNecessario: 900,     bonusProficiencia: 2 },
  { nivel: 4,  xpNecessario: 2700,    bonusProficiencia: 2 },
  { nivel: 5,  xpNecessario: 6500,    bonusProficiencia: 3 },
  { nivel: 6,  xpNecessario: 14000,   bonusProficiencia: 3 },
  { nivel: 7,  xpNecessario: 23000,   bonusProficiencia: 3 },
  { nivel: 8,  xpNecessario: 34000,   bonusProficiencia: 3 },
  { nivel: 9,  xpNecessario: 48000,   bonusProficiencia: 4 },
  { nivel: 10, xpNecessario: 64000,   bonusProficiencia: 4 },
  { nivel: 11, xpNecessario: 85000,   bonusProficiencia: 4 },
  { nivel: 12, xpNecessario: 100000,  bonusProficiencia: 4 },
  { nivel: 13, xpNecessario: 120000,  bonusProficiencia: 5 },
  { nivel: 14, xpNecessario: 140000,  bonusProficiencia: 5 },
  { nivel: 15, xpNecessario: 165000,  bonusProficiencia: 5 },
  { nivel: 16, xpNecessario: 195000,  bonusProficiencia: 5 },
  { nivel: 17, xpNecessario: 225000,  bonusProficiencia: 6 },
  { nivel: 18, xpNecessario: 265000,  bonusProficiencia: 6 },
  { nivel: 19, xpNecessario: 305000,  bonusProficiencia: 6 },
  { nivel: 20, xpNecessario: 355000,  bonusProficiencia: 6 },
]

export function getNivelPorXP(xp: number): NivelInfo {
  for (let i = TABELA_NIVEIS.length - 1; i >= 0; i--) {
    if (xp >= TABELA_NIVEIS[i].xpNecessario) return TABELA_NIVEIS[i]
  }
  return TABELA_NIVEIS[0]
}

export function getProximoNivel(nivelAtual: number): NivelInfo | null {
  return TABELA_NIVEIS.find(n => n.nivel === nivelAtual + 1) ?? null
}

export function getProgressoXP(xp: number): {
  nivelAtual: NivelInfo
  proximoNivel: NivelInfo | null
  xpAtual: number
  xpNecessarioProximo: number
  percentual: number
} {
  const nivelAtual = getNivelPorXP(xp)
  const proximoNivel = getProximoNivel(nivelAtual.nivel)

  if (!proximoNivel) {
    return { nivelAtual, proximoNivel: null, xpAtual: xp, xpNecessarioProximo: 0, percentual: 100 }
  }

  const xpNoNivel = xp - nivelAtual.xpNecessario
  const xpParaProximo = proximoNivel.xpNecessario - nivelAtual.xpNecessario
  const percentual = Math.min(100, Math.round((xpNoNivel / xpParaProximo) * 100))

  return { nivelAtual, proximoNivel, xpAtual: xpNoNivel, xpNecessarioProximo: xpParaProximo, percentual }
}
