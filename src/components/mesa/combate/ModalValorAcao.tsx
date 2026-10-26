'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { getTipoDano } from '@/lib/dados-dnd/tipos-dano'
import { cn } from '@/lib/utils'
import type { TipoDano } from '@/types/dnd'
import type { AcaoPendente } from '../tipos'
import { SeletorTipoDano } from '../ui/SeletorTipoDano'
import { TecladoNumerico } from '../ui/TecladoNumerico'

// Passo final de qualquer ação que precise de um número — dano ou cura já
// resolvidos. Tipo de dano só aparece quando a ação não já traz um fixo
// (arma/magia sem damage_type cadastrado).
export function ModalValorAcao({
  acao, alvosNomes, enviando, onConfirmar, onFechar,
}: {
  acao: AcaoPendente
  alvosNomes: string[]
  enviando: boolean
  onConfirmar: (valor: number, tipoDano: TipoDano | null) => void
  onFechar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [tipoDano, setTipoDano] = useState<TipoDano>(acao.tipoDanoPadrao ?? 'cortante')
  // Sem tipo predeterminado o jogador precisa escolher; com tipo, mostra o
  // chip fechado — mas ele pode abrir pra corrigir se a ficha estiver errada.
  const [editandoTipo, setEditandoTipo] = useState(!acao.tipoDanoPadrao)
  const mostrarTipoDano = acao.efeito === 'dano'
  const valorNumerico = parseInt(texto) || 0

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">{acao.nomeAcao}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {alvosNomes.length > 0 && (
          <p className="text-[var(--text3)] text-xs font-crimson mb-2 truncate">→ {alvosNomes.join(', ')}</p>
        )}

        <div className="text-center py-2 mb-2 rounded-lg bg-[var(--bg2)] border border-[var(--border)]">
          <span className="font-cinzel font-bold text-3xl text-[var(--text)]">{texto || '0'}</span>
          <span className="text-[var(--text3)] text-xs ml-1.5">{acao.efeito === 'cura' ? 'PV de cura' : 'de dano'}</span>
        </div>

        {mostrarTipoDano && (
          <div className="mb-2">
            {editandoTipo ? (
              <SeletorTipoDano valor={tipoDano} onChange={setTipoDano} />
            ) : (
              <button
                type="button"
                onClick={() => setEditandoTipo(true)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg2)] border border-[var(--border)] min-h-[40px]"
              >
                <span className="font-crimson text-sm text-[var(--text)] truncate">
                  {getTipoDano(tipoDano).icone} {getTipoDano(tipoDano).nome}
                </span>
                <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">trocar</span>
              </button>
            )}
          </div>
        )}

        <TecladoNumerico valor={texto} onChange={setTexto} />

        <button
          onClick={() => onConfirmar(valorNumerico, acao.efeito === 'dano' ? tipoDano : null)}
          disabled={valorNumerico <= 0 || enviando}
          className={cn(
            'w-full mt-3 py-3 rounded-lg font-cinzel text-sm font-bold min-h-[48px] flex items-center justify-center gap-2',
            'bg-[var(--gold)] text-[var(--bg)] disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirmar ${acao.efeito === 'cura' ? 'cura' : 'dano'}`}
        </button>
      </div>
    </div>,
    document.body
  )
}
