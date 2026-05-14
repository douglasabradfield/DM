import { NextRequest } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/prompts'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autenticado', { status: 401 })

  const { mensagem, contexto, grupoPJs, historico } = await req.json()

  let contextoAventura = ''
  if (contexto === 'aventura') {
    const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
    if (campanhas?.[0]) {
      const { data: avs } = await supabase.from('aventuras').select('titulo, conteudo_json').eq('campanha_id', campanhas[0].id).limit(1)
      if (avs?.[0]) {
        contextoAventura = `Aventura: ${avs[0].titulo}`
      }
    }
  }

  const systemPrompt = buildSystemPrompt(contextoAventura, grupoPJs)

  const mensagensHistorico = (historico ?? []).slice(-10).map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const claude = getClaudeClient()

  const stream = await claude.messages.stream({
    model: MODELO_CLAUDE,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      ...mensagensHistorico,
      { role: 'user', content: mensagem },
    ],
  })

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
