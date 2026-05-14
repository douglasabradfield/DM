import Link from 'next/link'
import { Shield, Swords, Users, Bot, BookOpen, Star } from 'lucide-react'
import { PLANOS, formatarPreco } from '@/lib/stripe/produtos'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d0a0e] text-[#e8dff0]">
      {/* Navbar */}
      <nav className="border-b border-[#4a3060] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-[#d4a843]" />
          <span className="font-cinzel text-[#d4a843] font-bold text-lg">Dungeon Desk</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[#b8a8cc] hover:text-[#e8dff0] text-sm font-crimson transition-colors">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="px-4 py-1.5 bg-[#d4a843] border border-[#f0c060] text-[#0d0a0e] rounded text-sm font-cinzel font-semibold hover:bg-[#f0c060] transition-colors"
          >
            Começar Grátis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#9b59b6]/5 via-transparent to-transparent" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d4a843]/10 border border-[#d4a843]/30 rounded-full text-[#d4a843] text-xs font-cinzel mb-6">
            ✦ Plataforma para Dungeon Masters ✦
          </div>
          <h1 className="font-cinzel text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-[#d4a843]">Sua mesa,</span>
            <br />
            <span className="text-[#e8dff0]">seu mundo,</span>
            <br />
            <span className="text-[#c39bd3]">sua aventura.</span>
          </h1>
          <p className="font-crimson text-xl text-[#b8a8cc] mb-8 max-w-2xl mx-auto leading-relaxed">
            O Dungeon Desk é a plataforma definitiva para Dungeon Masters de D&D 5e.
            Gerencie batalhas em tempo real, personagens, aventuras e conte com IA para tornar cada sessão épica.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cadastro"
              className="px-8 py-3 bg-[#d4a843] border border-[#f0c060] text-[#0d0a0e] rounded font-cinzel font-bold text-base hover:bg-[#f0c060] hover:shadow-[0_0_20px_rgba(212,168,67,0.4)] transition-all"
            >
              ✦ Criar Conta Gratuita
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 border border-[#4a3060] text-[#b8a8cc] rounded font-cinzel text-base hover:border-[#6b4890] hover:text-[#e8dff0] transition-all"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Divisor ornamentado */}
      <div className="flex items-center gap-3 px-6 my-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#4a3060]" />
        <span className="text-[#d4a843] text-xs">✦ ✦ ✦</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#4a3060]" />
      </div>

      {/* Funcionalidades */}
      <section className="px-6 py-12">
        <h2 className="font-cinzel text-center text-2xl text-[#d4a843] font-bold mb-10">
          Tudo que um DM precisa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {[
            {
              icone: Swords,
              titulo: 'Tracker de Batalha',
              descricao: 'Acompanhe iniciativa, PV, condições e espaços de magia em tempo real. Com cálculo automático de resistências e log completo.',
              cor: '#e74c3c',
            },
            {
              icone: Users,
              titulo: 'Fichas Digitais',
              descricao: 'Fichas completas de personagem com cálculo automático de modificadores, perícias e salvaguardas. Compatible com D&D Beyond.',
              cor: '#3498db',
            },
            {
              icone: BookOpen,
              titulo: 'Bestiário Completo',
              descricao: 'Acesso a todos os monstros do Manual dos Monstros em português. Adicione qualquer criatura à batalha com um clique.',
              cor: '#9b59b6',
            },
            {
              icone: Bot,
              titulo: 'Assistente IA',
              descricao: 'Claude IA integrado para improvisar NPCs, descrever locais, sugerir encontros e responder qualquer dúvida sobre regras em português.',
              cor: '#1abc9c',
            },
            {
              icone: BookOpen,
              titulo: 'Aventuras & Locais',
              descricao: 'Faça upload de aventuras em PDF (inglês ou português). A IA traduz, estrutura e organiza todos os locais e NPCs automaticamente.',
              cor: '#27ae60',
            },
            {
              icone: Star,
              titulo: 'Dados Virtuais',
              descricao: 'Todos os dados de d4 a d100. Com histórico, expressões complexas (2d6+3) e animações épicas para acertos críticos.',
              cor: '#d4a843',
            },
          ].map(({ icone: Icone, titulo, descricao, cor }) => (
            <div
              key={titulo}
              className="bg-[#150f18] border border-[#4a3060] rounded-lg p-5 hover:border-[#6b4890] transition-all group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${cor}20`, border: `1px solid ${cor}40` }}>
                <Icone className="w-5 h-5" style={{ color: cor }} />
              </div>
              <h3 className="font-cinzel text-[#e8dff0] font-semibold mb-2">{titulo}</h3>
              <p className="font-crimson text-[#8870a8] text-sm leading-relaxed">{descricao}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divisor */}
      <div className="flex items-center gap-3 px-6 my-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#4a3060]" />
        <span className="text-[#d4a843] text-xs">✦ ✦ ✦</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#4a3060]" />
      </div>

      {/* Preços */}
      <section className="px-6 py-12">
        <h2 className="font-cinzel text-center text-2xl text-[#d4a843] font-bold mb-2">Planos</h2>
        <p className="font-crimson text-center text-[#8870a8] mb-10">Comece grátis, evolua quando precisar</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {PLANOS.map(plano => (
            <div
              key={plano.id}
              className={`relative bg-[#150f18] border rounded-lg p-5 ${plano.destaque ? 'border-[#d4a843]' : 'border-[#4a3060]'}`}
            >
              {plano.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#d4a843] text-[#0d0a0e] text-xs font-cinzel font-bold rounded-full">
                  MAIS POPULAR
                </div>
              )}
              <h3 className="font-cinzel text-[#e8dff0] font-bold mb-1">{plano.nome}</h3>
              <div className="mb-3">
                <span className="font-cinzel text-2xl font-bold text-[#d4a843]">{formatarPreco(plano.preco)}</span>
                <span className="text-[#8870a8] text-xs">{plano.periodo}</span>
              </div>
              <ul className="space-y-1 mb-4">
                {plano.recursos.map(r => (
                  <li key={r} className="flex items-start gap-1.5 text-xs text-[#b8a8cc] font-crimson">
                    <span className="text-[#27ae60] mt-0.5 flex-shrink-0">✓</span>
                    {r}
                  </li>
                ))}
              </ul>
              <Link
                href="/cadastro"
                className={`block text-center py-2 rounded text-sm font-cinzel transition-all ${
                  plano.destaque
                    ? 'bg-[#d4a843] text-[#0d0a0e] hover:bg-[#f0c060]'
                    : 'border border-[#4a3060] text-[#b8a8cc] hover:border-[#6b4890]'
                }`}
              >
                {plano.preco === 0 ? 'Começar Grátis' : 'Assinar'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#4a3060] px-6 py-8 mt-8">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#d4a843]" />
            <span className="font-cinzel text-[#d4a843] font-semibold">Dungeon Desk</span>
          </div>
          <p className="font-crimson text-[#4a3060] text-sm">
            Sua mesa, seu mundo, sua aventura. ✦ {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}
