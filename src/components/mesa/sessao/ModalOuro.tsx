'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import type { Personagem } from '@/types/dnd'
import type { Destinatario } from '../tipos'
import { MOEDAS } from '../constantes'
import { totalEmPO } from '../helpers'
import { chamarAcaoInventario } from '../api'
import { Avatar } from '../ui/Avatar'

export function ModalOuro({
  personagem, sessaoId, destinatarios, onFechar,
}: {
  personagem: Personagem
  sessaoId: string
  destinatarios: Destinatario[]
  onFechar: () => void
}) {
  const [valores, setValores] = useState<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', string>>({ pl: '', po: '', pe: '', pp: '', pc: '' })
  const [vista, setVista] = useState<'principal' | 'dar'>('principal')
  const [enviando, setEnviando] = useState(false)

  const deltas = useMemo(() => {
    const d: Partial<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number>> = {}
    for (const m of MOEDAS) {
      const v = parseInt(valores[m.id]) || 0
      if (v !== 0) d[m.id] = v
    }
    return d
  }, [valores])
  const temValor = Object.keys(deltas).length > 0

  function limpar() { setValores({ pl: '', po: '', pe: '', pp: '', pc: '' }) }

  async function aplicar(sinal: 1 | -1) {
    if (!temValor || enviando) return
    setEnviando(true)
    const moedasEnvio = Object.fromEntries(Object.entries(deltas).map(([m, v]) => [m, v! * sinal]))
    const resultado = await chamarAcaoInventario({
      sessaoId, personagemId: personagem.id, tipo: 'ajuste_ouro', moedas: moedasEnvio,
    })
    setEnviando(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao ajustar moedas'); return }
    toast.success(resultado.descricao ?? 'Moedas ajustadas')
    limpar()
    onFechar()
  }

  async function darPara(destino: Destinatario) {
    if (!temValor || enviando) return
    setEnviando(true)
    const resultado = await chamarAcaoInventario({
      sessaoId, personagemId: personagem.id, tipo: 'transferir_moeda', moedas: deltas, paraPersonagemId: destino.id,
    })
    setEnviando(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao transferir moedas'); return }
    toast.success(resultado.descricao ?? 'Moedas transferidas')
    limpar()
    onFechar()
  }

  if (vista === 'dar') {
    return createPortal(
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
        <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setVista('principal')} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
            <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm flex-1">Dar moedas</h3>
          </div>
          {destinatarios.length === 0 ? (
            <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Ninguém mais para receber agora.</p>
          ) : (
            <>
              <p className="text-[var(--text3)] text-[11px] font-crimson mb-2">Toque em quem vai receber</p>
              <div className="grid grid-cols-4 gap-2">
                {destinatarios.map(d => (
                  <button
                    key={d.id}
                    disabled={enviando}
                    onClick={() => darPara(d)}
                    className="flex flex-col items-center gap-1 disabled:opacity-40"
                  >
                    <Avatar nome={d.nome} imagemUrl={d.imagemUrl} tamanho={44} />
                    <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{d.nome}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">💰 Ouro — {personagem.nome}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center py-2 mb-3 rounded-lg bg-[var(--bg2)] border border-[var(--border)]">
          <span className="font-cinzel font-bold text-2xl text-[var(--gold)]">{totalEmPO(personagem.moedas).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
          <span className="text-[var(--text3)] text-xs ml-1.5">PO (total convertido)</span>
        </div>

        <div className="grid grid-cols-5 gap-1 mb-3">
          {MOEDAS.map(m => (
            <div key={m.id}>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase block text-center">{m.id.toUpperCase()}</label>
              <p className="text-[var(--text2)] text-[10px] font-crimson text-center mb-0.5">{personagem.moedas?.[m.id] ?? 0}</p>
              <input
                type="number"
                inputMode="numeric"
                value={valores[m.id]}
                onChange={e => setValores(prev => ({ ...prev, [m.id]: e.target.value }))}
                placeholder="0"
                className="input-dd w-full text-center text-sm py-1.5"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-2">
          <button
            onClick={() => aplicar(-1)}
            disabled={!temValor || enviando}
            className="flex-1 py-2.5 rounded-lg border border-[var(--red2)]/50 text-[var(--red2)] font-cinzel text-sm min-h-[44px] disabled:opacity-40"
          >
            − Perder
          </button>
          <button
            onClick={() => aplicar(1)}
            disabled={!temValor || enviando}
            className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel font-bold text-sm min-h-[44px] disabled:opacity-40"
          >
            + Ganhar
          </button>
        </div>
        <button
          onClick={() => setVista('dar')}
          disabled={!temValor || enviando}
          className="w-full py-2.5 rounded-lg border border-[var(--accent2)]/50 text-[var(--accent2)] font-cinzel text-sm min-h-[44px] disabled:opacity-40"
        >
          Dar a outro jogador
        </button>
      </div>
    </div>,
    document.body
  )
}
