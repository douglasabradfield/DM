import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verificarAdmin } from '@/lib/admin/verificar-admin'

const PLANOS_VALIDOS = ['free', 'solo', 'mesa_pro', 'guild_master'] as const
type Plano = typeof PLANOS_VALIDOS[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const isAdmin = await verificarAdmin(user.id)
  if (!isAdmin) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const plano: Plano = body.plano

  if (!PLANOS_VALIDOS.includes(plano)) {
    return NextResponse.json({ erro: 'Plano inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: errPerfil } = await admin
    .from('profiles')
    .update({ plano })
    .eq('id', id)

  if (errPerfil) {
    return NextResponse.json({ erro: errPerfil.message }, { status: 500 })
  }

  // Upsert a manual subscription entry (no Stripe)
  await admin
    .from('assinaturas')
    .upsert({
      user_id: id,
      plano,
      status: 'ativo',
      stripe_subscription_id: null,
      stripe_price_id: null,
      periodo_inicio: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
