import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 60

const TAMANHO_LOTE = 6

interface Local {
  nome: string
  codigo: string
  notas_dm: string
  texto_narrativo: string
  tesouros: string[]
  armadilhas: string[]
  criaturas: string[]
}

interface Capitulo {
  numero: number
  titulo_pt: string
  titulo_en: string
  plano: string
  nivel_recomendado: string
  resumo: string
  npcs: Array<{ nome: string; descricao: string }>
  locais: Local[]
  traduzido?: boolean
}

interface ConteudoAventura {
  capitulos: Capitulo[]
  [key: string]: unknown
}

function montarPrompt(lote: Local[]): string {
  return `Você é tradutor especializado em RPG de mesa D&D 5e. Traduza para português brasileiro.

TRADUZA APENAS estes campos de cada local:
- nome
- texto_narrativo
- notas_dm
- tesouros[] (cada item é uma frase descritiva)
- armadilhas[] (cada item é uma frase descritiva)

NUNCA ALTERE (copie idêntico ao original):
- codigo
- criaturas[] — são slugs de ligação com o bestiário; traduzir quebra os links

REGRAS DE TRADUÇÃO:
- Nomes próprios de pessoas, lugares e mundos NÃO são traduzidos (ex: Landro, Ironrot, Eberron, Cyre, Mournland, Sharn, Vecna, Kas).
- Termos de regra vão para a nomenclatura PT-BR do SRD:
  "DC 12 Intelligence (Investigation)" -> "CD 12 Inteligência (Investigação)"
  saving throw -> teste de resistência | check -> teste | initiative -> iniciativa
  hit points -> pontos de vida | AC -> CA | attack roll -> jogada de ataque
- Mantenha as distâncias em PÉS (consistente com o bestiário SRD do app). Não converta para metros.
- texto_narrativo é lido em voz alta na mesa: traduza com fluidez e tom narrativo, não literalmente. Deve soar bem falado.
- notas_dm é técnico: traduza com precisão, sem floreio.
- Se um campo for null ou vazio, mantenha null ou vazio. NUNCA invente conteúdo.
- Se um texto estiver truncado no original (corta no meio da frase), traduza só o que existe. NÃO complete a frase.

RETORNE APENAS o array JSON de locais traduzidos, no mesmo formato de entrada (nome, codigo, notas_dm, texto_narrativo, tesouros, armadilhas, criaturas), sem markdown, sem texto antes ou depois.

LOCAIS PARA TRADUZIR:
${JSON.stringify(lote, null, 2)}`
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ erro: 'ANTHROPIC_API_KEY não configurada no Vercel' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { campanhaId, capituloNumero, offset } = await req.json()
    if (!campanhaId || capituloNumero === undefined || offset === undefined) {
      return NextResponse.json({ erro: 'campanhaId, capituloNumero e offset são obrigatórios' }, { status: 400 })
    }

    const { data: campanha } = await supabase
      .from('campanhas')
      .select('dm_id')
      .eq('id', campanhaId)
      .single()

    if (!campanha || campanha.dm_id !== user.id) {
      return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: aventura, error: errAventura } = await admin
      .from('aventuras')
      .select('id, conteudo_json')
      .eq('campanha_id', campanhaId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (errAventura || !aventura?.conteudo_json) {
      return NextResponse.json({ erro: 'Aventura não encontrada' }, { status: 404 })
    }

    const conteudo = aventura.conteudo_json as ConteudoAventura
    const capIdx = conteudo.capitulos.findIndex(c => c.numero === capituloNumero)
    if (capIdx === -1) {
      return NextResponse.json({ erro: 'Capítulo não encontrado' }, { status: 404 })
    }

    const capitulo = conteudo.capitulos[capIdx]
    const total = capitulo.locais.length
    const lote = capitulo.locais.slice(offset, offset + TAMANHO_LOTE)

    if (lote.length === 0) {
      return NextResponse.json({ traduzidos: 0, total, proximoOffset: offset, concluido: true })
    }

    console.log(`[traduzir] campanha=${campanhaId} capitulo=${capituloNumero} offset=${offset} lote=${lote.length}/${total}`)

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const claude = new Anthropic({ apiKey })

    const resposta = await claude.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: montarPrompt(lote) }],
    })

    const jsonStr = resposta.content[0].type === 'text' ? resposta.content[0].text : ''
    let locaisTraduzidos: Local[]
    try {
      const jsonLimpo = jsonStr
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      locaisTraduzidos = JSON.parse(jsonLimpo)
      if (!Array.isArray(locaisTraduzidos)) throw new Error('resposta não é um array')
    } catch {
      console.error(`[traduzir] JSON inválido no offset ${offset} (primeiros 500 chars):`, jsonStr.slice(0, 500))
      return NextResponse.json({ erro: 'Erro ao interpretar tradução retornada pela IA', offset }, { status: 500 })
    }

    const porCodigo = new Map(locaisTraduzidos.map((l, i) => [l?.codigo ?? lote[i]?.codigo, l]))

    for (let i = 0; i < lote.length; i++) {
      const original = lote[i]
      const trad = porCodigo.get(original.codigo) ?? locaisTraduzidos[i]
      if (!trad) continue

      capitulo.locais[offset + i] = {
        nome: trad.nome ?? original.nome,
        codigo: original.codigo,
        notas_dm: trad.notas_dm ?? original.notas_dm,
        texto_narrativo: trad.texto_narrativo ?? original.texto_narrativo,
        tesouros: Array.isArray(trad.tesouros) ? trad.tesouros : original.tesouros,
        armadilhas: Array.isArray(trad.armadilhas) ? trad.armadilhas : original.armadilhas,
        criaturas: original.criaturas,
      }
    }

    const proximoOffset = offset + lote.length
    const concluido = proximoOffset >= total
    if (concluido) capitulo.traduzido = true
    conteudo.capitulos[capIdx] = capitulo

    const { error: errUpdate } = await admin
      .from('aventuras')
      .update({ conteudo_json: conteudo })
      .eq('id', aventura.id)

    if (errUpdate) throw errUpdate

    console.log(`[traduzir] salvo: capitulo=${capituloNumero} traduzidos=${lote.length} proximoOffset=${proximoOffset} concluido=${concluido}`)

    return NextResponse.json({
      traduzidos: lote.length,
      total,
      proximoOffset,
      concluido,
    })

  } catch (err: unknown) {
    const e = err as { message?: string; stack?: string }
    console.error('[traduzir] ERRO DETALHADO:', e?.message, e?.stack)
    return NextResponse.json({ erro: e?.message || String(err) }, { status: 500 })
  }
}
