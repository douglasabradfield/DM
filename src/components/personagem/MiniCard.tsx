import Link from 'next/link'
import type { Personagem } from '@/types/dnd'
import { calcularModificadorAtributo, formatarModificador } from '@/lib/utils'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'

interface MiniCardProps {
  personagem: Personagem
}

const TIPO_TAG: Record<string, { label: string; cor: string }> = {
  jogador: { label: 'Jogador', cor: 'var(--accent)' },
  npc: { label: 'NPC', cor: 'var(--gold)' },
  monstro: { label: 'Monstro', cor: 'var(--red2)' },
}

export function MiniCard({ personagem: p }: MiniCardProps) {
  const pct = p.pv_maximo > 0 ? (p.pv_atual / p.pv_maximo) * 100 : 0
  const corPV = pct > 60 ? 'var(--green2)' : pct > 30 ? '#f39c12' : 'var(--red2)'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tipo = (p as any).tipo_personagem ?? 'jogador'
  const tag = TIPO_TAG[tipo]

  return (
    <Link href={`/personagens/${p.id}`}>
      <PainelGrimorio compacto className="hover:border-[var(--gold)] transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="font-cinzel text-[var(--gold)] font-semibold text-sm">{p.nome}</h3>
              {tag && (
                <span className="px-1 py-0.5 rounded text-[8px] font-cinzel border" style={{ color: tag.cor, borderColor: tag.cor }}>
                  {tag.label}
                </span>
              )}
            </div>
            <p className="text-[var(--text3)] text-xs">{p.raca} · {p.classe} Nv{p.nivel}</p>
            <p className="text-[var(--border)] text-[10px]">{p.jogador_nome}</p>
          </div>
          <div className="text-right">
            <div className="text-[var(--text2)] text-xs">CA <span className="text-[var(--text)] font-bold">{p.ca}</span></div>
            <div className="text-xs" style={{ color: corPV }}>
              {p.pv_atual}/{p.pv_maximo} PV
            </div>
          </div>
        </div>

        <div className="w-full h-1.5 bg-[var(--bg3)] rounded-full overflow-hidden">
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
              <div className="text-[var(--text3)] text-[8px] font-cinzel">{label}</div>
              <div className="text-[var(--text)] text-xs font-bold">{val}</div>
              <div className="text-[var(--text2)] text-[9px]">{formatarModificador(calcularModificadorAtributo(val))}</div>
            </div>
          ))}
        </div>
      </PainelGrimorio>
    </Link>
  )
}
