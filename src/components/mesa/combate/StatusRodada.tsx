import type { Combatente } from '@/types/batalha'

export function StatusRodada({
  ativa, statusBatalha, rodadaAtual, combatenteDoTurno, ehMeuTurno, ehDM, dmControlandoId, combatenteOperado,
}: {
  ativa: boolean
  statusBatalha: string
  rodadaAtual: number
  combatenteDoTurno: Combatente | null
  ehMeuTurno: boolean
  ehDM: boolean
  dmControlandoId: string | null
  combatenteOperado: Combatente | null
}) {
  if (statusBatalha === 'pausada') {
    return (
      <div className="flex-shrink-0 py-1.5 text-center">
        <span className="text-[var(--gold)] text-xs font-cinzel animate-pulse">⏸ Pausada</span>
      </div>
    )
  }
  if (!ativa) {
    return (
      <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
        Rodada {rodadaAtual}
      </div>
    )
  }
  // Motivo do bloqueio sempre visível na tela, não só no tooltip dos
  // botões desabilitados — bloqueio silencioso vira "o app não funciona".
  if (!combatenteDoTurno) {
    return (
      <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
        ⏳ O mestre ainda não definiu de quem é a vez · Rodada {rodadaAtual}
      </div>
    )
  }
  if (ehDM) {
    const operado = combatenteOperado
    if (!operado || (operado.id === combatenteDoTurno.id && operado.id === dmControlandoId)) {
      return (
        <div className="flex-shrink-0 py-1.5 text-center text-[var(--gold)] text-xs font-cinzel">
          Vez de {combatenteDoTurno.nome} · Rodada {rodadaAtual}
        </div>
      )
    }
    return (
      <div className="flex-shrink-0 py-1.5 px-3 text-center text-[var(--text2)] bg-[var(--surface)] border-y border-[var(--border)] text-xs font-crimson">
        Você controla {operado.nome} (fora da vez) · Vez de {combatenteDoTurno.nome} · Rodada {rodadaAtual}
      </div>
    )
  }
  if (ehMeuTurno) {
    return (
      <div className="flex-shrink-0 py-1.5 bg-[var(--gold)] text-[var(--bg)] text-center font-cinzel font-bold text-xs">
        ⚔️ É a sua vez! · Rodada {rodadaAtual}
      </div>
    )
  }
  return (
    <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
      Aguarde sua vez, quem age agora é {combatenteDoTurno.nome} · Rodada {rodadaAtual}
    </div>
  )
}
