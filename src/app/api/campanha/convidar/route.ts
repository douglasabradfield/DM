import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { decidirAdicaoMembro } from '@/lib/campanha/membro'

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
    // upsert por e-mail não cobre linha existente só por user_id (UNIQUE campanha_id, user_id)
    const { data: linhas, error: erroBusca } = await supabase
      .from('campanha_membros')
      .select('id, user_id, email, status')
      .eq('campanha_id', campanhaId)
      .or(`user_id.eq.${usuarioExistente.id},email.eq."${emailNormalizado.replace(/"/g, '')}"`)

    if (erroBusca) {
      return NextResponse.json({ erro: 'Não foi possível verificar os membros da campanha. Tente novamente.' }, { status: 500 })
    }

    const decisao = decidirAdicaoMembro(linhas ?? [], usuarioExistente.id, emailNormalizado)

    if (decisao.acao === 'ja_ativo') {
      return NextResponse.json({ sucesso: true, jaTemConta: true })
    }

    const { error } = decisao.acao === 'reativar'
      ? await supabase
          .from('campanha_membros')
          .update({
            user_id: usuarioExistente.id,
            status: 'ativo',
            papel: 'jogador',
            plano_efetivo: planoEfetivo,
            aceito_em: new Date().toISOString(),
          })
          .eq('id', decisao.id)
      : await supabase.from('campanha_membros').insert({
          campanha_id: campanhaId,
          email: emailNormalizado,
          papel: 'jogador',
          plano_efetivo: planoEfetivo,
          status: 'ativo',
          user_id: usuarioExistente.id,
          aceito_em: new Date().toISOString(),
        })

    if (error) {
      return NextResponse.json({ erro: 'Não foi possível adicionar o jogador à campanha. Tente novamente.' }, { status: 500 })
    }

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
