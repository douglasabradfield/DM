import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { gerarSlugBase, normalizarNome, validarMagiaImportada } from '@/lib/magias/validar-importacao'

// Grava a magia importada por qualquer usuário autenticado (service role).
// Nunca sobrescreve magia existente: nome repetido devolve a que já existe.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  let corpo: { magia?: unknown; campanhaId?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const campanhaId = typeof corpo.campanhaId === 'string' ? corpo.campanhaId : null
  if (!campanhaId) return NextResponse.json({ erro: 'Selecione uma campanha' }, { status: 400 })

  const resultado = validarMagiaImportada(corpo.magia)
  if ('erros' in resultado)
    return NextResponse.json({ erro: `Campos obrigatórios ausentes ou inválidos: ${resultado.erros.join(', ')}` }, { status: 400 })
  const magia = resultado.magia

  const admin = createAdminClient()

  // A magia fica disponível para a mesa: o usuário precisa ser mestre ou membro ativo dela.
  const [{ data: campanha }, { data: membro }] = await Promise.all([
    admin.from('campanhas').select('id, dm_id').eq('id', campanhaId).maybeSingle(),
    admin.from('campanha_membros').select('id').eq('campanha_id', campanhaId).eq('user_id', user.id).eq('status', 'ativo').maybeSingle(),
  ])
  if (!campanha || (campanha.dm_id !== user.id && !membro))
    return NextResponse.json({ erro: 'Você não faz parte dessa campanha' }, { status: 403 })

  // Duplicata: sem acento e sem diferença de caixa, em PT ou EN. Só olha o SRD
  // e as magias dessa campanha (magia custom de outra mesa não é exposta).
  const { data: candidatas } = await admin
    .from('spells')
    .select('id, name_pt, name_en')
    .or(`criado_por.is.null,campanha_id.eq.${campanhaId}`)
  const nomes = new Set([normalizarNome(magia.name_pt), normalizarNome(magia.name_en)])
  const repetida = (candidatas ?? []).find(s =>
    nomes.has(normalizarNome(String(s.name_pt ?? ''))) || nomes.has(normalizarNome(String(s.name_en ?? ''))))
  if (repetida) {
    const { data: existente } = await admin.from('spells').select('*').eq('id', repetida.id).single()
    return NextResponse.json({ duplicada: true, magia: existente })
  }

  const { data: criada, error } = await admin
    .from('spells')
    .insert({
      ...magia,
      slug: `${gerarSlugBase(magia.name_en) || 'magia'}-${Math.random().toString(36).slice(2, 6)}`,
      casting_time_en: magia.casting_time_pt,
      range_en: magia.range_pt,
      components_en: magia.components_pt,
      duration_en: magia.duration_pt,
      description_en: magia.description_pt,
      classes_en: magia.classes_pt,
      criado_por: user.id,
      campanha_id: campanhaId,
      visivel_jogadores: true,
      origem: 'importada_jogador',
      importada_por: user.id,
      revisada: false,
    })
    .select('*')
    .single()
  if (error || !criada) {
    console.error('Erro ao importar magia:', error)
    return NextResponse.json({ erro: 'Não foi possível salvar a magia. Tente de novo.' }, { status: 500 })
  }

  // Avisa cada admin. Falha aqui não desfaz a importação.
  try {
    const [{ data: perfil }, { data: admins }] = await Promise.all([
      admin.from('profiles').select('nome, username, email').eq('id', user.id).maybeSingle(),
      admin.from('profiles').select('id').eq('is_admin', true),
    ])
    const quem = perfil?.nome ?? perfil?.username ?? perfil?.email ?? 'Um jogador'
    if (admins && admins.length > 0) {
      await admin.from('notificacoes').insert(admins.map(a => ({
        user_id: a.id,
        tipo: 'magia_importada',
        titulo: '📜 Magia importada',
        mensagem: `${quem} importou a magia ${magia.name_pt}`,
        link: `/magias?magia=${criada.id}`,
      })))
    }
  } catch (e) {
    console.error('Erro ao notificar admins da magia importada:', e)
  }

  return NextResponse.json({ duplicada: false, magia: criada })
}
