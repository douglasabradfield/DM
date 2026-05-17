import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { itemNome, itemTipo, tipo, descricao, sugestao, userEmail } = await req.json()

    console.log('📬 FEEDBACK RECEBIDO:', {
      item: `${itemNome} (${itemTipo})`,
      tipo,
      descricao,
      sugestao: sugestao || null,
      usuario: userEmail || 'anônimo',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
