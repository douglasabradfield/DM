'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCampanha } from '@/store/campanha'
import { getTemaAtual, aplicarTema, type NomeTema, TEMAS } from '@/lib/tema'
import { LogOut, User, ChevronDown, Settings, Bell } from 'lucide-react'
import { useState, useEffect } from 'react'

interface HeaderProps {
  titulo: string
  usuario?: { nome: string | null; email: string }
}

export function Header({ titulo, usuario }: HeaderProps) {
  const router = useRouter()
  const { campanhaAtiva } = useCampanha()
  const [menuAberto, setMenuAberto] = useState(false)
  const [temaMenuAberto, setTemaMenuAberto] = useState(false)
  const [tema, setTema] = useState<NomeTema>('grimorio')
  const [notificacoes, setNotificacoes] = useState<Array<{
    id: string; titulo: string; mensagem: string | null; link: string | null; criado_em: string
  }>>([])
  const [notifAberto, setNotifAberto] = useState(false)

  useEffect(() => {
    const t = getTemaAtual()
    setTema(t)
    aplicarTema(t)
  }, [])

  useEffect(() => {
    async function buscarNotificacoes() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, link, criado_em')
        .eq('user_id', user.id)
        .eq('lida', false)
        .order('criado_em', { ascending: false })
        .limit(10)
      setNotificacoes(data ?? [])
    }
    buscarNotificacoes()
  }, [])

  async function marcarLida(id: string) {
    const supabase = createClient()
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotificacoes(prev => prev.filter(n => n.id !== id))
  }

  async function marcarTodasLidas() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notificacoes').update({ lida: true }).eq('user_id', user.id).eq('lida', false)
    setNotificacoes([])
    setNotifAberto(false)
  }

  function selecionarTema(novo: NomeTema) {
    aplicarTema(novo)
    setTema(novo)
    setTemaMenuAberto(false)
  }

  async function sair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-12 bg-[var(--bg2)] border-b border-[var(--border)] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h2 className="font-cinzel text-[var(--gold)] font-semibold text-sm truncate max-w-[120px] sm:max-w-none">{titulo}</h2>
        {campanhaAtiva && (
          <span className="hidden sm:inline text-[var(--border)] text-xs">
            ✦ {campanhaAtiva.nome}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Links de ajuda e legal */}
        <div className="hidden sm:flex items-center gap-1">
          <Link
            href="/ajuda"
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs
                       text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--surface)]
                       transition-colors font-cinzel"
          >
            ❓ Ajuda
          </Link>
          <Link
            href="/legal"
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs
                       text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--surface)]
                       transition-colors font-cinzel"
          >
            ⚖️ Legal
          </Link>
        </div>

        {/* Seletor de tema */}
        <div className="relative">
          <button
            onClick={() => setTemaMenuAberto(!temaMenuAberto)}
            className="flex items-center gap-1.5 px-3 py-1 text-sm rounded
                       bg-[var(--bg2)] hover:bg-[var(--bg3)] transition-colors
                       border border-[var(--border)]"
          >
            <span>{TEMAS.find(t => t.id === tema)?.icone}</span>
            <span className="hidden sm:inline text-[var(--dd-text2)]">
              {TEMAS.find(t => t.id === tema)?.label}
            </span>
            <ChevronDown size={14} className="text-[var(--dd-text3)]" />
          </button>

          {temaMenuAberto && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setTemaMenuAberto(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px]
                              bg-[var(--surface)] border border-[var(--border)]
                              rounded-lg shadow-xl overflow-hidden animate-fadeIn">
                {TEMAS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selecionarTema(t.id)}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm
                                transition-colors text-left
                                ${tema === t.id
                                  ? 'bg-[var(--surface2)] text-[var(--dd-gold)] font-semibold'
                                  : 'text-[var(--dd-text2)] hover:bg-[var(--surface2)] hover:text-[var(--dd-text)]'
                                }`}
                  >
                    <span>{t.icone}</span>
                    <span>{t.label}</span>
                    {tema === t.id && <span className="ml-auto text-[var(--dd-gold)]">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => { setNotifAberto(!notifAberto); setMenuAberto(false) }}
            className="relative p-1.5 text-[var(--text3)] hover:text-[var(--text2)] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {notificacoes.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--red2)] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {notificacoes.length > 9 ? '9+' : notificacoes.length}
              </span>
            )}
          </button>

          {notifAberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifAberto(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                  <span className="font-cinzel text-xs text-[var(--text3)] uppercase tracking-wider">Notificações</span>
                  {notificacoes.length > 0 && (
                    <button onClick={marcarTodasLidas} className="text-[10px] text-[var(--accent)] hover:underline font-cinzel">
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                {notificacoes.length === 0 ? (
                  <p className="text-center text-[var(--text3)] text-xs font-crimson py-4">Nenhuma notificação</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {notificacoes.map(n => (
                      <div
                        key={n.id}
                        className="px-3 py-2.5 border-b border-[var(--border)]/50 hover:bg-[var(--bg3)] transition-colors cursor-pointer"
                        onClick={() => {
                          marcarLida(n.id)
                          if (n.link) window.location.href = n.link
                          else setNotifAberto(false)
                        }}
                      >
                        <p className="text-[var(--text)] text-xs font-cinzel">{n.titulo}</p>
                        {n.mensagem && (
                          <p className="text-[var(--text3)] text-[10px] font-crimson mt-0.5 line-clamp-2">{n.mensagem}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {usuario && (
          <div className="relative">
            <button
              onClick={() => { setMenuAberto(!menuAberto); setNotifAberto(false) }}
              className="flex items-center gap-2 text-[var(--text2)] hover:text-[var(--text)] transition-colors text-sm"
            >
              <User className="w-4 h-4" />
              <span className="font-crimson">{usuario.nome || usuario.email}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg z-50 min-w-44">
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--text2)]">{usuario.nome || usuario.email}</p>
                  <p className="text-xs text-[var(--text3)] truncate">{usuario.email}</p>
                </div>
                <Link
                  href="/conta"
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text2)] hover:bg-[var(--bg3)] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Minha Conta
                </Link>
                <div className="border-t border-[var(--border)]" />
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
