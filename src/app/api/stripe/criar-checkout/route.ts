import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { priceId } = await req.json()
  if (!priceId) return NextResponse.json({ erro: 'Price ID necessário' }, { status: 400 })

  try {
    const stripe = getStripe()
    const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_uid: user.id },
      })
      customerId = customer.id
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?sucesso=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes`,
      locale: 'pt-BR',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Erro Stripe:', err)
    return NextResponse.json({ erro: 'Erro ao criar checkout' }, { status: 500 })
  }
}
