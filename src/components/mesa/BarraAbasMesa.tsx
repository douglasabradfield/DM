'use client'

import { usePathname } from 'next/navigation'
import { User, Sparkles, Backpack, Map } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMesaUi, type AbaMesa } from '@/store/mesa-ui'

const ABAS: { id: AbaMesa; label: string; icone: typeof User }[] = [
  { id: 'personagem', label: 'Personagem', icone: User },
  { id: 'magias', label: 'Magias', icone: Sparkles },
  { id: 'mochila', label: 'Mochila', icone: Backpack },
  { id: 'mapa', label: 'Mapa', icone: Map },
]

// Substitui o BottomNav do app apenas na /mesa (celular). Mesma altura,
// borda, fundo e safe-area do BottomNav para o pb-16 do <main> continuar valendo.
export function BarraAbasMesa() {
  const pathname = usePathname()
  const abaAtiva = useMesaUi(s => s.abaAtiva)
  const setAba = useMesaUi(s => s.setAba)

  if (pathname !== '/mesa' && !pathname.startsWith('/mesa/')) return null

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50
                    bg-[var(--bg2)] border-t border-[var(--border)]
                    flex items-center justify-around px-1 py-1 safe-area-pb">
      {ABAS.map(({ id, label, icone: Icone }) => (
        <button
          key={id}
          type="button"
          onClick={() => setAba(id)}
          aria-current={abaAtiva === id ? 'page' : undefined}
          className={cn(
            'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0 min-h-[44px]',
            abaAtiva === id ? 'text-[var(--dd-gold)]' : 'text-[var(--dd-text3)] hover:text-[var(--dd-text2)]'
          )}
        >
          <Icone size={20} />
          <span className="text-[10px] font-medium truncate">{label}</span>
        </button>
      ))}
    </nav>
  )
}
