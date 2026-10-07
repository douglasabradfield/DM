'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Wand2 } from 'lucide-react'
import { useBatalha } from '@/store/batalha'
import type { Combatente, EspacosMagiaBatalha } from '@/types/batalha'
import { cn } from '@/lib/utils'

interface EspacosMagiaProps {
  combatenteId: string
  espacos: EspacosMagiaBatalha
  somenteLeitura?: boolean
}

export function EspacosMagia({ combatenteId, espacos, somenteLeitura }: EspacosMagiaProps) {
  const editarEstado = useBatalha(s => s.editarEstado)
  const marcar = (nivel: number, usar: boolean) =>
    editarEstado({ tipo: 'definir_espacos', alvos: [{ combatenteId, nivelMagia: nivel, usar }] })

  const niveisComEspacos = Object.entries(espacos)
    .filter(([, e]) => e.total > 0)
    .map(([nivel, e]) => ({ nivel: parseInt(nivel), ...e }))
    .sort((a, b) => a.nivel - b.nivel)

  if (niveisComEspacos.length === 0) return null

  return (
    <div className="space-y-1.5">
      {niveisComEspacos.map(({ nivel, total, usados }) => (
        <div key={nivel} className="flex items-center gap-1.5">
          <span className="text-[#8870a8] text-[10px] w-10 font-cinzel flex-shrink-0">Nível {nivel}</span>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: total }).map((_, i) => {
              const usado = i < usados
              return (
                <button
                  key={i}
                  onClick={() => marcar(nivel, !usado)}
                  disabled={somenteLeitura}
                  className={cn(
                    'w-4 h-4 rounded-full border transition-all',
                    usado ? 'bg-transparent border-[#4a3060]' : 'bg-[#9b59b6] border-[#c39bd3]',
                    !somenteLeitura && 'hover:scale-125',
                    somenteLeitura && 'cursor-default',
                  )}
                  title={`Nível ${nivel}: ${total - usados}/${total} disponíveis`}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Disponíveis sobre o total, somando todos os níveis. null = sem espaço nenhum.
export function resumoEspacos(espacos: EspacosMagiaBatalha): { disponiveis: number; total: number } | null {
  let disponiveis = 0
  let total = 0
  Object.values(espacos).forEach(e => {
    if (e.total > 0) {
      total += e.total
      disponiveis += Math.max(0, e.total - e.usados)
    }
  })
  return total > 0 ? { disponiveis, total } : null
}

// Resumo de uma linha ("4/17 espaços") que abre os círculos num painel via
// createPortal — o mesmo painel de conjuração que os monstros já tinham
// (slots_monstro), agora servindo os dois. Sem espaço nenhum: o jogador não
// mostra nada; monstro/NPC mostra só a varinha, para o DM editar os slots.
export function BotaoEspacosMagia({ combatente: c, somenteLeitura, grande }: {
  combatente: Combatente
  somenteLeitura?: boolean
  grande?: boolean
}) {
  const atualizarCombatente = useBatalha(s => s.atualizarCombatente)
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const resumo = resumoEspacos(c.espacos_magia)
  const slotsMonstroEditaveis = !c.personagem_id && !somenteLeitura
  if (!resumo && !slotsMonstroEditaveis) return null

  function alternar() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 264))
      // Perto do rodapé abre para cima, para não sair da tela no celular.
      setPos(rect.bottom + 320 > window.innerHeight && rect.top > 320
        ? { bottom: window.innerHeight - rect.top + 4, left }
        : { top: rect.bottom + 4, left })
    }
    setAberto(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={alternar}
        title={resumo ? 'Espaços de magia — clique para ver' : 'Slots de conjuração'}
        className={cn(
          'inline-flex items-center gap-1 rounded transition-colors whitespace-nowrap',
          grande ? 'px-2 py-1.5 text-xs border border-[var(--border)] bg-[var(--bg3)]' : 'px-0.5 py-0.5 text-[11px]',
          aberto ? 'text-[var(--accent2)]' : resumo ? 'text-[#b48fd0] hover:text-[var(--accent2)]' : 'text-[var(--border)] hover:text-[var(--accent2)]',
        )}
      >
        <Wand2 className="w-3 h-3 flex-shrink-0" />
        {resumo && (
          <span className="font-cinzel">
            {resumo.disponiveis}/{resumo.total} <span className="opacity-70">espaços</span>
          </span>
        )}
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9995]" onClick={() => setAberto(false)} />
          <div
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, zIndex: 9996 }}
            className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg shadow-xl p-2.5 w-64 max-h-[70vh] overflow-y-auto"
          >
            {resumo && (
              <>
                <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-2">
                  Espaços de magia — {c.nome}
                </p>
                <EspacosMagia combatenteId={c.id} espacos={c.espacos_magia} somenteLeitura={somenteLeitura} />
              </>
            )}
            {slotsMonstroEditaveis && (
              <>
                <p className={cn('text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-2', resumo && 'mt-3')}>
                  Slots restantes — {c.nome}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
                    const nStr = String(n)
                    const val = (c.slots_monstro ?? {})[nStr] ?? 0
                    return (
                      <div key={n} className="text-center">
                        <p className="text-[var(--text3)] text-[9px] font-cinzel mb-0.5">Nível {n}</p>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={val}
                          onChange={e => {
                            atualizarCombatente(c.id, {
                              slots_monstro: {
                                ...(c.slots_monstro ?? {}),
                                [nStr]: parseInt(e.target.value) || 0,
                              },
                            })
                          }}
                          className="w-full input-dd text-center text-xs py-0.5 px-1"
                        />
                      </div>
                    )
                  })}
                </div>
                <p className="text-[var(--text3)] text-[9px] font-crimson mt-2 italic">
                  Edite os slots restantes disponíveis para este conjurador
                </p>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
