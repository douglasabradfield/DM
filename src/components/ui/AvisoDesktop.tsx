'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Monitor } from 'lucide-react'

interface AvisoDesktopProps {
  // Conteúdo real da tela — renderizado normalmente a partir de md (≥768px).
  // Abaixo disso fica oculto (não desmontado) atrás do aviso.
  children: React.ReactNode
  mensagem?: string
}

// Bloqueia telas de mestre com formulários densos abaixo de md, com um aviso
// amigável em vez de deixar o layout quebrar. Usar em volta da página
// inteira quando não há uma versão de só-consulta que valha manter; para
// bloquear só uma ação específica (ex.: criar/editar) dentro de uma tela que
// também tem consulta, usar diretamente dentro do gatilho daquela ação.
export function AvisoDesktop({ children, mensagem }: AvisoDesktopProps) {
  const router = useRouter()
  return (
    <>
      <div className="flex md:hidden flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-4">
          <Monitor className="w-7 h-7 text-[var(--border)]" />
        </div>
        <p className="font-cinzel text-[var(--gold)] text-lg mb-1">🖥️ Melhor no computador</p>
        <p className="text-[var(--text3)] text-sm font-crimson mb-6 max-w-xs">
          {mensagem ?? 'Esta tela usa formulários grandes e foi feita para telas maiores. Abra no notebook ou tablet para usar.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2.5 border border-[var(--border)] text-[var(--text2)] rounded-lg font-cinzel text-sm hover:border-[var(--border2)] transition-colors"
          >
            ← Voltar
          </button>
          <Link
            href="/mesa"
            className="px-4 py-2.5 bg-[var(--accent)] text-[var(--bg)] rounded-lg font-cinzel text-sm hover:opacity-90 transition-opacity"
          >
            Ir para Mesa
          </Link>
        </div>
      </div>
      <div className="hidden md:block h-full">{children}</div>
    </>
  )
}
