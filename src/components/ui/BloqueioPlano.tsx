'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'

interface BloqueioPlanoProps {
  recurso: string
  planoNecessario: string
  className?: string
  children?: React.ReactNode
}

export function BloqueioPlano({ recurso, planoNecessario, className = '', children }: BloqueioPlanoProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center h-full ${className}`}>
      <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-[var(--border)]" />
      </div>
      <p className="font-cinzel text-[var(--text3)] text-lg mb-1">{recurso}</p>
      <p className="text-[var(--text3)] text-sm font-crimson mb-5 max-w-xs">
        Disponível no plano{' '}
        <span className="text-[var(--gold)] font-semibold">{planoNecessario}</span>{' '}
        ou superior
      </p>
      {children}
      <Link
        href="/conta"
        className="px-5 py-2 bg-[var(--accent)] text-[var(--bg)] rounded-lg font-cinzel text-sm hover:opacity-90 transition-opacity"
      >
        Ver Planos
      </Link>
    </div>
  )
}
