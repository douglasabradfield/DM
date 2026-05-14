import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const titulos: Record<string, string> = {
  '/batalha': 'Tracker de Batalha',
  '/personagens': 'Personagens',
  '/bestiario': 'Bestiário',
  '/magias': 'Magias',
  '/itens': 'Itens & Armas',
  '/aventura': 'Aventura',
  '/diario': 'Diário de Campanha',
  '/ia': 'Assistente IA',
  '/configuracoes': 'Configurações',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0a0e]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          titulo="Dungeon Desk"
          usuario={profile ? { nome: profile.nome, email: profile.email } : { nome: null, email: user.email ?? '' }}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
