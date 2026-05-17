import { NextRequest } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/prompts'
import { createClient } from '@/lib/supabase/server'
import { LIMITES_IA } from '@/lib/ia/limites'

export { LIMITES_IA }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autenticado', { status: 401 })

  // Buscar plano do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', user.id)
    .single()

  const plano = profile?.plano ?? 'free'
  const limite = LIMITES_IA[plano] ?? 0

  // Verificar uso atual
  const agora = new Date()
  const mes = agora.getMonth() + 1
  const ano = agora.getFullYear()

  const { data: usoArr } = await supabase
    .from('uso_ia')
    .select('total_mensagens')
    .eq('user_id', user.id)
    .eq('mes', mes)
    .eq('ano', ano)
    .limit(1)

  const totalAtual = usoArr?.[0]?.total_mensagens ?? 0

  if (limite !== Infinity && totalAtual >= limite) {
    return Response.json(
      { error: `Limite de ${limite} mensagens atingido. Faça upgrade do plano para continuar.` },
      { status: 429 }
    )
  }

  const { mensagem, contexto, grupoPJs, historico, campanhaId, campanhaNome } = await req.json()

  let contextoAventura = ''
  if (contexto === 'aventura') {
    const cidAventura = campanhaId ?? await (async () => {
      const { data } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      return data?.[0]?.id ?? null
    })()

    if (cidAventura) {
      const { data: avs } = await supabase
        .from('aventuras')
        .select('titulo')
        .eq('campanha_id', cidAventura)
        .limit(1)
      if (avs?.[0]) contextoAventura = `Aventura: ${avs[0].titulo}`
    }
  }

  let contextoPersonagens = ''
  if (campanhaId) {
    const { data: pjs } = await supabase
      .from('personagens')
      .select('nome, classe, nivel, tipo_personagem')
      .eq('campanha_id', campanhaId)
      .eq('ativo', true)
    if (pjs?.length) {
      const nomecamp = campanhaNome ? `"${campanhaNome}"` : 'da campanha'
      contextoPersonagens = `\nGRUPO ${nomecamp}:\n` +
        pjs.map((p: { nome: string; classe: string | null; nivel: number | null; tipo_personagem: string | null }) =>
          `- ${p.nome} (${p.classe || p.tipo_personagem || 'personagem'} Nv${p.nivel || 1})`
        ).join('\n')
    }
  }

  const systemPrompt = buildSystemPrompt(contextoAventura + contextoPersonagens, grupoPJs)

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

  // Incrementar contador após resposta bem-sucedida
  supabase.from('uso_ia').upsert({
    user_id: user.id,
    mes,
    ano,
    total_mensagens: totalAtual + 1,
  }, { onConflict: 'user_id,mes,ano' }).then(() => {})

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
      'X-IA-Uso': String(totalAtual + 1),
      'X-IA-Limite': limite === Infinity ? 'ilimitado' : String(limite),
    },
  })
}
