import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcularDano, aplicarCura } from '@/lib/batalha/motor'
import type { TipoDano } from '@/types/dnd'
import type { TipoEntradaLog } from '@/types/batalha'

// Mesmo agrupamento de src/components/batalha/TabelaCombate.tsx (GRUPOS_ACAO /
// TIPOS_MAGIA_SLOTS / TIPOS_CURA_ACAO) — duplicado aqui porque aquele arquivo
// é um Client Component e não pode ser importado por uma rota de servidor.
const TIPOS_REACAO = new Set<TipoEntradaLog>([
  'ataque_oportunidade', 'contra_magia', 'escudo', 'absorver_elementos', 'queda_controlada', 'outra_reacao',
])
const TIPOS_CURA = new Set<TipoEntradaLog>(['cura', 'cura_bonus', 'pv_temporarios', 'estabilizar'])

interface AlvoPayload {
  combatenteId: string
  valor: number
  tipoDano?: TipoDano
}

interface AcaoPayload {
  batalhaId: string
  combatenteId: string
  tipo: TipoEntradaLog
  alvos: AlvoPayload[]
  nivelMagia?: number
  nomeAcao?: string
  vantagem?: 'vantagem' | 'desvantagem' | null
  descricao?: string
}

type SlotsMagiaDb = Record<string, { total: number; usados: number }>

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as Partial<AcaoPayload>
  const { batalhaId, combatenteId, tipo, alvos } = payload

  if (!batalhaId || !combatenteId || !tipo || !Array.isArray(alvos)) {
    return Response.json({ erro: 'Payload inválido' }, { status: 400 })
  }

  // 1. Usuário autenticado — nunca confia em um id vindo do payload
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // 2. A batalha existe e está ativa
  const { data: batalha } = await admin.from('batalhas').select('*').eq('id', batalhaId).maybeSingle()
  if (!batalha || batalha.status !== 'ativa') {
    return Response.json({ erro: 'Batalha não encontrada ou não está ativa' }, { status: 403 })
  }

  const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', batalha.campanha_id).maybeSingle()
  const ehDM = !!campanha && campanha.dm_id === user.id

  const { data: ator } = await admin
    .from('batalha_combatentes')
    .select('*')
    .eq('id', combatenteId)
    .eq('batalha_id', batalhaId)
    .maybeSingle()
  if (!ator) return Response.json({ erro: 'Combatente não encontrado nesta batalha' }, { status: 403 })

  // 3. DM ou controla o combatente que age
  if (!ehDM) {
    let controla = ator.controlado_por === user.id
    if (!controla && ator.personagem_id) {
      const { data: personagem } = await admin
        .from('personagens')
        .select('user_id')
        .eq('id', ator.personagem_id)
        .maybeSingle()
      controla = personagem?.user_id === user.id
    }
    if (!controla) {
      return Response.json({ erro: 'Você não controla este combatente' }, { status: 403 })
    }
  }

  const ehReacao = TIPOS_REACAO.has(tipo)

  // 4. Fora do turno só é permitido para reação
  if (!ehDM && !ehReacao && batalha.turno_combatente_id !== combatenteId) {
    return Response.json({ erro: 'Não é a vez deste combatente' }, { status: 403 })
  }

  // 5. Reação: uma por rodada
  if (ehReacao && ator.reacao_usada) {
    return Response.json({ erro: 'Este combatente já usou a reação nesta rodada' }, { status: 403 })
  }

  // 6. Alvos pertencem à mesma batalha
  const alvoIds = [...new Set(alvos.map(a => a.combatenteId).filter(Boolean))]
  let combatentesAlvo: Record<string, unknown>[] = []
  if (alvoIds.length > 0) {
    const { data } = await admin.from('batalha_combatentes').select('*').eq('batalha_id', batalhaId).in('id', alvoIds)
    combatentesAlvo = data ?? []
    if (combatentesAlvo.length !== alvoIds.length) {
      return Response.json({ erro: 'Um ou mais alvos não pertencem a esta batalha' }, { status: 403 })
    }
  }

  // 7. Espaço de magia disponível no nível informado
  const nivelMagia = payload.nivelMagia
  const nivelStr = nivelMagia !== undefined ? String(nivelMagia) : null
  if (nivelStr !== null) {
    if (ator.personagem_id) {
      const { data: personagemAtor } = await admin
        .from('personagens')
        .select('slots_magia')
        .eq('id', ator.personagem_id)
        .maybeSingle()
      const slotsDb = (personagemAtor?.slots_magia ?? {}) as SlotsMagiaDb
      const slotNivel = slotsDb[nivelStr] ?? { total: 0, usados: 0 }
      if (slotNivel.usados >= slotNivel.total) {
        return Response.json({ erro: `Sem espaços de ${nivelMagia}º nível disponíveis` }, { status: 403 })
      }
    } else {
      const slotsLocal = (ator.slots_monstro ?? {}) as Record<string, number>
      const qtd = slotsLocal[nivelStr] ?? 0
      if (qtd <= 0) {
        return Response.json({ erro: `Sem espaços de ${nivelMagia}º nível disponíveis` }, { status: 403 })
      }
    }
  }

  // =========================================================================
  // Todas as validações passaram — a partir daqui o efeito é aplicado.
  // =========================================================================

  const efeitoCura = TIPOS_CURA.has(tipo)
  const mapaAlvos = new Map(combatentesAlvo.map(c => [c.id as string, c]))

  const atualizacoes: { id: string; patch: Record<string, unknown>; personagemId: string | null }[] = []
  const resultados: { nome: string; valor: number; morreu: boolean }[] = []
  let xpGanho = 0

  for (const alvoPayload of alvos) {
    const alvo = mapaAlvos.get(alvoPayload.combatenteId)
    if (!alvo || !(alvoPayload.valor > 0)) continue

    if (efeitoCura) {
      const { pvFinal } = aplicarCura(alvoPayload.valor, alvo as { pv_atual: number; pv_maximo: number })
      atualizacoes.push({
        id: alvo.id as string,
        patch: { pv_atual: pvFinal, cura_total: (alvo.cura_total as number) + alvoPayload.valor },
        personagemId: alvo.personagem_id as string | null,
      })
      resultados.push({ nome: alvo.nome as string, valor: alvoPayload.valor, morreu: false })
    } else {
      const tipoDano = (alvoPayload.tipoDano ?? 'cortante') as TipoDano
      const { danoFinal, absorvidoTemporario } = calcularDano(alvoPayload.valor, tipoDano, alvo as {
        pv_temporarios: number; resistencias: TipoDano[]; imunidades: TipoDano[]; vulnerabilidades: TipoDano[]
      })
      const pvAtual = alvo.pv_atual as number
      const pvTemp = alvo.pv_temporarios as number
      const novoPvTemp = pvTemp - absorvidoTemporario
      const novoPv = Math.max(0, pvAtual - (danoFinal - absorvidoTemporario))
      const morreu = pvAtual > 0 && novoPv === 0

      atualizacoes.push({
        id: alvo.id as string,
        patch: {
          pv_atual: novoPv,
          pv_temporarios: novoPvTemp,
          dano_total: (alvo.dano_total as number) + danoFinal,
          ...(morreu ? { morto: false } : {}),
        },
        personagemId: alvo.personagem_id as string | null,
      })
      resultados.push({ nome: alvo.nome as string, valor: danoFinal, morreu })

      if (morreu && alvo.tipo === 'monstro') {
        const dadosMonstro = alvo.dados_monstro as { xp?: number } | null
        if (dadosMonstro?.xp) xpGanho += dadosMonstro.xp
      }
    }
  }

  for (const { id, patch } of atualizacoes) {
    const { error } = await admin.from('batalha_combatentes').update(patch).eq('id', id)
    if (error) {
      console.error('Erro ao aplicar ação de combate:', error)
      return Response.json({ erro: 'Erro ao salvar efeito nos combatentes' }, { status: 500 })
    }
  }

  await Promise.all(
    atualizacoes
      .filter(a => a.personagemId)
      .map(a => admin.from('personagens').update({
        pv_atual: a.patch.pv_atual,
        pv_temporarios: a.patch.pv_temporarios ?? mapaAlvos.get(a.id)?.pv_temporarios,
      }).eq('id', a.personagemId as string))
  )

  if (nivelStr !== null) {
    if (ator.personagem_id) {
      const { data: personagemAtor } = await admin
        .from('personagens')
        .select('slots_magia')
        .eq('id', ator.personagem_id)
        .maybeSingle()
      const slotsDb = (personagemAtor?.slots_magia ?? {}) as SlotsMagiaDb
      const slotNivel = slotsDb[nivelStr] ?? { total: 0, usados: 0 }
      const novosSlots = { ...slotsDb, [nivelStr]: { ...slotNivel, usados: slotNivel.usados + 1 } }
      await admin.from('personagens').update({ slots_magia: novosSlots }).eq('id', ator.personagem_id)

      const espacosBatalha: Record<string, { total: number; utilizados: number }> = {}
      for (const [k, v] of Object.entries(novosSlots)) espacosBatalha[k] = { total: v.total, utilizados: v.usados }
      await admin.from('batalha_combatentes').update({ espacos_magia: espacosBatalha }).eq('id', ator.id)
    } else {
      const slotsLocal = (ator.slots_monstro ?? {}) as Record<string, number>
      const qtd = slotsLocal[nivelStr] ?? 0
      await admin.from('batalha_combatentes')
        .update({ slots_monstro: { ...slotsLocal, [nivelStr]: qtd - 1 } })
        .eq('id', ator.id)
    }
  }

  if (ehReacao) {
    await admin.from('batalha_combatentes').update({ reacao_usada: true }).eq('id', ator.id)
  }

  const nivelLabel = nivelMagia !== undefined ? (nivelMagia === 0 ? ' (Truque)' : ` (N${nivelMagia})`) : ''
  const vantagemLabel = payload.vantagem === 'vantagem' ? ' [▲]' : payload.vantagem === 'desvantagem' ? ' [▼]' : ''
  const acaoLabel = `${payload.nomeAcao ?? tipo}${nivelLabel}${vantagemLabel}`
  const alvosDesc = resultados.map(r =>
    `${r.nome}: ${r.valor} ${efeitoCura ? 'cura' : 'dano'}${r.morreu ? ' — caiu! 💀' : ''}`
  )
  const descricaoFinal = [
    `${acaoLabel} — ${ator.nome}`,
    alvosDesc.length > 0 ? `→ ${alvosDesc.join(', ')}` : '',
    payload.descricao ? `(${payload.descricao})` : '',
  ].filter(Boolean).join(' ')

  const { data: logInserido, error: erroLog } = await admin.from('batalha_log').insert({
    batalha_id: batalhaId,
    rodada: batalha.rodada_atual,
    turno: null,
    tipo,
    autor_id: ator.id,
    autor_nome: ator.nome,
    alvo_id: alvoIds.length === 1 ? alvoIds[0] : null,
    alvo_nome: resultados.map(r => r.nome).join(', ') || null,
    valor: resultados.reduce((soma, r) => soma + r.valor, 0),
    tipo_dano: efeitoCura ? null : (alvos.find(a => a.tipoDano)?.tipoDano ?? null),
    descricao: descricaoFinal,
  }).select().single()

  if (erroLog) {
    console.error('Erro ao gravar log da ação (efeito já aplicado):', erroLog)
  }

  return Response.json({
    ok: true,
    combatentesAfetados: resultados,
    xpGanho,
    log: logInserido ?? null,
  })
}
