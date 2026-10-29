import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Combatente, EntradaLog } from '@/types/batalha'
import { fraseUltimoEvento } from '../helpers'

// Fora da vez, o jogador vê só o que acabou de acontecer — nunca a ordem de
// iniciativa, quem age em seguida nem o estado de saúde de inimigos.
// `lateral`: instância da coluna lateral (lg+). A de dentro do cartão some em lg+ (lg:hidden),
// então nunca há duas visíveis ao mesmo tempo.
export function CartaoUltimoEvento({ log, combatentes, lateral = false }: { log: EntradaLog[]; combatentes: Combatente[]; lateral?: boolean }) {
  const frase = useMemo(() => {
    const ordenado = [...log].sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    for (let i = ordenado.length - 1; i >= 0; i--) {
      const entrada = ordenado[i]
      // Alvo não encontrado é tratado como inimigo (lado seguro).
      const alvo = combatentes.find(c => c.nome === entrada.alvo)
      const f = fraseUltimoEvento(entrada, !alvo || alvo.tipo === 'monstro')
      if (f) return f
    }
    return null
  }, [log, combatentes])

  return (
    <div className={cn('rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2', !lateral && 'lg:hidden mt-2')}>
      <p className="font-cinzel text-[10px] uppercase tracking-wide text-[var(--text3)]">Último evento</p>
      <p className="font-crimson text-sm text-[var(--text2)]">{frase ?? 'Nenhuma ação ainda nesta rodada'}</p>
    </div>
  )
}
