import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Lista os jogadores ativos da campanha com nome de exibição. Existe porque
// `profiles` só tem a policy "Users can view own profile" (auth.uid() = id)
// — um DM não consegue ler o profiles de outro membro pelo client do
// navegador, então qualquer `.from('profiles').select(...).in(userIds)`
// feito do lado do cliente para IDs alheios sempre volta vazio. Esta rota
// usa o service role para contornar isso com a checagem de permissão feita
// aqui (DM ou membro ativo da própria campanha).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campanhaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', campanhaId).maybeSingle()
  if (!campanha) return Response.json({ erro: 'Campanha não encontrada' }, { status: 404 })

  const ehDM = campanha.dm_id === user.id
  if (!ehDM) {
    const { data: membro } = await admin
      .from('campanha_membros')
      .select('id')
      .eq('campanha_id', campanhaId)
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .maybeSingle()
    if (!membro) return Response.json({ erro: 'Sem permissão' }, { status: 403 })
  }

  const { data: membros } = await admin
    .from('campanha_membros')
    .select('user_id, email, profiles:user_id(nome, username)')
    .eq('campanha_id', campanhaId)
    .eq('status', 'ativo')
    .eq('papel', 'jogador')

  type PerfilBasico = { nome: string | null; username: string | null } | null

  const jogadores = (membros ?? []).map(m => {
    const perfil = m.profiles as unknown as PerfilBasico
    return {
      id: m.user_id as string,
      nome: perfil?.nome ?? perfil?.username ?? (m.email as string),
      username: perfil?.username ?? null,
    }
  })

  return Response.json({ jogadores })
}
