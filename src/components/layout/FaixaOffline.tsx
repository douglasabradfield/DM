'use client'

import { useEffect, useRef } from 'react'
import { WifiOff } from 'lucide-react'
import { useOnline } from '@/hooks/useOnline'
import { useCampanha } from '@/store/campanha'

/**
 * Faixa fixa, não dispensável, avisando que a conexão caiu — as escritas
 * (ações da /mesa, salvar da ficha) ficam desabilitadas enquanto isso via
 * useOnline() nos próprios componentes.
 *
 * Ao reconectar, força um recarregamento dos dados da campanha ativa: o
 * canal Realtime reconecta sozinho, mas o estado local pode ter divergido
 * durante a queda (ex.: uma sessão foi encerrada por outra aba enquanto
 * offline).
 */
export function FaixaOffline() {
  const online = useOnline()
  const estavaOfflineRef = useRef(false)
  const { campanhaAtiva, carregarCampanhas, carregarSessaoAtiva } = useCampanha()

  useEffect(() => {
    if (online && estavaOfflineRef.current) {
      carregarCampanhas()
      if (campanhaAtiva?.id) carregarSessaoAtiva(campanhaAtiva.id)
    }
    estavaOfflineRef.current = !online
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  if (online) return null

  return (
    <div className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-cinzel text-white z-[100]"
      style={{ background: 'var(--red2)' }}
    >
      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
      Sem conexão — as ações não serão registradas
    </div>
  )
}
