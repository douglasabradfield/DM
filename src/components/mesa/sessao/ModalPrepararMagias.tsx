'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useMagiasPersonagem } from '../magias/useMagiasPersonagem'

// 📖 Preparar magias — fora de combate, antes da sessão. Leitura e gravação
// no hook compartilhado com a aba Magias do celular. Truques (nível 0) não
// têm preparação em D&D 5e — não entram na lista.
export function ModalPrepararMagias({
  personagemId, personagemNome, onFechar,
}: {
  personagemId: string
  personagemNome: string
  onFechar: () => void
}) {
  const { carregando, magias: todas, alternarPreparada } = useMagiasPersonagem(personagemId)
  const magias = todas.filter(m => m.nivel > 0)
  const totalPreparadas = magias.filter(m => m.preparada).length

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">📖 Preparar — {personagemNome}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!carregando && magias.length > 0 && (
          <p className="text-[var(--text3)] text-[11px] font-crimson mb-2">{totalPreparadas} preparada(s)</p>
        )}

        {carregando ? (
          <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Carregando...</p>
        ) : magias.length === 0 ? (
          <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Nenhuma magia de nível 1+ na ficha</p>
        ) : (
          <div className="space-y-1">
            {magias.map(m => (
              <label
                key={m.id}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]"
              >
                <input
                  type="checkbox"
                  checked={m.preparada}
                  onChange={() => alternarPreparada(m)}
                  className="w-4 h-4 accent-[var(--gold)] flex-shrink-0"
                />
                <span className="text-[var(--text)] text-sm font-crimson truncate flex-1">{m.nome}</span>
                <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">N{m.nivel}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
