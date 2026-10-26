import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import type { TipoDano } from '@/types/dnd'

// Select compacto de tipo de dano — usado quando a ação não já traz um
// tipo predeterminado (arma/magia sem damage_type cadastrado).
export function SeletorTipoDano({ valor, onChange }: { valor: TipoDano; onChange: (t: TipoDano) => void }) {
  return (
    <select
      value={valor}
      onChange={e => onChange(e.target.value as TipoDano)}
      className="input-dd text-sm py-2"
    >
      {TIPOS_DANO.map(t => (
        <option key={t.id} value={t.id}>{t.icone} {t.nome}</option>
      ))}
    </select>
  )
}
