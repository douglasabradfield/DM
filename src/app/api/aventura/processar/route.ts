import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const formData = await req.formData()
    const arquivo = formData.get('arquivo') as File | null
    if (!arquivo) return NextResponse.json({ erro: 'Arquivo não encontrado' }, { status: 400 })

    const buffer = await arquivo.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mediaType = arquivo.type || 'application/pdf'

    console.log('Processando arquivo:', arquivo.name, 'tamanho:', buffer.byteLength)

    const claude = getClaudeClient()

    const resposta = await claude.messages.create({
      model: MODELO_CLAUDE,
      max_tokens: 8096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType as 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Você é um assistente especializado em processar aventuras de RPG D&D 5e.

Analise este PDF de aventura e estruture-o em JSON.
Se o texto estiver em inglês, TRADUZA tudo para português brasileiro.

Retorne APENAS o JSON válido, sem markdown, no seguinte formato:
{
  "titulo": "título da aventura em português",
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
          "texto_narrativo": "texto para leitura em voz alta aos jogadores",
          "notas_dm": "informações táticas e secretas para o DM",
          "encontros": [
            {"nome": "Goblin", "cr": "1/4", "quantidade": 3, "notas": ""}
          ],
          "npcs": [
            {"nome": "Nome NPC", "descricao": "descrição", "personalidade": "traços", "objetivo": "motivação", "segredos": ""}
          ],
          "ordem": 1
        }
      ]
    }
  ],
  "npcs_globais": [],
  "notas_gerais": "resumo e informações gerais da aventura"
}`,
          }
        ]
      }]
    })

    const jsonStr = resposta.content[0].type === 'text' ? resposta.content[0].text : ''

    console.log('Resposta Claude (primeiros 200 chars):', jsonStr.slice(0, 200))

    let conteudo
    try {
      const jsonLimpo = jsonStr
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      conteudo = JSON.parse(jsonLimpo)
    } catch (parseErr) {
      console.error('Erro ao fazer parse do JSON:', parseErr)
      console.error('JSON recebido:', jsonStr.slice(0, 500))
      return NextResponse.json({ erro: 'Erro ao processar estrutura da aventura' }, { status: 500 })
    }

    // Buscar campanha ativa do usuário
    const { data: campanhas } = await supabase
      .from('campanhas')
      .select('id')
      .eq('dm_id', user.id)
      .eq('status', 'ativa')
      .limit(1)

    let campanhaId = campanhas?.[0]?.id

    if (!campanhaId) {
      const { data: qualquer } = await supabase
        .from('campanhas')
        .select('id')
        .eq('dm_id', user.id)
        .limit(1)
      campanhaId = qualquer?.[0]?.id
    }

    if (!campanhaId) {
      const { data: nova } = await supabase
        .from('campanhas')
        .insert({
          dm_id: user.id,
          nome: conteudo.titulo ?? 'Minha Campanha',
          status: 'ativa',
        })
        .select()
        .single()
      campanhaId = nova?.id
    }

    const { error: errAventura } = await supabase
      .from('aventuras')
      .insert({
        campanha_id: campanhaId,
        titulo: conteudo.titulo,
        titulo_original: arquivo.name,
        idioma_original: 'pt',
        conteudo_json: conteudo,
        processada: true,
      })

    if (errAventura) {
      console.error('Erro ao salvar aventura:', errAventura)
      throw errAventura
    }

    if (conteudo.capitulos) {
      const { data: aventuraCriada } = await supabase
        .from('aventuras')
        .select('id')
        .eq('campanha_id', campanhaId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .single()

      if (aventuraCriada) {
        const todosLocais = (conteudo.capitulos as Array<{
          titulo: string
          locais?: Array<{
            codigo: string; nome: string; texto_narrativo: string
            notas_dm: string; encontros: unknown[]; npcs: unknown[]; ordem: number
          }>
        }>).flatMap(cap =>
          (cap.locais || []).map(local => ({
            aventura_id: aventuraCriada.id,
            codigo: local.codigo,
            nome: local.nome,
            capitulo: cap.titulo,
            texto_narrativo: local.texto_narrativo,
            notas_dm: local.notas_dm,
            encontros: local.encontros || [],
            npcs: local.npcs || [],
            ordem: local.ordem || 0,
          }))
        )

        if (todosLocais.length > 0) {
          await supabase.from('locais').insert(todosLocais)
        }
      }
    }

    const totalLocais = (conteudo.capitulos as Array<{ locais?: unknown[] }>)
      ?.reduce((acc, cap) => acc + (cap.locais?.length || 0), 0) || 0

    return NextResponse.json({
      sucesso: true,
      titulo: conteudo.titulo,
      locais: totalLocais,
    })

  } catch (err) {
    console.error('Erro ao processar aventura:', err)
    return NextResponse.json({
      erro: 'Erro interno ao processar aventura',
      detalhe: err instanceof Error ? err.message : String(err)
    }, { status: 500 })
  }
}
