import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { campanhaId } = await req.json()
  if (!campanhaId) return NextResponse.json({ erro: 'campanhaId obrigatório' }, { status: 400 })

  const { data: perfil } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  if (!['mesa_pro', 'guild_master'].includes(perfil?.plano || '')) {
    return NextResponse.json(
      { erro: 'Plano Mesa Pro ou Guild Master necessário' },
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
  // email marcador único por campanha — link aberto para qualquer pessoa
  const emailMarcador = `link_aberto@campanha.${campanhaId.slice(0, 8)}`

  const { error } = await supabase
    .from('campanha_membros')
    .upsert(
      {
        campanha_id: campanhaId,
        email: emailMarcador,
        papel: 'jogador',
        plano_efetivo: perfil!.plano === 'guild_master' ? 'guild_master' : 'mesa_pro',
        status: 'convidado',
        token_convite: token,
      },
      { onConflict: 'campanha_id,email' }
    )

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const origin = req.headers.get('origin') ?? req.nextUrl.origin
  const link = `${origin}/convite/${token}`

  return NextResponse.json({ link })
}
