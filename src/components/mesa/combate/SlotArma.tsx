'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ArmaEmpunhada } from '@/types/batalha'
import type { AtaqueDisponivel } from '../tipos'
import { ModalEscolherArma } from './ModalEscolherArma'

// Slot de arma empunhada. Empunhar/trocar continua sendo a única escrita
// direta (preferência de UI, não ação de jogo — arma_esquerda/direita têm
// policy própria). Tocar um slot preenchido ataca com aquela arma, pulando
// direto para a seleção de alvo; só o ícone ⇄ abre o seletor de novo.
export function SlotArma({
  arma, ataquesDisponiveis, podeAgir, onEscolher, onLimpar, onAtacar,
}: {
  arma: ArmaEmpunhada | null | undefined
  ataquesDisponiveis: AtaqueDisponivel[]
  podeAgir: boolean
  onEscolher: (arma: ArmaEmpunhada) => void
  onLimpar: () => void
  onAtacar: (arma: ArmaEmpunhada) => void
}) {
  const [abrindoPicker, setAbrindoPicker] = useState(false)

  if (!arma && ataquesDisponiveis.length === 0) {
    return (
      <div className="flex-shrink-0 w-16 min-h-[56px] flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[var(--text3)] text-[9px] font-crimson text-center px-1 leading-tight">
        Sem ataques na ficha
      </div>
    )
  }

  if (!arma) {
    return (
      <>
        <button
          onClick={() => setAbrindoPicker(true)}
          className="flex-shrink-0 w-16 min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[var(--accent2)]/60 text-[var(--accent2)] text-[10px] font-cinzel"
        >
          <span className="text-base leading-none">+</span>
          Empunhar
        </button>
        {abrindoPicker && (
          <ModalEscolherArma
            ataques={ataquesDisponiveis}
            armaAtual={null}
            onEscolher={a => { onEscolher(a); setAbrindoPicker(false) }}
            onLimpar={() => setAbrindoPicker(false)}
            onFechar={() => setAbrindoPicker(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={podeAgir ? 0 : -1}
        onClick={() => podeAgir && onAtacar(arma)}
        onKeyDown={e => { if (podeAgir && e.key === 'Enter') onAtacar(arma) }}
        title={podeAgir ? `Atacar com ${arma.nome}` : 'Aguarde sua vez'}
        className={cn(
          'relative flex-shrink-0 w-16 min-h-[56px] rounded-lg border border-[var(--border)] bg-[var(--surface)]',
          'flex flex-col items-center justify-center px-1 text-center transition-opacity',
          podeAgir ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
        )}
      >
        <p className="text-[var(--text)] text-[11px] font-cinzel font-bold truncate w-full leading-tight">{arma.nome}</p>
        <p className="text-[var(--text3)] text-[10px] font-crimson leading-tight">{arma.dano}</p>
        <button
          onClick={e => { e.stopPropagation(); setAbrindoPicker(true) }}
          title="Trocar arma"
          aria-label="Trocar arma"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--bg3)] border border-[var(--border)] text-[var(--text3)] flex items-center justify-center text-[10px]"
        >
          ⇄
        </button>
      </div>
      {abrindoPicker && (
        <ModalEscolherArma
          ataques={ataquesDisponiveis}
          armaAtual={arma}
          onEscolher={a => { onEscolher(a); setAbrindoPicker(false) }}
          onLimpar={() => { onLimpar(); setAbrindoPicker(false) }}
          onFechar={() => setAbrindoPicker(false)}
        />
      )}
    </>
  )
}
