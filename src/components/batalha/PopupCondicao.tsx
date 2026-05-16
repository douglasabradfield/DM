'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getCondicao } from '@/lib/dados-dnd/condicoes'
import type { TipoCondicao } from '@/types/batalha'
import { cn } from '@/lib/utils'

interface PopupCondicaoProps {
  condicao: TipoCondicao
  onRemover?: () => void
  className?: string
}

export function PopupCondicao({ condicao, onRemover, className }: PopupCondicaoProps) {
  const [visivel, setVisivel] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLButtonElement>(null)
  const dados = getCondicao(condicao)

  function handleMouseEnter() {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 240),
    })
    setVisivel(true)
  }

  return (
    <>
      <button
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisivel(false)}
        onClick={onRemover}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[#261a2e] border border-[#4a3060] rounded text-[#b8a8cc] hover:border-[#e74c3c] hover:text-[#e74c3c] transition-colors cursor-pointer',
          className
        )}
      >
        {dados?.icone} {condicao}
        {onRemover && <span className="text-[8px] opacity-60">✕</span>}
      </button>

      {visivel && dados && createPortal(
        <div
          onMouseLeave={() => setVisivel(false)}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            width: '224px',
          }}
          className="bg-[#261a2e]/95 border border-[#6b4890] rounded-lg shadow-2xl backdrop-blur-sm"
        >
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{dados.icone}</span>
              <span className="font-cinzel text-[#d4a843] font-semibold text-xs">{dados.nome}</span>
            </div>
            <p className="text-[#b8a8cc] text-xs mb-2 font-crimson">{dados.descricao}</p>
            {dados.efeitos.length > 0 && (
              <div className="mb-2">
                <p className="text-[#8870a8] text-[10px] font-cinzel uppercase tracking-wider mb-1">Efeitos</p>
                <ul className="space-y-0.5">
                  {dados.efeitos.map((efeito, i) => (
                    <li key={i} className="text-[#b8a8cc] text-[10px] flex gap-1">
                      <span className="text-[#d4a843] flex-shrink-0">•</span>
                      {efeito}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dados.como_sair && (
              <div>
                <p className="text-[#8870a8] text-[10px] font-cinzel uppercase tracking-wider mb-1">Como Sair</p>
                <p className="text-[#b8a8cc] text-[10px] font-crimson">{dados.como_sair}</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
