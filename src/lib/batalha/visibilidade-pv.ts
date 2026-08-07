export type ModoRevelacao = 'oculto' | 'vago' | 'exato'

export type EstadoVago = 'ileso' | 'ferido' | 'muito_ferido' | 'quase_morrendo' | 'morto'

interface CombatenteVisibilidade {
  tipo: string
  pv_atual: number
  pv_maximo: number
  pv_revelado: boolean
}

export function estadoVago(pvAtual: number, pvMaximo: number): EstadoVago {
  if (pvAtual <= 0) return 'morto'
  const pct = pvMaximo > 0 ? pvAtual / pvMaximo : 0
  if (pct > 0.90) return 'ileso'
  if (pct > 0.50) return 'ferido'
  if (pct > 0.25) return 'muito_ferido'
  return 'quase_morrendo'
}

export function pvVisivelParaJogador(
  combatente: CombatenteVisibilidade,
  modoGlobal: ModoRevelacao
): { modo: 'exato' | 'vago' | 'oculto'; estado?: EstadoVago } {
  // A mesa precisa saber quem curar — PJs sempre veem PV exato uns dos outros.
  if (combatente.tipo === 'jogador') {
    return { modo: 'exato' }
  }

  if (combatente.pv_revelado) {
    if (modoGlobal === 'exato') return { modo: 'exato' }
    return { modo: 'vago', estado: estadoVago(combatente.pv_atual, combatente.pv_maximo) }
  }

  if (modoGlobal === 'exato') return { modo: 'exato' }
  if (modoGlobal === 'vago') return { modo: 'vago', estado: estadoVago(combatente.pv_atual, combatente.pv_maximo) }
  return { modo: 'oculto' }
}

export const ESTADO_VAGO_INFO: Record<EstadoVago, { label: string; cor: string }> = {
  ileso: { label: 'Ileso', cor: 'var(--green2)' },
  ferido: { label: 'Ferido', cor: 'var(--gold)' },
  muito_ferido: { label: 'Muito ferido', cor: 'var(--gold2)' },
  quase_morrendo: { label: 'Quase morrendo', cor: 'var(--red2)' },
  morto: { label: 'Caído', cor: 'var(--text3)' },
}
