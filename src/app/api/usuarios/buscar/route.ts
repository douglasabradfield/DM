import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { decidirAdicaoMembro } from '@/lib/campanha/membro'

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

  // procura por user_id OU e-mail: o UNIQUE (campanha_id, email) também barra
  // o insert quando existe linha removida com o mesmo e-mail e user_id nulo
  const filtros = [`user_id.eq.${perfil.id}`]
  if (perfil.email) filtros.push(`email.eq."${perfil.email.replace(/"/g, '')}"`)

  const { data: linhas, error: erroBusca } = await admin
    .from('campanha_membros')
    .select('id, user_id, email, status')
    .eq('campanha_id', campanhaId)
    .or(filtros.join(','))

  if (erroBusca) {
    return NextResponse.json({ erro: 'Não foi possível verificar os membros da campanha. Tente novamente.' }, { status: 500 })
  }

  const decisao = decidirAdicaoMembro(linhas ?? [], perfil.id, perfil.email)

  if (decisao.acao === 'ja_ativo') {
    return NextResponse.json({ encontrado: true, jaEra: true, perfil })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planoEfetivo = (campanha.dm as any)?.plano || 'guild_master'
  const agora = new Date().toISOString()

  const { error: erroGravar } = decisao.acao === 'reativar'
    ? await admin
        .from('campanha_membros')
        .update({ user_id: perfil.id, status: 'ativo', papel: 'jogador', plano_efetivo: planoEfetivo, aceito_em: agora })
        .eq('id', decisao.id)
    : await admin.from('campanha_membros').insert({
        campanha_id: campanhaId,
        user_id: perfil.id,
        email: perfil.email || '',
        papel: 'jogador',
        plano_efetivo: planoEfetivo,
        status: 'ativo',
        aceito_em: agora,
      })

  if (erroGravar) {
    return NextResponse.json({ erro: 'Não foi possível adicionar o jogador à campanha. Tente novamente.' }, { status: 500 })
  }

  // a notificação é secundária: falhar aqui não desfaz a entrada na campanha
  const { error: erroNotif } = await admin.from('notificacoes').insert({
    user_id: perfil.id,
    tipo: 'adicionado_campanha',
    titulo: '🎲 Você foi adicionado a uma campanha!',
    mensagem: `Você foi adicionado à campanha "${campanha.nome}". Acesse agora!`,
    link: '/batalha',
  })
  if (erroNotif) console.error('Erro ao notificar jogador adicionado:', erroNotif.message)

  return NextResponse.json({ encontrado: true, jaEra: false, perfil })
}
