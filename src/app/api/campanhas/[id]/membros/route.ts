import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campanhaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const { data: campanha } = await supabase
    .from('campanhas')
    .select('dm_id')
    .eq('id', campanhaId)
    .single()

  if (!campanha || campanha.dm_id !== user.id) {
    return Response.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: membros } = await admin
    .from('campaign_members')
    .select('*, profiles(email, nome, avatar_url)')
    .eq('campanha_id', campanhaId)
    .order('joined_at')

  const { data: convites } = await admin
    .from('campaign_invites')
    .select('*')
    .eq('campanha_id', campanhaId)
    .eq('usado', false)
    .gt('expires_at', new Date().toISOString())
    .order('criado_em', { ascending: false })

  return Response.json({ membros: membros ?? [], convites: convites ?? [] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campanhaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const { data: campanha } = await supabase
    .from('campanhas')
    .select('dm_id')
    .eq('id', campanhaId)
    .single()

  if (!campanha || campanha.dm_id !== user.id) {
    return Response.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) return Response.json({ erro: 'user_id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('campaign_members')
    .delete()
    .eq('campanha_id', campanhaId)
    .eq('user_id', userId)

  if (error) return Response.json({ erro: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
