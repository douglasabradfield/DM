'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Combatente } from '@/types/batalha'
import { calcularModificadorAtributo, formatarModificador } from '@/lib/utils'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import type { TipoDano } from '@/types/dnd'

interface Props {
  combatente: Combatente
  children: React.ReactNode
}

function TagDano({ label, cor, tipos }: { label: string; cor: string; tipos: TipoDano[] }) {
  if (tipos.length === 0) return null
  return (
    <div className="mt-1">
      <span className="text-[var(--text3)] text-[10px]">{label}: </span>
      {tipos.map(t => {
        const info = TIPOS_DANO.find(d => d.id === t)
        return (
          <span key={t} className="text-[10px] mr-1" style={{ color: info?.cor ?? cor }}>
            {info?.icone} {info?.nome}
          </span>
        )
      })}
    </div>
  )
}

const TOOLTIP_WIDTH = 320
const TOOLTIP_HEIGHT = 440
const OFFSET = 16

export function TooltipCombatente({ combatente: c, children }: Props) {
  const [visivel, setVisivel] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY })
  }, [])

  function handleMouseEnter(e: React.MouseEvent) {
    setPos({ x: e.clientX, y: e.clientY })
    document.addEventListener('mousemove', handleMouseMove)
    setVisivel(true)
  }

  function handleMouseLeave() {
    document.removeEventListener('mousemove', handleMouseMove)
    setVisivel(false)
  }

  useEffect(() => {
    return () => { document.removeEventListener('mousemove', handleMouseMove) }
  }, [handleMouseMove])

  // Posicionamento inteligente — evita sair da tela
  const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - pos.y : 9999
  const spaceRight = typeof window !== 'undefined' ? window.innerWidth - pos.x : 9999

  const rawTop = spaceBelow < TOOLTIP_HEIGHT + OFFSET
    ? pos.y - TOOLTIP_HEIGHT - OFFSET
    : pos.y + OFFSET

  const rawLeft = spaceRight < TOOLTIP_WIDTH + OFFSET
    ? pos.x - TOOLTIP_WIDTH - OFFSET
    : pos.x + OFFSET

  const top = typeof window !== 'undefined'
    ? Math.max(8, Math.min(rawTop, window.innerHeight - TOOLTIP_HEIGHT - 8))
    : rawTop
  const left = typeof window !== 'undefined'
    ? Math.max(8, Math.min(rawLeft, window.innerWidth - TOOLTIP_WIDTH - 8))
    : rawLeft

  const atrs = c.dados_monstro
    ? [c.dados_monstro.forca, c.dados_monstro.destreza, c.dados_monstro.constituicao,
       c.dados_monstro.inteligencia, c.dados_monstro.sabedoria, c.dados_monstro.carisma]
    : null

  const habilidades = c.dados_monstro?.habilidades
    ? c.dados_monstro.habilidades.slice(0, 300) + (c.dados_monstro.habilidades.length > 300 ? '…' : '')
    : null
  const acoes = c.dados_monstro?.acoes
    ? c.dados_monstro.acoes.slice(0, 300) + (c.dados_monstro.acoes.length > 300 ? '…' : '')
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ataques: Array<{ nome: string; bonus: string; dano: string }> = (c as any).dados_personagem?.ataques || []

  return (
    <>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </span>

      {visivel && createPortal(
        <div
          style={{
            position: 'fixed',
            top,
            left,
            zIndex: 9999,
            width: `${TOOLTIP_WIDTH}px`,
            pointerEvents: 'none',
          }}
          className="bg-[var(--bg3)]/95 border border-[var(--border2)] rounded-lg shadow-2xl backdrop-blur-sm"
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-cinzel text-[var(--gold)] font-bold text-sm">{c.nome}</span>
              <span className="text-[var(--text3)] text-xs capitalize px-1.5 py-0.5 bg-[var(--surface)] rounded">{c.tipo}</span>
            </div>

            {c.dados_monstro?.cr && (
              <p className="text-[var(--text3)] text-[10px] mb-2">
                CR <span className="text-[var(--gold)]">{c.dados_monstro.cr}</span>
                {c.dados_monstro.tipo && <> · <span className="text-[var(--text2)]">{c.dados_monstro.tipo}</span></>}
              </p>
            )}

            <div className="grid grid-cols-3 gap-1 text-center mb-2">
              <div className="bg-[var(--surface)] rounded p-1">
                <div className="text-[var(--text3)] text-[9px] uppercase font-cinzel">CA</div>
                <div className="text-[var(--text)] text-sm font-bold">{c.ca}</div>
              </div>
              <div className="bg-[var(--surface)] rounded p-1">
                <div className="text-[var(--text3)] text-[9px] uppercase font-cinzel">PV</div>
                <div className="text-[var(--text)] text-sm font-bold">{c.pv_atual}/{c.pv_maximo}</div>
              </div>
              <div className="bg-[var(--surface)] rounded p-1">
                <div className="text-[var(--text3)] text-[9px] uppercase font-cinzel">Init</div>
                <div className="text-[var(--text)] text-sm font-bold">{c.iniciativa}</div>
              </div>
            </div>

            {atrs && (
              <div className="grid grid-cols-6 gap-1 text-center mb-2">
                {(['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'] as const).map((nome, i) => {
                  const val = atrs[i]
                  const mod = calcularModificadorAtributo(val)
                  return (
                    <div key={nome} className="bg-[var(--surface)] rounded p-1">
                      <div className="text-[var(--text3)] text-[8px] font-cinzel">{nome}</div>
                      <div className="text-[var(--text)] text-[11px] font-bold">{val}</div>
                      <div className="text-[var(--text2)] text-[9px]">{formatarModificador(mod)}</div>
                    </div>
                  )
                })}
              </div>
            )}

            <TagDano label="Imune" cor="#27ae60" tipos={c.imunidades} />
            <TagDano label="Resistente" cor="#3498db" tipos={c.resistencias} />
            <TagDano label="Vulnerável" cor="#e74c3c" tipos={c.vulnerabilidades} />

            {/* Ataques — jogadores */}
            {c.tipo === 'jogador' && ataques.length > 0 && (
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase tracking-wider mb-1">Ataques</p>
                {ataques.map((ataque, i) => (
                  <div key={i} className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[var(--text2)]">{ataque.nome}</span>
                    <span className="text-[var(--gold)]">{ataque.bonus} | {ataque.dano}</span>
                  </div>
                ))}
              </div>
            )}

            {habilidades && (
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase tracking-wider mb-1">Habilidades</p>
                <p className="text-[var(--text2)] text-[10px] font-crimson leading-relaxed">{habilidades}</p>
              </div>
            )}

            {acoes && (
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase tracking-wider mb-1">Ações</p>
                <p className="text-[var(--text2)] text-[10px] font-crimson leading-relaxed">{acoes}</p>
              </div>
            )}

            {c.condicoes.length > 0 && (
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <span className="text-[var(--text3)] text-[9px] font-cinzel uppercase tracking-wider">Condições: </span>
                {c.condicoes.map(cond => (
                  <span key={cond} className="text-[10px] text-[var(--accent2)] mr-1">{cond}</span>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
