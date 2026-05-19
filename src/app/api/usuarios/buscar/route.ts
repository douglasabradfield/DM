import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  if (!username?.trim()) return NextResponse.json({ erro: 'Username obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: perfil } = await admin
    .from('profiles')
    .select('id, username, nome, email')
    .ilike('username', username.trim())
    .maybeSingle()

  if (!perfil) return NextResponse.json({ encontrado: false })
  return NextResponse.json({ encontrado: true, perfil })
}
