'use client'

import { useState } from 'react'
import type { Combatente } from '@/types/batalha'
import { calcularModificadorAtributo, formatarModificador } from '@/lib/utils'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import type { TipoDano } from '@/types/dnd'

interface TooltipCombatenteProps {
  combatente: Combatente
  children: React.ReactNode
}

function TagDano({ label, tipos }: { label: string; tipos: TipoDano[] }) {
  if (tipos.length === 0) return null
  return (
    <div className="mt-1">
      <span className="text-[#8870a8] text-[10px]">{label}: </span>
      {tipos.map(t => {
        const info = TIPOS_DANO.find(d => d.id === t)
        return (
          <span key={t} className="text-[10px] mr-1" style={{ color: info?.cor }}>
            {info?.icone} {info?.nome}
          </span>
        )
      })}
    </div>
  )
}

export function TooltipCombatente({ combatente: c, children }: TooltipCombatenteProps) {
  const [aberto, setAberto] = useState(false)

  const atrs = c.dados_monstro
    ? { for: c.dados_monstro.forca, des: c.dados_monstro.destreza, con: c.dados_monstro.constituicao, int: c.dados_monstro.inteligencia, sab: c.dados_monstro.sabedoria, car: c.dados_monstro.carisma }
    : null

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      {children}

      {aberto && (
        <div className="absolute z-50 left-0 top-full mt-1 w-60 bg-[#1e1525] border border-[#6b4890] rounded shadow-2xl animate-fadeIn">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-cinzel text-[#d4a843] font-semibold text-sm">{c.nome}</span>
              <span className="text-[#8870a8] text-xs capitalize">{c.tipo}</span>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center mb-2">
              <div className="bg-[#261a2e] rounded p-1">
                <div className="text-[#8870a8] text-[9px] uppercase">CA</div>
                <div className="text-[#e8dff0] text-sm font-bold">{c.ca}</div>
              </div>
              <div className="bg-[#261a2e] rounded p-1">
                <div className="text-[#8870a8] text-[9px] uppercase">PV</div>
                <div className="text-[#e8dff0] text-sm font-bold">{c.pv_atual}/{c.pv_maximo}</div>
              </div>
              <div className="bg-[#261a2e] rounded p-1">
                <div className="text-[#8870a8] text-[9px] uppercase">Init</div>
                <div className="text-[#e8dff0] text-sm font-bold">{c.iniciativa}</div>
              </div>
            </div>

            {atrs && (
              <div className="grid grid-cols-6 gap-1 text-center mb-2">
                {(['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'] as const).map((nome, i) => {
                  const vals = [atrs.for, atrs.des, atrs.con, atrs.int, atrs.sab, atrs.car]
                  const val = vals[i]
                  const mod = calcularModificadorAtributo(val)
                  return (
                    <div key={nome} className="bg-[#261a2e] rounded p-1">
                      <div className="text-[#8870a8] text-[8px]">{nome}</div>
                      <div className="text-[#e8dff0] text-[11px] font-bold">{val}</div>
                      <div className="text-[#b8a8cc] text-[9px]">{formatarModificador(mod)}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {c.dados_monstro?.cr && (
              <div className="text-[#8870a8] text-xs mb-1">
                CR: <span className="text-[#d4a843]">{c.dados_monstro.cr}</span>
              </div>
            )}

            <TagDano label="Imune" tipos={c.imunidades} />
            <TagDano label="Resistente" tipos={c.resistencias} />
            <TagDano label="Vulnerável" tipos={c.vulnerabilidades} />

            {c.condicoes.length > 0 && (
              <div className="mt-1">
                <span className="text-[#8870a8] text-[10px]">Condições: </span>
                {c.condicoes.map(cond => (
                  <span key={cond} className="text-[10px] text-[#c39bd3] mr-1">{cond}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
