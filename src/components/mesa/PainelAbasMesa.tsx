'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useMesaUi } from '@/store/mesa-ui'
import { BotaoFichaCompleta } from './BotaoFichaCompleta'
import { AbaMapa } from './AbaMapa'
import type { ImagensMesa } from '@/hooks/useImagensMesa'

// Painéis das abas do celular (abaixo de md). Fica sempre montado — a árvore
// de sessão/combate é que se esconde por CSS quando a aba não é Personagem.
export function PainelAbasMesa({
  abaMagias, abaMochila, imagensMesa, ocultarMapa,
  semSessao, personagemFichaId,
}: {
  semSessao?: boolean
  personagemFichaId?: string | null
  abaMagias?: ReactNode
  abaMochila?: ReactNode
  imagensMesa: ImagensMesa
  // Em xl o mapa vive na coluna lateral da sessão: não monta uma 2ª instância aqui.
  ocultarMapa?: boolean
}) {
  const abaAtiva = useMesaUi(s => s.abaAtiva)

  return (
    // Pai (mesa/page.tsx) é flex-col overflow-hidden: sem flex-1/min-h-0 o
    // painel não encolhe e o conteúdo é cortado em vez de rolar.
    <div className={cn(
      'px-3 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex-1 min-h-0 overflow-y-auto',
      abaAtiva === 'personagem' ? 'hidden' : 'block md:hidden'
    )}>
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
      {abaAtiva === 'mapa' && !semSessao && !ocultarMapa && <AbaMapa dados={imagensMesa} />}
    </div>
  )
}
