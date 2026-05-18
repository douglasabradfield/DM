import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { campanhaId } = await req.json()
  if (!campanhaId) return NextResponse.json({ erro: 'campanhaId obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  const [campanhaRes, sessoesRes, personagensRes, diarioRes] = await Promise.all([
    admin.from('campanhas').select('nome, sistema, descricao, criado_em').eq('id', campanhaId).single(),
    admin.from('sessoes').select('titulo, resumo_ia, data').eq('campanha_id', campanhaId).eq('encerrada', true).order('data', { ascending: true }),
    admin.from('personagens').select('nome, classe, nivel, tipo_personagem').eq('campanha_id', campanhaId).eq('tipo_personagem', 'jogador'),
    admin.from('diario_entradas').select('titulo, conteudo, criado_em').eq('campanha_id', campanhaId).order('criado_em', { ascending: true }).limit(20),
  ])

  const campanha = campanhaRes.data
  if (!campanha) return NextResponse.json({ erro: 'Campanha não encontrada' }, { status: 404 })

  const sessoes = sessoesRes.data ?? []
  const personagens = personagensRes.data ?? []
  const entradas = diarioRes.data ?? []

  const duracaoMeses = (() => {
    const inicio = new Date(campanha.criado_em)
    const agora = new Date()
    const meses = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth())
    return meses
  })()

  const resumosSessoes = sessoes
    .filter(s => s.resumo_ia)
    .map(s => `**${s.titulo}**: ${(s.resumo_ia as string).slice(0, 400)}`)
    .join('\n\n')

  const entradaTexto = entradas
    .map(e => `[${e.titulo}] ${String(e.conteudo ?? '').slice(0, 300)}`)
    .join('\n')
    .slice(0, 2000)

  const claude = getClaudeClient()

  const resposta = await claude.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Você é um cronista épico de RPG. Escreva uma crônica narrativa final para a campanha encerrada "${campanha.nome}" em português brasileiro. Deve soar como o epílogo de um livro de fantasia — evocativo, épico e emocionante. Máximo 4 parágrafos.

DADOS DA CAMPANHA:
- Nome: ${campanha.nome}
- Sistema: ${campanha.sistema}
- Descrição: ${campanha.descricao ?? 'não informada'}
- Duração: aproximadamente ${duracaoMeses} mês(es)
- Sessões concluídas: ${sessoes.length}
- Heróis: ${personagens.map(p => `${p.nome} (${p.classe} Nv${p.nivel})`).join(', ') || 'não registrados'}

RESUMOS DAS SESSÕES:
${resumosSessoes || 'Sem resumos de batalhas disponíveis.'}

NOTAS DO DIÁRIO:
${entradaTexto || 'Sem entradas no diário.'}

Escreva a crônica final agora:`
    }]
  })

  const resumo = resposta.content[0].type === 'text' ? resposta.content[0].text : ''

  // Tenta salvar na coluna resumo_final (pode não existir — ignora erro)
  try {
    await admin.from('campanhas').update({ resumo_final: resumo }).eq('id', campanhaId)
  } catch {
    // coluna pode não existir ainda
  }

  if (resumo) {
    try {
      await admin.from('diario_entradas').insert({
        campanha_id: campanhaId,
        tipo: 'nota',
        titulo: `📜 Crônica Final — ${campanha.nome}`,
        conteudo: resumo,
        visibilidade: 'grupo',
        criado_em: new Date().toISOString(),
      })
    } catch { /* ignora */ }
  }

  return NextResponse.json({ resumo })
}
