import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// pdf-parse usa require (serverExternalPackage) — evita problema de default export no ESM
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const { storagePath, campanhaId } = await req.json()
    if (!storagePath) return NextResponse.json({ erro: 'storagePath obrigatório' }, { status: 400 })

    // 1. Baixar PDF do Supabase Storage (server-to-server, sem limite de tamanho)
    const admin = createAdminClient()
    const { data: fileData, error: downloadError } = await admin.storage
      .from('aventuras')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Erro Storage:', downloadError)
      return NextResponse.json({ erro: 'Erro ao baixar arquivo do Storage' }, { status: 500 })
    }

    // 2. Extrair texto com pdf-parse
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const pdf = await pdfParse(buffer)

    let textoAventura = pdf.text
    const totalPaginas = pdf.numpages

    // Limitar a 400K chars (≈100K tokens — cobre aventuras de até ~160 páginas de texto denso)
    const MAX_CHARS = 400_000
    const truncado = textoAventura.length > MAX_CHARS
    if (truncado) textoAventura = textoAventura.slice(0, MAX_CHARS)

    // Normalizar texto extraído do PDF
    textoAventura = textoAventura
      .replace(/\r\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()

    console.log(`PDF: ${totalPaginas} páginas, ${pdf.text.length} chars${truncado ? ' (TRUNCADO)' : ''}`)

    if (!textoAventura || textoAventura.length < 100) {
      return NextResponse.json({ erro: 'PDF sem texto extraível (pode ser digitalizado como imagem)' }, { status: 422 })
    }

    // 3. Enviar texto ao Claude com prompt robusto
    const claude = getClaudeClient()

    const resposta = await claude.messages.create({
      model: MODELO_CLAUDE,
      max_tokens: 8096,
      messages: [{
        role: 'user',
        content: `Você é um especialista em analisar aventuras de RPG de mesa (D&D, Pathfinder, Tormenta, Call of Cthulhu, etc.).

Analise o texto abaixo, extraído de um PDF de aventura, e estruture todas as informações.

INSTRUÇÕES:
- A aventura pode ser oficial (WotC, Paizo, etc.) ou criada pelo próprio DM — adapte-se ao formato encontrado
- O texto foi extraído de PDF e pode ter imperfeições: espaços extras, quebras de linha inesperadas, mistura de colunas, fragmentos de tabelas
- "Texto narrativo" = o que o DM lê em voz alta para os jogadores (frequentemente em itálico ou caixas destacadas nos livros impressos)
- "Notas do DM" = instruções táticas, informações secretas, contexto de fundo, mecânicas — o que apenas o DM precisa saber
- Se uma informação não existir no texto, use null ou [] — NUNCA invente conteúdo
- Se o texto estiver em inglês ou outro idioma, traduza tudo para português brasileiro
- Inclua TODOS os locais, salas, cenas e encontros mencionados — não pule nenhum
- Para criaturas: se o CR não aparecer no texto, estime baseado no sistema e no contexto
- Para aventuras sem estrutura de capítulos explícita: crie um único capítulo com todos os locais
${truncado ? '- ATENÇÃO: o texto foi truncado pois a aventura é muito grande. Processe o máximo possível com o texto disponível.' : ''}

TEXTO DA AVENTURA (${totalPaginas} páginas):
${textoAventura}

Retorne APENAS JSON válido, sem markdown, sem texto fora do JSON:
{
  "titulo": "título da aventura",
  "sistema": "D&D 5e",
  "sinopse": "resumo da trama em 2-3 frases",
  "nivel_recomendado": "1-4 ou null",
  "capitulos": [
    {
      "numero": 1,
      "titulo": "nome do capítulo ou parte",
      "locais": [
        {
          "id": "loc_1",
          "codigo": "C1-A",
          "nome": "nome do local",
          "capitulo": "nome do capítulo pai",
          "texto_narrativo": "texto para leitura em voz alta, ou null",
          "notas_dm": "notas táticas e segredos para o DM, ou null",
          "encontros": [
            { "nome": "Goblin Batedeiro", "cr": "1/4", "quantidade": 3, "notas": "" }
          ],
          "npcs": [
            { "nome": "Tavita", "descricao": "estalajadeira idosa", "personalidade": "acolhedora mas desconfiada", "objetivo": "proteger sua taverna", "segredos": "" }
          ],
          "ordem": 1
        }
      ]
    }
  ],
  "npcs_globais": [],
  "notas_gerais": "ganchos de aventura, premissa, notas gerais"
}`,
      }],
    })

    const jsonStr = resposta.content[0].type === 'text' ? resposta.content[0].text : ''

    // 4. Parse do JSON — limpar markdown se Claude não obedecer
    let conteudo
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
    const { data: aventuraSalva, error: errAventura } = await supabase
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
      .select('id')
      .single()

    if (errAventura) throw errAventura

    // 7. Salvar locais extraídos
    if (conteudo.capitulos && aventuraSalva) {
      type LocalBruto = {
        codigo?: string; nome?: string; texto_narrativo?: string
        notas_dm?: string; encontros?: unknown[]; npcs?: unknown[]; ordem?: number
      }
      const todosLocais = (conteudo.capitulos as Array<{ titulo: string; locais?: LocalBruto[] }>)
        .flatMap((cap, capIdx) =>
          (cap.locais ?? []).map((local, locIdx) => ({
            aventura_id: aventuraSalva.id,
            codigo: local.codigo ?? `C${capIdx + 1}-${locIdx + 1}`,
            nome: local.nome ?? 'Local sem nome',
            capitulo: cap.titulo,
            texto_narrativo: local.texto_narrativo ?? null,
            notas_dm: local.notas_dm ?? null,
            encontros: local.encontros ?? [],
            npcs: local.npcs ?? [],
            ordem: local.ordem ?? locIdx,
          }))
        )

      if (todosLocais.length > 0) {
        await supabase.from('locais').insert(todosLocais)
      }
    }

    const totalLocais = (conteudo.capitulos as Array<{ locais?: unknown[] }> | undefined)
      ?.reduce((acc, cap) => acc + (cap.locais?.length ?? 0), 0) ?? 0

    return NextResponse.json({
      sucesso: true,
      titulo: conteudo.titulo,
      locais: totalLocais,
      paginas: totalPaginas,
      truncado,
    })

  } catch (err) {
    console.error('Erro ao processar aventura:', err)
    return NextResponse.json({
      erro: 'Erro interno ao processar aventura',
      detalhe: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
