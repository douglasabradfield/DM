import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const PLANOS_STRIPE: Record<string, string> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_SOLO ?? '']: 'solo',
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_MESA_PRO ?? '']: 'mesa_pro',
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_GUILD_MASTER ?? '']: 'guild_master',
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: 'Sem assinatura' }, { status: 400 })
  }

  let evento: Stripe.Event
  try {
    const stripe = getStripe()
    evento = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ erro: 'Assinatura inválida' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (evento.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = evento.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id
      const plano = PLANOS_STRIPE[priceId] ?? 'free'
      const customerId = sub.customer as string

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        await supabase.from('profiles').update({ plano }).eq('id', profile.id)
        await supabase.from('assinaturas').upsert({
          user_id: profile.id,
          plano,
          status: sub.status === 'active' ? 'ativo' : sub.status,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          periodo_inicio: sub.billing_cycle_anchor ? new Date(sub.billing_cycle_anchor * 1000).toISOString() : null,
          periodo_fim: null,
        }, { onConflict: 'stripe_subscription_id' })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = evento.data.object as Stripe.Subscription
      const customerId = sub.customer as string

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        await supabase.from('profiles').update({ plano: 'free' }).eq('id', profile.id)
        await supabase.from('assinaturas').update({ status: 'cancelado' })
          .eq('stripe_subscription_id', sub.id)
      }
      break
    }
  }

  return NextResponse.json({ recebido: true })
}
