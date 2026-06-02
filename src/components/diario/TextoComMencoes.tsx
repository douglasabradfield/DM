'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'

interface TextoComMencoesProps {
  texto: string
  className?: string
}

interface PersonagemDetalhes {
  id: string
  nome: string
  tipo_personagem: string | null
  raca: string | null
  classe: string | null
  nivel: number | null
  ca: number | null
  pv_atual: number | null
  pv_maximo: number | null
}

type Parte =
  | { tipo: 'texto'; conteudo: string }
  | { tipo: 'mencao'; nome: string; id: string }
  | { tipo: 'legado'; nome: string }

function parsear(texto: string): Parte[] {
  const result: Parte[] = []
  // @[nome](personagem:id) — novo formato com ID
  // @palavra — formato legado sem ID
  const re = /@\[([^\]]+)\]\(personagem:([^)]+)\)|@(\w+)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) result.push({ tipo: 'texto', conteudo: texto.slice(last, m.index) })
    if (m[1] !== undefined && m[2] !== undefined) {
      result.push({ tipo: 'mencao', nome: m[1], id: m[2] })
    } else if (m[3] !== undefined) {
      result.push({ tipo: 'legado', nome: m[3] })
    }
    last = m.index + m[0].length
  }
  if (last < texto.length) result.push({ tipo: 'texto', conteudo: texto.slice(last) })
  return result
}

const TIPO_LABEL: Record<string, string> = {
  jogador: '👤 Jogador',
  npc: '🧙 NPC',
  monstro: '👹 Monstro',
}

export function TextoComMencoes({ texto, className }: TextoComMencoesProps) {
  const [popup, setPopup] = useState<{ id: string; x: number; y: number } | null>(null)
  const [personagem, setPersonagem] = useState<PersonagemDetalhes | null>(null)
  const [carregando, setCarregando] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  const partes = parsear(texto)

  const popupId = popup?.id
  useEffect(() => {
    if (!popupId) { setPersonagem(null); return }
    setCarregando(true)
    createClient()
      .from('personagens')
      .select('id, nome, tipo_personagem, raca, classe, nivel, ca, pv_atual, pv_maximo')
      .eq('id', popupId)
      .single()
      .then(({ data }) => {
        setPersonagem(data as PersonagemDetalhes | null)
        setCarregando(false)
      })
  }, [popupId])

  const isOpen = !!popup
  useEffect(() => {
    if (!isOpen) return
    function onMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isOpen])

  function abrirPopup(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const popupH = 200
    const popupW = 256
    const x = Math.min(rect.left, window.innerWidth - popupW - 8)
    const y = rect.bottom + 8 + popupH > window.innerHeight ? rect.top - popupH - 8 : rect.bottom + 8
    setPopup(prev => (prev?.id === id ? null : { id, x, y }))
  }

  const pvPct = personagem?.pv_maximo && personagem.pv_maximo > 0
    ? Math.max(0, Math.min(100, ((personagem.pv_atual ?? 0) / personagem.pv_maximo) * 100))
    : 0
  const corPV = pvPct > 50 ? 'var(--green2)' : pvPct > 25 ? '#f59e0b' : 'var(--red2)'

  return (
    <span className={className}>
      {partes.map((parte, i) => {
        if (parte.tipo === 'mencao') {
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={e => abrirPopup(parte.id, e)}
              onKeyDown={e => e.key === 'Enter' && abrirPopup(parte.id, e as unknown as React.MouseEvent)}
              className="px-1 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent2)] font-semibold font-cinzel text-[0.85em] cursor-pointer hover:bg-[var(--accent)]/40 transition-colors"
            >
              @{parte.nome}
            </span>
          )
        }
        if (parte.tipo === 'legado') {
          return (
            <span
              key={i}
              className="px-1 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent2)] font-semibold font-cinzel text-[0.85em]"
            >
              @{parte.nome}
            </span>
          )
        }
        return <span key={i}>{parte.conteudo}</span>
      })}

      {popup && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          style={{ position: 'fixed', top: popup.y, left: popup.x, zIndex: 9999, width: 256 }}
          className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl shadow-2xl p-3"
        >
          {carregando ? (
            <p className="text-[var(--text3)] text-xs font-cinzel text-center py-3 animate-pulse">Carregando...</p>
          ) : !personagem ? (
            <p className="text-[var(--text3)] text-xs font-cinzel text-center py-3">Personagem não encontrado</p>
          ) : (
            <>
              <div className="mb-2">
                <p className="font-cinzel text-[var(--gold)] font-bold text-sm leading-tight">{personagem.nome}</p>
                {personagem.tipo_personagem && (
                  <p className="text-[var(--text3)] text-[10px] font-crimson mt-0.5">
                    {TIPO_LABEL[personagem.tipo_personagem] ?? personagem.tipo_personagem}
                  </p>
                )}
              </div>

              {(personagem.raca || personagem.classe) && (
                <p className="text-[var(--text2)] text-xs font-crimson mb-2">
                  {[personagem.raca, personagem.classe, personagem.nivel ? `Nv${personagem.nivel}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-[var(--bg3)] rounded p-1.5 text-center">
                  <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase">CA</p>
                  <p className="text-[var(--gold)] font-bold text-base font-cinzel leading-none mt-0.5">
                    {personagem.ca ?? '—'}
                  </p>
                </div>
                <div className="bg-[var(--bg3)] rounded p-1.5 text-center">
                  <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase">PV</p>
                  <p className="font-bold text-sm font-cinzel leading-none mt-0.5" style={{ color: corPV }}>
                    {personagem.pv_atual}/{personagem.pv_maximo}
                  </p>
                </div>
              </div>

              {(personagem.pv_maximo ?? 0) > 0 && (
                <div className="h-1.5 bg-[var(--bg3)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pvPct}%`, backgroundColor: corPV }}
                  />
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </span>
  )
}
