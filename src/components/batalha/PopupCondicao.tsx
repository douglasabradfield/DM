'use client'

import { useState } from 'react'
import { getCondicao } from '@/lib/dados-dnd/condicoes'
import type { TipoCondicao } from '@/types/batalha'
import { cn } from '@/lib/utils'

interface PopupCondicaoProps {
  condicao: TipoCondicao
  onRemover?: () => void
  className?: string
}

export function PopupCondicao({ condicao, onRemover, className }: PopupCondicaoProps) {
  const [aberto, setAberto] = useState(false)
  const dados = getCondicao(condicao)

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onClick={onRemover}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[#261a2e] border border-[#4a3060] rounded text-[#b8a8cc] hover:border-[#e74c3c] hover:text-[#e74c3c] transition-colors cursor-pointer"
      >
        {dados?.icone} {condicao}
        {onRemover && <span className="text-[8px] opacity-60">✕</span>}
      </button>

      {aberto && dados && (
        <div className="absolute z-50 bottom-full left-0 mb-1 w-56 bg-[#261a2e] border border-[#6b4890] rounded shadow-xl animate-fadeIn">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{dados.icone}</span>
              <span className="font-cinzel text-[#d4a843] font-semibold text-xs">{dados.nome}</span>
            </div>
            <p className="text-[#b8a8cc] text-xs mb-2">{dados.descricao}</p>
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
                <p className="text-[#b8a8cc] text-[10px]">{dados.como_sair}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
