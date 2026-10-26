'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useMesaUi } from '@/store/mesa-ui'

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
  podeAgir, temPersonagem, ehDM,
  onConjurar, onPreparar, onItens, onOuro, onDistribuir,
}: {
  podeAgir: boolean
  temPersonagem: boolean
  ehDM: boolean
  onConjurar: () => void
  onPreparar: () => void
  onItens: () => void
  onOuro: () => void
  onDistribuir: () => void
}) {
  const abaAtiva = useMesaUi(s => s.abaAtiva)
  const usavel = podeAgir && temPersonagem

  const paineis: Record<'magias' | 'mochila' | 'mapa', Botao[]> = {
    magias: [
      { rotulo: '✨ Conjurar', descricao: 'Lançar uma magia', onClick: onConjurar, desabilitado: !usavel },
      { rotulo: '📖 Preparar magias', descricao: 'Escolher as magias preparadas', onClick: onPreparar, desabilitado: !usavel },
    ],
    mochila: [
      { rotulo: '🎒 Itens', descricao: 'Inventário e uso de itens', onClick: onItens, desabilitado: !usavel },
      { rotulo: '💰 Ouro', descricao: 'Moedas e transferências', onClick: onOuro, desabilitado: !usavel },
      ...(ehDM ? [{ rotulo: '🎁 Distribuir tesouro', descricao: 'Dar itens e moedas ao grupo', onClick: onDistribuir, desabilitado: !podeAgir }] : []),
    ],
    mapa: [
      { rotulo: '🗺️ Abrir mapas e imagens', descricao: 'Mapas e imagens da campanha', href: '/mapas' },
    ],
  }

  return (
    <div className={cn('px-3 py-3', abaAtiva === 'personagem' ? 'hidden' : 'block md:hidden')}>
      {abaAtiva !== 'personagem' && (
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
