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
    primario: 'bg-[#9b59b6] border-[#c39bd3] text-white hover:bg-[#8e44ad] hover:border-[#d4a843] hover:shadow-[0_0_12px_rgba(155,89,182,0.4)]',
    secundario: 'bg-[#261a2e] border-[#4a3060] text-[#e8dff0] hover:bg-[#2f2040] hover:border-[#6b4890]',
    perigo: 'bg-[#c0392b] border-[#e74c3c] text-white hover:bg-[#e74c3c] hover:shadow-[0_0_12px_rgba(192,57,43,0.4)]',
    fantasma: 'bg-transparent border-[#4a3060] text-[#b8a8cc] hover:border-[#d4a843] hover:text-[#d4a843]',
    ouro: 'bg-[#d4a843] border-[#f0c060] text-[#0d0a0e] hover:bg-[#f0c060] hover:shadow-[0_0_12px_rgba(212,168,67,0.5)]',
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
