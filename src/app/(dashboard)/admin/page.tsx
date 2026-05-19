import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verificarAdmin } from '@/lib/admin/verificar-admin'
import { PainelAdmin } from '@/components/admin/PainelAdmin'

export interface UsuarioAdmin {
  id: string
  email: string
  nome: string | null
  username: string | null
  plano: 'free' | 'heroi' | 'solo' | 'mesa_pro' | 'guild_master' | 'dm_supremo'
  is_admin: boolean
  criado_em: string
  assinatura_status: string | null
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await verificarAdmin(user.id)
  if (!isAdmin) redirect('/')

  // Fetch all profiles + most recent assinatura per user
  const admin = createAdminClient()

  const [perfisRes, assinaturasRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, nome, username, plano, is_admin, criado_em')
      .order('criado_em', { ascending: false }),
    admin
      .from('assinaturas')
      .select('user_id, status')
      .order('criado_em', { ascending: false }),
  ])

  const perfis = (perfisRes.data ?? []) as UsuarioAdmin[]
  const assinaturas = assinaturasRes.data ?? []

  const assinaturaPorUsuario = new Map<string, string>()
  for (const a of assinaturas) {
    if (!assinaturaPorUsuario.has(a.user_id)) {
      assinaturaPorUsuario.set(a.user_id, a.status)
    }
  }

  const usuarios: UsuarioAdmin[] = perfis.map(p => ({
    ...p,
    assinatura_status: assinaturaPorUsuario.get(p.id) ?? null,
  }))

  return <PainelAdmin usuarios={usuarios} adminAtualId={user.id} />
}
