import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: campanhasDM } = await admin
    .from('campanhas')
    .select('*')
    .eq('dm_id', user.id)
    .eq('status', 'ativa')

  const { data: membros } = await admin
    .from('campanha_membros')
    .select('campanha_id, plano_efetivo')
    .eq('user_id', user.id)
    .eq('status', 'ativo')

  const idsMembro = membros?.map(m => m.campanha_id) || []

  let campanhasMembro: unknown[] = []
  if (idsMembro.length > 0) {
    const { data } = await admin
      .from('campanhas')
      .select('*')
      .in('id', idsMembro)
    campanhasMembro = data || []
  }

  const { data: perfil } = await admin
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()
  const planoProprio = perfil?.plano || 'free'

  const campanhas = [
    ...(campanhasDM || []).map((c: Record<string, unknown>) => ({
      ...c,
      papel: 'dm',
      plano_efetivo: planoProprio,
    })),
    ...(campanhasMembro as Record<string, unknown>[]).map(c => ({
      ...c,
      papel: 'jogador',
      plano_efetivo: membros?.find(m => m.campanha_id === c.id)?.plano_efetivo || 'free',
    })),
  ]

  return NextResponse.json({ campanhas })
}
