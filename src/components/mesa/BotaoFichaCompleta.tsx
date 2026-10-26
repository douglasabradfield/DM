import Link from 'next/link'
import { cn } from '@/lib/utils'

// Atalho para a ficha completa (/personagens/[id]), onde a edição acontece.
export function BotaoFichaCompleta({ personagemId, rotulo = 'Ficha completa', className }: {
  personagemId: string
  rotulo?: string
  className?: string
}) {
  return (
    <Link
      href={`/personagens/${personagemId}`}
      className={cn(
        'flex items-center justify-center min-h-[44px] rounded-lg border border-[var(--border)]',
        'text-[var(--text2)] font-cinzel text-xs',
        className
      )}
    >
      📜 {rotulo}
    </Link>
  )
}
