import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const formData = await req.formData()
    const arquivo = formData.get('arquivo') as File | null
    if (!arquivo) return NextResponse.json({ erro: 'Arquivo não encontrado' }, { status: 400 })

    // Extrair texto do PDF
    const buffer = await arquivo.arrayBuffer()
    const bytes = Buffer.from(buffer)

    let textoExtraido = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const resultado = await pdfParse(bytes)
      textoExtraido = resultado.text
    } catch {
      textoExtraido = 'Não foi possível extrair o texto do PDF. Por favor, verifique o arquivo.'
    }

    if (textoExtraido.length < 100) {
      return NextResponse.json({ erro: 'Não foi possível extrair texto suficiente do PDF' }, { status: 400 })
    }

    // Limitar o texto para não exceder o contexto
    const textoLimitado = textoExtraido.slice(0, 50000)

    const claude = getClaudeClient()

    // Processar com Claude
    const resposta = await claude.messages.create({
      model: MODELO_CLAUDE,
      max_tokens: 8096,
      messages: [{
        role: 'user',
        content: `Você é um assistente especializado em processar aventuras de RPG.

Analise o seguinte texto de aventura e estruture-o em JSON conforme o formato abaixo.
Se o texto estiver em inglês, TRADUZA tudo para português brasileiro.

TEXTO DA AVENTURA:
${textoLimitado}

Retorne APENAS o JSON válido, sem markdown, no seguinte formato:
{
  "titulo": "título da aventura",
  "sistema": "dnd5e",
  "capitulos": [
    {
      "numero": 1,
      "titulo": "nome do capítulo",
      "locais": [
        {
          "id": "loc_1",
          "codigo": "C1",
          "nome": "nome do local",
          "capitulo": "Capítulo 1",
          "texto_narrativo": "texto para leitura em voz alta",
          "notas_dm": "informações táticas e secretas para o DM",
          "encontros": [{"nome": "Goblin", "cr": "1/4", "quantidade": 3, "notas": ""}],
          "npcs": [{"nome": "Taveirão", "descricao": "dono da taverna", "personalidade": "amigável", "objetivo": "vender bebidas", "segredos": ""}],
          "ordem": 1
        }
      ]
    }
  ],
  "npcs_globais": [],
  "notas_gerais": "informações gerais sobre a aventura"
}`
      }]
    })

    const jsonStr = resposta.content[0].type === 'text' ? resposta.content[0].text : ''
    let conteudo
    try {
      conteudo = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ erro: 'Erro ao processar estrutura da aventura' }, { status: 500 })
    }

    // Buscar ou criar campanha
    const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
    let campanhaId = campanhas?.[0]?.id

    if (!campanhaId) {
      const { data: nova } = await supabase.from('campanhas').insert({
        dm_id: user.id,
        nome: conteudo.titulo ?? 'Minha Campanha',
      }).select().single()
      campanhaId = nova?.id
    }

    // Salvar aventura
    const { error } = await supabase.from('aventuras').insert({
      campanha_id: campanhaId,
      titulo: conteudo.titulo,
      titulo_original: arquivo.name,
      idioma_original: textoExtraido.match(/\b(the|and|of|in|to)\b/i) ? 'en' : 'pt',
      conteudo_json: conteudo,
      processada: true,
    })

    if (error) throw error

    return NextResponse.json({ sucesso: true, titulo: conteudo.titulo })
  } catch (err) {
    console.error('Erro ao processar aventura:', err)
    return NextResponse.json({ erro: 'Erro interno ao processar aventura' }, { status: 500 })
  }
}
