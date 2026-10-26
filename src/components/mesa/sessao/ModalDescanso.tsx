'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Personagem } from '@/types/dnd'

export function ModalDescanso({
  personagem, onLongo, onCurto, onFechar,
}: {
  personagem: Personagem
  onLongo: () => void
  onCurto: (dadosGastos: number, curaInformada: number) => void
  onFechar: () => void
}) {
  const [modo, setModo] = useState<'escolha' | 'curto'>('escolha')
  const total = personagem.dados_vida_total ?? personagem.nivel ?? 1
  const disponivel = Math.max(0, total - (personagem.dados_vida_usados ?? 0))
  // 0 dados é um descanso curto válido: recupera recursos de classe e Pacto
  // Arcano sem cura.
  const [dadosGastos, setDadosGastos] = useState(disponivel > 0 ? 1 : 0)
  const [curaTexto, setCuraTexto] = useState('')

  if (modo === 'curto') {
    return createPortal(
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
        <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setModo('escolha')} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
            <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm flex-1">🛏️ Descanso curto</h3>
            <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[var(--text3)] text-xs font-crimson mb-3">
            {disponivel} de {total} dado(s) de vida disponíveis. Role fisicamente e informe o total.
          </p>

          <label className="block mb-3">
            <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase block mb-1">Quantos dados gastar</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDadosGastos(d => Math.max(0, d - 1))}
                disabled={dadosGastos <= 0}
                className="w-9 h-9 rounded border border-[var(--border)] text-[var(--text2)] font-cinzel disabled:opacity-40"
              >
                −
              </button>
              <span className="flex-1 text-center font-cinzel text-lg text-[var(--text)]">{dadosGastos}</span>
              <button
                onClick={() => setDadosGastos(d => Math.min(disponivel, d + 1))}
                disabled={dadosGastos >= disponivel}
                className="w-9 h-9 rounded border border-[var(--border)] text-[var(--text2)] font-cinzel disabled:opacity-40"
              >
                +
              </button>
            </div>
          </label>

          {dadosGastos > 0 ? (
            <label className="block mb-3">
              <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase block mb-1">Total de cura rolado</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={curaTexto}
                onChange={e => setCuraTexto(e.target.value)}
                placeholder="0"
                className="input-dd w-full text-center text-lg py-2"
              />
            </label>
          ) : (
            <p className="text-[var(--text3)] text-xs font-crimson mb-3">
              Sem gastar dados de vida: não cura, mas recupera recursos de classe de descanso curto.
            </p>
          )}

          <button
            onClick={() => onCurto(dadosGastos, dadosGastos > 0 ? (parseInt(curaTexto) || 0) : 0)}
            disabled={dadosGastos < 0 || dadosGastos > disponivel}
            className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40"
          >
            Confirmar descanso curto
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
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">🛏️ Descanso — {personagem.nome}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          <button
            onClick={onLongo}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors"
          >
            🌙 Descanso longo — recupera todo PV, espaços de magia, recursos de classe e metade dos dados de vida
          </button>
          <button
            onClick={() => setModo('curto')}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors disabled:opacity-40"
          >
            ☕ Descanso curto — dados de vida opcionais ({disponivel} disponíveis)
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
