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

// Calcula as coordenadas do caret dentro do textarea usando um div-espelho
function calcularPosCaret(textarea: HTMLTextAreaElement): { top: number; left: number } {
  const div = document.createElement('div')
  const style = window.getComputedStyle(textarea)

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
  div.style.visibility = 'hidden'
  div.style.width = `${textarea.clientWidth}px`
  div.style.height = 'auto'
  div.style.whiteSpace = 'pre-wrap'
  div.style.overflow = 'hidden'

  const texto = textarea.value.substring(0, textarea.selectionStart)
  div.textContent = texto

  const span = document.createElement('span')
  span.textContent = '|'
  div.appendChild(span)

  document.body.appendChild(div)
  const rect = textarea.getBoundingClientRect()
  const spanRect = span.getBoundingClientRect()
  document.body.removeChild(div)

  const scrollTop = textarea.scrollTop

  return {
    top: rect.top + span.offsetTop - scrollTop + div.offsetHeight / (texto.split('\n').length || 1),
    left: rect.left + spanRect.left - div.getBoundingClientRect().left,
  }
}

export function EditorComMencoes({ value, onChange, rows = 5, placeholder, className, campanhaId }: EditorComMencoesProps) {
  const [sugestoes, setSugestoes] = useState<Mencao[]>([])
  const [queryMencao, setQueryMencao] = useState<string | null>(null)
  const [posicaoCursor, setPosicaoCursor] = useState(0)
  const [indiceSelecionado, setIndiceSelecionado] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
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
    const match = anteCursor.match(/@(\w*)$/)
    if (match) {
      setQueryMencao(match[1])
      setPosicaoCursor(cursor)
      setIndiceSelecionado(0)
      // Calcular posição do caret para o portal
      if (textareaRef.current) {
        try {
          const { top, left } = calcularPosCaret(textareaRef.current)
          setDropdownPos({ top: top + 20, left })
        } catch {
          setDropdownPos(null)
        }
      }
    } else {
      setQueryMencao(null)
      setDropdownPos(null)
    }
  }

  function inserirMencao(nome: string) {
    const anteCursor = value.slice(0, posicaoCursor)
    const depoisCursor = value.slice(posicaoCursor)
    const posicaoArroba = anteCursor.lastIndexOf('@')
    const novoTexto = anteCursor.slice(0, posicaoArroba) + `@${nome}` + depoisCursor
    onChange(novoTexto)
    setQueryMencao(null)
    setSugestoes([])
    setDropdownPos(null)
    setTimeout(() => {
      const ta = textareaRef.current
      if (!ta) return
      const novoCursor = posicaoArroba + nome.length + 1
      ta.focus()
      ta.setSelectionRange(novoCursor, novoCursor)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (sugestoes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSelecionado(i => Math.min(i + 1, sugestoes.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceSelecionado(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (sugestoes[indiceSelecionado]) { e.preventDefault(); inserirMencao(sugestoes[indiceSelecionado].nome) }
    }
    if (e.key === 'Escape') { setQueryMencao(null); setSugestoes([]); setDropdownPos(null) }
  }

  const dropdown = sugestoes.length > 0 && queryMencao !== null && dropdownPos
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
            width: 224,
          }}
          className="bg-[var(--bg2)] border border-[var(--border)] rounded shadow-xl"
        >
          <div className="px-2 py-1 border-b border-[var(--border)]">
            <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Personagens</span>
          </div>
          {sugestoes.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); inserirMencao(s.nome) }}
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
