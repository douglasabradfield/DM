import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// pdf-parse usa require (serverExternalPackage) — evita problema de default export no ESM
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ erro: 'ANTHROPIC_API_KEY não configurada no Vercel' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

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

    // 2. Extrair texto conforme o formato do arquivo
    const ext = storagePath.split('.').pop()?.toLowerCase() ?? ''

    let textoAventura: string
    let totalPaginas: number
    let formatoDesc: string

    if (ext === 'pdf') {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const pdf = await pdfParse(buffer)
      textoAventura = pdf.text
      totalPaginas = pdf.numpages
      formatoDesc = `PDF (${totalPaginas} páginas)`
    } else {
      // .md ou .txt — leitura direta, sem biblioteca
      textoAventura = await fileData.text()
      totalPaginas = 1
      formatoDesc = ext === 'md' ? 'Markdown' : 'texto simples'
    }

    // Limitar a 400K chars (≈100K tokens — cobre aventuras de até ~160 páginas de texto denso)
    const MAX_CHARS = 400_000
    const truncado = textoAventura.length > MAX_CHARS
    if (truncado) textoAventura = textoAventura.slice(0, MAX_CHARS)

    // Normalizar texto
    textoAventura = textoAventura
      .replace(/\r\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim()

    console.log(`Arquivo: ${formatoDesc}, ${textoAventura.length} chars${truncado ? ' (TRUNCADO)' : ''}`)

    if (!textoAventura || textoAventura.length < 100) {
      return NextResponse.json({ erro: ext === 'pdf' ? 'PDF sem texto extraível (pode ser digitalizado como imagem)' : 'Arquivo sem conteúdo suficiente para processar' }, { status: 422 })
    }

    // 3. Enviar texto ao Claude com prompt robusto
    const claude = getClaudeClient()

    const resposta = await claude.messages.create({
      model: MODELO_CLAUDE,
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
- "Notas do DM" = instruções táticas, informações secretas, contexto de fundo, mecânicas — o que apenas o DM precisa saber
- Se uma informação não existir no texto, use null ou [] — NUNCA invente conteúdo
- Inclua TODOS os locais, salas, cenas e encontros mencionados — não pule nenhum
- Para criaturas: se o CR não aparecer no texto, estime baseado no sistema e no contexto
- Para aventuras sem estrutura de capítulos explícita: crie um único capítulo com todos os locais
- Para stat blocks: extraia nome e CR; não invente atributos ausentes no texto
- Onde havia imagem no PDF, ignore marcadores como [image] ou [figure]
${truncado ? '- ATENÇÃO: o texto foi truncado pois a aventura é muito grande. Processe o máximo possível com o texto disponível.' : ''}

TEXTO DA AVENTURA (${formatoDesc}):
${textoAventura}

Formato de saída (APENAS JSON válido):
{
  "titulo": "título da aventura em português",
  "sistema": "D&D 5e",
  "nivel_recomendado": "1-4",
  "numero_jogadores": "3-5",
  "sinopse": "resumo da trama em 2-3 frases",
  "capitulos": [
    {
      "numero": 1,
      "titulo": "Nome do Capítulo",
      "contexto_dm": "Resumo narrativo do capítulo para o DM entender o que acontece",
      "locais": [
        {
          "id": "loc_1",
          "codigo": "C1-A",
          "nome": "Nome do Local",
          "capitulo": "nome do capítulo pai",
          "texto_narrativo": "Texto para leitura em voz alta aos jogadores, ou null",
          "notas_dm": "Informações táticas, segredos e detalhes para o DM, ou null",
          "detalhes_ocultos": "Armadilhas, itens escondidos, segredos do local, ou null",
          "encontros": [
            {
              "nome": "Nome do Encontro ou criatura principal",
              "cr": "1/4",
              "quantidade": 3,
              "notas": "táticas e comportamento",
              "gatilho": "O que faz o encontro começar, ou null",
              "recompensa_xp": 150
            }
          ],
          "npcs": [
            {
              "nome": "Nome do NPC",
              "descricao": "Aparência e personalidade",
              "personalidade": "traços principais",
              "objetivo": "O que quer",
              "segredos": "O que esconde"
            }
          ],
          "tesouros": [
            {
              "nome": "Item ou moeda",
              "descricao": "Descrição",
              "valor": "50 PO",
              "localizacao": "Onde está"
            }
          ],
          "ordem": 1
        }
      ]
    }
  ],
  "npcs_globais": [
    {
      "nome": "Nome do NPC global",
      "descricao": "Descrição completa",
      "personalidade": "traços principais",
      "objetivo": "motivação",
      "segredos": "o que esconde"
    }
  ],
  "notas_gerais": "Informações gerais, tom da aventura, dicas para o DM"
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

  } catch (err: unknown) {
    const e = err as { message?: string; stack?: string }
    console.error('Erro ao processar aventura:', err)
    return NextResponse.json({
      erro: e?.message || String(err),
      stack: e?.stack?.slice(0, 500),
    }, { status: 500 })
  }
}
