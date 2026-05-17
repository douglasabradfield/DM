'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCampanha } from '@/store/campanha'
import { createClient } from '@/lib/supabase/client'
import type { Campanha } from '@/types/database'
import {
  Swords, Users, Wand2, Package,
  Map, BookMarked, Bot, Shield,
  ChevronRight, Skull, ChevronDown, Plus, X, ImageIcon, Compass, ShieldCheck, Scroll,
} from 'lucide-react'
import toast from 'react-hot-toast'

const itensNav = [
  { href: '/batalha',       icone: Swords,     label: 'Batalha',       cor: '#e74c3c', dmOnly: true  },
  { href: '/personagens',   icone: Users,       label: 'Personagens',   cor: '#3498db'                },
  { href: '/bestiario',     icone: Skull,       label: 'Bestiário',     cor: '#9b59b6', dmOnly: true  },
  { href: '/magias',        icone: Wand2,       label: 'Magias',        cor: '#c39bd3'                },
  { href: '/itens',         icone: Package,     label: 'Itens',         cor: '#d4a843'                },
  { href: '/aventura',      icone: Map,         label: 'Aventura',      cor: '#27ae60', dmOnly: true  },
  { href: '/diario',        icone: BookMarked,  label: 'Diário',        cor: '#f39c12'                },
  { href: '/imagens',       icone: ImageIcon,   label: 'Imagens',       cor: '#e91e63'                },
  { href: '/mapas',         icone: Compass,     label: 'Mapas',         cor: '#00bcd4'                },
  { href: '/ia',            icone: Bot,         label: 'Assistente IA', cor: '#1abc9c', dmOnly: true  },
  { href: '/campanhas',     icone: Scroll,      label: 'Campanhas',     cor: '#d4a843'                },
]

export function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const { campanhaAtiva, campanhas, setCampanhaAtiva, setCampanhas, carregarCampanhas, papelPorCampanha } = useCampanha()
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [modalNova, setModalNova] = useState(false)
  const [nomeCampanha, setNomeCampanha] = useState('')
  const [criando, setCriando] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarCampanhas() }, [])

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

  const campanhasAtivas = campanhas.filter(c => c.ativa !== false)
  const ehJogador = papelPorCampanha[campanhaAtiva?.id ?? ''] === 'jogador'
  const itensVisiveis = itensNav.filter(item => !item.dmOnly || !ehJogador)

  return (
    <>
      <aside className="hidden md:flex w-56 bg-[var(--bg2)] border-r border-[var(--border)] flex-col min-h-screen">
        {/* Logo */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-[var(--gold)]" />
            <div>
              <h1 className="font-cinzel text-[var(--gold)] font-bold text-sm leading-none">Dungeon</h1>
              <h1 className="font-cinzel text-[var(--gold2)] font-bold text-sm leading-none">Desk</h1>
            </div>
          </div>
        </div>

        {/* Seletor de Campanha */}
        <div className="p-2 border-b border-[var(--border)]">
          <p className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wider mb-1 px-1">Campanha</p>
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
                {!ehJogador && (
                  <button
                    onClick={() => { setModalNova(true); setDropdownAberto(false) }}
                    className="w-full text-left px-2 py-1.5 text-sm font-cinzel text-[var(--accent)] hover:bg-[var(--bg3)] transition-colors border-t border-[var(--border)] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Nova campanha
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {itensVisiveis.map(({ href, icone: Icone, label, cor }) => {
            const ativo = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDropdownAberto(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded text-base font-crimson transition-all duration-150 group',
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
                <span>{label}</span>
                {ativo && <ChevronRight className="w-3 h-3 ml-auto text-[var(--border)]" />}
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
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded text-base font-crimson transition-all duration-150',
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
                <span>Admin</span>
                {ativo && <ChevronRight className="w-3 h-3 ml-auto text-[var(--border)]" />}
              </Link>
            )
          })()}
        </nav>

        {/* Rodapé */}
        <div className="p-3 border-t border-[var(--border)]">
          <div className="text-center">
            <p className="font-cinzel text-xs text-[var(--border)] tracking-widest uppercase">Dungeon Desk</p>
            <p className="text-xs text-[var(--border)] mt-0.5">v1.0</p>
          </div>
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
    </>
  )
}

export function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const { campanhaAtiva, papelPorCampanha } = useCampanha()

  const ehJogador = papelPorCampanha[campanhaAtiva?.id ?? ''] === 'jogador'

  const itensDm = [
    { href: '/batalha',     icone: Swords,      label: 'Batalha'  },
    { href: '/personagens', icone: Users,        label: 'Persona.' },
    { href: '/bestiario',   icone: Skull,        label: 'Bestia.'  },
    { href: '/magias',      icone: Wand2,        label: 'Magias'   },
    { href: '/aventura',    icone: Map,          label: 'Aventura' },
  ]

  const itensJogador = [
    { href: '/personagens', icone: Users,        label: 'Persona.' },
    { href: '/magias',      icone: Wand2,        label: 'Magias'   },
    { href: '/itens',       icone: Package,      label: 'Itens'    },
    { href: '/diario',      icone: BookMarked,   label: 'Diário'   },
    { href: '/imagens',     icone: ImageIcon,    label: 'Imagens'  },
  ]

  const itensPrincipais = ehJogador ? itensJogador : itensDm

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50
                    bg-[var(--bg2)] border-t border-[var(--border)]
                    flex items-center justify-around px-2 py-1 safe-area-pb">
      {itensPrincipais.map(item => {
        const ativo = pathname === item.href || pathname.startsWith(item.href + '/')
        const Icone = item.icone
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0',
              ativo
                ? 'text-[var(--dd-gold)]'
                : 'text-[var(--dd-text3)] hover:text-[var(--dd-text2)]'
            )}
          >
            <Icone size={20} />
            <span className="text-[10px] font-medium truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
