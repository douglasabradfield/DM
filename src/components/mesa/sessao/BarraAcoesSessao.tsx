import { cn } from '@/lib/utils'

export function BarraAcoesSessao({
  podeAgir, onAbrirMagia, onAbrirItem, onAbrirOuro, onAbrirDescanso, onAbrirPreparar, botoesDM,
}: {
  podeAgir: boolean
  onAbrirMagia: () => void
  onAbrirItem: () => void
  onAbrirOuro: () => void
  onAbrirDescanso: () => void
  onAbrirPreparar: () => void
  botoesDM?: { label: string; onClick: () => void }[]
}) {
  const botoes = [
    { label: '✨ Magia', onClick: onAbrirMagia },
    { label: '📖 Preparar', onClick: onAbrirPreparar },
    { label: '🎒 Item', onClick: onAbrirItem },
    { label: '💰 Ouro', onClick: onAbrirOuro },
    { label: '🛏️ Descanso', onClick: onAbrirDescanso },
    ...(botoesDM ?? []),
  ]
  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-2 py-1.5">
      <div className={cn('grid gap-1.5', botoes.length > 4 ? 'grid-cols-3' : 'grid-cols-4')}>
        {botoes.map(b => (
          <button
            key={b.label}
            onClick={b.onClick}
            disabled={!podeAgir}
            className={cn(
              'flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[11px] min-h-[44px] transition-opacity',
              !podeAgir && 'opacity-40 cursor-not-allowed'
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}
