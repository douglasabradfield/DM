'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCampanha } from '@/store/campanha'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface HeaderProps {
  titulo: string
  usuario?: { nome: string | null; email: string }
}

export function Header({ titulo, usuario }: HeaderProps) {
  const router = useRouter()
  const { campanhaAtiva } = useCampanha()
  const [menuAberto, setMenuAberto] = useState(false)

  async function sair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-12 bg-[#150f18] border-b border-[#4a3060] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h2 className="font-cinzel text-[#d4a843] font-semibold text-sm">{titulo}</h2>
        {campanhaAtiva && (
          <span className="text-[#4a3060] text-xs">
            ✦ {campanhaAtiva.nome}
          </span>
        )}
      </div>

      {usuario && (
        <div className="relative">
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="flex items-center gap-2 text-[#b8a8cc] hover:text-[#e8dff0] transition-colors text-sm"
          >
            <User className="w-4 h-4" />
            <span className="font-crimson">{usuario.nome || usuario.email}</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {menuAberto && (
            <div className="absolute right-0 top-full mt-1 bg-[#261a2e] border border-[#4a3060] rounded shadow-lg z-50 min-w-40">
              <div className="px-3 py-2 border-b border-[#4a3060]">
                <p className="text-xs text-[#8870a8]">{usuario.email}</p>
              </div>
              <button
                onClick={sair}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#e74c3c] hover:bg-[#1e1525] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
