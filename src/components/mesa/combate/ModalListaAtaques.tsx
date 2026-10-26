'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { AtaqueDisponivel } from '../tipos'

// ⚔️ Ataque — lista completa (não só o que está empunhado): ataques da
// ficha + desarmado + improvisado, para o que não está nos slots.
export function ModalListaAtaques({
  ataques, onEscolher, onFechar,
}: {
  ataques: AtaqueDisponivel[]
  onEscolher: (a: AtaqueDisponivel) => void
  onFechar: () => void
}) {
  const opcoesExtra: AtaqueDisponivel[] = [
    { nome: 'Ataque desarmado', bonus: '', dano: '', tipo_dano: 'contundente' },
    { nome: 'Improvisado', bonus: '', dano: '', tipo_dano: undefined },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">⚔️ Escolher ataque</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {[...ataques, ...opcoesExtra].map((a, i) => (
            <button
              key={`${a.nome}-${i}`}
              onClick={() => onEscolher(a)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
            >
              <span className="text-[var(--text)] text-sm font-crimson truncate">{a.nome}</span>
              {(a.bonus || a.dano) && (
                <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">{[a.bonus, a.dano].filter(Boolean).join(' · ')}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
