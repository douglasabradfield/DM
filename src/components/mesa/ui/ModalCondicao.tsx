'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { getCondicao } from '@/lib/dados-dnd/condicoes'
import type { TipoCondicao } from '@/types/batalha'

export function ModalCondicao({ condicao, onFechar }: { condicao: TipoCondicao; onFechar: () => void }) {
  const info = getCondicao(condicao)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg shadow-2xl max-w-sm w-full p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-cinzel text-[var(--accent2)] font-bold text-base flex items-center gap-2">
            <span>{info?.icone}</span> {condicao}
          </h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        {info ? (
          <>
            <p className="text-[var(--text2)] text-sm font-crimson mb-3">{info.descricao}</p>
            {info.efeitos.length > 0 && (
              <ul className="list-disc list-inside space-y-1 mb-3">
                {info.efeitos.map((ef, i) => (
                  <li key={i} className="text-[var(--text3)] text-xs font-crimson">{ef}</li>
                ))}
              </ul>
            )}
            {info.como_sair && (
              <p className="text-[var(--text3)] text-xs font-crimson italic">Como sair: {info.como_sair}</p>
            )}
          </>
        ) : (
          <p className="text-[var(--text3)] text-sm font-crimson">Sem descrição disponível.</p>
        )}
      </div>
    </div>,
    document.body
  )
}
