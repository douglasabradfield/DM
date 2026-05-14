'use client'

import { useState } from 'react'
import { useBatalha } from '@/store/batalha'
import type { Combatente, TipoCondicao } from '@/types/batalha'
import { BarraVida } from './BarraVida'
import { EspacosMagia } from './EspacosMagia'
import { PopupCondicao } from './PopupCondicao'
import { SeletorTipoDano } from './SeletorTipoDano'
import { TooltipCombatente } from './TooltipCombatente'
import { TODAS_CONDICOES } from '@/lib/dados-dnd/condicoes'
import { cn } from '@/lib/utils'
import { Trash2, HeartPulse, Zap, Plus } from 'lucide-react'
import type { TipoDano } from '@/types/dnd'

interface LinhaCombatenteProps {
  combatente: Combatente
  ativo: boolean
  indice: number
}

export function LinhaCombatente({ combatente: c, ativo, indice }: LinhaCombatenteProps) {
  const {
    toggleAusencia, toggleMorto, removerCombatente,
    aplicarDano, aplicarCura, atualizarCombatente,
    setarDanoInput, setarTipoDano,
    adicionarCondicao, removerCondicao,
    definirIniciativa,
  } = useBatalha()

  const [editandoCA, setEditandoCA] = useState(false)
  const [editandoPV, setEditandoPV] = useState(false)
  const [editandoPVMax, setEditandoPVMax] = useState(false)
  const [mostraCondicoes, setMostraCondicoes] = useState(false)
  const [curaInput, setCuraInput] = useState(0)

  const pct = c.pv_maximo > 0 ? (c.pv_atual / c.pv_maximo) * 100 : 0
  const status = c.morto ? '💀' : pct === 0 ? '🩸' : ativo ? '⚔️' : ''

  return (
    <tr
      className={cn(
        'border-b border-[#1e1525] transition-colors',
        ativo && 'bg-[#261a2e]',
        c.morto && 'opacity-40',
        c.ausente && 'opacity-60',
        c.flash === 'dano' && 'bg-[#c0392b]/20',
        c.flash === 'cura' && 'bg-[#27ae60]/20',
      )}
    >
      {/* Presença */}
      <td className="px-1 py-1 w-8 text-center">
        <input
          type="checkbox"
          checked={!c.ausente}
          onChange={() => toggleAusencia(c.id)}
          className="w-3 h-3 accent-[#9b59b6] cursor-pointer"
        />
      </td>

      {/* Status */}
      <td className="px-1 py-1 w-6 text-center text-base">{status}</td>

      {/* Nome */}
      <td className="px-2 py-1 min-w-32">
        <TooltipCombatente combatente={c}>
          <span className={cn(
            'font-crimson text-sm cursor-help',
            ativo ? 'text-[#f0c060] font-semibold' : 'text-[#e8dff0]',
            c.tipo === 'monstro' && 'text-[#e74c3c]',
            c.tipo === 'npc' && 'text-[#c39bd3]',
          )}>
            {c.nome}
          </span>
        </TooltipCombatente>
      </td>

      {/* Iniciativa */}
      <td className="px-1 py-1 w-14 text-center">
        <input
          type="number"
          value={c.iniciativa}
          onChange={e => definirIniciativa(c.id, parseInt(e.target.value) || 0)}
          className="w-12 input-dd text-center text-sm"
        />
      </td>

      {/* CA */}
      <td className="px-1 py-1 w-12 text-center">
        {editandoCA ? (
          <input
            type="number"
            defaultValue={c.ca}
            autoFocus
            onBlur={e => { atualizarCombatente(c.id, { ca: parseInt(e.target.value) || c.ca }); setEditandoCA(false) }}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-12 input-dd text-center text-sm"
          />
        ) : (
          <span
            onClick={() => setEditandoCA(true)}
            className="text-[#b8a8cc] text-sm cursor-pointer hover:text-[#d4a843]"
          >
            {c.ca}
          </span>
        )}
      </td>

      {/* PV */}
      <td className="px-2 py-1 min-w-28">
        <div className="flex items-center gap-1">
          {editandoPV ? (
            <input
              type="number"
              defaultValue={c.pv_atual}
              autoFocus
              onBlur={e => {
                atualizarCombatente(c.id, { pv_atual: Math.min(parseInt(e.target.value) || 0, c.pv_maximo) })
                setEditandoPV(false)
              }}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-12 input-dd text-center text-sm"
            />
          ) : (
            <span
              onClick={() => setEditandoPV(true)}
              className={cn('text-sm cursor-pointer font-semibold', pct > 50 ? 'text-[#27ae60]' : pct > 25 ? 'text-[#f39c12]' : 'text-[#e74c3c]')}
            >
              {c.pv_atual}
            </span>
          )}
          <span className="text-[#4a3060] text-xs">/</span>
          {editandoPVMax ? (
            <input
              type="number"
              defaultValue={c.pv_maximo}
              autoFocus
              onBlur={e => { atualizarCombatente(c.id, { pv_maximo: parseInt(e.target.value) || c.pv_maximo }); setEditandoPVMax(false) }}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-12 input-dd text-center text-sm"
            />
          ) : (
            <span onClick={() => setEditandoPVMax(true)} className="text-[#8870a8] text-xs cursor-pointer hover:text-[#b8a8cc]">
              {c.pv_maximo}
            </span>
          )}
        </div>
        <BarraVida atual={c.pv_atual} maximo={c.pv_maximo} temporarios={c.pv_temporarios} className="mt-0.5" />
      </td>

      {/* Tipo de Dano */}
      <td className="px-1 py-1 w-28">
        <SeletorTipoDano valor={c.dano_tipo} onChange={(t) => setarTipoDano(c.id, t)} />
      </td>

      {/* Dano */}
      <td className="px-1 py-1 w-28">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            value={c.dano_input || ''}
            onChange={e => setarDanoInput(c.id, parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-14 input-dd text-center text-sm"
          />
          <button
            onClick={() => { if (c.dano_input > 0) { aplicarDano(c.id, c.dano_input, c.dano_tipo); setarDanoInput(c.id, 0) } }}
            className="p-1 text-[#e74c3c] hover:text-[#c0392b] transition-colors"
            title="Aplicar dano"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>

      {/* Cura */}
      <td className="px-1 py-1 w-24">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            value={curaInput || ''}
            onChange={e => setCuraInput(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-14 input-dd text-center text-sm"
          />
          <button
            onClick={() => { if (curaInput > 0) { aplicarCura(c.id, curaInput); setCuraInput(0) } }}
            className="p-1 text-[#27ae60] hover:text-[#1a6b3a] transition-colors"
            title="Aplicar cura"
          >
            <HeartPulse className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>

      {/* Totais */}
      <td className="px-1 py-1 w-16 text-center">
        <span className="text-[#e74c3c] text-xs">{c.dano_total}</span>
      </td>
      <td className="px-1 py-1 w-16 text-center">
        <span className="text-[#27ae60] text-xs">{c.cura_total}</span>
      </td>

      {/* Condições */}
      <td className="px-1 py-1 min-w-24 max-w-40">
        <div className="flex flex-wrap gap-0.5 items-center">
          {c.condicoes.map(cond => (
            <PopupCondicao
              key={cond}
              condicao={cond}
              onRemover={() => removerCondicao(c.id, cond)}
            />
          ))}
          <div className="relative">
            <button
              onClick={() => setMostraCondicoes(!mostraCondicoes)}
              className="w-4 h-4 rounded border border-[#4a3060] text-[#8870a8] hover:border-[#d4a843] hover:text-[#d4a843] flex items-center justify-center text-xs transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            {mostraCondicoes && (
              <div className="absolute z-50 top-5 left-0 bg-[#261a2e] border border-[#4a3060] rounded shadow-xl w-40 max-h-48 overflow-y-auto">
                {TODAS_CONDICOES.filter(cond => !c.condicoes.includes(cond)).map(cond => (
                  <button
                    key={cond}
                    onClick={() => { adicionarCondicao(c.id, cond as TipoCondicao); setMostraCondicoes(false) }}
                    className="w-full text-left px-2 py-1 text-xs text-[#b8a8cc] hover:bg-[#1e1525] hover:text-[#e8dff0] transition-colors"
                  >
                    {cond}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Espaços de Magia */}
      <td className="px-1 py-1 min-w-20">
        {Object.keys(c.espacos_magia).length > 0 && (
          <EspacosMagia combatenteId={c.id} espacos={c.espacos_magia} />
        )}
      </td>

      {/* Notas */}
      <td className="px-1 py-1 min-w-24">
        <input
          type="text"
          value={c.notas}
          onChange={e => atualizarCombatente(c.id, { notas: e.target.value })}
          placeholder="Notas..."
          className="w-full input-dd text-xs"
        />
      </td>

      {/* Ações */}
      <td className="px-1 py-1 w-16">
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleMorto(c.id)}
            className={cn('text-xs p-1 rounded transition-colors', c.morto ? 'text-[#27ae60]' : 'text-[#8870a8] hover:text-[#e74c3c]')}
            title={c.morto ? 'Ressuscitar' : 'Matar'}
          >
            {c.morto ? '♻' : '💀'}
          </button>
          <button
            onClick={() => removerCombatente(c.id)}
            className="text-[#8870a8] hover:text-[#e74c3c] p-1 transition-colors"
            title="Remover"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  )
}
