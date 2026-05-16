'use client'

import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface BotaoRunicoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'ouro'
  tamanho?: 'sm' | 'md' | 'lg'
  carregando?: boolean
}

export function BotaoRunico({
  children,
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  className,
  disabled,
  ...props
}: BotaoRunicoProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-cinzel font-semibold transition-all duration-200 rounded border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  const variantes = {
    primario: 'bg-[var(--accent)] border-[var(--accent2)] text-[var(--bg)] hover:opacity-90 hover:border-[var(--gold)] hover:shadow-[0_0_12px_rgba(155,89,182,0.4)]',
    secundario: 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface2)] hover:border-[var(--border2)]',
    perigo: 'bg-[#c0392b] border-[#e74c3c] text-[var(--bg)] hover:bg-[#e74c3c] hover:shadow-[0_0_12px_rgba(192,57,43,0.4)]',
    fantasma: 'bg-transparent border-[var(--border)] text-[var(--text2)] hover:border-[var(--gold)] hover:text-[var(--gold)]',
    ouro: 'bg-[var(--gold)] border-[var(--gold2)] text-[var(--bg)] hover:bg-[var(--gold2)] hover:shadow-[0_0_12px_rgba(212,168,67,0.5)]',
  }

  const tamanhos = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-3',
  }

  return (
    <button
      className={cn(base, variantes[variante], tamanhos[tamanho], className)}
      disabled={disabled || carregando}
      {...props}
    >
      {carregando ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Carregando...
        </>
      ) : children}
    </button>
  )
}
