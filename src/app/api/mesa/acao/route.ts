import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcularDano, aplicarCura } from '@/lib/batalha/motor'
import { ehPactoArcano } from '@/lib/dados-dnd/espacos-magia'
import type { TipoDano } from '@/types/dnd'
import type { TipoCondicao, TipoEntradaLog } from '@/types/batalha'

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

interface AcaoBatalhaPayload {
  batalhaId: string
  combatenteId: string
  tipo: TipoEntradaLog
  alvos: AlvoPayload[]
  nivelMagia?: number
  nomeAcao?: string
  vantagem?: 'vantagem' | 'desvantagem' | null
  descricao?: string
  marcarEfeitoAtivo?: string
  encerrarEfeitoAtivo?: string
}

type TipoAcaoSessao =
  | 'dano' | 'cura' | 'pv_temporarios'
  | 'condicao_aplicada' | 'condicao_removida'
  | 'usar_espaco' | 'recuperar_espaco'
  | 'usar_inspiracao' | 'ajuste_ouro'
  | 'descanso_longo' | 'descanso_curto'

interface AcaoSessaoPayload {
  sessaoId: string
  personagemId: string
  tipo: TipoAcaoSessao
  valor?: number
  tipoDano?: TipoDano
  condicao?: TipoCondicao
  nivelMagia?: number
  moeda?: 'pc' | 'pp' | 'pe' | 'po' | 'pl'
  dadosGastos?: number
  curaInformada?: number
  nomeAcao?: string
  descricao?: string
}

type SlotsMagiaDb = Record<string, { total: number; usados: number }>
type MoedasDb = Partial<Record<'pc' | 'pp' | 'pe' | 'po' | 'pl', number>>

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as Partial<AcaoBatalhaPayload & AcaoSessaoPayload>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  if (payload.batalhaId) {
    return tratarAcaoBatalha(payload as AcaoBatalhaPayload, user.id, admin)
  }
  if (payload.sessaoId) {
    return tratarAcaoSessao(payload as AcaoSessaoPayload, user.id, admin)
  }
  return Response.json({ erro: 'Payload inválido — informe batalhaId ou sessaoId' }, { status: 400 })
}

// =============================================================================
// Modo combate — inalterado em relação ao antigo /api/batalha/acao
// =============================================================================

async function tratarAcaoBatalha(
  payload: Partial<AcaoBatalhaPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  const { batalhaId, combatenteId, tipo, alvos } = payload

  if (!batalhaId || !combatenteId || !tipo || !Array.isArray(alvos)) {
    return Response.json({ erro: 'Payload inválido' }, { status: 400 })
  }

  // A batalha existe e está ativa — mensagens distintas por caso, sempre
  // orientando a próxima ação (o jogador não tem como saber o que fazer com
  // "não está ativa" genérico).
  const { data: batalha } = await admin.from('batalhas').select('*').eq('id', batalhaId).maybeSingle()
  if (!batalha) {
    return Response.json({ erro: 'Batalha não encontrada' }, { status: 403 })
  }
  if (batalha.status !== 'ativa') {
    const mensagensPorStatus: Record<string, string> = {
      preparacao: 'A batalha ainda não foi iniciada pelo mestre.',
      pausada: 'A batalha está pausada — peça ao mestre para retomar.',
      encerrada: 'Esta batalha já foi encerrada.',
    }
    return Response.json(
      { erro: mensagensPorStatus[batalha.status] ?? 'A batalha não está ativa no momento.' },
      { status: 403 }
    )
  }

  const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', batalha.campanha_id).maybeSingle()
  const ehDM = !!campanha && campanha.dm_id === userId

  const { data: ator } = await admin
    .from('batalha_combatentes')
    .select('*')
    .eq('id', combatenteId)
    .eq('batalha_id', batalhaId)
    .maybeSingle()
  if (!ator) return Response.json({ erro: 'Combatente não encontrado nesta batalha' }, { status: 403 })

  // DM ou controla o combatente que age
  if (!ehDM) {
    let controla = ator.controlado_por === userId
    if (!controla && ator.personagem_id) {
      const { data: personagem } = await admin
        .from('personagens')
        .select('user_id')
        .eq('id', ator.personagem_id)
        .maybeSingle()
      controla = personagem?.user_id === userId
    }
    if (!controla) {
      return Response.json(
        { erro: 'Você não controla este combatente — verifique se selecionou o personagem certo.' },
        { status: 403 }
      )
    }
  }

  const ehReacao = TIPOS_REACAO.has(tipo)
  // Encerrar efeito ativo não é uma ação de turno — o conjurador pode fazer
  // isso a qualquer momento, dentro ou fora da própria vez.
  const bypassaTurno = ehReacao || !!payload.encerrarEfeitoAtivo

  // Fora do turno só é permitido para reação (ou encerrar efeito ativo)
  if (!ehDM && !bypassaTurno && batalha.turno_combatente_id !== combatenteId) {
    return Response.json(
      { erro: 'Não é a sua vez — aguarde seu turno para agir (reações continuam disponíveis a qualquer momento).' },
      { status: 403 }
    )
  }

  // Reação: uma por rodada
  if (ehReacao && ator.reacao_usada) {
    return Response.json(
      { erro: 'Este combatente já usou a reação nesta rodada — disponível de novo na próxima rodada.' },
      { status: 403 }
    )
  }

  // Alvos pertencem à mesma batalha
  const alvoIds = [...new Set(alvos!.map(a => a.combatenteId).filter(Boolean))]
  let combatentesAlvo: Record<string, unknown>[] = []
  if (alvoIds.length > 0) {
    const { data } = await admin.from('batalha_combatentes').select('*').eq('batalha_id', batalhaId).in('id', alvoIds)
    combatentesAlvo = data ?? []
    if (combatentesAlvo.length !== alvoIds.length) {
      return Response.json({ erro: 'Um ou mais alvos não pertencem a esta batalha' }, { status: 403 })
    }
  }

  // Espaço de magia disponível no nível informado
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
        return Response.json(
          { erro: `Sem espaços de magia de ${nivelMagia}º nível disponíveis — escolha outro nível ou espere um descanso.` },
          { status: 403 }
        )
      }
    } else {
      const slotsLocal = (ator.slots_monstro ?? {}) as Record<string, number>
      const qtd = slotsLocal[nivelStr] ?? 0
      if (qtd <= 0) {
        return Response.json(
          { erro: `Sem espaços de magia de ${nivelMagia}º nível disponíveis — escolha outro nível ou espere um descanso.` },
          { status: 403 }
        )
      }
    }
  }

  // =========================================================================
  // Todas as validações passaram — a partir daqui o efeito é aplicado.
  // =========================================================================

  const efeitoCura = TIPOS_CURA.has(tipo)
  const mapaAlvos = new Map(combatentesAlvo.map(c => [c.id as string, c]))

  const atualizacoes: { id: string; patch: Record<string, unknown>; personagemId: string | null }[] = []
  const resultados: { id: string; nome: string; valor: number; morreu: boolean; tipoDano: TipoDano | null }[] = []
  let xpGanho = 0

  for (const alvoPayload of alvos!) {
    const alvo = mapaAlvos.get(alvoPayload.combatenteId)
    if (!alvo || !(alvoPayload.valor > 0)) continue

    if (efeitoCura) {
      const { pvFinal } = aplicarCura(alvoPayload.valor, alvo as { pv_atual: number; pv_maximo: number })
      atualizacoes.push({
        id: alvo.id as string,
        patch: { pv_atual: pvFinal, cura_total: (alvo.cura_total as number) + alvoPayload.valor },
        personagemId: alvo.personagem_id as string | null,
      })
      resultados.push({ id: alvo.id as string, nome: alvo.nome as string, valor: alvoPayload.valor, morreu: false, tipoDano: null })
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
      resultados.push({ id: alvo.id as string, nome: alvo.nome as string, valor: danoFinal, morreu, tipoDano })

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

  // Efeitos colaterais sobre a própria linha do ator: reação consumida,
  // vantagem/desvantagem escolhida (acompanha a ação, vira o estado atual
  // do combatente) e, se pedido, a anotação de efeito persistente.
  const patchAtor: Record<string, unknown> = {}
  if (ehReacao) patchAtor.reacao_usada = true
  if (payload.vantagem !== undefined) patchAtor.vantagem = payload.vantagem
  if (payload.marcarEfeitoAtivo) {
    const efeitosAtuais = (ator.efeitos_ativos ?? []) as { nome: string; rodada_inicio: number }[]
    patchAtor.efeitos_ativos = [...efeitosAtuais, { nome: payload.marcarEfeitoAtivo, rodada_inicio: batalha.rodada_atual }]
  }
  if (payload.encerrarEfeitoAtivo) {
    const efeitosAtuais = (ator.efeitos_ativos ?? []) as { nome: string; rodada_inicio: number }[]
    patchAtor.efeitos_ativos = efeitosAtuais.filter(e => e.nome !== payload.encerrarEfeitoAtivo)
  }
  if (Object.keys(patchAtor).length > 0) {
    await admin.from('batalha_combatentes').update(patchAtor).eq('id', ator.id)
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

  // Uma entrada narrativa (o que aparece no log ao vivo) + uma entrada
  // contábil por alvo afetado (resumo=true — some da UI, mas alimenta a
  // agregação de dano/cura do diário via montarConteudoDiario).
  const linhaNarrativa = {
    batalha_id: batalhaId,
    rodada: batalha.rodada_atual,
    turno: null,
    tipo,
    autor_id: ator.id,
    autor_nome: ator.nome,
    alvo_id: alvoIds.length === 1 ? alvoIds[0] : null,
    alvo_nome: resultados.map(r => r.nome).join(', ') || null,
    valor: resultados.reduce((soma, r) => soma + r.valor, 0),
    tipo_dano: efeitoCura ? null : (alvos!.find(a => a.tipoDano)?.tipoDano ?? null),
    descricao: descricaoFinal,
    resumo: false,
  }

  const linhasContabeis = resultados.map(r => ({
    batalha_id: batalhaId,
    rodada: batalha.rodada_atual,
    turno: null,
    tipo: efeitoCura ? ('cura' as const) : ('dano' as const),
    autor_id: ator.id,
    autor_nome: ator.nome,
    alvo_id: r.id,
    alvo_nome: r.nome,
    valor: r.valor,
    tipo_dano: efeitoCura ? null : r.tipoDano,
    descricao: `${ator.nome} → ${r.nome}: ${r.valor} ${efeitoCura ? 'cura' : 'dano'}${r.morreu ? ' — caiu! 💀' : ''}`,
    resumo: true,
  }))

  const { data: logInserido, error: erroLog } = await admin
    .from('batalha_log')
    .insert([linhaNarrativa, ...linhasContabeis])
    .select()

  if (erroLog) {
    console.error('Erro ao gravar log da ação (efeito já aplicado):', erroLog)
  }

  return Response.json({
    ok: true,
    combatentesAfetados: resultados,
    xpGanho,
    log: logInserido?.find(l => !l.resumo) ?? null,
  })
}

// =============================================================================
// Modo sessão — ações fora de combate, sem turno, sempre sobre um
// personagem (nunca um "alvo" de ataque — fora de combate não existe isso).
// =============================================================================

async function tratarAcaoSessao(
  payload: Partial<AcaoSessaoPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  const { sessaoId, personagemId, tipo } = payload
  if (!sessaoId || !personagemId || !tipo) {
    return Response.json({ erro: 'Payload inválido' }, { status: 400 })
  }

  const { data: sessao } = await admin.from('sessoes').select('*').eq('id', sessaoId).maybeSingle()
  if (!sessao) return Response.json({ erro: 'Sessão não encontrada' }, { status: 403 })
  if (sessao.status === 'encerrada') {
    return Response.json({ erro: 'Esta sessão já foi encerrada.' }, { status: 403 })
  }

  const { data: personagem } = await admin.from('personagens').select('*').eq('id', personagemId).maybeSingle()
  if (!personagem || personagem.campanha_id !== sessao.campanha_id) {
    return Response.json({ erro: 'Personagem não encontrado nesta campanha' }, { status: 403 })
  }

  const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', sessao.campanha_id).maybeSingle()
  const ehDM = !!campanha && campanha.dm_id === userId
  if (!ehDM && personagem.user_id !== userId) {
    return Response.json(
      { erro: 'Você não controla este personagem — verifique se selecionou o personagem certo.' },
      { status: 403 }
    )
  }

  const patch: Record<string, unknown> = {}
  let descricao = ''
  let valorLog: number | null = null
  const nomeAcao = payload.nomeAcao ?? tipo

  switch (tipo) {
    case 'dano': {
      const valor = payload.valor ?? 0
      if (valor <= 0) return Response.json({ erro: 'Valor de dano inválido' }, { status: 400 })
      const novoPv = Math.max(0, (personagem.pv_atual as number) - valor)
      patch.pv_atual = novoPv
      valorLog = valor
      descricao = `${personagem.nome} sofreu ${valor} de dano${payload.tipoDano ? ` (${payload.tipoDano})` : ''} fora de combate`
      break
    }
    case 'cura': {
      const valor = payload.valor ?? 0
      if (valor < 0) return Response.json({ erro: 'Valor de cura inválido' }, { status: 400 })
      // valor 0 é válido — cobre o uso de item/magia sem efeito de cura
      // (só registra o uso no log, sem alterar PV).
      if (valor > 0) {
        patch.pv_atual = Math.min(personagem.pv_maximo as number, (personagem.pv_atual as number) + valor)
      }
      valorLog = valor > 0 ? valor : null
      descricao = valor > 0
        ? `${personagem.nome} recuperou ${valor} PV`
        : `${personagem.nome} usou ${nomeAcao}`
      break
    }
    case 'pv_temporarios': {
      const valor = Math.max(0, payload.valor ?? 0)
      patch.pv_temporarios = valor
      valorLog = valor
      descricao = valor > 0 ? `${personagem.nome} ganhou ${valor} PV temporários` : `${personagem.nome} perdeu os PV temporários`
      break
    }
    case 'condicao_aplicada': {
      if (!payload.condicao) return Response.json({ erro: 'Condição não informada' }, { status: 400 })
      const atuais = (personagem.condicoes ?? []) as string[]
      if (!atuais.includes(payload.condicao)) {
        patch.condicoes = [...atuais, payload.condicao]
      }
      descricao = `${personagem.nome} ficou ${payload.condicao}`
      break
    }
    case 'condicao_removida': {
      if (!payload.condicao) return Response.json({ erro: 'Condição não informada' }, { status: 400 })
      const atuais = (personagem.condicoes ?? []) as string[]
      patch.condicoes = atuais.filter(c => c !== payload.condicao)
      descricao = `${personagem.nome} não está mais ${payload.condicao}`
      break
    }
    case 'usar_espaco': {
      const nivelStr = String(payload.nivelMagia ?? '')
      const slotsDb = (personagem.slots_magia ?? {}) as SlotsMagiaDb
      const slot = slotsDb[nivelStr] ?? { total: 0, usados: 0 }
      if (slot.usados >= slot.total) {
        return Response.json({ erro: `Sem espaços de ${payload.nivelMagia}º nível disponíveis` }, { status: 403 })
      }
      patch.slots_magia = { ...slotsDb, [nivelStr]: { ...slot, usados: slot.usados + 1 } }
      descricao = `${personagem.nome} gastou um espaço de ${payload.nivelMagia}º nível`
      break
    }
    case 'recuperar_espaco': {
      const nivelStr = String(payload.nivelMagia ?? '')
      const slotsDb = (personagem.slots_magia ?? {}) as SlotsMagiaDb
      const slot = slotsDb[nivelStr] ?? { total: 0, usados: 0 }
      patch.slots_magia = { ...slotsDb, [nivelStr]: { ...slot, usados: Math.max(0, slot.usados - 1) } }
      descricao = `${personagem.nome} recuperou um espaço de ${payload.nivelMagia}º nível`
      break
    }
    case 'usar_inspiracao': {
      const atual = (personagem.inspiracao as number) ?? 0
      if (atual <= 0) return Response.json({ erro: 'Sem inspiração disponível' }, { status: 403 })
      patch.inspiracao = atual - 1
      descricao = `${personagem.nome} usou 1 inspiração heroica`
      break
    }
    case 'ajuste_ouro': {
      if (!payload.moeda) return Response.json({ erro: 'Moeda não informada' }, { status: 400 })
      const valor = payload.valor ?? 0
      const moedasDb = (personagem.moedas ?? {}) as MoedasDb
      const novoValor = Math.max(0, (moedasDb[payload.moeda] ?? 0) + valor)
      patch.moedas = { ...moedasDb, [payload.moeda]: novoValor }
      valorLog = valor
      descricao = `${personagem.nome}: ${valor >= 0 ? '+' : ''}${valor} ${payload.moeda}`
      break
    }
    case 'descanso_longo': {
      const slotsDb = (personagem.slots_magia ?? {}) as SlotsMagiaDb
      const slotsRecuperados: SlotsMagiaDb = {}
      for (const [nivel, slot] of Object.entries(slotsDb)) slotsRecuperados[nivel] = { ...slot, usados: 0 }
      patch.pv_atual = personagem.pv_maximo
      patch.slots_magia = slotsRecuperados

      const totalDados = (personagem.dados_vida_total as number | null) ?? (personagem.nivel as number) ?? 1
      const usadosAtuais = (personagem.dados_vida_usados as number) ?? 0
      patch.dados_vida_usados = Math.max(0, usadosAtuais - Math.max(1, Math.floor(totalDados / 2)))

      descricao = `${personagem.nome} fez um descanso longo — PV e espaços de magia recuperados`
      break
    }
    case 'descanso_curto': {
      const dadosGastos = payload.dadosGastos ?? 0
      const curaInformada = payload.curaInformada ?? 0
      if (dadosGastos <= 0) return Response.json({ erro: 'Informe quantos dados de vida gastar' }, { status: 400 })

      const totalDados = (personagem.dados_vida_total as number | null) ?? (personagem.nivel as number) ?? 1
      const usadosAtuais = (personagem.dados_vida_usados as number) ?? 0
      if (usadosAtuais + dadosGastos > totalDados) {
        return Response.json(
          { erro: `Só restam ${totalDados - usadosAtuais} dado(s) de vida disponíveis` },
          { status: 403 }
        )
      }

      patch.pv_atual = Math.min(personagem.pv_maximo as number, (personagem.pv_atual as number) + curaInformada)
      patch.dados_vida_usados = usadosAtuais + dadosGastos
      valorLog = curaInformada

      // Pacto Arcano (Bruxo) recupera todos os espaços de magia no descanso
      // curto, não no longo — é a mecânica central da classe.
      if (ehPactoArcano(personagem.classe as string | null)) {
        const slotsDb = (personagem.slots_magia ?? {}) as SlotsMagiaDb
        const slotsRecuperados: SlotsMagiaDb = {}
        for (const [nivel, slot] of Object.entries(slotsDb)) slotsRecuperados[nivel] = { ...slot, usados: 0 }
        patch.slots_magia = slotsRecuperados
      }

      descricao = `${personagem.nome} fez um descanso curto — gastou ${dadosGastos} dado(s) de vida, recuperou ${curaInformada} PV`
      break
    }
    default:
      return Response.json({ erro: 'Tipo de ação inválido para sessão' }, { status: 400 })
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('personagens').update(patch).eq('id', personagemId)
    if (error) {
      console.error('Erro ao aplicar ação de sessão:', error)
      return Response.json({ erro: 'Erro ao salvar alteração no personagem' }, { status: 500 })
    }
  }

  const { data: autorProfile } = await admin.from('profiles').select('nome').eq('id', userId).maybeSingle()

  const { error: erroLog } = await admin.from('sessao_log').insert({
    sessao_id: sessaoId,
    tipo,
    autor_id: userId,
    autor_nome: autorProfile?.nome ?? (ehDM ? 'DM' : personagem.nome),
    personagem_id: personagemId,
    valor: valorLog,
    tipo_dano: payload.tipoDano ?? null,
    descricao: payload.descricao ? `${descricao} (${payload.descricao})` : descricao,
  })
  if (erroLog) {
    console.error('Erro ao gravar log da ação de sessão (efeito já aplicado):', erroLog)
  }

  const { data: personagemAtualizado } = await admin.from('personagens').select('*').eq('id', personagemId).maybeSingle()

  return Response.json({ ok: true, personagem: personagemAtualizado, descricao, nomeAcao })
}
