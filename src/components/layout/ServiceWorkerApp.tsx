'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const INTERVALO_VERIFICACAO_MS = 30 * 60 * 1000

/**
 * Registra o service worker (public/sw.js) e mostra um aviso quando uma
 * versão nova foi instalada. O SW já ativa sozinho (skipWaiting +
 * clients.claim, ver sw.js) — o aviso aqui é só pra convidar o usuário a
 * recarregar a aba na hora que ele quiser, sem interromper uma sessão em
 * andamento sem avisar.
 */
export function ServiceWorkerApp() {
  const [atualizacaoDisponivel, setAtualizacaoDisponivel] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registro: ServiceWorkerRegistration | null = null

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      registro = reg

      // Já havia um SW controlando a página quando este registro rodou
      // (ou seja, não é a primeira instalação) — se o navegador encontrar
      // um SW mais novo agora, é uma atualização de verdade.
      reg.addEventListener('updatefound', () => {
        const instalando = reg.installing
        if (!instalando) return
        instalando.addEventListener('statechange', () => {
          if (instalando.state === 'installed' && navigator.serviceWorker.controller) {
            setAtualizacaoDisponivel(true)
          }
        })
      })
    }).catch(() => {})

    // Abas de sessão longa (uma batalha de horas) só checam por update em
    // navegação — força uma checagem periódica e ao voltar o foco.
    const intervalo = setInterval(() => registro?.update(), INTERVALO_VERIFICACAO_MS)
    function aoFocar() {
      if (document.visibilityState === 'visible') registro?.update()
    }
    document.addEventListener('visibilitychange', aoFocar)

    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoFocar)
    }
  }, [])

  if (!atualizacaoDisponivel) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-2xl border border-[var(--gold)]/40 bg-[var(--bg3)]">
      <span className="text-sm font-crimson text-[var(--text2)]">Nova versão disponível</span>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3 py-1 rounded font-cinzel text-xs text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/40 hover:bg-[var(--gold)]/20 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Atualizar
      </button>
    </div>
  )
}
