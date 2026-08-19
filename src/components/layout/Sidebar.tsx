'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCampanha } from '@/store/campanha'
import { createClient } from '@/lib/supabase/client'
import type { Campanha, Sessao } from '@/types/database'
import type { Personagem } from '@/types/dnd'
import {
  Swords, Users, Wand2, Package,
  Map, BookMarked, Bot, Shield, Dices,
  ChevronRight, Skull, ChevronDown, Plus, X, ImageIcon, Compass, ShieldCheck, Scroll, Lock, Menu,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { planoSuficiente, getPlano, type PlanoId } from '@/lib/planos'
import { usePlanoEfetivo } from '@/hooks/usePlanoEfetivo'
import { useControleSessao } from '@/hooks/useControleSessao'
import { ModalIniciarSessao } from '@/components/campanha/ModalIniciarSessao'

type ItemNav = {
  href: string; icone: React.ElementType; label: string; cor: string
  dmOnly?: boolean; planoMinimo?: PlanoId
}

const itensNav: ItemNav[] = [
  { href: '/mesa',          icone: Dices,       label: 'Mesa',          cor: '#f39c12'                },
  { href: '/batalha',       icone: Swords,     label: 'Batalha',       cor: '#e74c3c', dmOnly: true  },
  { href: '/personagens',   icone: Users,       label: 'Personagens',   cor: '#3498db'                },
  { href: '/bestiario',     icone: Skull,       label: 'Bestiário',     cor: '#9b59b6', dmOnly: true  },
  { href: '/magias',        icone: Wand2,       label: 'Magias',        cor: '#c39bd3',                planoMinimo: 'solo'  },
  { href: '/itens',         icone: Package,     label: 'Itens',         cor: '#d4a843',                planoMinimo: 'solo'  },
  { href: '/aventura',      icone: Map,         label: 'Aventura',      cor: '#27ae60', dmOnly: true,  planoMinimo: 'solo'  },
  { href: '/diario',        icone: BookMarked,  label: 'Diário',        cor: '#f39c12',                planoMinimo: 'solo'  },
  { href: '/imagens',       icone: ImageIcon,   label: 'Imagens',       cor: '#e91e63',                planoMinimo: 'guild_master' },
  { href: '/mapas',         icone: Compass,     label: 'Mapas',         cor: '#00bcd4',                planoMinimo: 'guild_master' },
  { href: '/ia',            icone: Bot,         label: 'Assistente IA', cor: '#1abc9c', dmOnly: true,  planoMinimo: 'solo'  },
  { href: '/campanhas',     icone: Scroll,      label: 'Campanhas',     cor: '#d4a843'                },
]

export function Sidebar({ isAdmin, plano }: { isAdmin?: boolean; plano?: string }) {
  const pathname = usePathname()
  const {
    campanhaAtiva, campanhas, setCampanhaAtiva, setCampanhas, carregarCampanhas, papelPorCampanha,
    carregarSessaoAtiva, carregarFog,
  } = useCampanha()
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [modalNova, setModalNova] = useState(false)
  const [modalPresencaAberto, setModalPresencaAberto] = useState(false)
  const [nomeCampanha, setNomeCampanha] = useState('')
  const [criando, setCriando] = useState(false)
  const [minimizada, setMinimizada] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarCampanhas() }, [])

  // Ponto único de carga da sessão ativa — Sidebar é montado por todo o
  // layout do dashboard (DM e jogador, /batalha e /mesa), então qualquer
  // tela que leia sessaoAtiva do store já a encontra carregada, sem
  // precisar de um useEffect próprio (e sem risco de esquecer de adicionar
  // um em uma tela nova). Dispara de novo sempre que a campanha ativa muda.
  useEffect(() => {
    if (!campanhaAtiva?.id) return
    carregarSessaoAtiva(campanhaAtiva.id)
    carregarFog(campanhaAtiva.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaAtiva?.id])

  useEffect(() => {
    const salvo = localStorage.getItem('sidebar-minimizada')
    if (salvo === 'true') setMinimizada(true)
  }, [])

  function toggleMinimizar() {
    const novo = !minimizada
    setMinimizada(novo)
    localStorage.setItem('sidebar-minimizada', String(novo))
  }

  async function criarCampanha() {
    if (!nomeCampanha.trim()) return
    setCriando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.from('campanhas').insert({
        dm_id: user.id,
        nome: nomeCampanha.trim(),
        sistema: 'D&D 5e',
        ativa: true,
      }).select().single()

      if (error) throw error

      const nova = data as Campanha
      setCampanhas([nova, ...campanhas])
      setCampanhaAtiva(nova)
      setModalNova(false)
      setNomeCampanha('')
      toast.success(`Campanha "${nova.nome}" criada!`)
      await carregarCampanhas()
    } catch {
      toast.error('Erro ao criar campanha')
    } finally {
      setCriando(false)
    }
  }

  const planoEfetivo = usePlanoEfetivo()
  const campanhasAtivas = campanhas.filter(c => c.ativa !== false)
  const ehJogador = campanhaAtiva
    ? papelPorCampanha[campanhaAtiva.id] === 'jogador'
    : false
  const ehDM = campanhaAtiva ? papelPorCampanha[campanhaAtiva.id] === 'dm' : false
  const itensVisiveis = itensNav.filter(item => !item.dmOnly || !ehJogador)

  const {
    sessaoAtiva, sessaoCarregando, encerrando,
    modalIniciarAberto, abrirModalIniciar, fecharModalIniciar,
    confirmarIniciarSessao, handleEncerrarSessao,
  } = useControleSessao()

  return (
    <>
      <aside className={cn(
        "hidden md:flex bg-[var(--bg2)] border-r border-[var(--border)] flex-col min-h-screen",
        "transition-all duration-200 overflow-hidden flex-shrink-0",
        minimizada ? "w-14" : "w-[220px]"
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-[var(--gold)] flex-shrink-0" />
            {!minimizada && (
              <div>
                <h1 className="font-cinzel text-[var(--gold)] font-bold text-sm leading-none">Dungeon</h1>
                <h1 className="font-cinzel text-[var(--gold2)] font-bold text-sm leading-none">Desk</h1>
              </div>
            )}
          </div>
        </div>

        {/* Campanha + botão minimizar */}
        <div className="border-b border-[var(--border)]">
          <div className="flex items-center justify-between px-3 py-2">
            {!minimizada && (
              <span className="font-cinzel text-[var(--text3)] text-[10px] uppercase tracking-wider">
                Campanha
              </span>
            )}
            <button
              onClick={toggleMinimizar}
              className="ml-auto p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors text-sm leading-none"
              title={minimizada ? 'Expandir menu' : 'Minimizar menu'}
            >
              {minimizada ? '→' : '←'}
            </button>
          </div>

          {!minimizada && (
            <div className="px-2 pb-2">
              <div className="relative">
                <button
                  onClick={() => setDropdownAberto(!dropdownAberto)}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-[var(--bg3)] border border-[var(--border)] rounded text-sm text-left hover:border-[var(--border2)] transition-colors"
                >
                  <span className={cn('font-crimson truncate', campanhaAtiva ? 'text-[var(--gold)]' : 'text-[var(--border)]')}>
                    {campanhaAtiva?.nome ?? 'Sem campanha'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--border)] flex-shrink-0 ml-1" />
                </button>

                {dropdownAberto && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl">
                    {campanhasAtivas.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCampanhaAtiva(c); setDropdownAberto(false) }}
                        className={cn(
                          'w-full text-left px-2 py-1.5 text-sm font-crimson transition-colors hover:bg-[var(--bg3)]',
                          campanhaAtiva?.id === c.id ? 'text-[var(--gold)]' : 'text-[var(--text2)]'
                        )}
                      >
                        {c.nome}
                        {campanhaAtiva?.id === c.id && <span className="ml-1 text-[9px]">✓</span>}
                        {papelPorCampanha[c.id] === 'jogador' && (
                          <span className="ml-1 text-[9px] text-[var(--accent2)]">(jogador)</span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => { setModalNova(true); setDropdownAberto(false) }}
                      className="w-full text-left px-2 py-1.5 text-sm font-cinzel text-[var(--accent)] hover:bg-[var(--bg3)] transition-colors border-t border-[var(--border)] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Nova campanha
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controle de sessão — estado da campanha (Fase 3.5), não da
            batalha. Só o DM da campanha ativa vê; o jogador só sente o
            efeito (a /mesa habilitando). */}
        {ehDM && (
          <div className="border-b border-[var(--border)] px-2 py-2">
            {minimizada ? (
              <button
                onClick={sessaoAtiva ? handleEncerrarSessao : abrirModalIniciar}
                disabled={sessaoCarregando || encerrando}
                title={sessaoAtiva ? `Sessão ${sessaoAtiva.numero ?? ''} ativa — clique para encerrar` : 'Iniciar sessão'}
                className="w-full flex items-center justify-center py-1.5 rounded hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
              >
                <span className="text-sm">{sessaoAtiva ? '🟢' : '▶️'}</span>
              </button>
            ) : sessaoCarregando ? (
              <p className="text-[var(--text3)] text-[10px] font-cinzel text-center py-1">Carregando sessão...</p>
            ) : sessaoAtiva ? (
              <div className="space-y-1">
                <p className="text-[var(--green2)] text-[10px] font-cinzel truncate" title={sessaoAtiva.iniciada_em ?? undefined}>
                  🟢 Sessão {sessaoAtiva.numero ?? '—'} ·{' '}
                  {sessaoAtiva.iniciada_em
                    ? new Date(sessaoAtiva.iniciada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </p>
                <button
                  onClick={() => setModalPresencaAberto(true)}
                  className="w-full text-[10px] font-cinzel py-1 rounded border border-[var(--border)] text-[var(--text3)] hover:border-[var(--border2)] hover:text-[var(--text2)] transition-colors"
                >
                  👥 Presença
                </button>
                <button
                  onClick={handleEncerrarSessao}
                  disabled={encerrando}
                  className="w-full text-[10px] font-cinzel py-1 rounded border border-[var(--red2)]/50 text-[var(--red2)] hover:bg-[var(--red2)]/10 transition-colors disabled:opacity-50"
                >
                  {encerrando ? 'Encerrando...' : 'Encerrar sessão'}
                </button>
              </div>
            ) : (
              <button
                onClick={abrirModalIniciar}
                className="w-full text-xs font-cinzel py-1.5 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition-colors"
              >
                ▶️ Iniciar sessão
              </button>
            )}
          </div>
        )}

        {/* Navegação */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {itensVisiveis.map(({ href, icone: Icone, label, cor, planoMinimo }) => {
            const ativo = pathname === href || pathname.startsWith(href + '/')
            const bloqueado = !!planoMinimo && !planoSuficiente(planoEfetivo, planoMinimo)
            if (bloqueado) {
              return (
                <div
                  key={href}
                  title={minimizada ? label : `Disponível no plano ${planoMinimo ? getPlano(planoMinimo).nome : ''} ou superior`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-base font-crimson opacity-40 cursor-not-allowed select-none",
                    minimizada && "justify-center"
                  )}
                >
                  <Icone className="w-4 h-4 flex-shrink-0 text-[var(--text3)]" />
                  {!minimizada && (
                    <>
                      <span className="text-[var(--text3)]">{label}</span>
                      <Lock className="w-3 h-3 ml-auto text-[var(--text3)]" />
                    </>
                  )}
                </div>
              )
            }
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDropdownAberto(false)}
                title={minimizada ? label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded text-base font-crimson transition-all duration-150 group',
                  minimizada && 'justify-center',
                  ativo
                    ? 'bg-[var(--surface)] text-[var(--text)] border-l-2'
                    : 'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--bg3)]'
                )}
                style={{ borderLeftColor: ativo ? cor : 'transparent' }}
              >
                <Icone
                  className="w-4 h-4 flex-shrink-0 transition-colors"
                  style={{ color: ativo ? cor : undefined }}
                />
                {!minimizada && (
                  <>
                    <span>{label}</span>
                    {ativo && <ChevronRight className="w-3 h-3 ml-auto text-[var(--border)]" />}
                  </>
                )}
              </Link>
            )
          })}
          {isAdmin && (() => {
            const ativo = pathname === '/admin' || pathname.startsWith('/admin/')
            const cor = '#d4a843'
            return (
              <Link
                href="/admin"
                onClick={() => setDropdownAberto(false)}
                title={minimizada ? 'Admin' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded text-base font-crimson transition-all duration-150',
                  minimizada && 'justify-center',
                  ativo
                    ? 'bg-[var(--surface)] text-[var(--text)] border-l-2'
                    : 'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--bg3)]'
                )}
                style={{ borderLeftColor: ativo ? cor : 'transparent' }}
              >
                <ShieldCheck
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: ativo ? cor : undefined }}
                />
                {!minimizada && (
                  <>
                    <span>Admin</span>
                    {ativo && <ChevronRight className="w-3 h-3 ml-auto text-[var(--border)]" />}
                  </>
                )}
              </Link>
            )
          })()}
        </nav>

        {/* Rodapé */}
        <div className="p-3 border-t border-[var(--border)] space-y-1">
          <Link
            href="/feedback"
            onClick={() => setDropdownAberto(false)}
            title={minimizada ? 'Feedback' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-crimson transition-colors w-full',
              minimizada && 'justify-center',
              pathname === '/feedback'
                ? 'bg-[var(--surface)] text-[var(--text)]'
                : 'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--bg3)]'
            )}
          >
            <span>💬</span>
            {!minimizada && <span>Feedback & Sugestões</span>}
          </Link>
          {isAdmin && (
            <Link
              href="/admin/feedbacks"
              onClick={() => setDropdownAberto(false)}
              title={minimizada ? 'Feedbacks Admin' : undefined}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-crimson transition-colors w-full',
                minimizada && 'justify-center',
                pathname === '/admin/feedbacks'
                  ? 'bg-[var(--surface)] text-[var(--text)]'
                  : 'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--bg3)]'
              )}
            >
              <span>📋</span>
              {!minimizada && <span>Feedbacks Admin</span>}
            </Link>
          )}
          {!minimizada && (
            <div className="text-center pt-1">
              <p className="font-cinzel text-xs text-[var(--border)] tracking-widest uppercase">Dungeon Desk</p>
              <p className="text-xs text-[var(--border)] mt-0.5">v1.0</p>
            </div>
          )}
        </div>
      </aside>

      {/* Modal nova campanha */}
      {modalNova && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg p-6 w-80 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-cinzel text-[var(--gold)] font-bold">Nova Campanha</h2>
              <button onClick={() => setModalNova(false)} className="text-[var(--border)] hover:text-[var(--red2)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nome da Campanha</label>
                <input
                  type="text"
                  value={nomeCampanha}
                  onChange={e => setNomeCampanha(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && criarCampanha()}
                  placeholder="A Maldição de Strahd..."
                  className="w-full input-dd mt-1"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={() => setModalNova(false)}
                  className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarCampanha}
                  disabled={!nomeCampanha.trim() || criando}
                  className="px-3 py-1.5 text-xs font-cinzel text-[var(--gold)] bg-[var(--surface)] border border-[#d4a843]/50 rounded hover:bg-[#d4a843]/10 transition-colors disabled:opacity-50"
                >
                  {criando ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalIniciarAberto && (
        <ModalIniciarSessao onConfirmar={confirmarIniciarSessao} onCancelar={fecharModalIniciar} />
      )}

      {modalPresencaAberto && campanhaAtiva && sessaoAtiva && (
        <ModalPresenca
          campanhaId={campanhaAtiva.id}
          sessao={sessaoAtiva}
          onFechar={() => setModalPresencaAberto(false)}
        />
      )}
    </>
  )
}

// 👥 Presença — quem do grupo está na mesa hoje. Guardado direto em
// sessoes.personagens_presentes (array de ids; null = todos presentes,
// estado inicial e compatível com sessões antigas) em vez de reaproveitar o
// fluxo "Carregar Personagens" da batalha: aquele cria linhas em
// batalha_combatentes (PV snapshot, iniciativa etc.) para uma tabela de
// instância que a sessão não tem nem precisa — presença fora de combate é
// só uma lista de ids, sem estado adicional por personagem.
function ModalPresenca({
  campanhaId, sessao, onFechar,
}: {
  campanhaId: string
  sessao: Sessao
  onFechar: () => void
}) {
  const setSessaoAtiva = useCampanha(s => s.setSessaoAtiva)
  const [personagens, setPersonagens] = useState<Personagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let cancelado = false
    createClient()
      .from('personagens')
      .select('*')
      .eq('campanha_id', campanhaId)
      .eq('tipo_personagem', 'jogador')
      .eq('ativo', true)
      .then(({ data }) => {
        if (cancelado) return
        const lista = (data as Personagem[]) ?? []
        setPersonagens(lista)
        setSelecionados(new Set(
          sessao.personagens_presentes ?? lista.map(p => p.id)
        ))
        setCarregando(false)
      })
    return () => { cancelado = true }
  }, [campanhaId, sessao.personagens_presentes])

  function toggle(id: string) {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  async function salvar() {
    setSalvando(true)
    const lista = Array.from(selecionados)
    const { error } = await createClient()
      .from('sessoes')
      .update({ personagens_presentes: lista })
      .eq('id', sessao.id)
    setSalvando(false)
    if (error) {
      toast.error('Erro ao salvar presença')
      return
    }
    setSessaoAtiva({ ...sessao, personagens_presentes: lista })
    toast.success('Presença atualizada!')
    onFechar()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onFechar}>
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg p-4 w-80 max-h-[70vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-cinzel text-[var(--gold)] font-bold text-sm">👥 Presença na sessão</h2>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {carregando ? (
          <p className="text-[var(--text3)] text-xs font-crimson text-center py-6">Carregando...</p>
        ) : personagens.length === 0 ? (
          <p className="text-[var(--text3)] text-xs font-crimson text-center py-6">Nenhum jogador na campanha</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1">
            {personagens.map(p => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-[var(--surface)] transition-colors">
                <input
                  type="checkbox"
                  checked={selecionados.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="w-4 h-4 accent-[var(--gold)]"
                />
                <span className="text-[var(--text2)] text-sm font-crimson truncate">{p.nome}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-[var(--border)]">
          <button
            onClick={onFechar}
            className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={carregando || salvando}
            className="px-3 py-1.5 text-xs font-cinzel text-[var(--gold)] bg-[var(--surface)] border border-[#d4a843]/50 rounded hover:bg-[#d4a843]/10 transition-colors disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar presença'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Destinos mais usados na barra fixa; o resto vai para a folha "Mais".
const HREFS_PRIMARIOS_DM = ['/mesa', '/batalha', '/personagens', '/bestiario', '/magias']
const HREFS_PRIMARIOS_JOGADOR = ['/mesa', '/personagens', '/magias', '/itens', '/diario']

export function BottomNav({ isAdmin }: { isAdmin?: boolean; plano?: string }) {
  const pathname = usePathname()
  const { campanhaAtiva, papelPorCampanha } = useCampanha()
  const planoEfetivo = usePlanoEfetivo()
  const [maisAberto, setMaisAberto] = useState(false)

  const ehJogador = campanhaAtiva
    ? papelPorCampanha[campanhaAtiva.id] === 'jogador'
    : false

  const itensVisiveis = itensNav.filter(item => !item.dmOnly || !ehJogador)
  const hrefsPrimarios = ehJogador ? HREFS_PRIMARIOS_JOGADOR : HREFS_PRIMARIOS_DM
  const itensPrimarios = hrefsPrimarios
    .map(href => itensVisiveis.find(item => item.href === href))
    .filter((item): item is ItemNav => !!item)
  const itensSecundarios = itensVisiveis.filter(item => !hrefsPrimarios.includes(item.href))

  function fechar() { setMaisAberto(false) }

  function renderItemCompacto(item: ItemNav) {
    const ativo = pathname === item.href || pathname.startsWith(item.href + '/')
    const bloqueado = !!item.planoMinimo && !planoSuficiente(planoEfetivo, item.planoMinimo)
    const Icone = item.icone
    if (bloqueado) {
      return (
        <div key={item.href} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-0 opacity-40">
          <Icone size={20} />
          <span className="text-[10px] font-medium truncate">{item.label}</span>
        </div>
      )
    }
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0',
          ativo ? 'text-[var(--dd-gold)]' : 'text-[var(--dd-text3)] hover:text-[var(--dd-text2)]'
        )}
      >
        <Icone size={20} />
        <span className="text-[10px] font-medium truncate">{item.label}</span>
      </Link>
    )
  }

  function renderItemLista(item: ItemNav) {
    const ativo = pathname === item.href || pathname.startsWith(item.href + '/')
    const bloqueado = !!item.planoMinimo && !planoSuficiente(planoEfetivo, item.planoMinimo)
    const Icone = item.icone
    if (bloqueado) {
      return (
        <div key={item.href} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-crimson opacity-40">
          <Icone className="w-4 h-4 flex-shrink-0" />
          <span>{item.label}</span>
          <Lock className="w-3 h-3 ml-auto" />
        </div>
      )
    }
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={fechar}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-crimson transition-colors',
          ativo ? 'text-[var(--dd-gold)]' : 'text-[var(--dd-text3)] hover:text-[var(--dd-text2)]'
        )}
      >
        <Icone className="w-4 h-4 flex-shrink-0" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50
                      bg-[var(--bg2)] border-t border-[var(--border)]
                      flex items-center justify-around px-1 py-1 safe-area-pb">
        {itensPrimarios.map(renderItemCompacto)}
        <button
          onClick={() => setMaisAberto(true)}
          className={cn(
            'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0',
            maisAberto ? 'text-[var(--dd-gold)]' : 'text-[var(--dd-text3)] hover:text-[var(--dd-text2)]'
          )}
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>

      {maisAberto && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60 md:hidden" onClick={fechar} />
          <div className="fixed inset-x-0 bottom-0 z-[61] md:hidden bg-[var(--surface)] border-t border-[var(--border)] rounded-t-xl shadow-2xl max-h-[75vh] overflow-y-auto safe-area-pb">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)]">
              <span className="font-cinzel text-xs text-[var(--text3)] uppercase tracking-wider">Mais opções</span>
              <button onClick={fechar} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 space-y-0.5">
              {itensSecundarios.map(renderItemLista)}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={fechar}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-crimson text-[var(--dd-text3)] hover:text-[var(--dd-text2)] transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                href="/feedback"
                onClick={fechar}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-crimson text-[var(--dd-text3)] hover:text-[var(--dd-text2)] transition-colors"
              >
                <span>💬</span>
                <span>Feedback & Sugestões</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
