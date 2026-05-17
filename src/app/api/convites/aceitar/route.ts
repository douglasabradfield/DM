import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const LIMITE_POR_PLANO: Record<string, number> = {
  free: 1,
  heroi: 3,
}

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return Response.json({ erro: 'Token obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: convite } = await admin
    .from('campaign_invites')
    .select('*')
    .eq('token', token)
    .eq('usado', false)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!convite) {
    return Response.json({ erro: 'Convite inválido ou expirado' }, { status: 400 })
  }

  const { data: campanha } = await admin
    .from('campanhas')
    .select('dm_id')
    .eq('id', convite.campanha_id)
    .single()

  if (campanha?.dm_id === user.id) {
    return Response.json({ erro: 'Você já é o DM desta campanha' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('campaign_members')
    .select('id')
    .eq('campanha_id', convite.campanha_id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return Response.json({ erro: 'Você já é membro desta campanha' }, { status: 400 })
  }

  // Check campaign limit per plan
  const { data: perfil } = await admin
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  const plano = perfil?.plano ?? 'free'
  const limite = LIMITE_POR_PLANO[plano]

  if (limite !== undefined) {
    const { count } = await admin
      .from('campaign_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= limite) {
      const nomePlano = plano === 'free' ? 'gratuita' : 'Herói'
      return Response.json({
        erro: `Limite de ${limite} campanha(s) atingido no plano ${nomePlano}. Faça upgrade para participar de mais campanhas.`,
      }, { status: 403 })
    }
  }

  const { error } = await admin.from('campaign_members').insert({
    campanha_id: convite.campanha_id,
    user_id: user.id,
    papel: 'jogador',
  })

  if (error) return Response.json({ erro: error.message }, { status: 500 })

  await admin.from('campaign_invites').update({ usado: true }).eq('id', convite.id)

  return Response.json({ ok: true, campanha_id: convite.campanha_id })
}
