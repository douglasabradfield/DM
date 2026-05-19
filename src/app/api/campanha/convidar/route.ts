import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { campanhaId, email } = await req.json()
  if (!campanhaId || !email?.trim()) {
    return NextResponse.json({ erro: 'campanhaId e email obrigatórios' }, { status: 400 })
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  if (!['mesa_pro', 'guild_master', 'dm_supremo'].includes(perfil?.plano || '')) {
    return NextResponse.json(
      { erro: 'Plano Mesa Pro ou superior necessário para convidar jogadores' },
      { status: 403 }
    )
  }

  const { data: campanha } = await supabase
    .from('campanhas')
    .select('nome, dm_id')
    .eq('id', campanhaId)
    .single()

  if (!campanha || campanha.dm_id !== user.id) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  const emailNormalizado = email.trim().toLowerCase()
  const planoEfetivo = perfil!.plano === 'guild_master' ? 'guild_master' : 'mesa_pro'

  const { data: usuarioExistente } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', emailNormalizado)
    .maybeSingle()

  if (usuarioExistente) {
    const { error } = await supabase
      .from('campanha_membros')
      .upsert(
        {
          campanha_id: campanhaId,
          email: emailNormalizado,
          papel: 'jogador',
          plano_efetivo: planoEfetivo,
          status: 'ativo',
          user_id: usuarioExistente.id,
        },
        { onConflict: 'campanha_id,email' }
      )

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    await supabase.from('notificacoes').insert({
      user_id: usuarioExistente.id,
      tipo: 'convite_campanha',
      titulo: '🎲 Convite para campanha',
      mensagem: `Você foi adicionado à campanha "${campanha.nome}".`,
      link: '/campanhas',
      lida: false,
    })

    return NextResponse.json({ sucesso: true, jaTemConta: true })
  }

  const token = randomBytes(32).toString('hex')

  const { error } = await supabase
    .from('campanha_membros')
    .upsert(
      {
        campanha_id: campanhaId,
        email: emailNormalizado,
        papel: 'jogador',
        plano_efetivo: planoEfetivo,
        status: 'convidado',
        user_id: null,
        token_convite: token,
      },
      { onConflict: 'campanha_id,email' }
    )

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const origin = req.headers.get('origin') ?? req.nextUrl.origin
  const linkConvite = `${origin}/convite/${token}`

  return NextResponse.json({ sucesso: true, jaTemConta: false, link: linkConvite })
}
