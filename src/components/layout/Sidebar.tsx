'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Swords, Users, BookOpen, Wand2, Package,
  Map, BookMarked, Bot, Settings, Shield,
  ChevronRight, Skull
} from 'lucide-react'

const itensNav = [
  { href: '/batalha',       icone: Swords,     label: 'Batalha',       cor: '#e74c3c' },
  { href: '/personagens',   icone: Users,       label: 'Personagens',   cor: '#3498db' },
  { href: '/bestiario',     icone: Skull,       label: 'Bestiário',     cor: '#9b59b6' },
  { href: '/magias',        icone: Wand2,       label: 'Magias',        cor: '#c39bd3' },
  { href: '/itens',         icone: Package,     label: 'Itens',         cor: '#d4a843' },
  { href: '/aventura',      icone: Map,         label: 'Aventura',      cor: '#27ae60' },
  { href: '/diario',        icone: BookMarked,  label: 'Diário',        cor: '#f39c12' },
  { href: '/ia',            icone: Bot,         label: 'Assistente IA', cor: '#1abc9c' },
  { href: '/configuracoes', icone: Settings,    label: 'Configurações', cor: '#95a5a6' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-[#150f18] border-r border-[#4a3060] flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-[#4a3060]">
        <div className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-[#d4a843]" />
          <div>
            <h1 className="font-cinzel text-[#d4a843] font-bold text-sm leading-none">Dungeon</h1>
            <h1 className="font-cinzel text-[#f0c060] font-bold text-sm leading-none">Desk</h1>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {itensNav.map(({ href, icone: Icone, label, cor }) => {
          const ativo = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded text-sm font-crimson transition-all duration-150 group',
                ativo
                  ? 'bg-[#261a2e] text-[#e8dff0] border-l-2'
                  : 'text-[#8870a8] hover:text-[#b8a8cc] hover:bg-[#1e1525]'
              )}
              style={{ borderLeftColor: ativo ? cor : 'transparent' }}
            >
              <Icone
                className="w-4 h-4 flex-shrink-0 transition-colors"
                style={{ color: ativo ? cor : undefined }}
              />
              <span>{label}</span>
              {ativo && <ChevronRight className="w-3 h-3 ml-auto text-[#4a3060]" />}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé */}
      <div className="p-3 border-t border-[#4a3060]">
        <div className="text-center">
          <p className="font-cinzel text-[10px] text-[#4a3060] tracking-widest uppercase">
            Dungeon Desk
          </p>
          <p className="text-[9px] text-[#4a3060] mt-0.5">v1.0</p>
        </div>
      </div>
    </aside>
  )
}
