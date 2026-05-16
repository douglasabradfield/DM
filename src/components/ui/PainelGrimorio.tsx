import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface PainelGrimorioProps extends HTMLAttributes<HTMLDivElement> {
  titulo?: string
  subtitulo?: string
  ornamentado?: boolean
  compacto?: boolean
}

export function PainelGrimorio({
  children,
  titulo,
  subtitulo,
  ornamentado = false,
  compacto = false,
  className,
  ...props
}: PainelGrimorioProps) {
  return (
    <div
      className={cn(
        'bg-[var(--bg2)] border border-[var(--border)] rounded-lg relative overflow-hidden',
        ornamentado && 'border-[var(--gold)]',
        compacto ? 'p-3' : 'p-5',
        className
      )}
      {...props}
    >
      {ornamentado && (
        <>
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--gold)]" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[var(--gold)]" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[var(--gold)]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--gold)]" />
        </>
      )}
      {(titulo || subtitulo) && (
        <div className="mb-4">
          {titulo && (
            <h3 className="font-cinzel text-[var(--gold)] font-semibold text-sm uppercase tracking-wider">
              {titulo}
            </h3>
          )}
          {subtitulo && (
            <p className="text-[var(--text3)] text-xs mt-0.5">{subtitulo}</p>
          )}
          <div className="mt-2 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
        </div>
      )}
      {children}
    </div>
  )
}
