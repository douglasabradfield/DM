'use client'

import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import type { TipoDano } from '@/types/dnd'

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
