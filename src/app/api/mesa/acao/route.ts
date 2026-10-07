import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcularDano, aplicarCura, consumirEspaco } from '@/lib/batalha/motor'
import { normalizarTipoDano, MODIFICADOR_RESISTENCIA, MODIFICADOR_VULNERABILIDADE } from '@/lib/dados-dnd/tipos-dano'
import { ehPactoArcano } from '@/lib/dados-dnd/espacos-magia'
import type { TipoDano } from '@/types/dnd'
import type { TipoCondicao, TipoEntradaLog, EspacosMagiaBatalha } from '@/types/batalha'

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

// ajuste_ouro NÃO está aqui — vive só em TipoAcaoInventario. Já esteve
// duplicado nos dois vocabulários (aqui com payload.moeda singular,
// ali com payload.moedas em lote); a versão daqui nunca foi atualizada
// para o formato em lote, e como o dispatcher só desviava para o handler
// novo quando havia batalhaId, todo ajuste_ouro de sessão (o caso do
// ModalOuro) caía nesta versão velha e quebrava. Ver TipoAcaoInventario.
type TipoAcaoSessao =
  | 'dano' | 'cura' | 'pv_temporarios'
  | 'condicao_aplicada' | 'condicao_removida'
  | 'usar_espaco' | 'recuperar_espaco'
  | 'usar_inspiracao'
  | 'descanso_longo' | 'descanso_curto'

interface AcaoSessaoPayload {
  sessaoId: string
  personagemId: string
  tipo: TipoAcaoSessao
  valor?: number
  tipoDano?: TipoDano
  condicao?: TipoCondicao
  nivelMagia?: number
  dadosGastos?: number
  curaInformada?: number
  nomeAcao?: string
  descricao?: string
}

// Ações de inventário — funcionam em três modos: sessão (sessaoId+
// personagemId), batalha (batalhaId+combatenteId, resolvido para o
// personagem vinculado ao combatente — dar poção no meio do combate é
// comum) e ficha (só personagemId, sem sessão/batalha — a ficha pode ser
// editada a qualquer momento, inclusive fora de uma sessão em andamento).
// Diferem do branch de batalha "clássico" (tratarAcaoBatalha) por não terem
// `alvos` — o efeito é sempre sobre o próprio personagem de origem (ou,
// no caso de transferência/distribuição, sobre outro personagem indicado
// explicitamente por id).
type TipoAcaoInventario =
  | 'usar_item' | 'equipar_item' | 'descartar_item' | 'adicionar_item' | 'definir_item'
  | 'transferir_item' | 'transferir_moeda' | 'ajuste_ouro' | 'distribuir' | 'conceder_inspiracao'

interface ItemDistribuido {
  nome: string
  tipo?: string | null
  raridade?: string | null
  descricao?: string | null
  quantidade: number
  itemRef?: string | null
}

interface AcaoInventarioPayload {
  batalhaId?: string
  combatenteId?: string
  sessaoId?: string
  personagemId?: string
  tipo: TipoAcaoInventario
  itemId?: string
  itemRef?: string | null
  nome?: string
  tipoItem?: string | null
  raridade?: string | null
  descricaoItem?: string | null
  quantidade?: number
  equipado?: boolean
  remover?: boolean
  valorCura?: number
  paraPersonagemId?: string
  moeda?: 'pc' | 'pp' | 'pe' | 'po' | 'pl'
  valor?: number
  moedas?: MoedasDb
  paraPersonagemIds?: string[]
  itens?: ItemDistribuido[]
}

// Edição de estado sem ator — o mestre acertando um número, não narrando uma
// ação. Cada tipo é nomeado e tem validação própria: NÃO existe patch
// genérico de campos aqui, de propósito (ver tratarAcaoEstado).
type TipoAcaoEstado =
  | 'dano_ambiente' | 'cura_ambiente' | 'ajustar_pv'
  | 'definir_pv_maximo' | 'definir_espacos' | 'zerar_contadores'

interface AlvoEstadoPayload {
  combatenteId: string
  valor?: number
  pvTemporarios?: number
  pvMaximo?: number
  nivelMagia?: number
  usar?: boolean
}

interface AcaoEstadoPayload {
  batalhaId: string
  tipo: TipoAcaoEstado
  alvos: AlvoEstadoPayload[]
  tipoDano?: TipoDano
  motivo?: string
}

const TIPOS_ESTADO = new Set<string>([
  'dano_ambiente', 'cura_ambiente', 'ajustar_pv', 'definir_pv_maximo', 'definir_espacos', 'zerar_contadores',
])

const TIPOS_INVENTARIO = new Set<string>([
  'usar_item', 'equipar_item', 'descartar_item', 'adicionar_item', 'definir_item',
  'transferir_item', 'transferir_moeda', 'ajuste_ouro', 'distribuir', 'conceder_inspiracao',
])

type SlotsMagiaDb = Record<string, { total: number; usados: number }>
type MoedasDb = Partial<Record<'pc' | 'pp' | 'pe' | 'po' | 'pl', number>>

// `tipo` tem um vocabulário de literais diferente (e incompatível) em cada
// um dos três payloads — interseccionar os três tipos direto faz esse campo
// colapsar para `never` no TS (e o objeto inteiro junto). Por isso ele é
// excluído aqui e tratado como string solta; cada handler faz o `as` para
// seu payload específico antes de usar `tipo` com o literal union certo.
type PayloadBruto =
  Omit<Partial<AcaoBatalhaPayload>, 'tipo'> &
  Omit<Partial<AcaoSessaoPayload>, 'tipo'> &
  Omit<Partial<AcaoInventarioPayload>, 'tipo'> &
  { tipo?: string }

// Edição de estado tem alvos com outro formato — fora da interseção acima.
type PayloadBrutoEstado = Omit<PayloadBruto, 'alvos'> & { alvos?: AlvoEstadoPayload[] }

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as PayloadBruto

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const tipoRecebido = payload.tipo

  // Ações de inventário (incluindo ajuste_ouro) têm o próprio discriminador
  // (o `tipo`, não a presença de alvos) — checadas antes do branch clássico
  // de batalha para não colidir com o 'usar_item' antigo (TipoEntradaLog,
  // baseado em `alvos`, sem itemId — ver TabelaCombate/usarItem em
  // MesaCliente.tsx, que continua intacto). Uma implementação só de
  // ajuste_ouro, usada por sessão e batalha igualmente — antes havia um
  // special-case aqui que só desviava para tratarAcaoInventario com
  // batalhaId, deixando o ajuste_ouro de sessão cair no case legado (e
  // divergente) de tratarAcaoSessao, que não entendia o payload em lote
  // que o ModalOuro manda. Removido para não repetir esse bug.
  if (tipoRecebido && TIPOS_INVENTARIO.has(tipoRecebido)) {
    return tratarAcaoInventario(payload as AcaoInventarioPayload, user.id, admin)
  }
  if (tipoRecebido && TIPOS_ESTADO.has(tipoRecebido)) {
    return tratarAcaoEstado(payload as PayloadBrutoEstado as Partial<AcaoEstadoPayload>, user.id, admin)
  }
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

    // Alvo com ficha: PV vem de personagens, não da cópia em batalha_combatentes.
    // Sem a ficha, recusa — calcular sobre dado velho é pior do que não agir.
    const personagemIds = [...new Set(combatentesAlvo.map(c => c.personagem_id as string | null).filter((id): id is string => !!id))]
    if (personagemIds.length > 0) {
      const { data: fichas, error: erroFichas } = await admin
        .from('personagens')
        .select('id, pv_atual, pv_temporarios, pv_maximo')
        .in('id', personagemIds)
      if (erroFichas || !fichas || fichas.length !== personagemIds.length) {
        console.error('Erro ao ler fichas dos alvos:', erroFichas)
        return Response.json({ erro: 'Não foi possível ler a ficha dos alvos — tente de novo' }, { status: 500 })
      }
      const mapaFichas = new Map(fichas.map(f => [f.id as string, f]))
      // PV máximo é teto da cura: zero ou ausente zeraria o alvo. Ficha
      // quebrada aparece como erro, sem cair no valor da linha da batalha.
      const quebrado = combatentesAlvo.find(c => {
        const pvMax = mapaFichas.get(c.personagem_id as string)?.pv_maximo
        return c.personagem_id && !(typeof pvMax === 'number' && pvMax > 0)
      })
      if (quebrado) {
        console.error('Ficha com PV máximo inválido:', quebrado.personagem_id)
        return Response.json({ erro: `Não foi possível ler a ficha de ${quebrado.nome as string} — PV máximo inválido` }, { status: 500 })
      }
      combatentesAlvo = combatentesAlvo.map(c => {
        const ficha = c.personagem_id ? mapaFichas.get(c.personagem_id as string) : undefined
        return ficha
          ? { ...c, pv_atual: ficha.pv_atual ?? 0, pv_temporarios: ficha.pv_temporarios ?? 0, pv_maximo: ficha.pv_maximo }
          : c
      })
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
      const tipoDano = normalizarTipoDano(alvoPayload.tipoDano) ?? 'cortante'
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

      await admin.from('batalha_combatentes').update({ espacos_magia: novosSlots }).eq('id', ator.id)
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
// Edição de estado — sem ator, só o mestre. Cada tipo é uma regra nomeada:
// nada de aceitar um objeto de campos e gravar o que vier, senão qualquer
// cliente passaria a escrever qualquer coluna de batalha_combatentes e de
// personagens. Sem validação de turno: corrigir um número não é ação de turno.
// =============================================================================

const ORIGEM_AJUSTE = 'DM (ajuste)'

const ehInteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

// O que uma edição faz num combatente: patch da linha da batalha (espelho) e
// patch da ficha só com os campos que a edição mudou — nunca os quatro.
interface EfeitoEstado {
  combatente: Record<string, unknown>
  linha: Record<string, unknown>
  ficha: Record<string, unknown>
  descricao: string
  valor: number
  morreu: boolean
}

async function tratarAcaoEstado(
  payload: Partial<AcaoEstadoPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  const { batalhaId, tipo, alvos } = payload
  if (!batalhaId || !tipo || !Array.isArray(alvos)) {
    return Response.json({ erro: 'Payload inválido' }, { status: 400 })
  }

  const { data: batalha } = await admin.from('batalhas').select('*').eq('id', batalhaId).maybeSingle()
  if (!batalha) return Response.json({ erro: 'Batalha não encontrada' }, { status: 403 })

  const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', batalha.campanha_id).maybeSingle()
  if (!campanha || campanha.dm_id !== userId) {
    return Response.json({ erro: 'Só o mestre pode editar o estado dos combatentes' }, { status: 403 })
  }

  // Pausada continua editável: o mestre acerta números com o jogo parado.
  if (batalha.status === 'encerrada') {
    return Response.json({ erro: 'Esta batalha já foi encerrada.' }, { status: 403 })
  }

  // Zerar sem alvos = a batalha inteira. Os demais tipos exigem alvo.
  const todaBatalha = tipo === 'zerar_contadores' && alvos.length === 0
  if (!todaBatalha && alvos.length === 0) {
    return Response.json({ erro: 'Selecione ao menos um alvo' }, { status: 400 })
  }
  const alvoIds = alvos.map(a => a?.combatenteId)
  if (alvoIds.some(id => typeof id !== 'string' || !id) || new Set(alvoIds).size !== alvoIds.length) {
    return Response.json({ erro: 'Alvos inválidos ou repetidos' }, { status: 400 })
  }

  let consulta = admin.from('batalha_combatentes').select('*').eq('batalha_id', batalhaId)
  if (!todaBatalha) consulta = consulta.in('id', alvoIds)
  const { data: linhas, error: erroLinhas } = await consulta
  if (erroLinhas || !linhas) {
    console.error('Erro ao ler combatentes:', erroLinhas)
    return Response.json({ erro: 'Não foi possível ler os combatentes — tente de novo' }, { status: 500 })
  }
  if (!todaBatalha && linhas.length !== alvoIds.length) {
    return Response.json({ erro: 'Um ou mais alvos não pertencem a esta batalha' }, { status: 403 })
  }

  // Combatente com ficha: PV e espaços vêm de personagens, lidos agora. É
  // por isso que este caminho não precisa da guarda do store — não existe
  // cópia velha para empurrar de volta à ficha.
  const personagemIds = [...new Set(linhas.map(c => c.personagem_id as string | null).filter((id): id is string => !!id))]
  const mapaFichas = new Map<string, Record<string, unknown>>()
  if (personagemIds.length > 0) {
    const { data: fichas, error: erroFichas } = await admin
      .from('personagens')
      .select('id, pv_atual, pv_temporarios, pv_maximo, slots_magia')
      .in('id', personagemIds)
    if (erroFichas || !fichas || fichas.length !== personagemIds.length) {
      console.error('Erro ao ler fichas dos alvos:', erroFichas)
      return Response.json({ erro: 'Não foi possível ler a ficha dos alvos — tente de novo' }, { status: 500 })
    }
    fichas.forEach(f => mapaFichas.set(f.id as string, f))
  }

  // definir_pv_maximo é justamente o conserto de uma ficha com PV máximo
  // quebrado; definir_espacos não depende dele. Os demais usam o máximo
  // como teto e recusam ficha inválida, como o caminho de ator.
  if (tipo !== 'definir_pv_maximo' && tipo !== 'definir_espacos') {
    const quebrado = linhas.find(c => {
      const pvMax = c.personagem_id ? mapaFichas.get(c.personagem_id as string)?.pv_maximo : c.pv_maximo
      return !(typeof pvMax === 'number' && pvMax > 0)
    })
    if (quebrado) {
      console.error('Combatente com PV máximo inválido:', quebrado.id)
      return Response.json({ erro: `PV máximo inválido em ${quebrado.nome as string} — corrija o PV máximo antes` }, { status: 500 })
    }
  }

  const combatentes = new Map(linhas.map(c => {
    const ficha = c.personagem_id ? mapaFichas.get(c.personagem_id as string) : undefined
    const mesclado = ficha
      ? { ...c, pv_atual: ficha.pv_atual ?? 0, pv_temporarios: ficha.pv_temporarios ?? 0, pv_maximo: ficha.pv_maximo, slots_magia: ficha.slots_magia ?? {} }
      : c
    return [c.id as string, mesclado as Record<string, unknown>]
  }))

  const alvosResolvidos: { alvo: AlvoEstadoPayload; c: Record<string, unknown> }[] = todaBatalha
    ? [...combatentes.values()].map(c => ({ alvo: { combatenteId: c.id as string }, c }))
    : alvos.map(alvo => ({ alvo, c: combatentes.get(alvo.combatenteId)! }))

  // =========================================================================
  // Validação e cálculo — nada é gravado até todos os alvos passarem.
  // =========================================================================

  const efeitos: EfeitoEstado[] = []
  let xpGanho = 0
  const tipoDano = tipo === 'dano_ambiente' ? normalizarTipoDano(payload.tipoDano) : null

  if (tipo === 'dano_ambiente' && !tipoDano) {
    return Response.json({ erro: 'Escolha o tipo de dano — dano sem tipo não é aplicado' }, { status: 400 })
  }

  for (const { alvo, c } of alvosResolvidos) {
    const nome = c.nome as string
    const pvAtual = c.pv_atual as number
    const pvTemp = c.pv_temporarios as number
    const pvMax = c.pv_maximo as number

    switch (tipo) {
      case 'dano_ambiente': {
        if (!ehInteiro(alvo.valor) || alvo.valor <= 0) {
          return Response.json({ erro: `Valor de dano inválido para ${nome}` }, { status: 400 })
        }
        const { danoFinal, absorvidoTemporario, modificador } = calcularDano(alvo.valor, tipoDano, c as {
          pv_temporarios: number; resistencias: TipoDano[]; imunidades: TipoDano[]; vulnerabilidades: TipoDano[]
        })
        const novoPvTemp = pvTemp - absorvidoTemporario
        const novoPv = Math.max(0, pvAtual - (danoFinal - absorvidoTemporario))
        const morreu = pvAtual > 0 && novoPv === 0
        const ficha: Record<string, unknown> = {}
        if (novoPv !== pvAtual) ficha.pv_atual = novoPv
        if (novoPvTemp !== pvTemp) ficha.pv_temporarios = novoPvTemp
        let descricao = `${nome}: ${danoFinal}`
        if (modificador === MODIFICADOR_RESISTENCIA) descricao += ` (resistência: ${alvo.valor}→${danoFinal})`
        else if (modificador === MODIFICADOR_VULNERABILIDADE) descricao += ` (vulnerabilidade: ${alvo.valor}→${danoFinal})`
        else if (danoFinal === 0) descricao += ' (imune)'
        if (morreu) descricao += ' — caiu! 💀'
        efeitos.push({
          combatente: c,
          linha: {
            pv_atual: novoPv,
            pv_temporarios: novoPvTemp,
            dano_total: (c.dano_total as number) + danoFinal,
            ...(morreu ? { morto: false } : {}),
          },
          ficha,
          descricao,
          valor: danoFinal,
          morreu,
        })
        if (morreu && c.tipo === 'monstro') {
          const dadosMonstro = c.dados_monstro as { xp?: number } | null
          if (dadosMonstro?.xp) xpGanho += dadosMonstro.xp
        }
        break
      }

      case 'cura_ambiente': {
        if (!ehInteiro(alvo.valor) || alvo.valor <= 0) {
          return Response.json({ erro: `Valor de cura inválido para ${nome}` }, { status: 400 })
        }
        const { pvFinal, curaEfetiva } = aplicarCura(alvo.valor, { pv_atual: pvAtual, pv_maximo: pvMax })
        efeitos.push({
          combatente: c,
          linha: { pv_atual: pvFinal, cura_total: (c.cura_total as number) + alvo.valor },
          ficha: pvFinal !== pvAtual ? { pv_atual: pvFinal } : {},
          descricao: `${nome}: +${curaEfetiva}${curaEfetiva < alvo.valor ? ` (de ${alvo.valor}, no máximo)` : ''}`,
          valor: alvo.valor,
          morreu: false,
        })
        break
      }

      // Correção, não dano: valor absoluto, sem resistência, sem contadores.
      case 'ajustar_pv': {
        const temPv = alvo.valor !== undefined
        const temTemp = alvo.pvTemporarios !== undefined
        if (!temPv && !temTemp) {
          return Response.json({ erro: `Informe o PV de ${nome}` }, { status: 400 })
        }
        if ((temPv && !ehInteiro(alvo.valor)) || (temTemp && (!ehInteiro(alvo.pvTemporarios) || alvo.pvTemporarios < 0))) {
          return Response.json({ erro: `Valor de PV inválido para ${nome}` }, { status: 400 })
        }
        const linha: Record<string, unknown> = {}
        const partes: string[] = []
        if (temPv) {
          const novoPv = Math.max(0, Math.min(pvMax, alvo.valor as number))
          linha.pv_atual = novoPv
          partes.push(`PV ${pvAtual} → ${novoPv}`)
        }
        if (temTemp) {
          linha.pv_temporarios = alvo.pvTemporarios
          partes.push(`PV temp. ${pvTemp} → ${alvo.pvTemporarios}`)
        }
        const ficha: Record<string, unknown> = {}
        if (temPv && linha.pv_atual !== pvAtual) ficha.pv_atual = linha.pv_atual
        if (temTemp && linha.pv_temporarios !== pvTemp) ficha.pv_temporarios = linha.pv_temporarios
        efeitos.push({ combatente: c, linha, ficha, descricao: `${nome}: ${partes.join(', ')}`, valor: 0, morreu: false })
        break
      }

      // Máximo abaixo do atual corta o atual — os dois no mesmo update, para
      // a ficha nunca ficar com atual acima do máximo.
      case 'definir_pv_maximo': {
        if (!ehInteiro(alvo.pvMaximo) || alvo.pvMaximo <= 0) {
          return Response.json({ erro: `PV máximo inválido para ${nome}` }, { status: 400 })
        }
        const novoMax = alvo.pvMaximo
        const novoAtual = Math.min(pvAtual, novoMax)
        const linha: Record<string, unknown> = { pv_maximo: novoMax }
        const ficha: Record<string, unknown> = {}
        if (novoMax !== pvMax) ficha.pv_maximo = novoMax
        let descricao = `${nome}: PV máximo ${pvMax} → ${novoMax}`
        if (novoAtual !== pvAtual) {
          linha.pv_atual = novoAtual
          ficha.pv_atual = novoAtual
          descricao += ` (PV atual ${pvAtual} → ${novoAtual})`
        }
        efeitos.push({ combatente: c, linha, ficha, descricao, valor: 0, morreu: false })
        break
      }

      case 'definir_espacos': {
        const nivel = alvo.nivelMagia
        if (!ehInteiro(nivel) || nivel < 1 || nivel > 9 || typeof alvo.usar !== 'boolean') {
          return Response.json({ erro: `Nível de espaço inválido para ${nome}` }, { status: 400 })
        }
        const semEspaco = `Sem espaços de magia de ${nivel}º nível disponíveis — escolha outro nível ou espere um descanso.`
        const nivelStr = String(nivel)
        const verbo = alvo.usar ? 'gastou' : 'recuperou'
        const descricao = `${nome}: ${verbo} 1 espaço de ${nivel}º nível`

        if (c.personagem_id) {
          const slots = (c.slots_magia ?? {}) as SlotsMagiaDb
          let novos: SlotsMagiaDb
          if (alvo.usar) {
            const { novosEspacos, ok } = consumirEspaco(slots as EspacosMagiaBatalha, nivel)
            if (!ok) return Response.json({ erro: semEspaco }, { status: 403 })
            novos = novosEspacos as SlotsMagiaDb
          } else {
            const slot = slots[nivelStr]
            if (!slot) return Response.json({ erro: `${nome} não tem espaços de ${nivel}º nível` }, { status: 400 })
            novos = { ...slots, [nivelStr]: { ...slot, usados: Math.max(0, slot.usados - 1) } }
          }
          efeitos.push({ combatente: c, linha: { espacos_magia: novos }, ficha: { slots_magia: novos }, descricao, valor: 0, morreu: false })
        } else {
          const slots = (c.slots_monstro ?? {}) as Record<string, number>
          const qtd = slots[nivelStr] ?? 0
          if (alvo.usar && qtd <= 0) return Response.json({ erro: semEspaco }, { status: 403 })
          const novos = { ...slots, [nivelStr]: alvo.usar ? qtd - 1 : qtd + 1 }
          efeitos.push({ combatente: c, linha: { slots_monstro: novos }, ficha: {}, descricao, valor: 0, morreu: false })
        }
        break
      }

      // PV ao máximo, contadores zerados, morto desmarcado. Espaços de magia
      // e PV temporários ficam como estão.
      case 'zerar_contadores': {
        efeitos.push({
          combatente: c,
          linha: { dano_total: 0, cura_total: 0, pv_atual: pvMax, morto: false },
          ficha: pvAtual !== pvMax ? { pv_atual: pvMax } : {},
          descricao: nome,
          valor: 0,
          morreu: false,
        })
        break
      }

      default:
        return Response.json({ erro: 'Tipo de edição inválido' }, { status: 400 })
    }
  }

  // =========================================================================
  // Gravação — ficha primeiro (fonte da verdade), depois o espelho na linha
  // da batalha, que as telas dos jogadores leem quando a ficha não chega.
  // =========================================================================

  for (const { combatente, linha, ficha } of efeitos) {
    if (combatente.personagem_id && Object.keys(ficha).length > 0) {
      const { error } = await admin.from('personagens').update(ficha).eq('id', combatente.personagem_id as string)
      if (error) {
        console.error('Erro ao gravar ficha (edição de estado):', error)
        return Response.json({ erro: `Erro ao salvar a ficha de ${combatente.nome as string}` }, { status: 500 })
      }
    }
    const { error } = await admin.from('batalha_combatentes').update(linha).eq('id', combatente.id as string)
    if (error) {
      console.error('Erro ao gravar combatente (edição de estado):', error)
      return Response.json({ erro: `Erro ao salvar ${combatente.nome as string}` }, { status: 500 })
    }
  }

  // Uma entrada por ação, mesmo em lote. Dano e cura entram como 'dano'/
  // 'cura' (contam no diário, atribuídos ao ajuste do mestre); correções
  // entram como 'sistema'.
  const rotulos: Record<TipoAcaoEstado, string> = {
    dano_ambiente: `💥 Dano (${tipoDano})`,
    cura_ambiente: '💚 Cura',
    ajustar_pv: '✏️ PV ajustado',
    definir_pv_maximo: '✏️ PV máximo',
    definir_espacos: '✨ Espaço de magia',
    zerar_contadores: '🔄 Contadores zerados — PV ao máximo e mortos revividos',
  }
  const descricaoFinal = [
    rotulos[tipo],
    `— ${efeitos.map(e => e.descricao).join(', ')}`,
    payload.motivo?.trim() ? `(${payload.motivo.trim()})` : '',
  ].filter(Boolean).join(' ')
  const tipoLog: TipoEntradaLog = tipo === 'dano_ambiente' ? 'dano' : tipo === 'cura_ambiente' ? 'cura' : 'sistema'
  const somaValores = tipoLog === 'sistema' ? null : efeitos.reduce((soma, e) => soma + e.valor, 0)

  const { data: logInserido, error: erroLog } = await admin
    .from('batalha_log')
    .insert({
      batalha_id: batalhaId,
      rodada: batalha.rodada_atual,
      turno: null,
      tipo: tipoLog,
      autor_id: null,
      autor_nome: ORIGEM_AJUSTE,
      alvo_id: efeitos.length === 1 ? efeitos[0].combatente.id : null,
      alvo_nome: todaBatalha ? 'Todos' : efeitos.map(e => e.combatente.nome as string).join(', '),
      valor: somaValores,
      tipo_dano: tipoDano,
      descricao: descricaoFinal,
      resumo: false,
    })
    .select()
    .maybeSingle()
  if (erroLog) {
    console.error('Erro ao gravar log da edição de estado (efeito já aplicado):', erroLog)
  }

  return Response.json({
    ok: true,
    combatentesAfetados: efeitos.map(e => ({ id: e.combatente.id, nome: e.combatente.nome, valor: e.valor, morreu: e.morreu })),
    xpGanho,
    log: logInserido ?? null,
  })
}

// =============================================================================
// Modo sessão — ações fora de combate, sem turno, sempre sobre um
// personagem (nunca um "alvo" de ataque — fora de combate não existe isso).
// =============================================================================

// Recursos de classe (recursos_personagem) no descanso:
// - longo: zera usados de todos;
// - curto: zera 'curto', devolve 1 uso de 'um_curto_todos_longo' (piso 0),
//   não mexe em 'longo'.
async function recuperarRecursosNoDescanso(
  admin: ReturnType<typeof createAdminClient>,
  personagemId: string,
  descanso: 'longo' | 'curto'
): Promise<unknown> {
  const agora = new Date().toISOString()
  if (descanso === 'longo') {
    const { error } = await admin.from('recursos_personagem')
      .update({ usados: 0, atualizado_em: agora })
      .eq('personagem_id', personagemId)
      .gt('usados', 0)
    return error
  }

  const { error: erroCurto } = await admin.from('recursos_personagem')
    .update({ usados: 0, atualizado_em: agora })
    .eq('personagem_id', personagemId)
    .eq('recuperacao', 'curto')
    .gt('usados', 0)
  if (erroCurto) return erroCurto

  const { data: parciais, error: erroBusca } = await admin.from('recursos_personagem')
    .select('id, usados')
    .eq('personagem_id', personagemId)
    .eq('recuperacao', 'um_curto_todos_longo')
    .gt('usados', 0)
  if (erroBusca) return erroBusca
  for (const r of parciais ?? []) {
    const { error } = await admin.from('recursos_personagem')
      .update({ usados: Math.max(0, (r.usados as number) - 1), atualizado_em: agora })
      .eq('id', r.id)
    if (error) return error
  }
  return null
}

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
    case 'descanso_longo': {
      const slotsDb = (personagem.slots_magia ?? {}) as SlotsMagiaDb
      const slotsRecuperados: SlotsMagiaDb = {}
      for (const [nivel, slot] of Object.entries(slotsDb)) slotsRecuperados[nivel] = { ...slot, usados: 0 }
      patch.pv_atual = personagem.pv_maximo
      patch.slots_magia = slotsRecuperados

      const totalDados = (personagem.dados_vida_total as number | null) ?? (personagem.nivel as number) ?? 1
      const usadosAtuais = (personagem.dados_vida_usados as number) ?? 0
      patch.dados_vida_usados = Math.max(0, usadosAtuais - Math.max(1, Math.floor(totalDados / 2)))

      descricao = `${personagem.nome} fez um descanso longo — PV, espaços de magia e recursos de classe recuperados`
      break
    }
    case 'descanso_curto': {
      // dadosGastos = 0 é válido: descanso curto sem gastar dado de vida
      // ainda recupera recursos de classe (Canalizar Divindade, Segundo
      // Fôlego...) e Pacto Arcano. Sem dado gasto não há cura.
      const dadosGastos = payload.dadosGastos ?? 0
      const curaInformada = dadosGastos > 0 ? (payload.curaInformada ?? 0) : 0
      if (!Number.isInteger(dadosGastos) || dadosGastos < 0) {
        return Response.json({ erro: 'Quantidade de dados de vida inválida' }, { status: 400 })
      }

      const totalDados = (personagem.dados_vida_total as number | null) ?? (personagem.nivel as number) ?? 1
      const usadosAtuais = (personagem.dados_vida_usados as number) ?? 0
      if (dadosGastos > 0 && usadosAtuais + dadosGastos > totalDados) {
        return Response.json(
          { erro: `Só restam ${totalDados - usadosAtuais} dado(s) de vida disponíveis` },
          { status: 403 }
        )
      }

      if (dadosGastos > 0) {
        patch.pv_atual = Math.min(personagem.pv_maximo as number, (personagem.pv_atual as number) + curaInformada)
        patch.dados_vida_usados = usadosAtuais + dadosGastos
        valorLog = curaInformada
      }

      // Pacto Arcano (Bruxo) recupera todos os espaços de magia no descanso
      // curto, não no longo — é a mecânica central da classe.
      if (ehPactoArcano(personagem.classe as string | null)) {
        const slotsDb = (personagem.slots_magia ?? {}) as SlotsMagiaDb
        const slotsRecuperados: SlotsMagiaDb = {}
        for (const [nivel, slot] of Object.entries(slotsDb)) slotsRecuperados[nivel] = { ...slot, usados: 0 }
        patch.slots_magia = slotsRecuperados
      }

      descricao = dadosGastos > 0
        ? `${personagem.nome} fez um descanso curto — gastou ${dadosGastos} dado(s) de vida, recuperou ${curaInformada} PV`
        : `${personagem.nome} fez um descanso curto sem gastar dados de vida`
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

  if (tipo === 'descanso_longo' || tipo === 'descanso_curto') {
    const erroRecursos = await recuperarRecursosNoDescanso(admin, personagemId, tipo === 'descanso_longo' ? 'longo' : 'curto')
    if (erroRecursos) {
      console.error('Erro ao recuperar recursos de classe no descanso:', erroRecursos)
      return Response.json({ erro: 'Descanso aplicado, mas os recursos de classe não foram recuperados' }, { status: 500 })
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

// =============================================================================
// Inventário — usar/equipar/descartar/transferir item, transferir moeda,
// ajustar ouro e distribuir (DM). Funciona a partir de sessão ou de batalha:
// o resolvedor abaixo reduz os dois modos a um único "personagem de origem"
// + uma função de log que grava no destino certo (sessao_log/batalha_log).
// =============================================================================

// O legado (personagens.inventario, migrado para inventario_itens) mistura
// item_ref numérico avulso e slug de compêndio para o "mesmo" item conforme
// quem cadastrou — ex.: "Poção de Cura" existe como item_ref '1' num
// personagem e 'potion-of-healing' noutro. Casar só por item_ref nesse
// cenário cria linhas duplicadas do mesmo item ao transferir/distribuir.
// Por isso o match de "é o mesmo item" usa item_ref OU (nome normalizado +
// tipo) como fallback — não é gambiarra, é a regra combinada para não
// duplicar itens herdados de fontes diferentes (ficha antiga vs. compêndio).
function normalizarNomeItem(nome: string): string {
  return nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function encontrarItemCorrespondente(
  itens: { id: string; item_ref: string | null; nome: string; tipo: string | null; quantidade: number }[],
  alvo: { item_ref: string | null; nome: string; tipo: string | null }
) {
  const nomeAlvo = normalizarNomeItem(alvo.nome)
  return itens.find(i =>
    (alvo.item_ref && i.item_ref === alvo.item_ref) ||
    (normalizarNomeItem(i.nome) === nomeAlvo && (i.tipo ?? null) === (alvo.tipo ?? null))
  )
}

interface ContextoInventario {
  personagem: Record<string, unknown>
  campanhaId: string
  sessaoId: string | null
  ehDM: boolean
  registrarLog: (args: { valor?: number | null; descricao: string }) => Promise<void>
}

type ResultadoContexto = { ok: true; contexto: ContextoInventario } | { ok: false; erro: string; status: number }

async function resolverContextoInventario(
  payload: Partial<AcaoInventarioPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<ResultadoContexto> {
  if (payload.batalhaId) {
    if (!payload.combatenteId) return { ok: false, erro: 'Payload inválido', status: 400 }

    const { data: batalha } = await admin.from('batalhas').select('*').eq('id', payload.batalhaId).maybeSingle()
    if (!batalha) return { ok: false, erro: 'Batalha não encontrada', status: 403 }
    if (batalha.status !== 'ativa') {
      const mensagensPorStatus: Record<string, string> = {
        preparacao: 'A batalha ainda não foi iniciada pelo mestre.',
        pausada: 'A batalha está pausada — peça ao mestre para retomar.',
        encerrada: 'Esta batalha já foi encerrada.',
      }
      return { ok: false, erro: mensagensPorStatus[batalha.status] ?? 'A batalha não está ativa no momento.', status: 403 }
    }

    const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', batalha.campanha_id).maybeSingle()
    const ehDM = !!campanha && campanha.dm_id === userId

    const { data: ator } = await admin
      .from('batalha_combatentes')
      .select('*')
      .eq('id', payload.combatenteId)
      .eq('batalha_id', payload.batalhaId)
      .maybeSingle()
    if (!ator) return { ok: false, erro: 'Combatente não encontrado nesta batalha', status: 403 }
    if (!ator.personagem_id) {
      return { ok: false, erro: 'Este combatente não tem ficha vinculada — sem inventário', status: 400 }
    }

    if (!ehDM) {
      let controla = ator.controlado_por === userId
      if (!controla) {
        const { data: personagemCheck } = await admin
          .from('personagens').select('user_id').eq('id', ator.personagem_id).maybeSingle()
        controla = personagemCheck?.user_id === userId
      }
      if (!controla) {
        return {
          ok: false,
          erro: 'Você não controla este combatente — verifique se selecionou o personagem certo.',
          status: 403,
        }
      }
    }

    const { data: personagem } = await admin.from('personagens').select('*').eq('id', ator.personagem_id).maybeSingle()
    if (!personagem) return { ok: false, erro: 'Personagem não encontrado', status: 403 }

    return {
      ok: true,
      contexto: {
        personagem,
        campanhaId: batalha.campanha_id,
        sessaoId: batalha.sessao_id ?? null,
        ehDM,
        registrarLog: async ({ valor = null, descricao }) => {
          const { error } = await admin.from('batalha_log').insert({
            batalha_id: payload.batalhaId,
            rodada: batalha.rodada_atual,
            turno: null,
            tipo: 'nota',
            autor_id: ator.id,
            autor_nome: ator.nome,
            alvo_id: null,
            alvo_nome: null,
            valor,
            tipo_dano: null,
            descricao,
            resumo: false,
          })
          if (error) console.error('Erro ao gravar log de inventário (batalha):', error)
        },
      },
    }
  }

  if (payload.sessaoId) {
    if (!payload.personagemId) return { ok: false, erro: 'Payload inválido', status: 400 }

    const { data: sessao } = await admin.from('sessoes').select('*').eq('id', payload.sessaoId).maybeSingle()
    if (!sessao) return { ok: false, erro: 'Sessão não encontrada', status: 403 }
    if (sessao.status === 'encerrada') return { ok: false, erro: 'Esta sessão já foi encerrada.', status: 403 }

    const { data: personagem } = await admin.from('personagens').select('*').eq('id', payload.personagemId).maybeSingle()
    if (!personagem || personagem.campanha_id !== sessao.campanha_id) {
      return { ok: false, erro: 'Personagem não encontrado nesta campanha', status: 403 }
    }

    const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', sessao.campanha_id).maybeSingle()
    const ehDM = !!campanha && campanha.dm_id === userId
    if (!ehDM && personagem.user_id !== userId) {
      return {
        ok: false,
        erro: 'Você não controla este personagem — verifique se selecionou o personagem certo.',
        status: 403,
      }
    }

    return {
      ok: true,
      contexto: {
        personagem,
        campanhaId: sessao.campanha_id,
        sessaoId: sessao.id,
        ehDM,
        registrarLog: async ({ valor = null, descricao }) => {
          const { data: autorProfile } = await admin.from('profiles').select('nome').eq('id', userId).maybeSingle()
          const { error } = await admin.from('sessao_log').insert({
            sessao_id: payload.sessaoId,
            tipo: 'nota',
            autor_id: userId,
            autor_nome: autorProfile?.nome ?? (ehDM ? 'DM' : (personagem.nome as string)),
            personagem_id: personagem.id,
            valor,
            tipo_dano: null,
            descricao,
          })
          if (error) console.error('Erro ao gravar log de inventário (sessão):', error)
        },
      },
    }
  }

  // Modo ficha — sem sessão nem batalha. A ficha pode ser editada a
  // qualquer momento (adicionar item do compêndio, ajustar quantidade,
  // equipar, remover), não só durante uma sessão ativa. Sem sessaoId/
  // batalhaId não há onde registrar sessao_log/batalha_log — registrarLog
  // não faz nada nesse modo (a mudança já fica visível no próprio inventário).
  if (payload.personagemId) {
    const { data: personagem } = await admin.from('personagens').select('*').eq('id', payload.personagemId).maybeSingle()
    if (!personagem) return { ok: false, erro: 'Personagem não encontrado', status: 404 }

    const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', personagem.campanha_id).maybeSingle()
    const ehDM = !!campanha && campanha.dm_id === userId
    if (!ehDM && personagem.user_id !== userId) {
      return {
        ok: false,
        erro: 'Você não controla este personagem — verifique se selecionou o personagem certo.',
        status: 403,
      }
    }

    return {
      ok: true,
      contexto: {
        personagem,
        campanhaId: personagem.campanha_id,
        sessaoId: null,
        ehDM,
        registrarLog: async () => {},
      },
    }
  }

  return { ok: false, erro: 'Payload inválido — informe batalhaId, sessaoId ou personagemId', status: 400 }
}

async function tratarAcaoInventario(
  payload: Partial<AcaoInventarioPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  if (!payload.tipo) return Response.json({ erro: 'Payload inválido' }, { status: 400 })

  // 'distribuir' não parte do inventário de um "ator" — o DM cria itens/
  // moedas do zero para um ou mais personagens — então tem validação própria.
  if (payload.tipo === 'distribuir') {
    return tratarDistribuir(payload, userId, admin)
  }

  const resultado = await resolverContextoInventario(payload, userId, admin)
  if (!resultado.ok) return Response.json({ erro: resultado.erro }, { status: resultado.status })
  const { personagem, campanhaId, sessaoId, registrarLog } = resultado.contexto
  const personagemId = personagem.id as string
  const personagemNome = personagem.nome as string

  switch (payload.tipo) {
    case 'usar_item': {
      if (!payload.itemId) return Response.json({ erro: 'Item não informado' }, { status: 400 })
      const { data: item } = await admin
        .from('inventario_itens').select('*').eq('id', payload.itemId).eq('personagem_id', personagemId).maybeSingle()
      if (!item) return Response.json({ erro: 'Item não encontrado no inventário' }, { status: 404 })

      const novaQtd = (item.quantidade as number) - 1
      if (novaQtd <= 0) {
        await admin.from('inventario_itens').delete().eq('id', item.id)
      } else {
        await admin.from('inventario_itens').update({ quantidade: novaQtd }).eq('id', item.id)
      }

      const valorCura = payload.valorCura ?? 0
      let descricao = `${personagemNome} usou ${item.nome}`
      if (valorCura > 0) {
        const novoPv = Math.min(personagem.pv_maximo as number, (personagem.pv_atual as number) + valorCura)
        await admin.from('personagens').update({ pv_atual: novoPv }).eq('id', personagemId)
        descricao += ` — recuperou ${valorCura} PV`
      }

      await registrarLog({ valor: valorCura > 0 ? valorCura : null, descricao })
      return Response.json({ ok: true, descricao })
    }

    case 'equipar_item': {
      if (!payload.itemId) return Response.json({ erro: 'Item não informado' }, { status: 400 })
      const { data: item } = await admin
        .from('inventario_itens').select('*').eq('id', payload.itemId).eq('personagem_id', personagemId).maybeSingle()
      if (!item) return Response.json({ erro: 'Item não encontrado no inventário' }, { status: 404 })

      const equipado = !!payload.equipado
      await admin.from('inventario_itens').update({ equipado }).eq('id', item.id)
      const descricao = `${personagemNome} ${equipado ? 'equipou' : 'desequipou'} ${item.nome}`
      await registrarLog({ descricao })
      return Response.json({ ok: true, descricao })
    }

    case 'descartar_item': {
      if (!payload.itemId) return Response.json({ erro: 'Item não informado' }, { status: 400 })
      const qtd = payload.quantidade ?? 1
      if (qtd <= 0) return Response.json({ erro: 'Quantidade inválida' }, { status: 400 })

      const { data: item } = await admin
        .from('inventario_itens').select('*').eq('id', payload.itemId).eq('personagem_id', personagemId).maybeSingle()
      if (!item) return Response.json({ erro: 'Item não encontrado no inventário' }, { status: 404 })

      const novaQtd = (item.quantidade as number) - qtd
      if (novaQtd <= 0) {
        await admin.from('inventario_itens').delete().eq('id', item.id)
      } else {
        await admin.from('inventario_itens').update({ quantidade: novaQtd }).eq('id', item.id)
      }

      const descricao = `${personagemNome} descartou ${qtd}x ${item.nome}`
      await registrarLog({ descricao })
      return Response.json({ ok: true, descricao })
    }

    case 'adicionar_item': {
      if (!payload.nome) return Response.json({ erro: 'Nome do item não informado' }, { status: 400 })
      const quantidade = payload.quantidade ?? 1
      if (quantidade <= 0) return Response.json({ erro: 'Quantidade inválida' }, { status: 400 })

      const { data: itensAtuais } = await admin.from('inventario_itens').select('*').eq('personagem_id', personagemId)
      const alvo = { item_ref: payload.itemRef ?? null, nome: payload.nome, tipo: payload.tipoItem ?? null }
      const existente = encontrarItemCorrespondente(itensAtuais ?? [], alvo)

      if (existente) {
        await admin.from('inventario_itens')
          .update({ quantidade: (existente.quantidade as number) + quantidade }).eq('id', existente.id)
      } else {
        const { error } = await admin.from('inventario_itens').insert({
          personagem_id: personagemId,
          item_ref: payload.itemRef ?? null,
          nome: payload.nome,
          tipo: alvo.tipo,
          raridade: payload.raridade ?? null,
          descricao: payload.descricaoItem ?? null,
          quantidade,
          equipado: false,
        })
        if (error) {
          console.error('Erro ao adicionar item:', error)
          return Response.json({ erro: 'Erro ao adicionar item' }, { status: 500 })
        }
      }

      const descricao = `${personagemNome} recebeu ${quantidade}x ${payload.nome}`
      await registrarLog({ descricao })
      return Response.json({ ok: true, descricao })
    }

    // Uso da ficha: quantidade absoluta (não delta) e/ou equipar, ou remoção
    // direta — os controles de +/- e o toggle de equipar na ficha já
    // calculam o valor final antes de chamar a API.
    case 'definir_item': {
      if (!payload.itemId) return Response.json({ erro: 'Item não informado' }, { status: 400 })
      const { data: item } = await admin
        .from('inventario_itens').select('*').eq('id', payload.itemId).eq('personagem_id', personagemId).maybeSingle()
      if (!item) return Response.json({ erro: 'Item não encontrado no inventário' }, { status: 404 })

      if (payload.remover) {
        await admin.from('inventario_itens').delete().eq('id', item.id)
        const descricao = `${personagemNome} removeu ${item.nome}`
        await registrarLog({ descricao })
        return Response.json({ ok: true, descricao })
      }

      const patch: Record<string, unknown> = {}
      if (payload.quantidade !== undefined) {
        if (payload.quantidade <= 0) {
          await admin.from('inventario_itens').delete().eq('id', item.id)
          const descricao = `${personagemNome} removeu ${item.nome}`
          await registrarLog({ descricao })
          return Response.json({ ok: true, descricao })
        }
        patch.quantidade = payload.quantidade
      }
      if (payload.equipado !== undefined) patch.equipado = payload.equipado

      if (Object.keys(patch).length > 0) {
        await admin.from('inventario_itens').update(patch).eq('id', item.id)
      }
      const descricao = `${personagemNome} atualizou ${item.nome}`
      await registrarLog({ descricao })
      return Response.json({ ok: true, descricao })
    }

    case 'transferir_item':
      return tratarTransferirItem(payload, userId, admin, personagem, campanhaId, sessaoId, registrarLog)

    case 'transferir_moeda':
      return tratarTransferirMoeda(payload, userId, admin, personagem, campanhaId, sessaoId, registrarLog)

    case 'ajuste_ouro': {
      // Única implementação de ajuste_ouro (sessão e batalha) — aceita as
      // duas formas de payload para não quebrar quem manda uma moeda só:
      // `moedas` (mapa, formato do ModalOuro — vários deltas numa chamada
      // só) tem prioridade; `moeda`+`valor` (singular) é o formato de
      // compatibilidade.
      const moedasDb = (personagem.moedas ?? {}) as MoedasDb

      if (payload.moedas) {
        const entradas = Object.entries(payload.moedas).filter(([, v]) => (v ?? 0) !== 0) as ['pc' | 'pp' | 'pe' | 'po' | 'pl', number][]
        if (entradas.length === 0) return Response.json({ erro: 'Informe ao menos uma moeda para ajustar' }, { status: 400 })
        const novasMoedas = { ...moedasDb }
        for (const [moeda, valor] of entradas) novasMoedas[moeda] = Math.max(0, (novasMoedas[moeda] ?? 0) + valor)
        await admin.from('personagens').update({ moedas: novasMoedas }).eq('id', personagemId)
        const descricaoMoedas = entradas.map(([m, v]) => `${v >= 0 ? '+' : ''}${v} ${m.toUpperCase()}`).join(', ')
        const descricao = `${personagemNome}: ${descricaoMoedas}`
        await registrarLog({ descricao })
        return Response.json({ ok: true, descricao })
      }

      if (!payload.moeda) return Response.json({ erro: 'Moeda não informada' }, { status: 400 })
      const valor = payload.valor ?? 0
      const novoValor = Math.max(0, (moedasDb[payload.moeda] ?? 0) + valor)
      const novasMoedas = { ...moedasDb, [payload.moeda]: novoValor }
      await admin.from('personagens').update({ moedas: novasMoedas }).eq('id', personagemId)
      const descricao = `${personagemNome}: ${valor >= 0 ? '+' : ''}${valor} ${payload.moeda}`
      await registrarLog({ valor, descricao })
      return Response.json({ ok: true, descricao })
    }

    case 'conceder_inspiracao': {
      if (!resultado.contexto.ehDM) {
        return Response.json({ erro: 'Só o mestre pode conceder inspiração' }, { status: 403 })
      }
      const atual = (personagem.inspiracao as number) ?? 0
      await admin.from('personagens').update({ inspiracao: atual + 1 }).eq('id', personagemId)
      const descricao = `O mestre concedeu inspiração heroica a ${personagemNome}`
      if (personagem.user_id) {
        await admin.from('notificacoes').insert({
          user_id: personagem.user_id,
          tipo: 'inspiracao_concedida',
          titulo: '⭐ Inspiração heroica!',
          mensagem: `O mestre concedeu inspiração heroica a ${personagemNome}.`,
          link: `/personagens/${personagemId}`,
          lida: false,
        })
      }
      await registrarLog({ descricao })
      return Response.json({ ok: true, descricao })
    }

    default:
      return Response.json({ erro: 'Tipo de ação inválido' }, { status: 400 })
  }
}

// Transferência de item — ordem de validação: sessão/batalha ativa (já
// resolvido acima), quem envia controla a origem (idem), mesma campanha,
// quantidade disponível. O crédito no destino é escrito ANTES do débito na
// origem: se o crédito falhar, ninguém perdeu o item; se o débito falhar
// depois do crédito ter sido confirmado, o pior caso é uma duplicata
// (recuperável), nunca uma perda.
async function tratarTransferirItem(
  payload: Partial<AcaoInventarioPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
  origem: Record<string, unknown>,
  campanhaId: string,
  sessaoId: string | null,
  registrarLog: (args: { valor?: number | null; descricao: string }) => Promise<void>
) {
  const { itemId, paraPersonagemId } = payload
  const quantidade = payload.quantidade ?? 1
  const origemId = origem.id as string
  const origemNome = origem.nome as string

  if (!itemId || !paraPersonagemId) return Response.json({ erro: 'Payload inválido' }, { status: 400 })
  if (quantidade <= 0) return Response.json({ erro: 'Quantidade inválida' }, { status: 400 })
  if (paraPersonagemId === origemId) {
    return Response.json({ erro: 'Não é possível transferir para o mesmo personagem' }, { status: 400 })
  }

  const { data: destino } = await admin
    .from('personagens').select('id, nome, campanha_id, user_id').eq('id', paraPersonagemId).maybeSingle()
  if (!destino) return Response.json({ erro: 'Personagem de destino não encontrado' }, { status: 404 })
  if (destino.campanha_id !== campanhaId) {
    return Response.json({ erro: 'Origem e destino precisam estar na mesma campanha' }, { status: 403 })
  }

  const { data: itemOrigem } = await admin
    .from('inventario_itens').select('*').eq('id', itemId).eq('personagem_id', origemId).maybeSingle()
  if (!itemOrigem) return Response.json({ erro: 'Item não encontrado no inventário de origem' }, { status: 404 })
  if ((itemOrigem.quantidade as number) < quantidade) {
    return Response.json(
      { erro: `Só há ${itemOrigem.quantidade}x ${itemOrigem.nome} disponível para transferir` },
      { status: 403 }
    )
  }

  const { data: itensDestino } = await admin
    .from('inventario_itens').select('*').eq('personagem_id', destino.id)
  const itemDestinoExistente = encontrarItemCorrespondente(itensDestino ?? [], itemOrigem)

  if (itemDestinoExistente) {
    const { error } = await admin.from('inventario_itens')
      .update({ quantidade: (itemDestinoExistente.quantidade as number) + quantidade })
      .eq('id', itemDestinoExistente.id)
    if (error) {
      console.error('Erro ao creditar item no destino:', error)
      return Response.json({ erro: 'Erro ao transferir item' }, { status: 500 })
    }
  } else {
    const { error } = await admin.from('inventario_itens').insert({
      personagem_id: destino.id,
      item_ref: itemOrigem.item_ref,
      nome: itemOrigem.nome,
      tipo: itemOrigem.tipo,
      raridade: itemOrigem.raridade,
      descricao: itemOrigem.descricao,
      quantidade,
      equipado: false,
    })
    if (error) {
      console.error('Erro ao creditar item no destino:', error)
      return Response.json({ erro: 'Erro ao transferir item' }, { status: 500 })
    }
  }

  const novaQtdOrigem = (itemOrigem.quantidade as number) - quantidade
  if (novaQtdOrigem <= 0) {
    await admin.from('inventario_itens').delete().eq('id', itemOrigem.id)
  } else {
    await admin.from('inventario_itens').update({ quantidade: novaQtdOrigem }).eq('id', itemOrigem.id)
  }

  await admin.from('transferencias').insert({
    sessao_id: sessaoId,
    de_personagem_id: origemId,
    para_personagem_id: destino.id,
    de_nome: origemNome,
    para_nome: destino.nome,
    tipo: 'item',
    item_nome: itemOrigem.nome,
    quantidade,
    criado_por: userId,
  })

  if (destino.user_id && destino.user_id !== userId) {
    await admin.from('notificacoes').insert({
      user_id: destino.user_id,
      tipo: 'item_recebido',
      titulo: '🎁 Você recebeu um item!',
      mensagem: `${origemNome} te deu ${quantidade}x ${itemOrigem.nome}.`,
      link: `/personagens/${destino.id}`,
      lida: false,
    })
  }

  const descricao = `${origemNome} transferiu ${quantidade}x ${itemOrigem.nome} para ${destino.nome}`
  await registrarLog({ descricao })
  return Response.json({ ok: true, descricao })
}

// Transferência de moeda — mesma ordem de validação de item, mais o check
// específico de moeda (remetente precisa ter o valor de cada moeda enviada).
async function tratarTransferirMoeda(
  payload: Partial<AcaoInventarioPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
  origem: Record<string, unknown>,
  campanhaId: string,
  sessaoId: string | null,
  registrarLog: (args: { valor?: number | null; descricao: string }) => Promise<void>
) {
  const { paraPersonagemId, moedas } = payload
  const origemId = origem.id as string
  const origemNome = origem.nome as string

  if (!paraPersonagemId || !moedas) return Response.json({ erro: 'Payload inválido' }, { status: 400 })
  if (paraPersonagemId === origemId) {
    return Response.json({ erro: 'Não é possível transferir para o mesmo personagem' }, { status: 400 })
  }

  const entradas = Object.entries(moedas).filter(([, v]) => (v ?? 0) > 0) as ['pc' | 'pp' | 'pe' | 'po' | 'pl', number][]
  if (entradas.length === 0) return Response.json({ erro: 'Informe ao menos uma moeda para transferir' }, { status: 400 })

  const { data: destino } = await admin
    .from('personagens').select('id, nome, campanha_id, moedas, user_id').eq('id', paraPersonagemId).maybeSingle()
  if (!destino) return Response.json({ erro: 'Personagem de destino não encontrado' }, { status: 404 })
  if (destino.campanha_id !== campanhaId) {
    return Response.json({ erro: 'Origem e destino precisam estar na mesma campanha' }, { status: 403 })
  }

  const moedasOrigem = (origem.moedas ?? {}) as MoedasDb
  for (const [moeda, valor] of entradas) {
    if ((moedasOrigem[moeda] ?? 0) < valor) {
      return Response.json({ erro: `${origemNome} não tem ${valor} ${moeda.toUpperCase()} suficiente` }, { status: 403 })
    }
  }

  // Crédito no destino primeiro (mesmo raciocínio de tratarTransferirItem).
  const moedasDestino = (destino.moedas ?? {}) as MoedasDb
  const novasMoedasDestino = { ...moedasDestino }
  for (const [moeda, valor] of entradas) novasMoedasDestino[moeda] = (novasMoedasDestino[moeda] ?? 0) + valor
  const { error: erroCredito } = await admin.from('personagens').update({ moedas: novasMoedasDestino }).eq('id', destino.id)
  if (erroCredito) {
    console.error('Erro ao creditar moeda no destino:', erroCredito)
    return Response.json({ erro: 'Erro ao transferir moeda' }, { status: 500 })
  }

  const novasMoedasOrigem = { ...moedasOrigem }
  for (const [moeda, valor] of entradas) novasMoedasOrigem[moeda] = (novasMoedasOrigem[moeda] ?? 0) - valor
  await admin.from('personagens').update({ moedas: novasMoedasOrigem }).eq('id', origemId)

  await admin.from('transferencias').insert({
    sessao_id: sessaoId,
    de_personagem_id: origemId,
    para_personagem_id: destino.id,
    de_nome: origemNome,
    para_nome: destino.nome,
    tipo: 'moeda',
    moedas: Object.fromEntries(entradas),
    criado_por: userId,
  })

  const descricaoMoedas = entradas.map(([m, v]) => `${v} ${m.toUpperCase()}`).join(', ')

  if (destino.user_id && destino.user_id !== userId) {
    await admin.from('notificacoes').insert({
      user_id: destino.user_id,
      tipo: 'moeda_recebida',
      titulo: '💰 Você recebeu moedas!',
      mensagem: `${origemNome} te deu ${descricaoMoedas}.`,
      link: `/personagens/${destino.id}`,
      lida: false,
    })
  }

  const descricao = `${origemNome} transferiu ${descricaoMoedas} para ${destino.nome}`
  await registrarLog({ descricao })
  return Response.json({ ok: true, descricao })
}

// Distribuição — só DM. Não parte do inventário de ninguém: cria itens/
// credita moedas diretamente em um ou mais personagens de destino.
async function tratarDistribuir(
  payload: Partial<AcaoInventarioPayload>,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
) {
  let campanhaId: string
  let sessaoId: string | null
  let registrarLog: (args: { descricao: string }) => Promise<void>

  if (payload.batalhaId) {
    const { data: batalha } = await admin.from('batalhas').select('*').eq('id', payload.batalhaId).maybeSingle()
    if (!batalha) return Response.json({ erro: 'Batalha não encontrada' }, { status: 403 })
    if (batalha.status !== 'ativa') return Response.json({ erro: 'A batalha não está ativa no momento.' }, { status: 403 })
    campanhaId = batalha.campanha_id
    sessaoId = batalha.sessao_id ?? null
    registrarLog = async ({ descricao }) => {
      await admin.from('batalha_log').insert({
        batalha_id: payload.batalhaId, rodada: batalha.rodada_atual, turno: null,
        tipo: 'nota', autor_id: userId, autor_nome: 'DM',
        alvo_id: null, alvo_nome: null, valor: null, tipo_dano: null, descricao, resumo: false,
      })
    }
  } else if (payload.sessaoId) {
    const { data: sessao } = await admin.from('sessoes').select('*').eq('id', payload.sessaoId).maybeSingle()
    if (!sessao) return Response.json({ erro: 'Sessão não encontrada' }, { status: 403 })
    if (sessao.status === 'encerrada') return Response.json({ erro: 'Esta sessão já foi encerrada.' }, { status: 403 })
    campanhaId = sessao.campanha_id
    sessaoId = sessao.id
    registrarLog = async ({ descricao }) => {
      await admin.from('sessao_log').insert({
        sessao_id: sessao.id, tipo: 'nota', autor_id: userId, autor_nome: 'DM', descricao,
      })
    }
  } else {
    return Response.json({ erro: 'Payload inválido — informe batalhaId ou sessaoId' }, { status: 400 })
  }

  const { data: campanha } = await admin.from('campanhas').select('dm_id').eq('id', campanhaId).maybeSingle()
  if (!campanha || campanha.dm_id !== userId) {
    return Response.json({ erro: 'Só o mestre pode distribuir itens ou moedas' }, { status: 403 })
  }

  const paraIds = payload.paraPersonagemIds ?? []
  if (paraIds.length === 0) return Response.json({ erro: 'Selecione ao menos um personagem para receber' }, { status: 400 })

  const { data: destinos } = await admin.from('personagens').select('id, nome, campanha_id, moedas, user_id').in('id', paraIds)
  if (!destinos || destinos.length !== paraIds.length || destinos.some(d => d.campanha_id !== campanhaId)) {
    return Response.json({ erro: 'Um ou mais personagens de destino não pertencem a esta campanha' }, { status: 403 })
  }

  const itens = (payload.itens ?? []).filter(i => i.nome && i.quantidade > 0)
  const moedas = payload.moedas ?? {}
  const entradasMoedas = Object.entries(moedas).filter(([, v]) => (v ?? 0) > 0) as ['pc' | 'pp' | 'pe' | 'po' | 'pl', number][]

  for (const destino of destinos) {
    for (const item of itens) {
      const { data: itensDestino } = await admin
        .from('inventario_itens').select('*').eq('personagem_id', destino.id)
      const existente = encontrarItemCorrespondente(itensDestino ?? [], {
        item_ref: item.itemRef ?? null, nome: item.nome, tipo: item.tipo ?? null,
      })
      if (existente) {
        await admin.from('inventario_itens')
          .update({ quantidade: (existente.quantidade as number) + item.quantidade }).eq('id', existente.id)
      } else {
        await admin.from('inventario_itens').insert({
          personagem_id: destino.id,
          item_ref: item.itemRef ?? null,
          nome: item.nome,
          tipo: item.tipo ?? null,
          raridade: item.raridade ?? null,
          descricao: item.descricao ?? null,
          quantidade: item.quantidade,
          equipado: false,
        })
      }
    }

    if (entradasMoedas.length > 0) {
      const moedasDestino = (destino.moedas ?? {}) as MoedasDb
      const novasMoedas = { ...moedasDestino }
      for (const [m, v] of entradasMoedas) novasMoedas[m] = (novasMoedas[m] ?? 0) + v
      await admin.from('personagens').update({ moedas: novasMoedas }).eq('id', destino.id)
    }

    if (itens.length > 0) {
      await admin.from('transferencias').insert({
        sessao_id: sessaoId,
        de_personagem_id: null,
        de_nome: 'DM',
        para_personagem_id: destino.id,
        para_nome: destino.nome,
        tipo: 'item',
        item_nome: itens.map(i => i.nome).join(', '),
        quantidade: itens.reduce((soma, i) => soma + i.quantidade, 0),
        criado_por: userId,
      })
    }
    if (entradasMoedas.length > 0) {
      await admin.from('transferencias').insert({
        sessao_id: sessaoId,
        de_personagem_id: null,
        de_nome: 'DM',
        para_personagem_id: destino.id,
        para_nome: destino.nome,
        tipo: 'moeda',
        moedas: Object.fromEntries(entradasMoedas),
        criado_por: userId,
      })
    }

    if (destino.user_id && (itens.length > 0 || entradasMoedas.length > 0)) {
      const partes = [
        itens.length > 0 ? itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ') : null,
        entradasMoedas.length > 0 ? entradasMoedas.map(([m, v]) => `${v} ${m.toUpperCase()}`).join(', ') : null,
      ].filter(Boolean)
      await admin.from('notificacoes').insert({
        user_id: destino.user_id,
        tipo: 'tesouro_recebido',
        titulo: '🎁 O mestre distribuiu tesouro!',
        mensagem: `Você recebeu ${partes.join(' e ')}.`,
        link: `/personagens/${destino.id}`,
        lida: false,
      })
    }
  }

  const partesDescricao = [
    itens.length > 0 ? itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ') : null,
    entradasMoedas.length > 0 ? entradasMoedas.map(([m, v]) => `${v} ${m.toUpperCase()}`).join(', ') : null,
  ].filter(Boolean)
  const descricao = `DM distribuiu ${partesDescricao.join(' e ')} para ${destinos.map(d => d.nome).join(', ')}`
  await registrarLog({ descricao })

  return Response.json({ ok: true, descricao })
}
