'use client'

import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import type { AcaoPendente, AlvoSelecionado } from '../tipos'

// Bandeja flutuante de seleção de alvo — fixed, fora do fluxo da tela
// principal (não pode empurrar layout / criar scroll vertical). Aparece
// enquanto há uma ação pendente que precisa de alvo.
export function BandejaAlvos({
  acao, alvos, enviando, onConfirmar, onCancelar,
}: {
  acao: AcaoPendente
  alvos: AlvoSelecionado[]
  enviando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return createPortal(
    <div className="fixed left-0 right-0 bottom-0 z-[9997] flex justify-center px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-[var(--bg3)] border border-[var(--gold)]/60 rounded-xl shadow-2xl p-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[var(--gold)] text-xs font-cinzel font-bold truncate">{acao.nomeAcao}</p>
          <p className="text-[var(--text3)] text-[11px] font-crimson truncate">
            {alvos.length === 0 ? 'Toque um alvo na barra acima' : alvos.map(a => a.nome).join(', ')}
          </p>
        </div>
        <button
          onClick={onCancelar}
          className="flex-shrink-0 px-2.5 py-2 rounded-lg border border-[var(--border)] text-[var(--text3)] text-xs font-cinzel min-h-[40px]"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={alvos.length === 0 || enviando}
          className="flex-shrink-0 px-3 py-2 rounded-lg bg-[var(--gold)] text-[var(--bg)] text-xs font-cinzel font-bold min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Confirmar ({alvos.length})
        </button>
      </div>
    </div>,
    document.body
  )
}
