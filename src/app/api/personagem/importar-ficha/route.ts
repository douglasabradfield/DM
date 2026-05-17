import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const form = await req.formData()
  const arquivo = form.get('arquivo') as File | null
  if (!arquivo) return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })

  if (arquivo.size > 5 * 1024 * 1024)
    return NextResponse.json({ erro: 'Arquivo muito grande (máx 5 MB)' }, { status: 413 })

  const buffer = await arquivo.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const claude = getClaudeClient()

  const resposta = await claude.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        } as never,
        {
          type: 'text',
          text: `Você é um assistente que extrai dados de fichas de personagem D&D 5ª Edição.
Analise esta ficha PDF e retorne um JSON com os dados do personagem.

Retorne APENAS um JSON válido (sem markdown, sem texto extra) com este formato:
{
  "nome": string,
  "classe": string,
  "nivel": number,
  "raca": string,
  "antecedente": string,
  "alinhamento": string,
  "pontos_experiencia": number,
  "forca": number,
  "destreza": number,
  "constituicao": number,
  "inteligencia": number,
  "sabedoria": number,
  "carisma": number,
  "ca": number,
  "iniciativa": number,
  "deslocamento": number,
  "pv_maximo": number,
  "pv_atual": number,
  "bonus_proficiencia": number,
  "tracos_personalidade": string,
  "ideais": string,
  "vinculos": string,
  "fraquezas": string,
  "outras_proficiencias": string,
  "caracteristicas_talentos": string
}

Se um campo não estiver na ficha, use valores padrão: strings vazias, números 0 ou valores típicos de D&D (ca=10, pv_maximo=8, etc.).`,
        },
      ],
    }],
  })

  const texto = resposta.content[0].type === 'text' ? resposta.content[0].text : ''

  try {
    const dados = JSON.parse(texto.trim())
    return NextResponse.json({ dados })
  } catch {
    return NextResponse.json({ erro: 'Não foi possível interpretar a ficha', raw: texto }, { status: 422 })
  }
}
