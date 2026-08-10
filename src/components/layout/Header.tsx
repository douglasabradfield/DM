'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCampanha } from '@/store/campanha'
import { getTemaAtual, aplicarTema, type NomeTema, TEMAS } from '@/lib/tema'
import { LogOut, User, ChevronDown, Settings, Bell, Shield, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useControleSessao } from '@/hooks/useControleSessao'
import { ModalIniciarSessao } from '@/components/campanha/ModalIniciarSessao'
import { InstalarApp } from '@/components/layout/InstalarApp'

interface HeaderProps {
  titulo: string
  usuario?: { nome: string | null; email: string; username?: string | null }
}

interface Notificacao {
  id: string
  titulo: string
  mensagem: string | null
  link: string | null
  criado_em: string
  lida: boolean
}

export function Header({ titulo, usuario }: HeaderProps) {
  const router = useRouter()
  const { campanhaAtiva, campanhas, setCampanhaAtiva, papelPorCampanha } = useCampanha()
  const [menuAberto, setMenuAberto] = useState(false)
  const [temaMenuAberto, setTemaMenuAberto] = useState(false)
  const [tema, setTema] = useState<NomeTema>('grimorio')
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [notifAberto, setNotifAberto] = useState(false)
  const [seletorCampanhaAberto, setSeletorCampanhaAberto] = useState(false)
  const [sessaoFolhaAberta, setSessaoFolhaAberta] = useState(false)
  const userIdRef = useRef<string | null>(null)
  const ehDM = campanhaAtiva ? papelPorCampanha[campanhaAtiva.id] === 'dm' : false
  const {
    sessaoAtiva, sessaoCarregando, encerrando,
    modalIniciarAberto, abrirModalIniciar, fecharModalIniciar,
    confirmarIniciarSessao, handleEncerrarSessao,
  } = useControleSessao()

  useEffect(() => {
    const t = getTemaAtual()
    setTema(t)
    aplicarTema(t)
  }, [])

  async function buscarNotificacoes() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    userIdRef.current = user.id
    const { data } = await supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, link, criado_em, lida')
      .eq('user_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(20)
    setNotificacoes((data ?? []) as Notificacao[])
  }

  useEffect(() => {
    buscarNotificacoes()
    const interval = setInterval(buscarNotificacoes, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function marcarLida(id: string, link: string | null) {
    const supabase = createClient()
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    if (link) window.location.href = link
  }

  async function marcarTodasLidas() {
    const supabase = createClient()
    const userId = userIdRef.current
    if (!userId) return
    await supabase.from('notificacoes').update({ lida: true }).eq('user_id', userId).eq('lida', false)
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
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

  const naoLidas = notificacoes.filter(n => !n.lida)
  const lidas = notificacoes.filter(n => n.lida)
  const campanhasAtivas = campanhas.filter(c => c.ativa !== false)

  return (
    <header className="min-h-12 bg-[var(--bg2)] border-b border-[var(--border)] flex items-center justify-between px-2 sm:px-4 gap-2 safe-area-pt">
      {/* Desktop: título + campanha (inalterado) */}
      <div className="hidden md:flex items-center gap-3">
        <h2 className="font-cinzel text-[var(--gold)] font-semibold text-sm truncate max-w-[120px] sm:max-w-none">{titulo}</h2>
        {campanhaAtiva && (
          <span className="hidden sm:inline text-[var(--border)] text-xs">
            ✦ {campanhaAtiva.nome}
          </span>
        )}
      </div>

      {/* Mobile: logo (ícone) + seletor de campanha compacto */}
      <div className="flex md:hidden items-center gap-2 min-w-0 flex-1">
        <Shield className="w-5 h-5 text-[var(--gold)] flex-shrink-0" />
        <button
          onClick={() => setSeletorCampanhaAberto(true)}
          className="flex items-center gap-1 min-w-0 px-2 py-1 rounded text-xs font-cinzel
                     text-[var(--gold)] bg-[var(--bg3)] border border-[var(--border)]
                     hover:border-[var(--border2)] transition-colors"
        >
          <span className="truncate">{campanhaAtiva?.nome ?? 'Sem campanha'}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>

        {/* Controle de sessão — só o DM vê; jogador só sente o efeito (a
            /mesa habilitando). Mesmo estado/ações da Sidebar, via
            useControleSessao — aqui abre folha própria. */}
        {ehDM && (
          <button
            onClick={() => setSessaoFolhaAberta(true)}
            disabled={sessaoCarregando}
            title={sessaoAtiva ? `Sessão ${sessaoAtiva.numero ?? ''} ativa` : 'Iniciar sessão'}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                       bg-[var(--bg3)] border border-[var(--border)] disabled:opacity-50"
          >
            <span className="text-xs">{sessaoAtiva ? '🟢' : '▶️'}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
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
            {naoLidas.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--red2)] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {naoLidas.length > 9 ? '9+' : naoLidas.length}
              </span>
            )}
          </button>

          {notifAberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifAberto(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden">
                {/* Header do dropdown */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                  <span className="font-cinzel text-xs text-[var(--text3)] uppercase tracking-wider">
                    Notificações
                    {naoLidas.length > 0 && (
                      <span className="ml-1.5 text-[var(--red2)]">({naoLidas.length})</span>
                    )}
                  </span>
                  {naoLidas.length > 0 && (
                    <button onClick={marcarTodasLidas} className="text-[10px] text-[var(--accent)] hover:underline font-cinzel">
                      Marcar todas como lidas
                    </button>
                  )}
                </div>

                {notificacoes.length === 0 ? (
                  <p className="text-center text-[var(--text3)] text-xs font-crimson py-4">
                    Nenhuma notificação
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {/* Não lidas */}
                    {naoLidas.map(n => (
                      <div
                        key={n.id}
                        className="px-3 py-2.5 border-b border-[var(--border)]/50 hover:bg-[var(--bg3)] transition-colors cursor-pointer"
                        onClick={() => marcarLida(n.id, n.link)}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--accent2)] flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[var(--text)] text-xs font-cinzel">{n.titulo}</p>
                            {n.mensagem && (
                              <p className="text-[var(--text3)] text-[10px] font-crimson mt-0.5 line-clamp-2">{n.mensagem}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Separador entre grupos */}
                    {naoLidas.length > 0 && lidas.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg3)]/50">
                        <div className="flex-1 h-px bg-[var(--border)]" />
                        <span className="text-[9px] text-[var(--text3)] font-cinzel uppercase tracking-wider">Lidas</span>
                        <div className="flex-1 h-px bg-[var(--border)]" />
                      </div>
                    )}

                    {/* Lidas */}
                    {lidas.map(n => (
                      <div
                        key={n.id}
                        className="px-3 py-2.5 border-b border-[var(--border)]/30 hover:bg-[var(--bg3)]/50 transition-colors cursor-default opacity-55"
                        onClick={() => { if (n.link) window.location.href = n.link }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--border)] flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[var(--text2)] text-xs font-cinzel">{n.titulo}</p>
                            {n.mensagem && (
                              <p className="text-[var(--text3)] text-[10px] font-crimson mt-0.5 line-clamp-2">{n.mensagem}</p>
                            )}
                          </div>
                        </div>
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
              <span className="font-crimson hidden md:inline">{usuario.nome || usuario.email}</span>
              <ChevronDown className="w-3 h-3 hidden sm:inline" />
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg z-50 min-w-44">
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--text2)]">{usuario.nome || usuario.email}</p>
                  {usuario.username && (
                    <p className="text-xs text-[var(--gold)] font-cinzel">@{usuario.username}</p>
                  )}
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
                <InstalarApp />
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

      {/* Folha inferior: seletor de campanha (mobile) */}
      {seletorCampanhaAberto && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 md:hidden"
            onClick={() => setSeletorCampanhaAberto(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[61] md:hidden bg-[var(--surface)] border-t border-[var(--border)] rounded-t-xl shadow-2xl max-h-[70vh] overflow-y-auto safe-area-pb">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)]">
              <span className="font-cinzel text-xs text-[var(--text3)] uppercase tracking-wider">Campanha</span>
              <button onClick={() => setSeletorCampanhaAberto(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-1">
              {campanhasAtivas.length === 0 ? (
                <p className="text-center text-[var(--text3)] text-xs font-crimson py-4">Nenhuma campanha</p>
              ) : (
                campanhasAtivas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCampanhaAtiva(c); setSeletorCampanhaAberto(false) }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 text-left px-4 py-3 text-sm font-crimson transition-colors',
                      campanhaAtiva?.id === c.id ? 'text-[var(--gold)]' : 'text-[var(--text2)]'
                    )}
                  >
                    <span className="truncate">{c.nome}</span>
                    {campanhaAtiva?.id === c.id && <span className="text-xs flex-shrink-0">✓</span>}
                  </button>
                ))
              )}
              <Link
                href="/campanhas"
                onClick={() => setSeletorCampanhaAberto(false)}
                className="block px-4 py-3 text-sm font-cinzel text-[var(--accent)] border-t border-[var(--border)]"
              >
                + Nova campanha
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Folha inferior: sessão (mobile) */}
      {sessaoFolhaAberta && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 md:hidden"
            onClick={() => setSessaoFolhaAberta(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[61] md:hidden bg-[var(--surface)] border-t border-[var(--border)] rounded-t-xl shadow-2xl safe-area-pb">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-cinzel text-xs text-[var(--text3)] uppercase tracking-wider">Sessão</span>
              <button onClick={() => setSessaoFolhaAberta(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {sessaoCarregando ? (
                <p className="text-[var(--text3)] text-sm font-crimson text-center py-2">Carregando sessão...</p>
              ) : sessaoAtiva ? (
                <div className="space-y-3">
                  <p className="text-[var(--green2)] text-sm font-cinzel">
                    🟢 Sessão {sessaoAtiva.numero ?? '—'} · iniciada às{' '}
                    {sessaoAtiva.iniciada_em
                      ? new Date(sessaoAtiva.iniciada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                  <button
                    onClick={async () => { await handleEncerrarSessao(); setSessaoFolhaAberta(false) }}
                    disabled={encerrando}
                    className="w-full py-2.5 rounded-lg border border-[var(--red2)]/50 text-[var(--red2)] font-cinzel text-sm hover:bg-[var(--red2)]/10 transition-colors disabled:opacity-50"
                  >
                    {encerrando ? 'Encerrando...' : 'Encerrar sessão'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setSessaoFolhaAberta(false); abrirModalIniciar() }}
                  className="w-full py-2.5 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] font-cinzel text-sm hover:bg-[var(--gold)]/20 transition-colors"
                >
                  ▶️ Iniciar sessão
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {modalIniciarAberto && (
        <ModalIniciarSessao onConfirmar={confirmarIniciarSessao} onCancelar={fecharModalIniciar} />
      )}
    </header>
  )
}
