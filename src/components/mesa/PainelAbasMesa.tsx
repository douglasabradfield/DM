'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useMesaUi } from '@/store/mesa-ui'
import { BotaoFichaCompleta } from './BotaoFichaCompleta'

interface Botao {
  rotulo: string
  descricao: string
  onClick?: () => void
  href?: string
  desabilitado?: boolean
}

const CLASSE_BOTAO = cn(
  'flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]',
  'text-[var(--text2)] font-cinzel text-base min-h-[96px] px-3 text-center transition-opacity'
)

// Painéis das abas do celular (abaixo de md). Fica sempre montado — a árvore
// de sessão/combate é que se esconde por CSS quando a aba não é Personagem.
export function PainelAbasMesa({
  abaMagias, abaMochila,
  semSessao, personagemFichaId,
}: {
  semSessao?: boolean
  personagemFichaId?: string | null
  abaMagias?: ReactNode
  abaMochila?: ReactNode
}) {
  const abaAtiva = useMesaUi(s => s.abaAtiva)

  const paineis: Record<'mapa', Botao[]> = {
    mapa: [
      { rotulo: '🗺️ Abrir mapas e imagens', descricao: 'Mapas e imagens da campanha', href: '/mapas' },
    ],
  }

  return (
    <div className={cn('px-3 py-3', abaAtiva === 'personagem' ? 'hidden' : 'block md:hidden')}>
      {abaAtiva !== 'personagem' && semSessao && (
        <div className="flex flex-col gap-3 text-center">
          <p className="text-[var(--text3)] text-sm font-crimson">
            Sem sessão em andamento. Abra a ficha completa para editar.
          </p>
          {personagemFichaId && <BotaoFichaCompleta personagemId={personagemFichaId} rotulo="Abrir ficha completa" />}
        </div>
      )}
      {abaAtiva === 'magias' && !semSessao && abaMagias}
      {abaAtiva === 'mochila' && !semSessao && abaMochila}
      {abaAtiva === 'mapa' && !semSessao && (
        <div className="grid grid-cols-1 gap-3">
          {paineis[abaAtiva].map(b => b.href ? (
            <Link key={b.rotulo} href={b.href} className={CLASSE_BOTAO}>
              <span>{b.rotulo}</span>
              <span className="text-[var(--text3)] font-crimson text-xs">{b.descricao}</span>
            </Link>
          ) : (
            <button
              key={b.rotulo}
              type="button"
              onClick={b.onClick}
              disabled={b.desabilitado}
              className={cn(CLASSE_BOTAO, b.desabilitado && 'opacity-40 cursor-not-allowed')}
            >
              <span>{b.rotulo}</span>
              <span className="text-[var(--text3)] font-crimson text-xs">{b.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
