import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verificarAdmin } from '@/lib/admin/verificar-admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const isAdmin = await verificarAdmin(user.id)
  if (!isAdmin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const admin = createAdminClient()

  const [perfisRes, assinaturasRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, nome, plano, is_admin, criado_em')
      .order('criado_em', { ascending: false }),
    admin
      .from('assinaturas')
      .select('user_id, status, plano, criado_em')
      .order('criado_em', { ascending: false }),
  ])

  const perfis = perfisRes.data ?? []
  const assinaturas = assinaturasRes.data ?? []

  // Keep only the most recent assinatura per user
  const assinaturaPorUsuario = new Map<string, { status: string; plano: string }>()
  for (const a of assinaturas) {
    if (!assinaturaPorUsuario.has(a.user_id)) {
      assinaturaPorUsuario.set(a.user_id, { status: a.status, plano: a.plano })
    }
  }

  const usuarios = perfis.map(p => ({
    ...p,
    assinatura_status: assinaturaPorUsuario.get(p.id)?.status ?? null,
  }))

  return NextResponse.json({ usuarios })
}
