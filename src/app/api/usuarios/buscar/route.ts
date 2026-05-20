import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { username, campanhaId } = await req.json()
  if (!username?.trim() || !campanhaId) {
    return NextResponse.json({ erro: 'username e campanhaId obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: campanha } = await admin
    .from('campanhas')
    .select('nome, dm_id, dm:profiles!dm_id(plano)')
    .eq('id', campanhaId)
    .single()

  if (!campanha || campanha.dm_id !== user.id) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  const { data: perfil } = await admin
    .from('profiles')
    .select('id, username, nome, email, plano')
    .ilike('username', username.trim())
    .maybeSingle()

  if (!perfil) {
    return NextResponse.json({ encontrado: false })
  }

  const { data: jaExiste } = await admin
    .from('campanha_membros')
    .select('id, status')
    .eq('campanha_id', campanhaId)
    .eq('user_id', perfil.id)
    .maybeSingle()

  if (jaExiste && jaExiste.status === 'ativo') {
    return NextResponse.json({ encontrado: true, jaEra: true, perfil })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planoEfetivo = (campanha.dm as any)?.plano || 'guild_master'

  if (jaExiste) {
    await admin
      .from('campanha_membros')
      .update({ status: 'ativo', plano_efetivo: planoEfetivo, aceito_em: new Date().toISOString() })
      .eq('id', jaExiste.id)
  } else {
    await admin.from('campanha_membros').insert({
      campanha_id: campanhaId,
      user_id: perfil.id,
      email: perfil.email || '',
      papel: 'jogador',
      plano_efetivo: planoEfetivo,
      status: 'ativo',
      aceito_em: new Date().toISOString(),
    })
  }

  await admin.from('notificacoes').insert({
    user_id: perfil.id,
    tipo: 'adicionado_campanha',
    titulo: '🎲 Você foi adicionado a uma campanha!',
    mensagem: `Você foi adicionado à campanha "${campanha.nome}". Acesse agora!`,
    link: '/batalha',
  })

  return NextResponse.json({ encontrado: true, jaEra: false, perfil })
}
