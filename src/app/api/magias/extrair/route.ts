import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient } from '@/lib/supabase/server'
import { LIMITE_TEXTO_IMPORTACAO, validarMagiaImportada } from '@/lib/magias/validar-importacao'

export const maxDuration = 60

// Só EXTRAI. Não grava nada: o jogador confere o resultado e confirma em
// /api/magias/importar, que revalida tudo.

const PROMPT = `Você extrai o texto de uma magia de D&D 5ª Edição (2014 ou 2024, em português ou inglês) para um banco de dados.

Se o texto NÃO for uma magia, retorne apenas: { "erro": "explicação curta em português" }

Caso contrário, retorne APENAS um JSON válido (sem markdown) neste formato:
{
  "name_pt": string, "name_en": string ("" se não houver),
  "level": number (0 para truque, 1 a 9),
  "school_pt": "Abjuração" | "Adivinhação" | "Conjuração" | "Encantamento" | "Evocação" | "Ilusão" | "Necromancia" | "Transmutação",
  "casting_time_pt": string, "range_pt": string (sempre em metros, 5 pés = 1,5 m), "components_pt": string (ex.: "V, S, M (uma pena)"),
  "duration_pt": string, "concentration": boolean, "ritual": boolean,
  "description_pt": string (texto completo, incluindo "Em níveis superiores" se houver),
  "classes_pt": string (separadas por vírgula, ou ""),
  "damage_dice": string ou null (ex.: "8d6"), "damage_type_pt": acido | contundente | cortante | eletrico | fogo | forca | frio | necrotico | perfurante | psiquico | radiante | trovejante | veneno, ou null,
  "heal_dice": string ou null,
  "save_ability": "FOR" | "DES" | "CON" | "INT" | "SAB" | "CAR" ou null
}
Se o texto estiver em inglês, traduza para o português. Nunca invente informação que não esteja no texto.

Texto colado pelo jogador:
"""
`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  let corpo: { texto?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const textoColado = typeof corpo.texto === 'string' ? corpo.texto.trim() : ''
  if (!textoColado) return NextResponse.json({ erro: 'Cole o texto da magia' }, { status: 400 })
  if (textoColado.length > LIMITE_TEXTO_IMPORTACAO)
    return NextResponse.json({ erro: `Texto muito grande (máx. ${LIMITE_TEXTO_IMPORTACAO.toLocaleString('pt-BR')} caracteres)` }, { status: 413 })

  let respostaTexto: string
  try {
    const resposta = await getClaudeClient().messages.create({
      model: MODELO_CLAUDE,
      max_tokens: 4000,
      messages: [{ role: 'user', content: `${PROMPT}${textoColado}\n"""` }],
    })
    if (resposta.stop_reason === 'max_tokens')
      return NextResponse.json({ erro: 'A magia é grande demais para extrair de uma vez.' }, { status: 422 })
    respostaTexto = resposta.content[0]?.type === 'text' ? resposta.content[0].text : ''
  } catch (e) {
    console.error('Erro na extração de magia:', e)
    return NextResponse.json({ erro: 'Falha ao contatar a IA. Tente de novo em instantes.' }, { status: 502 })
  }

  let bruto: Record<string, unknown>
  try {
    bruto = JSON.parse(respostaTexto.slice(respostaTexto.indexOf('{'), respostaTexto.lastIndexOf('}') + 1))
  } catch {
    return NextResponse.json({ erro: 'Não foi possível interpretar a resposta da IA. Tente de novo.' }, { status: 422 })
  }

  if (typeof bruto.erro === 'string' && bruto.erro.trim())
    return NextResponse.json({ erro: `Não parece uma magia: ${bruto.erro}` }, { status: 422 })

  const resultado = validarMagiaImportada(bruto)
  if ('erros' in resultado)
    return NextResponse.json({ erro: `Extração incompleta, não encontrei: ${resultado.erros.join(', ')}.` }, { status: 422 })

  return NextResponse.json({ magia: resultado.magia })
}
