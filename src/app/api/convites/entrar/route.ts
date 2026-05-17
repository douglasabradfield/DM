import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const LIMITE_POR_PLANO: Record<string, number> = {
  free: 1,
  heroi: 3,
}

export async function POST(req: NextRequest) {
  const { link_token } = await req.json()
  if (!link_token) return Response.json({ erro: 'Token obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  const { data: campanha } = await admin
    .from('campanhas')
    .select('id, nome, ativa, dm_id')
    .eq('link_token', link_token)
    .single()

  if (!campanha) return Response.json({ erro: 'Link inválido ou revogado' }, { status: 404 })
  if (!campanha.ativa) return Response.json({ erro: 'Esta campanha está encerrada' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  if (campanha.dm_id === user.id) {
    return Response.json({ erro: 'Você já é o DM desta campanha' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('campaign_members')
    .select('id')
    .eq('campanha_id', campanha.id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return Response.json({ erro: 'Você já é membro desta campanha' }, { status: 400 })
  }

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
    campanha_id: campanha.id,
    user_id: user.id,
    papel: 'jogador',
  })

  if (error) return Response.json({ erro: error.message }, { status: 500 })

  return Response.json({ ok: true, campanha_id: campanha.id })
}
