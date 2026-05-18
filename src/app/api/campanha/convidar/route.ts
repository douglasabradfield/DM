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

  if (!['mesa_pro', 'guild_master'].includes(perfil?.plano || '')) {
    return NextResponse.json(
      { erro: 'Plano Mesa Pro ou Guild Master necessário para convidar jogadores' },
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

  const token = randomBytes(32).toString('hex')

  const { error } = await supabase
    .from('campanha_membros')
    .upsert(
      {
        campanha_id: campanhaId,
        email: email.trim().toLowerCase(),
        papel: 'jogador',
        plano_efetivo: perfil!.plano === 'guild_master' ? 'guild_master' : 'mesa_pro',
        status: 'convidado',
        token_convite: token,
      },
      { onConflict: 'campanha_id,email' }
    )

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const origin = req.headers.get('origin') ?? req.nextUrl.origin
  const linkConvite = `${origin}/convite/${token}`

  return NextResponse.json({ sucesso: true, link: linkConvite, mensagem: 'Convite gerado!' })
}
