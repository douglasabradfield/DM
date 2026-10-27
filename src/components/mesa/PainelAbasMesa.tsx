'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useMesaUi } from '@/store/mesa-ui'
import { BotaoFichaCompleta } from './BotaoFichaCompleta'
import { AbaMapa } from './AbaMapa'

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
      {abaAtiva === 'mapa' && !semSessao && <AbaMapa />}
    </div>
  )
}
