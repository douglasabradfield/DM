'use client'

import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function estaStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari legado
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function ehIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOSClassico = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ se identifica como Mac, mas tem touch
  const iPadOSDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOSClassico || iPadOSDesktop
}

function ehSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua)
}

/**
 * Botão discreto de instalação do PWA — item de menu (não banner). Android/
 * desktop com Chrome/Edge usam o evento beforeinstallprompt; iOS Safari não
 * tem esse evento, então mostramos a instrução manual. Nada é exibido se o
 * app já roda em modo standalone ou se o navegador não suporta nenhum dos
 * dois caminhos (ex.: iOS fora do Safari, Firefox).
 */
export function InstalarApp() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [mostrarInstrucoesIOS, setMostrarInstrucoesIOS] = useState(false)
  const [iOSSafari, setIOSSafari] = useState(false)

  useEffect(() => {
    setStandalone(estaStandalone())
    setIOSSafari(ehIOS() && ehSafari())

    function aoCapturarPrompt(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', aoCapturarPrompt)
    return () => window.removeEventListener('beforeinstallprompt', aoCapturarPrompt)
  }, [])

  if (standalone) return null
  if (!promptEvent && !iOSSafari) return null

  async function instalar() {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
  }

  if (promptEvent) {
    return (
      <button
        onClick={instalar}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text2)] hover:bg-[var(--bg3)] transition-colors"
      >
        <Download className="w-4 h-4" />
        Instalar app
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMostrarInstrucoesIOS(v => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text2)] hover:bg-[var(--bg3)] transition-colors"
      >
        <Download className="w-4 h-4" />
        Instalar app
      </button>
      {mostrarInstrucoesIOS && (
        <div className="px-3 py-2 text-xs text-[var(--text3)] font-crimson border-t border-[var(--border)] flex items-start gap-1.5">
          <Share className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Toque em <strong className="text-[var(--text2)]">Compartilhar</strong> e depois em <strong className="text-[var(--text2)]">Adicionar à Tela de Início</strong>.</span>
        </div>
      )}
    </div>
  )
}
