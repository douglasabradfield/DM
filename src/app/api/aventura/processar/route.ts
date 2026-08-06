import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ConteudoAventura } from '@/types/database'

export const maxDuration = 60

// LIMITAÇÃO CONHECIDA: max_tokens=8096 e a aventura inteira é processada numa
// única chamada à IA. Aventuras grandes truncam a resposta (ver flag `truncado`).
// Solução futura: processar por capítulo, espelhando o padrão de offset em
// src/app/api/aventura/traduzir/route.ts.

export async function POST(req: NextRequest) {
  console.log('=== INICIO PROCESSAR AVENTURA ===')
  try {
    console.log('1. Verificando API key...')
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ erro: 'ANTHROPIC_API_KEY não configurada no Vercel' }, { status: 500 })
    }

    console.log('2. Verificando autenticação...')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    console.log('3. Lendo body...')
    const { storagePath, campanhaId } = await req.json()
    if (!storagePath) return NextResponse.json({ erro: 'storagePath obrigatório' }, { status: 400 })

    console.log('4. Baixando arquivo do Storage:', storagePath)
    const admin = createAdminClient()
    const { data: fileData, error: downloadError } = await admin.storage
      .from('aventuras')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Erro Storage:', downloadError)
      return NextResponse.json({ erro: 'Erro ao baixar arquivo do Storage' }, { status: 500 })
    }

    console.log('5. Extraindo texto...')
    const ext = storagePath.split('.').pop()?.toLowerCase() ?? ''

    let textoAventura: string
    let totalPaginas: number
    let formatoDesc: string

    if (ext === 'pdf') {
      console.log('5a. Importando pdf-parse...')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const pdf = await pdfParse(buffer)
      textoAventura = pdf.text
      totalPaginas = pdf.numpages
      formatoDesc = `PDF (${totalPaginas} páginas)`
    } else {
      textoAventura = await fileData.text()
      totalPaginas = 1
      formatoDesc = ext === 'md' ? 'Markdown' : 'texto simples'
    }

    const MAX_CHARS = 400_000
    const truncado = textoAventura.length > MAX_CHARS
    if (truncado) textoAventura = textoAventura.slice(0, MAX_CHARS)

    textoAventura = textoAventura
      .replace(/\r\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()

    console.log(`6. Arquivo: ${formatoDesc}, ${textoAventura.length} chars${truncado ? ' (TRUNCADO)' : ''}`)

    if (!textoAventura || textoAventura.length < 100) {
      return NextResponse.json({ erro: ext === 'pdf' ? 'PDF sem texto extraível (pode ser digitalizado como imagem)' : 'Arquivo sem conteúdo suficiente para processar' }, { status: 422 })
    }

    console.log('7. Importando Anthropic SDK...')
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    console.log('8. Criando cliente Anthropic...')
    const claude = new Anthropic({ apiKey })

    console.log('9. Chamando API Claude...')
    const resposta = await claude.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8096,
      messages: [{
        role: 'user',
        content: `Você é um assistente especializado em processar aventuras de RPG de mesa (D&D 5e e sistemas compatíveis).

Analise o conteúdo da aventura abaixo e estruture-o em JSON válido, sem markdown externo.
Se o conteúdo estiver em inglês, TRADUZA TUDO para português brasileiro.
Mantenha os textos de leitura em voz alta fiéis ao original, apenas traduzindo.

RETORNE APENAS O JSON, sem texto antes ou depois, sem blocos de código markdown.

INSTRUÇÕES:
- A aventura pode ser oficial (WotC, Paizo, etc.) ou criada pelo próprio DM — adapte-se ao formato encontrado
- Formato de origem: ${formatoDesc}
- ${ext === 'pdf' ? 'O texto foi extraído de PDF e pode ter imperfeições: espaços extras, quebras de linha inesperadas, mistura de colunas, fragmentos de tabelas' : 'O texto está em formato legível (Markdown/texto simples) e deve estar bem estruturado'}
- "Texto narrativo" = o que o DM lê em voz alta para os jogadores (frequentemente em itálico ou caixas destacadas nos livros impressos)
- "Notas do DM" = instruções táticas, informações secretas, contexto de fundo, mecânicas, armadilhas e segredos — tudo que apenas o DM precisa saber vai neste campo
- Campos de texto nunca devem vir null — use string vazia ("")
- tesouros[] e armadilhas[] são arrays de STRING, nunca de objeto. Cada elemento é uma frase descritiva completa em português (ex: "50 peças de ouro escondidas sob a tábua solta do assoalho")
- criaturas[] é um array de SLUGS EM INGLÊS do SRD 5e, em minúsculas com hífen (ex: "goblin", "clay-golem", "adult-black-dragon", "vampire-spawn"). Nunca traduza esses valores, nunca use nome em português, nunca invente slug — se não houver criatura no local, devolva array vazio
- artefato_central e mecanica_especial são opcionais: omita essas chaves do JSON se a aventura não tiver esses elementos
- Inclua TODOS os locais, salas e cenas mencionados — não pule nenhum
- Para aventuras sem estrutura de capítulos explícita: crie um único capítulo com todos os locais
- Onde havia imagem no PDF, ignore marcadores como [image] ou [figure]
${truncado ? '- ATENÇÃO: o texto foi truncado pois a aventura é muito grande. Processe o máximo possível com o texto disponível.' : ''}

TEXTO DA AVENTURA (${formatoDesc}):
${textoAventura}

Formato de saída (APENAS JSON válido, nada além dele):
{
  "titulo": "título da aventura em português",
  "titulo_original": "título no idioma original do documento",
  "sistema": "D&D 5e",
  "nivel_recomendado": "1-4",
  "numero_jogadores": "3-5",
  "resumo_geral": "resumo da trama em 2-3 frases",
  "npcs_globais": [
    { "nome": "", "papel": "", "descricao": "", "motivacao": "" }
  ],
  "capitulos": [
    {
      "numero": 1,
      "titulo_pt": "Nome do capítulo em português",
      "titulo_en": "Nome do capítulo no idioma original",
      "plano": "Plano de existência ou região onde o capítulo se passa",
      "nivel_recomendado": "3-5",
      "resumo": "Resumo narrativo do capítulo para o DM",
      "npcs": [ { "nome": "", "descricao": "" } ],
      "locais": [
        {
          "codigo": "C1-A",
          "nome": "Nome do Local",
          "texto_narrativo": "Texto de leitura em voz alta, ou string vazia",
          "notas_dm": "Táticas, segredos, armadilhas e detalhes para o DM",
          "criaturas": ["goblin", "adult-black-dragon"],
          "tesouros": ["Cada item é uma frase descritiva completa"],
          "armadilhas": ["Cada item é uma frase descritiva completa"]
        }
      ]
    }
  ],
  "artefato_central": { "nome": "", "descricao": "", "fragmentos": [] },
  "mecanica_especial": { "nome": "", "descricao": "" }
}`,
      }],
    })

    console.log('10. Resposta recebida, fazendo parse...')
    const jsonStr = resposta.content[0].type === 'text' ? resposta.content[0].text : ''
    let conteudo: ConteudoAventura
    try {
      const jsonLimpo = jsonStr
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      conteudo = JSON.parse(jsonLimpo)
    } catch {
      console.error('JSON inválido (primeiros 500 chars):', jsonStr.slice(0, 500))
      return NextResponse.json({ erro: 'Erro ao interpretar estrutura retornada pela IA' }, { status: 500 })
    }

    console.log('10b. Validando slugs de criaturas contra o bestiário...')
    const { data: monstrosBanco } = await admin.from('monsters').select('slug')
    const slugsValidos = new Set((monstrosBanco ?? []).map(m => m.slug))
    const criaturasDesconhecidas = new Set<string>()

    for (const cap of conteudo.capitulos ?? []) {
      for (const local of cap.locais ?? []) {
        const criaturasOriginais = local.criaturas ?? []
        local.criaturas = criaturasOriginais.filter(slug => {
          if (slugsValidos.has(slug)) return true
          criaturasDesconhecidas.add(slug)
          return false
        })
      }
    }

    console.log('11. JSON parseado, salvando no banco...')
    // 5. Resolver campanha
    let campId = campanhaId
    if (!campId) {
      const { data: c1 } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).eq('ativa', true).limit(1)
      campId = c1?.[0]?.id
    }
    if (!campId) {
      const { data: c2 } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      campId = c2?.[0]?.id
    }
    if (!campId) {
      const { data: nova } = await supabase.from('campanhas').insert({
        dm_id: user.id,
        nome: conteudo.titulo ?? 'Nova Campanha',
        sistema: conteudo.sistema ?? 'D&D 5e',
        ativa: true,
      }).select('id').single()
      campId = nova?.id
    }

    // 6. Salvar aventura
    const { error: errAventura } = await supabase
      .from('aventuras')
      .insert({
        campanha_id: campId,
        titulo: conteudo.titulo,
        titulo_original: storagePath.split('/').pop() ?? storagePath,
        idioma_original: 'pt',
        conteudo_json: conteudo,
        arquivo_url: storagePath,
        processada: true,
      })

    if (errAventura) throw errAventura

    const totalLocais = conteudo.capitulos
      ?.reduce((acc, cap) => acc + (cap.locais?.length ?? 0), 0) ?? 0

    console.log('12. Concluído com sucesso:', conteudo.titulo)
    return NextResponse.json({
      sucesso: true,
      titulo: conteudo.titulo,
      locais: totalLocais,
      paginas: totalPaginas,
      truncado,
      criaturas_desconhecidas: Array.from(criaturasDesconhecidas),
    })

  } catch (err: unknown) {
    const e = err as { message?: string; stack?: string }
    console.error('ERRO DETALHADO:', e?.message, e?.stack)
    return NextResponse.json({
      erro: e?.message || String(err),
      stack: e?.stack?.slice(0, 500),
    }, { status: 500 })
  }
}
