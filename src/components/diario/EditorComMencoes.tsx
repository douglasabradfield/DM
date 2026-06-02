'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'

interface Mencao {
  id: string
  nome: string
}

interface EditorComMencoesProps {
  value: string
  onChange: (valor: string) => void
  rows?: number
  placeholder?: string
  className?: string
  campanhaId: string | null
}

function getCaretCoordinates(element: HTMLTextAreaElement, position: number): { x: number; y: number } {
  const div = document.createElement('div')
  const style = window.getComputedStyle(element)
  const props: (keyof CSSStyleDeclaration)[] = [
    'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight',
    'textIndent', 'wordSpacing', 'paddingTop', 'paddingRight', 'paddingBottom',
    'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
    'borderLeftWidth', 'boxSizing', 'whiteSpace', 'wordWrap', 'overflowWrap',
  ]
  props.forEach(p => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(div.style as any)[p] = style[p]
  })
  div.style.position = 'absolute'
  div.style.top = '-9999px'
  div.style.width = `${element.clientWidth}px`
  div.style.whiteSpace = 'pre-wrap'
  div.textContent = element.value.substring(0, position)
  const span = document.createElement('span')
  span.textContent = '|'
  div.appendChild(span)
  document.body.appendChild(div)
  const rect = element.getBoundingClientRect()
  const x = rect.left + span.offsetLeft - element.scrollLeft
  const y = rect.top + span.offsetTop - element.scrollTop
  document.body.removeChild(div)
  return { x, y }
}

export function EditorComMencoes({ value, onChange, rows = 5, placeholder, className, campanhaId }: EditorComMencoesProps) {
  const [sugestoes, setSugestoes] = useState<Mencao[]>([])
  const [queryMencao, setQueryMencao] = useState<string | null>(null)
  const [indiceSelecionado, setIndiceSelecionado] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const buscarPersonagens = useCallback(async (query: string) => {
    if (!campanhaId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('personagens')
      .select('id, nome')
      .eq('campanha_id', campanhaId)
      .ilike('nome', `%${query}%`)
      .limit(8)
    setSugestoes((data ?? []) as Mencao[])
  }, [campanhaId])

  useEffect(() => {
    if (queryMencao === null) { setSugestoes([]); return }
    buscarPersonagens(queryMencao)
  }, [queryMencao, buscarPersonagens])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const texto = e.target.value
    const cursor = e.target.selectionStart
    onChange(texto)

    const anteCursor = texto.slice(0, cursor)
    const match = anteCursor.match(/@([^\s@]*)$/)
    if (match) {
      setQueryMencao(match[1])
      setIndiceSelecionado(0)
      if (textareaRef.current) {
        try {
          const coords = getCaretCoordinates(textareaRef.current, cursor)
          const dropdownH = Math.min(8 * 44, 200)
          const y = coords.y + 20 + dropdownH > window.innerHeight
            ? coords.y - dropdownH - 4
            : coords.y + 20
          setDropdownPos({
            x: Math.max(8, Math.min(coords.x, window.innerWidth - 224 - 8)),
            y: Math.max(8, y),
          })
        } catch {
          setDropdownPos(null)
        }
      }
    } else {
      setQueryMencao(null)
      setDropdownPos(null)
    }
  }

  function inserirMencao(nome: string, id: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const pos = textarea.selectionStart
    const antes = value.slice(0, pos)
    const depois = value.slice(pos)
    const novosAntes = antes.replace(/@[^\s@]*$/, `@[${nome}](personagem:${id})`)
    onChange(`${novosAntes} ${depois}`)
    setQueryMencao(null)
    setSugestoes([])
    setDropdownPos(null)
    setTimeout(() => {
      const novaPosicao = novosAntes.length + 1
      textarea.setSelectionRange(novaPosicao, novaPosicao)
      textarea.focus()
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (sugestoes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSelecionado(i => Math.min(i + 1, sugestoes.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceSelecionado(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (sugestoes[indiceSelecionado]) { e.preventDefault(); inserirMencao(sugestoes[indiceSelecionado].nome, sugestoes[indiceSelecionado].id) }
    }
    if (e.key === 'Escape') { setQueryMencao(null); setSugestoes([]); setDropdownPos(null) }
  }

  const dropdown = sugestoes.length > 0 && queryMencao !== null && dropdownPos
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: dropdownPos.y,
            left: dropdownPos.x,
            zIndex: 9999,
            width: 224,
          }}
          className="bg-[var(--bg2)] border border-[var(--border)] rounded shadow-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-2 py-1 border-b border-[var(--border)]">
            <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Personagens</span>
          </div>
          {sugestoes.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); inserirMencao(s.nome, s.id) }}
              className={`w-full text-left px-3 py-1.5 text-sm font-crimson transition-colors ${i === indiceSelecionado ? 'bg-[var(--surface)] text-[var(--gold)]' : 'text-[var(--text)] hover:bg-[var(--bg3)]'}`}
            >
              @{s.nome}
            </button>
          ))}
        </div>,
        document.body
      )
    : null

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
      {dropdown}
    </>
  )
}
