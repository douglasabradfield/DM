import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
    .select('dm_id')
    .eq('id', campanhaId)
    .single()

  if (!campanha || campanha.dm_id !== user.id) {
    return Response.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  const { email } = await req.json()
  if (!email?.trim()) return Response.json({ erro: 'Email obrigatório' }, { status: 400 })

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const admin = createAdminClient()
  const { error } = await admin.from('campaign_invites').insert({
    campanha_id: campanhaId,
    email: email.trim().toLowerCase(),
    token,
    expires_at: expiresAt,
  })

  if (error) return Response.json({ erro: error.message }, { status: 500 })

  const origin = req.headers.get('origin') ?? req.nextUrl.origin
  const link = `${origin}/convite?token=${token}`

  return Response.json({ link, token })
}
