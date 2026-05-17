import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campanhaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const { data: campanha } = await supabase
    .from('campanhas')
    .select('dm_id, link_token')
    .eq('id', campanhaId)
    .single()

  if (!campanha || campanha.dm_id !== user.id) {
    return Response.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  const token = campanha.link_token ?? crypto.randomUUID()

  if (!campanha.link_token) {
    await supabase.from('campanhas').update({ link_token: token }).eq('id', campanhaId)
  }

  const origin = req.nextUrl.origin
  const link = `${origin}/entrar?c=${token}`
  return Response.json({ link, token })
}

export async function DELETE(
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

  await supabase.from('campanhas').update({ link_token: null }).eq('id', campanhaId)
  return Response.json({ ok: true })
}
