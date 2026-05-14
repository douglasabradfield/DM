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
        'bg-[#150f18] border border-[#4a3060] rounded-lg relative overflow-hidden',
        ornamentado && 'border-[#d4a843]',
        compacto ? 'p-3' : 'p-5',
        className
      )}
      {...props}
    >
      {ornamentado && (
        <>
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#d4a843]" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#d4a843]" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#d4a843]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#d4a843]" />
        </>
      )}
      {(titulo || subtitulo) && (
        <div className="mb-4">
          {titulo && (
            <h3 className="font-cinzel text-[#d4a843] font-semibold text-sm uppercase tracking-wider">
              {titulo}
            </h3>
          )}
          {subtitulo && (
            <p className="text-[#8870a8] text-xs mt-0.5">{subtitulo}</p>
          )}
          <div className="mt-2 h-px bg-gradient-to-r from-transparent via-[#4a3060] to-transparent" />
        </div>
      )}
      {children}
    </div>
  )
}
