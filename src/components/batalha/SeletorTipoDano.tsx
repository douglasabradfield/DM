'use client'

import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import type { TipoDano } from '@/types/dnd'

interface SeletorTipoDanoProps {
  valor: TipoDano
  onChange: (tipo: TipoDano) => void
  compacto?: boolean
}

export function SeletorTipoDano({ valor, onChange, compacto = false }: SeletorTipoDanoProps) {
  const atual = TIPOS_DANO.find(t => t.id === valor)

  return (
    <select
      value={valor}
      onChange={e => onChange(e.target.value as TipoDano)}
      className="input-dd text-xs py-1 cursor-pointer"
      style={{ color: atual?.cor }}
      title="Tipo de dano"
    >
      {TIPOS_DANO.map(t => (
        <option key={t.id} value={t.id} style={{ color: t.cor }}>
          {compacto ? t.icone : `${t.icone} ${t.nome}`}
        </option>
      ))}
    </select>
  )
}
