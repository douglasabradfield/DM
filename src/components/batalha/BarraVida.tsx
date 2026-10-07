'use client'

import { cn } from '@/lib/utils'

interface BarraVidaProps {
  atual: number
  maximo: number
  temporarios?: number
  className?: string
  // Versão fina para a linha da tabela; o cartão mobile usa a espessura padrão.
  fina?: boolean
}

export function BarraVida({ atual, maximo, temporarios = 0, className, fina = false }: BarraVidaProps) {
  const pct = maximo > 0 ? Math.min(100, (atual / maximo) * 100) : 0

  const corClasse =
    pct > 60 ? 'bg-[#27ae60]' :
    pct > 35 ? 'bg-[#f39c12]' :
    pct > 15 ? 'bg-[#e74c3c]' :
    'bg-[#c0392b] animate-pulse'

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(fina ? 'h-1' : 'h-2', 'bg-[#1e1525] rounded-full overflow-hidden')}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', corClasse)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {temporarios > 0 && (
        <div className={cn(fina ? 'h-0.5' : 'h-1', 'bg-[#3498db]/50 rounded-full mt-0.5')} style={{ width: `${Math.min(100, (temporarios / maximo) * 100)}%` }} />
      )}
    </div>
  )
}
