import { cn } from '@/lib/utils'

// Aba do celular a que cada botão pertence; abaixo de md só o grupo
// 'personagem' aparece aqui (os demais vivem no PainelAbasMesa).
export type GrupoAba = 'personagem' | 'magias' | 'mochila'

export function BarraAcoesSessao({
  podeAgir, onAbrirMagia, onAbrirItem, onAbrirOuro, onAbrirDescanso, onAbrirPreparar, botoesDM,
}: {
  podeAgir: boolean
  onAbrirMagia: () => void
  onAbrirItem: () => void
  onAbrirOuro: () => void
  onAbrirDescanso: () => void
  onAbrirPreparar: () => void
  botoesDM?: { label: string; onClick: () => void; grupo: GrupoAba }[]
}) {
  const botoes = [
    { label: '✨ Magia', onClick: onAbrirMagia, grupo: 'magias' as GrupoAba },
    { label: '📖 Preparar', onClick: onAbrirPreparar, grupo: 'magias' as GrupoAba },
    { label: '🎒 Item', onClick: onAbrirItem, grupo: 'mochila' as GrupoAba },
    { label: '💰 Ouro', onClick: onAbrirOuro, grupo: 'mochila' as GrupoAba },
    { label: '🛏️ Descanso', onClick: onAbrirDescanso, grupo: 'personagem' as GrupoAba },
    ...(botoesDM ?? []),
  ]
  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-2 py-1.5">
      <div className={cn('grid gap-1.5 grid-cols-2', botoes.length > 4 ? 'md:grid-cols-3' : 'md:grid-cols-4')}>
        {botoes.map(b => (
          <button
            key={b.label}
            onClick={b.onClick}
            disabled={!podeAgir}
            className={cn(
              'flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[11px] min-h-[44px] transition-opacity',
              b.grupo !== 'personagem' && 'max-md:hidden',
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
