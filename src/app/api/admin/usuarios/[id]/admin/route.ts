import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verificarAdmin } from '@/lib/admin/verificar-admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const isAdmin = await verificarAdmin(user.id)
  if (!isAdmin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const novoValor: boolean = body.is_admin

  // Prevent self-demotion
  if (id === user.id && novoValor === false) {
    return NextResponse.json({ erro: 'Você não pode remover sua própria permissão de admin' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: novoValor })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
