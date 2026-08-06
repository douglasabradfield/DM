import { MODO_MESA_LIVRE } from '@/lib/planos'

export const LIMITES_IA: Record<string, number> = {
  free: 0,
  heroi: 0,
  solo: 30,
  mesa_pro: 100,
  guild_master: Infinity,
  dm_supremo: Infinity,
}

export function getLimiteIA(plano: string): number {
  if (MODO_MESA_LIVRE) return Infinity
  return LIMITES_IA[plano] ?? 0
}
