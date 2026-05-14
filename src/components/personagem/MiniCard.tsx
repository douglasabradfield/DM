import Link from 'next/link'
import type { Personagem } from '@/types/dnd'
import { calcularModificadorAtributo, formatarModificador } from '@/lib/utils'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'

interface MiniCardProps {
  personagem: Personagem
}

export function MiniCard({ personagem: p }: MiniCardProps) {
  const pct = p.pv_maximo > 0 ? (p.pv_atual / p.pv_maximo) * 100 : 0
  const corPV = pct > 60 ? '#27ae60' : pct > 30 ? '#f39c12' : '#e74c3c'

  return (
    <Link href={`/personagens/${p.id}`}>
      <PainelGrimorio compacto className="hover:border-[#d4a843] transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-cinzel text-[#d4a843] font-semibold text-sm">{p.nome}</h3>
            <p className="text-[#8870a8] text-xs">{p.raca} · {p.classe} Nv{p.nivel}</p>
            <p className="text-[#4a3060] text-[10px]">{p.jogador_nome}</p>
          </div>
          <div className="text-right">
            <div className="text-[#b8a8cc] text-xs">CA <span className="text-[#e8dff0] font-bold">{p.ca}</span></div>
            <div className="text-xs" style={{ color: corPV }}>
              {p.pv_atual}/{p.pv_maximo} PV
            </div>
          </div>
        </div>

        <div className="w-full h-1.5 bg-[#1e1525] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: corPV }} />
        </div>

        <div className="grid grid-cols-6 gap-1 mt-2 text-center">
          {[
            { label: 'FOR', val: p.forca },
            { label: 'DES', val: p.destreza },
            { label: 'CON', val: p.constituicao },
            { label: 'INT', val: p.inteligencia },
            { label: 'SAB', val: p.sabedoria },
            { label: 'CAR', val: p.carisma },
          ].map(({ label, val }) => (
            <div key={label}>
              <div className="text-[#8870a8] text-[8px] font-cinzel">{label}</div>
              <div className="text-[#e8dff0] text-xs font-bold">{val}</div>
              <div className="text-[#b8a8cc] text-[9px]">{formatarModificador(calcularModificadorAtributo(val))}</div>
            </div>
          ))}
        </div>
      </PainelGrimorio>
    </Link>
  )
}
