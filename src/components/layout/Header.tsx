'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCampanha } from '@/store/campanha'
import { getTemaAtual, aplicarTema, type NomeTema } from '@/lib/tema'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'

interface HeaderProps {
  titulo: string
  usuario?: { nome: string | null; email: string }
}

export function Header({ titulo, usuario }: HeaderProps) {
  const router = useRouter()
  const { campanhaAtiva } = useCampanha()
  const [menuAberto, setMenuAberto] = useState(false)
  const [tema, setTema] = useState<NomeTema>('grimorio')

  useEffect(() => {
    const t = getTemaAtual()
    setTema(t)
    aplicarTema(t)
  }, [])

  function alternarTema() {
    const novo: NomeTema = tema === 'grimorio' ? 'medieval' : 'grimorio'
    aplicarTema(novo)
    setTema(novo)
  }

  async function sair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-12 bg-[var(--bg2)] border-b border-[var(--border)] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h2 className="font-cinzel text-[var(--gold)] font-semibold text-sm">{titulo}</h2>
        {campanhaAtiva && (
          <span className="text-[var(--border)] text-xs">
            ✦ {campanhaAtiva.nome}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Botão de tema */}
        <button
          onClick={alternarTema}
          className="text-sm px-2 py-1 rounded border border-[var(--border)] text-[var(--text3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors font-cinzel"
          title={tema === 'grimorio' ? 'Mudar para tema Medieval' : 'Mudar para tema Grimório'}
        >
          {tema === 'grimorio' ? '📜 Medieval' : '🌙 Grimório'}
        </button>

        {usuario && (
          <div className="relative">
            <button
              onClick={() => setMenuAberto(!menuAberto)}
              className="flex items-center gap-2 text-[var(--text2)] hover:text-[var(--text)] transition-colors text-sm"
            >
              <User className="w-4 h-4" />
              <span className="font-crimson">{usuario.nome || usuario.email}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg z-50 min-w-40">
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <p className="text-xs text-[var(--text3)]">{usuario.email}</p>
                </div>
                <button
                  onClick={sair}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--red2)] hover:bg-[var(--bg3)] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
