'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import type { TipoDano } from '@/types/dnd'
import { cn } from '@/lib/utils'

interface SeletorTipoDanoProps {
  valor: TipoDano | null
  onChange: (tipo: TipoDano | null) => void
  compacto?: boolean
}

// Começa sem tipo de propósito: dano sem tipo escolhido é recusado, em vez de
// virar cortante em silêncio.
export function SeletorTipoDano({ valor, onChange, compacto = false }: SeletorTipoDanoProps) {
  const atual = TIPOS_DANO.find(t => t.id === valor)

  return (
    <select
      value={valor ?? ''}
      onChange={e => onChange((e.target.value || null) as TipoDano | null)}
      className="input-dd text-xs py-1 cursor-pointer"
      style={{ color: atual?.cor }}
      title="Tipo de dano"
    >
      <option value="">{compacto ? '—' : '— tipo —'}</option>
      {TIPOS_DANO.map(t => (
        <option key={t.id} value={t.id} style={{ color: t.cor }}>
          {compacto ? t.icone : `${t.icone} ${t.nome}`}
        </option>
      ))}
    </select>
  )
}

// Versão em botão para a linha da tabela: só o ícone do tipo, e a lista abre
// num painel no mesmo padrão do botão de condições (portal + fundo que fecha).
export function BotaoTipoDano({ valor, onChange }: Pick<SeletorTipoDanoProps, 'valor' | 'onChange'>) {
  const atual = TIPOS_DANO.find(t => t.id === valor)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function escolher(tipo: TipoDano | null) {
    onChange(tipo)
    setAberto(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          const rect = btnRef.current?.getBoundingClientRect()
          if (rect) {
            const top = rect.bottom + 4
            const left = Math.min(rect.left, window.innerWidth - 168)
            setPos({ top, left })
          }
          setAberto(v => !v)
        }}
        title={atual ? `Tipo de dano: ${atual.nome}` : 'Escolha o tipo de dano'}
        className={cn(
          'w-5 h-5 shrink-0 rounded border flex items-center justify-center text-xs leading-none transition-colors',
          !atual && 'border-[var(--border)] text-[var(--text3)] hover:border-[var(--gold)] hover:text-[var(--gold)]'
        )}
        style={atual ? { borderColor: atual.cor, color: atual.cor } : undefined}
      >
        {atual ? atual.icone : '–'}
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9997]" onClick={() => setAberto(false)} />
          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9998 }}
            className="bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl w-40 max-h-64 overflow-y-auto"
          >
            <button
              onClick={() => escolher(null)}
              className="w-full text-left px-2 py-1 text-xs text-[var(--text3)] hover:bg-[var(--bg3)] hover:text-[var(--text)] transition-colors border-b border-[var(--border)]"
            >
              — sem tipo —
            </button>
            {TIPOS_DANO.map(t => (
              <button
                key={t.id}
                onClick={() => escolher(t.id)}
                className={cn(
                  'w-full text-left px-2 py-1 text-xs hover:bg-[var(--bg3)] transition-colors',
                  t.id === valor && 'bg-[var(--bg3)]'
                )}
                style={{ color: t.cor }}
              >
                {t.icone} {t.nome}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
