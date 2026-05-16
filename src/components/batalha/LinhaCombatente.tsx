'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useBatalha } from '@/store/batalha'
import type { Combatente, TipoCondicao, DadosMonstroSimples } from '@/types/batalha'
import { BarraVida } from './BarraVida'
import { EspacosMagia } from './EspacosMagia'
import { PopupCondicao } from './PopupCondicao'
import { SeletorTipoDano } from './SeletorTipoDano'
import { TooltipCombatente } from './TooltipCombatente'
import { TODAS_CONDICOES } from '@/lib/dados-dnd/condicoes'
import { cn } from '@/lib/utils'
import { Trash2, Plus, GripVertical, X } from 'lucide-react'
import type { TipoDano } from '@/types/dnd'

interface LinhaCombatenteProps {
  combatente: Combatente
  ativo: boolean
  indice: number
}

export function LinhaCombatente({ combatente: c, ativo, indice }: LinhaCombatenteProps) {
  const router = useRouter()
  const {
    toggleAusencia, toggleMorto, removerCombatente,
    aplicarDano, aplicarCura, atualizarCombatente,
    setarDanoInput, setarTipoDano,
    adicionarCondicao, removerCondicao,
    definirIniciativa, setVantagem, usarInspiracao,
  } = useBatalha()
  const pausada = useBatalha(s => s.statusBatalha === 'pausada')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })

  const [editandoCA, setEditandoCA] = useState(false)
  const [editandoPV, setEditandoPV] = useState(false)
  const [editandoPVMax, setEditandoPVMax] = useState(false)
  const [mostraCondicoes, setMostraCondicoes] = useState(false)
  const [valorAcao, setValorAcao] = useState('')
  const [modalMonstroAberto, setModalMonstroAberto] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const pct = c.pv_maximo > 0 ? (c.pv_atual / c.pv_maximo) * 100 : 0
  const estaMorto = c.morto || c.pv_atual <= 0
  const status = estaMorto ? '💀' : ativo ? '⚔️' : ''
  const corBordaTipo = c.tipo === 'jogador' ? 'var(--gold)' : c.tipo === 'npc' ? 'var(--green2)' : 'var(--red2)'

  function handleNomeClick() {
    if (c.tipo === 'jogador' && c.personagem_id) {
      router.push(`/personagens/${c.personagem_id}`)
    } else if (c.tipo === 'monstro' && c.dados_monstro) {
      setModalMonstroAberto(true)
    }
  }

  function reviverCombatente() {
    atualizarCombatente(c.id, { pv_atual: 1, morto: false })
  }

  return (
    <tr
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: corBordaTipo }}
      className={cn(
        'border-b border-[var(--bg3)] border-l-2 transition-colors',
        ativo && 'bg-[var(--surface)]',
        estaMorto && 'opacity-40',
        c.ausente && 'opacity-60',
        c.flash === 'dano' && 'bg-[#c0392b]/20',
        c.flash === 'cura' && 'bg-[#27ae60]/20',
      )}
    >
      {/* Handle de drag */}
      <td className="px-1 py-1 w-6">
        <button
          {...attributes}
          {...listeners}
          className="text-[var(--border)] hover:text-[var(--text3)] cursor-grab active:cursor-grabbing touch-none"
          title="Arrastar para reordenar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </td>

      {/* Presença */}
      <td className="px-1 py-1 w-8 text-center">
        <input
          type="checkbox"
          checked={!c.ausente}
          onChange={() => toggleAusencia(c.id)}
          className="w-3 h-3 accent-[var(--accent)] cursor-pointer"
        />
      </td>

      {/* Status */}
      <td className="px-1 py-1 w-6 text-center text-base">{status}</td>

      {/* Nome */}
      <td className="px-2 py-1 min-w-32">
        <TooltipCombatente combatente={c}>
          <span
            onClick={handleNomeClick}
            className={cn(
              'font-crimson text-base',
              c.tipo === 'jogador' && 'cursor-pointer hover:underline',
              c.tipo === 'monstro' && c.dados_monstro && 'cursor-pointer hover:underline',
              c.tipo === 'monstro' && !c.dados_monstro && 'cursor-default',
              c.tipo === 'npc' && 'cursor-default',
              ativo ? 'text-[var(--gold2)] font-semibold' : 'text-[var(--text)]',
              c.tipo === 'monstro' && 'text-[var(--red2)]',
              c.tipo === 'npc' && 'text-[var(--accent2)]',
            )}
          >
            {c.nome}
          </span>
        </TooltipCombatente>
        {c.tipo === 'jogador' && (
          <div className="flex items-center gap-0.5 ml-1">
            {[1, 2, 3, 4, 5].map(i => {
              const temInspiracao = (c.inspiracao ?? 0) >= i
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (temInspiracao && confirm(`Usar 1 inspiração de ${c.nome}? (${c.inspiracao} → ${(c.inspiracao ?? 1) - 1})`)) {
                      usarInspiracao(c.id)
                    }
                  }}
                  disabled={!temInspiracao}
                  title={temInspiracao ? `Clique para usar 1 inspiração (${c.inspiracao} disponível)` : 'Sem inspiração'}
                  className={`text-sm leading-none transition-all ${
                    temInspiracao
                      ? 'cursor-pointer hover:scale-125 active:scale-95'
                      : 'opacity-20 cursor-default'
                  }`}
                >
                  {temInspiracao ? '⭐' : '☆'}
                </button>
              )
            })}
          </div>
        )}
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

      {/* Vantagem / Desvantagem */}
      <td className="px-1 py-1 w-16 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <button
            onClick={() => setVantagem(c.id, c.vantagem === 'vantagem' ? null : 'vantagem')}
            title="Vantagem — rola 2d20 e usa o maior"
            className={`w-6 h-6 rounded text-xs font-bold transition-all ${
              c.vantagem === 'vantagem'
                ? 'bg-[#27ae60] text-white border border-[#2ecc71]'
                : 'bg-[var(--surface)] text-[var(--text3)] border border-[var(--border)] hover:border-[#27ae60] hover:text-[#27ae60]'
            }`}
          >▲</button>
          <button
            onClick={() => setVantagem(c.id, c.vantagem === 'desvantagem' ? null : 'desvantagem')}
            title="Desvantagem — rola 2d20 e usa o menor"
            className={`w-6 h-6 rounded text-xs font-bold transition-all ${
              c.vantagem === 'desvantagem'
                ? 'bg-[#e74c3c] text-white border border-[#c0392b]'
                : 'bg-[var(--surface)] text-[var(--text3)] border border-[var(--border)] hover:border-[#e74c3c] hover:text-[#e74c3c]'
            }`}
          >▼</button>
        </div>
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
            className="text-[var(--text2)] text-base cursor-pointer hover:text-[var(--gold)]"
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
              className={cn('text-base cursor-pointer font-semibold', pct > 50 ? 'text-[#27ae60]' : pct > 25 ? 'text-[#f39c12]' : 'text-[var(--red2)]')}
            >
              {c.pv_atual}
            </span>
          )}
          <span className="text-[var(--border)] text-sm">/</span>
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
            <span onClick={() => setEditandoPVMax(true)} className="text-[var(--text3)] text-xs cursor-pointer hover:text-[var(--text2)]">
              {c.pv_maximo}
            </span>
          )}
        </div>
        <BarraVida atual={c.pv_atual} maximo={c.pv_maximo} temporarios={c.pv_temporarios} className="mt-0.5" />
      </td>

      {/* Tipo de Dano */}
      <td className="px-1 py-1 w-24">
        <SeletorTipoDano valor={c.dano_tipo} onChange={(t) => setarTipoDano(c.id, t)} />
      </td>

      {/* Dano / Cura unificado */}
      <td className="px-1 py-1 w-28">
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            value={valorAcao}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setValorAcao(v)
              setarDanoInput(c.id, parseInt(v) || 0)
            }}
            onFocus={e => e.target.select()}
            placeholder="0"
            className="w-12 input-dd text-center text-sm"
          />
          <button
            onClick={() => {
              const v = parseInt(valorAcao)
              if (!v || pausada) return
              aplicarDano(c.id, v, c.dano_tipo)
              setValorAcao('')
              setarDanoInput(c.id, 0)
            }}
            disabled={pausada}
            title="Aplicar dano"
            className="px-1.5 py-0.5 bg-[var(--red2)]/80 hover:bg-[var(--red2)] text-white rounded text-xs font-bold transition-colors disabled:opacity-30"
          >💥</button>
          <button
            onClick={() => {
              const v = parseInt(valorAcao)
              if (!v || pausada) return
              aplicarCura(c.id, v)
              setValorAcao('')
              setarDanoInput(c.id, 0)
            }}
            disabled={pausada}
            title="Aplicar cura"
            className="px-1.5 py-0.5 bg-[var(--green)]/80 hover:bg-[var(--green)] text-white rounded text-xs font-bold transition-colors disabled:opacity-30"
          >💚</button>
        </div>
      </td>

      {/* Totais */}
      <td className="px-1 py-1 w-16 text-center">
        <span className="text-[var(--red2)] text-xs">{c.dano_total}</span>
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
              className="w-4 h-4 rounded border border-[var(--border)] text-[var(--text3)] hover:border-[var(--gold)] hover:text-[var(--gold)] flex items-center justify-center text-xs transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            {mostraCondicoes && (
              <div className="fixed z-[9998] bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl w-40 max-h-48 overflow-y-auto">
                {TODAS_CONDICOES.filter(cond => !c.condicoes.includes(cond)).map(cond => (
                  <button
                    key={cond}
                    onClick={() => { adicionarCondicao(c.id, cond as TipoCondicao); setMostraCondicoes(false) }}
                    className="w-full text-left px-2 py-1 text-xs text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)] transition-colors"
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

      {/* Ações */}
      <td className="px-1 py-1 w-20">
        <div className="flex items-center gap-1">
          {estaMorto ? (
            <button
              onClick={reviverCombatente}
              className="text-xs px-1.5 py-0.5 rounded bg-[#1a6b3a]/30 border border-[#27ae60]/40 text-[#27ae60] hover:bg-[#27ae60]/20 transition-colors font-cinzel"
              title="Reviver com 1 PV"
            >
              💊
            </button>
          ) : (
            <button
              onClick={() => toggleMorto(c.id)}
              className="text-xs p-1 rounded text-[var(--text3)] hover:text-[var(--red2)] transition-colors"
              title="Matar"
            >
              💀
            </button>
          )}
          <button
            onClick={() => removerCombatente(c.id)}
            disabled={pausada}
            className="text-[var(--text3)] hover:text-[var(--red2)] p-1 transition-colors disabled:opacity-30"
            title="Remover"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>

      {/* Modal stats monstro */}
      {modalMonstroAberto && c.dados_monstro && typeof document !== 'undefined' && createPortal(
        <ModalMonstro
          nome={c.nome}
          ca={c.ca}
          pvMaximo={c.pv_maximo}
          dados={c.dados_monstro}
          onFechar={() => setModalMonstroAberto(false)}
        />,
        document.body
      )}
    </tr>
  )
}

function mod(valor: number): string {
  const m = Math.floor((valor - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function ModalMonstro({
  nome, ca, pvMaximo, dados, onFechar,
}: {
  nome: string
  ca: number
  pvMaximo: number
  dados: DadosMonstroSimples
  onFechar: () => void
}) {
  const atributos: Array<{ label: string; valor: number }> = [
    { label: 'FOR', valor: dados.forca },
    { label: 'DES', valor: dados.destreza },
    { label: 'CON', valor: dados.constituicao },
    { label: 'INT', valor: dados.inteligencia },
    { label: 'SAB', valor: dados.sabedoria },
    { label: 'CAR', valor: dados.carisma },
  ]

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg shadow-2xl w-96 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h2 className="font-cinzel text-[var(--red2)] font-bold text-lg leading-tight">{nome}</h2>
            <p className="text-[var(--text3)] text-xs font-crimson italic">{dados.tipo} · CR {dados.cr}</p>
          </div>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] transition-colors ml-2 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Stats principais */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded p-2 text-center">
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">CA</p>
              <p className="text-[var(--gold)] font-bold text-lg font-cinzel">{ca}</p>
            </div>
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded p-2 text-center">
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">PV</p>
              <p className="text-[var(--green)] font-bold text-lg font-cinzel">{pvMaximo}</p>
            </div>
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded p-2 text-center">
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">CR</p>
              <p className="text-[var(--accent2)] font-bold text-lg font-cinzel">{dados.cr}</p>
            </div>
          </div>

          {/* Atributos */}
          <div>
            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-1.5">Atributos</p>
            <div className="grid grid-cols-6 gap-1">
              {atributos.map(({ label, valor }) => (
                <div key={label} className="bg-[var(--bg2)] border border-[var(--border)] rounded p-1.5 text-center">
                  <p className="text-[var(--text3)] text-[9px] font-cinzel">{label}</p>
                  <p className="text-[var(--text)] text-xs font-bold">{valor}</p>
                  <p className="text-[var(--text3)] text-[9px]">{mod(valor)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Habilidades */}
          {dados.habilidades && (
            <div>
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-1">Habilidades</p>
              <p className="text-[var(--text2)] text-xs font-crimson leading-relaxed whitespace-pre-wrap">{dados.habilidades}</p>
            </div>
          )}

          {/* Ações */}
          {dados.acoes && (
            <div>
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-1">Ações</p>
              <p className="text-[var(--text2)] text-xs font-crimson leading-relaxed whitespace-pre-wrap">{dados.acoes}</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
          {dados.xp != null && (
            <span className="text-[var(--text3)] text-xs font-cinzel">{dados.xp.toLocaleString('pt-BR')} XP</span>
          )}
          <Link
            href={`/bestiario?q=${encodeURIComponent(dados.slug ?? nome)}`}
            onClick={onFechar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--accent2)] rounded text-xs font-cinzel hover:border-[var(--accent2)] hover:text-[var(--accent)] transition-colors ml-auto"
          >
            📖 Ver Ficha no Bestiário
          </Link>
        </div>
      </div>
    </div>
  )
}
