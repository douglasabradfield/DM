'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ArmaEmpunhada } from '@/types/batalha'
import type { AtaqueDisponivel } from '../tipos'

export function ModalEscolherArma({
  ataques, armaAtual, onEscolher, onLimpar, onFechar,
}: {
  ataques: AtaqueDisponivel[]
  armaAtual: ArmaEmpunhada | null | undefined
  onEscolher: (arma: ArmaEmpunhada) => void
  onLimpar: () => void
  onFechar: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">Empunhar arma</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {ataques.map((a, i) => (
            <button
              key={i}
              onClick={() => onEscolher(a)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
            >
              <span className="text-[var(--text)] text-sm font-crimson truncate">{a.nome}</span>
              <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">{a.bonus} · {a.dano}</span>
            </button>
          ))}
        </div>
        {armaAtual && (
          <button
            onClick={onLimpar}
            className="w-full mt-3 py-2.5 rounded-lg border border-[var(--red2)]/50 text-[var(--red2)] text-xs font-cinzel min-h-[44px]"
          >
            ✕ Desempunhar
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
