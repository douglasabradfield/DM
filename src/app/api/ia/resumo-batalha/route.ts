import { NextRequest, NextResponse } from 'next/server'
import { getClaudeClient, MODELO_CLAUDE } from '@/lib/claude/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { nomeBatalha, rodadas, totalDano, totalCura, mortos, combatentes, log } = await req.json()

  const claude = getClaudeClient()

  const resposta = await claude.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Você é um escriba épico de D&D. Escreva uma narrativa dramática e envolvente desta batalha em português brasileiro, como se fosse um trecho de livro ou crônica medieval. Máximo 3 parágrafos.

DADOS DA BATALHA:
- Nome: ${nomeBatalha}
- Rodadas: ${rodadas}
- Dano total causado: ${totalDano}
- Cura total: ${totalCura}
- Baixas: ${(mortos as string[]).length > 0 ? (mortos as string[]).join(', ') : 'nenhuma'}
- Combatentes: ${(combatentes as Array<{ nome: string; tipo: string; pvFinal: number; pvMax: number }>)
  .map(c => `${c.nome} (${c.tipo}, PV: ${c.pvFinal}/${c.pvMax})`).join(', ')}

LOG DE AÇÕES:
${log}

Escreva a narrativa épica agora:`
    }]
  })

  const resumo = resposta.content[0].type === 'text' ? resposta.content[0].text : ''

  return NextResponse.json({ resumo })
}
