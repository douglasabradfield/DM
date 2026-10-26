'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { OPCOES_REACAO } from '../constantes'

// ⚡ Reação — sempre disponível (dentro ou fora do turno), uma por rodada.
// "Outra reação" tem texto livre e vai direto pro log, sem alvo/valor.
export function ModalReacao({
  onEscolher, onEnviarLivre, onFechar,
}: {
  onEscolher: (opt: typeof OPCOES_REACAO[number]) => void
  onEnviarLivre: (descricao: string) => void
  onFechar: () => void
}) {
  const [textoLivre, setTextoLivre] = useState<string | null>(null)
  const [texto, setTexto] = useState('')

  if (textoLivre !== null) {
    return createPortal(
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
        <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setTextoLivre(null)} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
            <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm flex-1">Outra reação</h3>
          </div>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={3}
            placeholder="Descreva a reação..."
            className="input-dd w-full text-sm mb-3 resize-none"
            autoFocus
          />
          <button
            onClick={() => onEnviarLivre(texto.trim())}
            disabled={!texto.trim()}
            className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Registrar reação
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">⚡ Reação</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {OPCOES_REACAO.map(opt => (
            <button
              key={opt.tipo}
              onClick={() => onEscolher(opt)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors"
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setTextoLivre('')}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors"
          >
            Outra reação
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
