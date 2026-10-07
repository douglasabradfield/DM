import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type {
  Combatente, EntradaLog, TipoCondicao, TipoCombatente,
  CombatenteDB, LogDB, BatalhaDB, ArmaEmpunhada, EspacosMagiaBatalha,
} from '@/types/batalha'
import type { TipoDano } from '@/types/dnd'
import { calcularDano, aplicarCura as calcularCura, consumirEspaco } from '@/lib/batalha/motor'
import type { ModoRevelacao } from '@/lib/batalha/visibilidade-pv'
import { createClient } from '@/lib/supabase/client'
import { chamarAcaoApi, ORIGEM_AJUSTE, type PayloadAcaoEstado, type TipoAcaoEstado } from '@/lib/batalha/acao-api'
import toast from 'react-hot-toast'

// =============================================================================
// Helpers puros (sem acesso a get/set) — conversão Combatente <-> linha do banco
// =============================================================================

function jsonEstavel(valor: unknown): string {
  return JSON.stringify(valor, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val).sort().reduce((acc, k) => {
        acc[k] = (val as Record<string, unknown>)[k]
        return acc
      }, {} as Record<string, unknown>)
    }
    return val
  })
}

function combatenteParaLinha(c: Combatente, batalhaId: string) {
  return {
    id: c.id,
    batalha_id: batalhaId,
    personagem_id: c.personagem_id,
    monster_id: null,
    controlado_por: null,
    nome: c.nome,
    tipo: c.tipo,
    ordem: c.ordem,
    iniciativa: c.iniciativa,
    ca: c.ca,
    pv_maximo: c.pv_maximo,
    pv_atual: c.pv_atual,
    pv_temporarios: c.pv_temporarios,
    condicoes: c.condicoes,
    espacos_magia: c.espacos_magia,
    slots_monstro: c.slots_monstro ?? null,
    ataques_estruturados: c.ataques_estruturados ?? null,
    dados_monstro: c.dados_monstro,
    dados_personagem: c.dados_personagem ?? null,
    nivel: c.nivel ?? null,
    notas: c.notas ?? '',
    resistencias: c.resistencias,
    imunidades: c.imunidades,
    vulnerabilidades: c.vulnerabilidades,
    morto: c.morto,
    ausente: c.ausente,
    pv_revelado: c.pv_revelado,
    arma_esquerda: c.arma_esquerda ?? null,
    arma_direita: c.arma_direita ?? null,
    vantagem: c.vantagem ?? null,
    inspiracao: c.inspiracao ?? 0,
    dano_total: c.dano_total,
    cura_total: c.cura_total,
    reacao_usada: c.reacao_usada,
    efeitos_ativos: c.efeitos_ativos,
  }
}

function assinaturaCombatente(c: Combatente): string {
  return jsonEstavel(combatenteParaLinha(c, c.batalha_id))
}

// Antes da unificação com personagens.slots_magia, a chave dos espaços gastos
// no combatente era `utilizados`. As 103 linhas históricas de
// batalha_combatentes com esse nome estão todas em batalhas encerradas, que
// nunca são relidas (carregarBatalhaAtiva filtra status != 'encerrada' e
// /api/mesa/acao exige status 'ativa'). A leitura tolerante fica aqui por
// segurança e é o único ponto que conhece o nome antigo; a gravação
// (combatenteParaLinha) usa apenas `usados`.
function normalizarEspacosMagia(raw: unknown): EspacosMagiaBatalha {
  const espacos: EspacosMagiaBatalha = {}
  if (!raw || typeof raw !== 'object') return espacos
  for (const [nivel, e] of Object.entries(raw as Record<string, { total?: number; usados?: number; utilizados?: number }>)) {
    if (!e) continue
    espacos[parseInt(nivel)] = { total: e.total ?? 0, usados: e.usados ?? e.utilizados ?? 0 }
  }
  return espacos
}

function combatenteFromDB(row: CombatenteDB): Combatente {
  return {
    id: row.id,
    batalha_id: row.batalha_id,
    personagem_id: row.personagem_id,
    nome: row.nome,
    tipo: row.tipo as TipoCombatente,
    iniciativa: row.iniciativa ?? 0,
    ca: row.ca,
    pv_maximo: row.pv_maximo,
    pv_atual: row.pv_atual,
    pv_temporarios: row.pv_temporarios,
    ausente: row.ausente,
    morto: row.morto,
    condicoes: row.condicoes,
    resistencias: row.resistencias,
    imunidades: row.imunidades,
    vulnerabilidades: row.vulnerabilidades,
    espacos_magia: normalizarEspacosMagia(row.espacos_magia),
    notas: row.notas ?? '',
    pv_revelado: row.pv_revelado,
    arma_esquerda: row.arma_esquerda,
    arma_direita: row.arma_direita,
    dados_monstro: row.dados_monstro,
    dados_personagem: row.dados_personagem ?? null,
    ordem: row.ordem,
    vantagem: row.vantagem,
    inspiracao: row.inspiracao,
    nivel: row.nivel ?? undefined,
    slots_monstro: row.slots_monstro ?? undefined,
    ataques_estruturados: row.ataques_estruturados ?? undefined,
    reacao_usada: row.reacao_usada,
    efeitos_ativos: row.efeitos_ativos ?? [],
    dano_input: 0,
    dano_tipo: null,
    dano_total: row.dano_total,
    cura_total: row.cura_total,
    flash: null,
  }
}

// Campos de personagens que são fonte da verdade para o combatente com ficha.
export interface FichaBatalha {
  pv_atual: number
  pv_temporarios: number
  pv_maximo: number
  slots_magia: Record<string, { total: number; usados: number }> | null
}

type LinhaFicha = Partial<FichaBatalha> & { id: string }

const COLUNAS_FICHA = 'id, pv_atual, pv_temporarios, pv_maximo, slots_magia'

// Campo ausente na linha (ex.: payload de realtime parcial) mantém o valor
// anterior em vez de virar zero.
function fichaDaLinha(linha: LinhaFicha, anterior?: FichaBatalha): FichaBatalha {
  return {
    pv_atual: linha.pv_atual ?? anterior?.pv_atual ?? 0,
    pv_temporarios: linha.pv_temporarios ?? anterior?.pv_temporarios ?? 0,
    pv_maximo: linha.pv_maximo ?? anterior?.pv_maximo ?? 0,
    slots_magia: linha.slots_magia !== undefined ? linha.slots_magia : anterior?.slots_magia ?? null,
  }
}

type CampoFicha = 'pv_atual' | 'pv_temporarios' | 'pv_maximo' | 'slots_magia'

// Só os campos pedidos, lidos do combatente. Nunca os quatro por padrão: cada
// ação da batalha mexe em um campo, e gravar os outros empurraria para a ficha
// uma cópia possivelmente velha de PV máximo ou espaços.
function fichaParcial(c: Combatente, campos: CampoFicha[]): Partial<FichaBatalha> {
  const patch: Partial<FichaBatalha> = {}
  for (const campo of campos) {
    if (campo === 'slots_magia') patch.slots_magia = c.espacos_magia as Record<string, { total: number; usados: number }>
    else patch[campo] = c[campo]
  }
  return patch
}

// Campos de Partial<Combatente> que correspondem a campos da ficha.
function camposFichaEm(dados: Partial<Combatente>): CampoFicha[] {
  const campos: CampoFicha[] = []
  if ('pv_atual' in dados) campos.push('pv_atual')
  if ('pv_temporarios' in dados) campos.push('pv_temporarios')
  if ('pv_maximo' in dados) campos.push('pv_maximo')
  if ('espacos_magia' in dados) campos.push('slots_magia')
  return campos
}

const CAMPOS_PV: CampoFicha[] = ['pv_atual', 'pv_temporarios']

// Ponto único de leitura de PV e espaços de magia do combatente com ficha:
// substitui os campos da linha de batalha_combatentes pelos de personagens.
// Sem personagem_id (monstro/NPC) ou sem ficha carregada (falha na busca, ou
// ficha invisível ao jogador por RLS), a linha da batalha continua valendo.
// Devolve o mesmo objeto quando nada muda, para não disparar render à toa.
function aplicarFicha(c: Combatente, personagens: Record<string, FichaBatalha>): Combatente {
  if (!c.personagem_id) return c
  const ficha = personagens[c.personagem_id]
  if (!ficha) return c
  const espacos = (ficha.slots_magia ?? {}) as EspacosMagiaBatalha
  if (
    c.pv_atual === ficha.pv_atual
    && c.pv_temporarios === ficha.pv_temporarios
    && c.pv_maximo === ficha.pv_maximo
    && jsonEstavel(c.espacos_magia) === jsonEstavel(espacos)
  ) return c
  return {
    ...c,
    pv_atual: ficha.pv_atual,
    pv_temporarios: ficha.pv_temporarios,
    pv_maximo: ficha.pv_maximo,
    espacos_magia: espacos,
  }
}

// Busca as fichas em uma query só. null = erro (já avisado com toast); o
// chamador mantém os valores da linha de batalha como fallback. Ficha que o
// usuário não pode ler (RLS) simplesmente não vem — não é erro.
async function buscarFichas(ids: string[]): Promise<Record<string, FichaBatalha> | null> {
  if (ids.length === 0) return {}
  const { data, error } = await createClient()
    .from('personagens')
    .select(COLUNAS_FICHA)
    .in('id', ids)
  if (error) {
    console.error('Erro ao ler fichas dos combatentes:', error)
    toast.error('Não foi possível ler PV e espaços de magia das fichas — exibindo os valores salvos na batalha')
    return null
  }
  return Object.fromEntries((data as LinhaFicha[] ?? []).map(p => [p.id, fichaDaLinha(p)]))
}

function logFromDB(row: LogDB): EntradaLog {
  return {
    id: row.id,
    rodada: row.rodada,
    turno: row.turno ?? 0,
    tipo: row.tipo,
    origem: row.autor_nome ?? '',
    alvo: row.alvo_nome ?? '',
    valor: row.valor,
    tipo_dano: row.tipo_dano,
    descricao: row.descricao ?? '',
    resumo: row.resumo,
    criado_em: row.criado_em,
  }
}

function formatarDuracao(inicio: Date | null): string {
  if (!inicio) return 'duração desconhecida'
  const minutos = Math.max(0, Math.round((Date.now() - inicio.getTime()) / 60000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto > 0 ? `${horas}h ${resto}min` : `${horas}h`
}

// Monta a entrada de diário a partir de batalha_log — puramente factual,
// sem IA. batalha_log é a fonte da verdade: os totais aqui são somados a
// partir das entradas do log, nunca dos campos acumulados em
// batalha_combatentes (dano_total/cura_total), que existem só para exibição
// em tempo real. Esta mesma agregação é a base prevista para a futura tela
// de estatísticas de campanha (ainda não implementada).
function montarConteudoDiario(params: {
  nomeBatalha: string
  rodadaAtual: number
  iniciadaEm: Date | null
  log: EntradaLog[]
  combatentes: Combatente[]
}): string {
  const { nomeBatalha, rodadaAtual, iniciadaEm, log, combatentes } = params

  const danoPorAtacante = new Map<string, { total: number; acertos: number }>()
  const curaPorAtacante = new Map<string, number>()
  const danoPorAlvo = new Map<string, number>()
  const baixas: { nome: string; rodada: number }[] = []

  // Dano e cura somam só das entradas contábeis (resumo, uma por alvo): a
  // narrativa da mesma ação repete o total, e somar as duas contaria em
  // dobro. O ajuste do mestre (dano de ambiente, cura sem conjurador) entra
  // no dano sofrido, mas não no ranking de quem causou ou curou.
  log.forEach(l => {
    if (l.tipo === 'dano' && l.resumo && l.valor != null) {
      danoPorAlvo.set(l.alvo, (danoPorAlvo.get(l.alvo) ?? 0) + l.valor)
      if (l.origem !== ORIGEM_AJUSTE) {
        const atual = danoPorAtacante.get(l.origem) ?? { total: 0, acertos: 0 }
        atual.total += l.valor
        if (l.valor > 0) atual.acertos++
        danoPorAtacante.set(l.origem, atual)
      }
    }
    if (l.tipo === 'cura' && l.resumo && l.valor != null && l.origem !== ORIGEM_AJUSTE) {
      curaPorAtacante.set(l.origem, (curaPorAtacante.get(l.origem) ?? 0) + l.valor)
    }
    if (l.tipo === 'morte') {
      baixas.push({ nome: l.alvo, rodada: l.rodada })
    }
  })

  const entradaXP = [...log].reverse().find(l =>
    l.tipo === 'sistema' && l.origem === 'DM' && l.alvo === 'Grupo' && l.valor != null
  )
  const jogadoresAtivos = combatentes.filter(c => c.tipo === 'jogador' && !c.ausente).length

  const secoes: string[] = []
  secoes.push(`## ${nomeBatalha}`)
  secoes.push(`${rodadaAtual} rodada${rodadaAtual !== 1 ? 's' : ''} · ${formatarDuracao(iniciadaEm)}`)

  if (danoPorAtacante.size > 0) {
    secoes.push([
      '### Dano causado',
      ...[...danoPorAtacante.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([nome, d]) => `- ${nome}: ${d.total} (${d.acertos} acerto${d.acertos !== 1 ? 's' : ''})`),
    ].join('\n'))
  }

  if (danoPorAlvo.size > 0) {
    const total = [...danoPorAlvo.values()].reduce((soma, v) => soma + v, 0)
    secoes.push([
      '### Dano sofrido',
      ...[...danoPorAlvo.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([nome, valor]) => `- ${nome}: ${valor}`),
      `- **Total: ${total}**`,
    ].join('\n'))
  }

  if (curaPorAtacante.size > 0) {
    secoes.push([
      '### Cura realizada',
      ...[...curaPorAtacante.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([nome, total]) => `- ${nome}: ${total}`),
    ].join('\n'))
  }

  if (baixas.length > 0) {
    secoes.push([
      '### Baixas',
      ...baixas.map(b => `- ${b.nome} caiu na rodada ${b.rodada}`),
    ].join('\n'))
  }

  if (entradaXP && jogadoresAtivos > 0) {
    const xpPorJogador = entradaXP.valor ?? 0
    secoes.push([
      '### XP',
      `${xpPorJogador * jogadoresAtivos} XP · ${xpPorJogador} por jogador`,
    ].join('\n'))
  }

  // Entradas resumo (contábeis) entram na agregação acima, mas não aqui —
  // a entrada narrativa da mesma ação já cobre a mesma informação.
  const linhasRegistro = log
    .filter(l => l.tipo !== 'sistema' && !l.resumo)
    .map(l => {
      if (l.tipo === 'dano') return `R${l.rodada} · ${l.origem} → ${l.alvo}: ${l.valor} de dano${l.tipo_dano ? ` (${l.tipo_dano})` : ''}`
      if (l.tipo === 'cura') return `R${l.rodada} · ${l.origem} → ${l.alvo}: ${l.valor} de cura`
      return `R${l.rodada} · ${l.descricao}`
    })
  secoes.push([
    '### Registro completo',
    ...(linhasRegistro.length > 0 ? linhasRegistro : ['_Nenhuma ação registrada_']),
  ].join('\n'))

  return secoes.join('\n\n')
}

function novaEntradaLog(
  rodada: number,
  turno: number,
  partial: Omit<EntradaLog, 'id' | 'rodada' | 'turno' | 'criado_em' | 'resumo'> & { resumo?: boolean }
): EntradaLog {
  return {
    ...partial,
    resumo: partial.resumo ?? false,
    id: crypto.randomUUID(),
    rodada,
    turno,
    criado_em: new Date().toISOString(),
  }
}

// Percorre a lista ordenada (não só os ativos) para achar o próximo
// não-morto/não-ausente, contando uma "volta completa" como nova rodada.
function proximoIndiceAtivo(ordenados: Combatente[], idxAtual: number): { idx: number; novaRodada: boolean } {
  const n = ordenados.length
  if (n === 0) return { idx: -1, novaRodada: false }
  for (let step = 1; step <= n; step++) {
    const posicao = idxAtual + step
    const idx = ((posicao % n) + n) % n
    if (!ordenados[idx].ausente && !ordenados[idx].morto) {
      return { idx, novaRodada: posicao >= n }
    }
  }
  return { idx: -1, novaRodada: false }
}

function indiceAnteriorAtivo(ordenados: Combatente[], idxAtual: number): { idx: number; novaRodada: boolean } {
  const n = ordenados.length
  if (n === 0) return { idx: -1, novaRodada: false }
  const base = idxAtual === -1 ? n : idxAtual
  for (let step = 1; step <= n; step++) {
    const posicao = base - step
    const idx = ((posicao % n) + n) % n
    if (!ordenados[idx].ausente && !ordenados[idx].morto) {
      return { idx, novaRodada: posicao < 0 }
    }
  }
  return { idx: -1, novaRodada: false }
}

// Índice do combatente ativo dentro da lista FILTRADA (só ativos), na ordem
// de exibição — é o formato que os componentes esperam em turnoAtual.
function calcularIndiceTurno(combatentes: Combatente[], turnoCombatenteId: string | null): number {
  if (!turnoCombatenteId) return 0
  const ordenados = [...combatentes].sort((a, b) => a.ordem - b.ordem)
  const ativos = ordenados.filter(c => !c.ausente && !c.morto)
  const idx = ativos.findIndex(c => c.id === turnoCombatenteId)
  return idx === -1 ? 0 : idx
}

// =============================================================================
// Store
// =============================================================================

interface EstadoBatalhaStore {
  combatentes: Combatente[]
  log: EntradaLog[]
  rodadaAtual: number
  turnoAtual: number
  turnoCombatenteId: string | null
  ativa: boolean
  batalhaId: string | null
  campanhaId: string | null
  // Fonte da verdade de PV e espaços de magia para combatente com
  // personagem_id. A linha de batalha_combatentes ainda guarda cópia desses
  // campos (removida na etapa 3), mas ela não é mais lida.
  personagensDaBatalha: Record<string, FichaBatalha>
  xpGanhoNaBatalha: number
  xpDistribuido: boolean
  marcarXPDistribuido: (xpPorJogador: number, nomes: string[]) => void
  revelacaoPv: ModoRevelacao
  definirRevelacaoPv: (modo: ModoRevelacao) => void
  togglePvRevelado: (combatenteId: string) => void
  definirArmaEmpunhada: (combatenteId: string, lado: 'esquerda' | 'direita', arma: ArmaEmpunhada | null) => void

  // Sessão / persistência
  sessaoId: string | null
  nomeBatalha: string
  statusBatalha: 'inativa' | 'ativa' | 'pausada' | 'concluida'
  iniciadaEm: Date | null

  // Ações de gerenciamento
  iniciarBatalha: (nome: string, campanhaId: string, sessaoId: string) => Promise<string>
  encerrarBatalha: () => Promise<string | null>
  pausarBatalha: () => Promise<void>
  retomarBatalha: () => Promise<void>
  carregarBatalhaAtiva: (campanhaId: string) => Promise<void>
  resetarBatalha: () => void

  // Realtime
  assinarRealtime: () => void
  encerrarRealtime: () => void

  // Combatentes
  adicionarCombatente: (c: Omit<Combatente, 'id' | 'batalha_id' | 'dano_input' | 'dano_tipo' | 'dano_total' | 'cura_total' | 'flash' | 'reacao_usada' | 'efeitos_ativos'>) => void
  removerCombatente: (id: string) => void
  atualizarCombatente: (id: string, dados: Partial<Combatente>) => void

  // Iniciativa
  definirIniciativa: (id: string, valor: number) => void
  rolarIniciativasMonstros: () => void
  confirmarIniciativa: () => void

  // PV
  setarDanoInput: (id: string, valor: number) => void
  setarTipoDano: (id: string, tipo: TipoDano | null) => void
  adicionarEntradaLog: (entrada: Omit<EntradaLog, 'id' | 'rodada' | 'turno' | 'criado_em' | 'resumo'> & { resumo?: boolean }) => void

  // Turnos
  proximoTurno: () => void
  turnoAnterior: () => void
  proximaRodada: () => void
  // Mesa por cartas: o DM aponta explicitamente de quem é a vez, sem
  // depender de uma ordem fixa nem de confirmarIniciativa.
  definirTurnoPara: (combatenteId: string) => void

  // Presença
  toggleAusencia: (id: string) => void

  // Reordenação manual
  reordenarCombatentes: (idAtivo: string, idSobre: string) => void

  // Vantagem / Desvantagem
  setVantagem: (id: string, valor: 'vantagem' | 'desvantagem' | null) => void

  // Inspiração
  usarInspiracao: (id: string) => void

  // Sincronização com ficha
  atualizarCombatentePorPersonagem: (personagemId: string, dados: Partial<Combatente>) => void

  // Prévia otimista de ação gravada pela API (/api/mesa/acao)
  aplicarPreviaAcao: (previa: PreviaAcao) => () => void
  // Edição de estado pelo mestre (dano/cura sem ator, PV, espaços, zerar)
  editarEstado: (edicao: EdicaoEstado) => void
}

// Efeito de uma ação que a API (/api/mesa/acao) vai gravar. Mesmo cálculo de
// tratarAcaoBatalha / tratarAcaoEstado — tipoDano já resolvido pelo chamador
// do jeito da API. Sem atorId = edição de estado do mestre (ninguém agindo).
//   dano/cura: valor é o dano ou a cura
//   ajustar_pv: valor é o PV atual absoluto
//   definir_pv_maximo: valor é o novo máximo
//   definir_espacos: nivelMagia + usar
//   zerar: alvos são os combatentes a zerar
//   definir_morto: morto (true zera o PV; false só tira a marca)
//   aplicar_condicao / remover_condicao: condicao
export interface PreviaAcao {
  atorId?: string
  efeito: 'dano' | 'cura' | 'ajustar_pv' | 'definir_pv_maximo' | 'definir_espacos' | 'zerar'
    | 'definir_morto' | 'aplicar_condicao' | 'remover_condicao'
  alvos: {
    combatenteId: string
    valor?: number
    tipoDano?: TipoDano
    nivelMagia?: number
    usar?: boolean
    morto?: boolean
    condicao?: TipoCondicao
  }[]
  nivelMagia?: number
  reacao?: boolean
  marcarEfeitoAtivo?: string
}

const EFEITO_PREVIA: Record<TipoAcaoEstado, PreviaAcao['efeito']> = {
  dano_ambiente: 'dano',
  cura_ambiente: 'cura',
  ajustar_pv: 'ajustar_pv',
  definir_pv_maximo: 'definir_pv_maximo',
  definir_espacos: 'definir_espacos',
  zerar_contadores: 'zerar',
  definir_morto: 'definir_morto',
  aplicar_condicao: 'aplicar_condicao',
  remover_condicao: 'remover_condicao',
}

// Mesmas recusas determinísticas da API, checadas antes da prévia para o
// erro aparecer sem a tela piscar. A API continua sendo quem decide.
function recusaEdicaoLocal(edicao: EdicaoEstado, combatentes: Combatente[]): string {
  if (edicao.tipo === 'dano_ambiente' && !edicao.tipoDano) {
    return 'Escolha o tipo de dano — dano sem tipo não é aplicado'
  }
  if (edicao.tipo === 'definir_espacos') {
    for (const alvo of edicao.alvos) {
      const c = combatentes.find(x => x.id === alvo.combatenteId)
      if (!c || !alvo.usar || alvo.nivelMagia === undefined) continue
      const disponivel = c.personagem_id
        ? (c.espacos_magia[alvo.nivelMagia]?.total ?? 0) - (c.espacos_magia[alvo.nivelMagia]?.usados ?? 0)
        : c.slots_monstro?.[String(alvo.nivelMagia)] ?? 0
      if (disponivel <= 0) {
        return `Sem espaços de magia de ${alvo.nivelMagia}º nível disponíveis — escolha outro nível ou espere um descanso.`
      }
    }
  }
  return ''
}

export type EdicaoEstado = Omit<PayloadAcaoEstado, 'batalhaId'>

// Canal Realtime — vive fora do state reativo (não precisa disparar renders)
let canalAtual: RealtimeChannel | null = null
let canalBatalhaId: string | null = null

export const useBatalha = create<EstadoBatalhaStore>()(
  immer((set, get) => {

    // ---------------------------------------------------------------------
    // Persistência — ponto único de escrita por tabela
    // ---------------------------------------------------------------------

    async function persistirCombatente(id: string, anterior?: Combatente) {
      const state = get()
      if (!state.batalhaId) return
      const c = state.combatentes.find(x => x.id === id)
      if (!c) return
      const linha = combatenteParaLinha(c, state.batalhaId)
      const { error } = await createClient().from('batalha_combatentes').update(linha).eq('id', id)
      if (error) {
        console.error('Erro ao salvar combatente:', error)
        toast.error(`Erro ao salvar ${c.nome} — alteração revertida`)
        if (anterior) {
          set(s => {
            const idx = s.combatentes.findIndex(x => x.id === id)
            if (idx !== -1) s.combatentes[idx] = anterior
          })
        }
      }
    }

    async function persistirLog(entrada: EntradaLog) {
      const state = get()
      if (!state.batalhaId) return
      const autor = state.combatentes.find(c => c.nome === entrada.origem) ?? null
      const alvo = state.combatentes.find(c => c.nome === entrada.alvo) ?? null
      const { error } = await createClient().from('batalha_log').insert({
        id: entrada.id,
        batalha_id: state.batalhaId,
        rodada: entrada.rodada,
        turno: entrada.turno,
        tipo: entrada.tipo,
        autor_id: autor?.id ?? null,
        autor_nome: entrada.origem || null,
        alvo_id: alvo?.id ?? null,
        alvo_nome: entrada.alvo || null,
        valor: entrada.valor,
        tipo_dano: entrada.tipo_dano,
        descricao: entrada.descricao,
        resumo: entrada.resumo,
      })
      if (error) {
        console.error('Erro ao salvar log:', error)
        toast.error('Erro ao salvar entrada do log')
        set(s => { s.log = s.log.filter(e => e.id !== entrada.id) })
      }
    }

    async function persistirBatalha(patch: Record<string, unknown>): Promise<boolean> {
      const state = get()
      if (!state.batalhaId) return true
      const { error } = await createClient().from('batalhas').update(patch).eq('id', state.batalhaId)
      if (error) {
        console.error('Erro ao salvar batalha:', error)
        toast.error('Erro ao salvar estado da batalha')
        return false
      }
      return true
    }

    async function persistirOrdem(rows: { id: string; ordem: number }[], anteriores?: { id: string; ordem: number }[]) {
      const state = get()
      if (!state.batalhaId) return
      const supabase = createClient()
      const resultados = await Promise.all(
        rows.map(r => supabase.from('batalha_combatentes').update({ ordem: r.ordem }).eq('id', r.id))
      )
      const comErro = resultados.some(r => r.error)
      if (comErro) {
        console.error('Erro ao salvar ordem dos combatentes')
        toast.error('Erro ao salvar a ordem — revertido')
        if (anteriores) {
          set(s => {
            anteriores.forEach(a => {
              const c = s.combatentes.find(x => x.id === a.id)
              if (c) c.ordem = a.ordem
            })
          })
        }
      }
    }

    function mutarCombatente(id: string, mut: (c: Combatente) => void) {
      const anterior = get().combatentes.find(x => x.id === id)
      if (!anterior) return
      set(state => {
        const c = state.combatentes.find(x => x.id === id)
        if (c) mut(c)
      })
      persistirCombatente(id, anterior)
    }

    // ---------------------------------------------------------------------
    // Ficha (personagens) — fonte de PV e espaços do combatente com ficha
    // ---------------------------------------------------------------------

    function reaplicarFicha(personagemId: string) {
      const { combatentes, personagensDaBatalha } = get()
      const novos = combatentes.map(c => c.personagem_id === personagemId ? aplicarFicha(c, personagensDaBatalha) : c)
      if (novos.every((c, i) => c === combatentes[i])) return
      set(s => {
        novos.forEach((c, i) => {
          if (c !== combatentes[i] && s.combatentes[i]?.id === c.id) s.combatentes[i] = c
        })
      })
    }

    // Mutação local cuja gravação em personagens já é feita pelo chamador:
    // espelha no mapa para que o eco de batalha_combatentes (lido através do
    // mapa) não traga de volta o valor antigo antes do eco de personagens.
    // Sem ficha no mapa (fallback), não cria entrada — a linha segue valendo.
    // Mescla só os `campos` sobre a entrada existente e devolve a entrada
    // anterior completa, para reverter se a gravação falhar.
    function espelharFicha(combatenteId: string, campos: CampoFicha[]): FichaBatalha | undefined {
      const c = get().combatentes.find(x => x.id === combatenteId)
      if (!c?.personagem_id) return
      const pid = c.personagem_id
      const anterior = get().personagensDaBatalha[pid]
      if (!anterior) return
      if (campos.length === 0) return anterior
      const ficha = { ...anterior, ...fichaParcial(c, campos) }
      set(s => { s.personagensDaBatalha[pid] = ficha })
      return anterior
    }

    // Gravação em personagens falhou: o eco não virá, então o mapa volta ao
    // valor que o banco ainda tem — senão o próximo evento reaplicaria na
    // tela um valor que só existe neste cliente.
    function falhaGravarFicha(personagemId: string, nome: string, anterior: FichaBatalha | undefined, error: unknown) {
      console.error('Sync PV/espaços batalha→ficha:', error)
      if (!anterior) {
        toast.error(`Erro ao salvar a ficha de ${nome}`)
        return
      }
      toast.error(`Erro ao salvar a ficha de ${nome} — PV e espaços revertidos`)
      set(s => { s.personagensDaBatalha[personagemId] = anterior })
      reaplicarFicha(personagemId)
    }

    // Mutação local de PV/espaços: como a leitura vem de personagens, sem esta
    // gravação a mudança seria desfeita no próximo evento.
    // Grava apenas os `campos` declarados pelo chamador — obrigatório.
    // Sem ficha no mapa (fallback, ou ficha que este usuário não lê por RLS),
    // o combatente só tem a cópia de batalha_combatentes: gravar a partir dela
    // sobrescreveria a ficha real com dado velho. Aborta e avisa.
    async function gravarFicha(combatenteId: string, campos: CampoFicha[]) {
      const c = get().combatentes.find(x => x.id === combatenteId)
      if (!c?.personagem_id || campos.length === 0) return
      const pid = c.personagem_id
      if (!get().personagensDaBatalha[pid]) {
        toast.error(`Alteração não salva na ficha de ${c.nome} — a ficha não foi carregada nesta batalha`)
        return
      }
      const anterior = espelharFicha(combatenteId, campos)
      const { error } = await createClient().from('personagens').update(fichaParcial(c, campos)).eq('id', pid)
      if (error) falhaGravarFicha(pid, c.nome, anterior, error)
    }

    async function carregarFichas(ids: string[]) {
      const fichas = await buscarFichas(ids)
      if (!fichas) return
      const encontrados = Object.keys(fichas)
      if (encontrados.length === 0) return
      set(s => { Object.assign(s.personagensDaBatalha, fichas) })
      encontrados.forEach(reaplicarFicha)
    }

    // ---------------------------------------------------------------------
    // Realtime — assinatura única por batalha_id + reconciliação
    // ---------------------------------------------------------------------

    function reconciliarBatalha(payload: RealtimePostgresChangesPayload<BatalhaDB>) {
      const novo = payload.new as BatalhaDB | undefined
      if (!novo || !novo.id) return
      const state = get()
      if (novo.id !== state.batalhaId) return

      const igual = state.rodadaAtual === novo.rodada_atual
        && state.turnoCombatenteId === novo.turno_combatente_id
        && state.xpDistribuido === novo.xp_distribuido
        && state.revelacaoPv === novo.revelacao_pv
        && (state.statusBatalha === 'pausada') === (novo.status === 'pausada')
        && (state.statusBatalha === 'concluida') === (novo.status === 'encerrada')
      if (igual) return

      set(s => {
        s.statusBatalha = novo.status === 'pausada' ? 'pausada' : novo.status === 'encerrada' ? 'concluida' : 'ativa'
        s.ativa = novo.status === 'ativa' || novo.status === 'preparacao'
        s.rodadaAtual = novo.rodada_atual
        s.turnoCombatenteId = novo.turno_combatente_id
        s.turnoAtual = calcularIndiceTurno(s.combatentes, novo.turno_combatente_id)
        s.xpDistribuido = novo.xp_distribuido
        s.revelacaoPv = novo.revelacao_pv
      })
    }

    function reconciliarCombatente(payload: RealtimePostgresChangesPayload<CombatenteDB>) {
      const state = get()

      if (payload.eventType === 'DELETE') {
        const idRemovido = (payload.old as Partial<CombatenteDB> | undefined)?.id
        if (!idRemovido) return
        if (!state.combatentes.some(c => c.id === idRemovido)) return
        set(s => { s.combatentes = s.combatentes.filter(c => c.id !== idRemovido) })
        return
      }

      const linha = payload.new as CombatenteDB
      if (!linha?.id || linha.batalha_id !== state.batalhaId) return

      const atual = state.combatentes.find(c => c.id === linha.id)
      // O evento atualiza iniciativa, ordem, condições etc., mas PV e espaços
      // do combatente com ficha vêm do mapa — senão a cópia velha da linha
      // volta à tela a cada evento.
      const remoto = aplicarFicha(combatenteFromDB(linha), state.personagensDaBatalha)

      if (!atual && remoto.personagem_id && !state.personagensDaBatalha[remoto.personagem_id]) {
        carregarFichas([remoto.personagem_id])
      }

      if (atual) {
        if (assinaturaCombatente(atual) === assinaturaCombatente(remoto)) return // eco do próprio cliente
        set(s => {
          const idx = s.combatentes.findIndex(c => c.id === linha.id)
          if (idx === -1) return
          s.combatentes[idx] = { ...remoto, dano_input: s.combatentes[idx].dano_input, dano_tipo: s.combatentes[idx].dano_tipo, flash: s.combatentes[idx].flash }
        })
      } else {
        set(s => { s.combatentes.push(remoto) })
      }
    }

    function reconciliarLog(payload: RealtimePostgresChangesPayload<LogDB>) {
      if (payload.eventType !== 'INSERT') return
      const linha = payload.new as LogDB
      const state = get()
      if (!linha?.id || linha.batalha_id !== state.batalhaId) return
      if (state.log.some(e => e.id === linha.id)) return // eco do próprio cliente
      set(s => { s.log.push(logFromDB(linha)) })
    }

    function reconciliarPersonagem(payload: RealtimePostgresChangesPayload<LinhaFicha>) {
      const linha = payload.new as LinhaFicha | undefined
      if (!linha?.id) return
      const state = get()
      if (!state.combatentes.some(c => c.personagem_id === linha.id)) return
      const anterior = state.personagensDaBatalha[linha.id]
      const ficha = fichaDaLinha(linha, anterior)
      if (anterior && jsonEstavel(anterior) === jsonEstavel(ficha)) return // eco do próprio cliente
      set(s => { s.personagensDaBatalha[linha.id] = ficha })
      reaplicarFicha(linha.id)
    }

    function assinarRealtime() {
      const { batalhaId, campanhaId } = get()
      if (!batalhaId) return
      if (canalAtual && canalBatalhaId === batalhaId) return
      encerrarRealtime()

      const supabase = createClient()
      let channel = supabase
        .channel(`batalha:${batalhaId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'batalhas', filter: `id=eq.${batalhaId}` }, reconciliarBatalha)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'batalha_combatentes', filter: `batalha_id=eq.${batalhaId}` }, reconciliarCombatente)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'batalha_log', filter: `batalha_id=eq.${batalhaId}` }, reconciliarLog)
      if (campanhaId) {
        channel = channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'personagens', filter: `campanha_id=eq.${campanhaId}` }, reconciliarPersonagem)
      }
      // A cada (re)conexão relê as fichas: eventos de personagens perdidos
      // enquanto o canal esteve fora não são reenviados pelo realtime.
      channel.subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        const ids = [...new Set(get().combatentes.map(c => c.personagem_id).filter((id): id is string => !!id))]
        carregarFichas(ids)
      })

      canalAtual = channel
      canalBatalhaId = batalhaId
    }

    function encerrarRealtime() {
      if (canalAtual) {
        createClient().removeChannel(canalAtual)
        canalAtual = null
        canalBatalhaId = null
      }
    }

    return {
      combatentes: [],
      log: [],
      rodadaAtual: 1,
      turnoAtual: 0,
      turnoCombatenteId: null,
      ativa: false,
      batalhaId: null,
      campanhaId: null,
      personagensDaBatalha: {},
      xpGanhoNaBatalha: 0,
      xpDistribuido: false,
      sessaoId: null,
      nomeBatalha: '',
      statusBatalha: 'inativa',
      iniciadaEm: null,
      revelacaoPv: 'padrao',

      assinarRealtime,
      encerrarRealtime,

      iniciarBatalha: async (nome, campanhaId, sessaoId) => {
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()

        // O turno também precisa nascer explícito — sem isso,
        // turno_combatente_id fica null e qualquer tela que dependa de
        // "de quem é a vez" (inclusive o gate de ação do jogador) cai num
        // fallback de índice 0 que não reflete ninguém de verdade. Calculado
        // aqui porque os combatentes (com seus ids já client-side) precisam
        // existir antes do insert de 'batalhas' para ir na mesma escrita.
        const combatentesAtuais = get().combatentes
        const primeiroAtivoId = [...combatentesAtuais]
          .sort((a, b) => a.ordem - b.ordem)
          .find(c => !c.ausente && !c.morto)?.id ?? null

        const { data: batalha, error: erroBatalha } = await supabase
          .from('batalhas')
          .insert({
            campanha_id: campanhaId,
            sessao_id: sessaoId,
            nome,
            // 'ativa' direto — 'preparacao' só virava 'ativa' em
            // confirmarIniciativa(), que a mesa por cartas nunca chama.
            // Batalha ficava presa em 'preparacao' e a API árbitro recusava
            // toda ação de jogador ("não está ativa"), sem o DM perceber
            // (ele escreve direto no banco, ignorando esse status).
            status: 'ativa',
            turno_combatente_id: primeiroAtivoId,
            criado_por: userData.user?.id ?? null,
          })
          .select()
          .single()

        if (erroBatalha) throw erroBatalha

        // Escopado por batalha_id (não sessao_id) — uma sessão pode conter
        // várias batalhas, e encerrarBatalha() precisa achar exatamente
        // esta entrada para atualizar, não a de outra batalha da mesma sessão.
        await supabase.from('diario_entradas').insert({
          campanha_id: campanhaId,
          sessao_id: sessaoId,
          batalha_id: batalha.id,
          tipo: 'batalha',
          titulo: nome,
          conteudo: `Batalha iniciada em ${new Date().toLocaleString('pt-BR')}`,
          tags: ['batalha'],
        })

        if (combatentesAtuais.length > 0) {
          const linhasCombatentes = combatentesAtuais.map(c => combatenteParaLinha(c, batalha.id))
          const { error: erroCombatentes } = await supabase.from('batalha_combatentes').insert(linhasCombatentes)
          if (erroCombatentes) throw erroCombatentes
        }

        const jogadores = combatentesAtuais.filter(c => c.tipo === 'jogador')
        const monstros = combatentesAtuais.filter(c => c.tipo === 'monstro')
        const npcs = combatentesAtuais.filter(c => c.tipo === 'npc')

        const linhasResumo: string[] = [`⚔️ Batalha "${nome}" iniciada`]
        if (jogadores.length > 0) linhasResumo.push(`👤 Jogadores: ${jogadores.map(c => c.nome).join(', ')}`)
        if (npcs.length > 0) linhasResumo.push(`🧑 NPCs: ${npcs.map(c => c.nome).join(', ')}`)
        if (monstros.length > 0) linhasResumo.push(`👹 Monstros: ${monstros.map(c => c.nome).join(', ')}`)

        const entradaInicial: EntradaLog = {
          id: crypto.randomUUID(),
          rodada: 0,
          turno: 0,
          tipo: 'sistema',
          origem: 'Sistema',
          alvo: 'Batalha',
          valor: null,
          tipo_dano: null,
          descricao: linhasResumo.join(' | '),
          resumo: false,
          criado_em: new Date().toISOString(),
        }

        set(state => {
          state.sessaoId = sessaoId
          state.nomeBatalha = nome
          state.statusBatalha = 'ativa'
          state.ativa = true
          state.batalhaId = batalha.id
          state.campanhaId = campanhaId
          state.rodadaAtual = 1
          state.turnoCombatenteId = primeiroAtivoId
          state.turnoAtual = calcularIndiceTurno(state.combatentes, primeiroAtivoId)
          state.iniciadaEm = new Date()
          state.revelacaoPv = batalha.revelacao_pv
          state.combatentes.forEach(c => { c.batalha_id = batalha.id })
          state.log.push(entradaInicial)
        })

        await supabase.from('batalha_log').insert({
          id: entradaInicial.id,
          batalha_id: batalha.id,
          rodada: 0,
          turno: 0,
          tipo: 'sistema',
          autor_id: null,
          autor_nome: 'Sistema',
          alvo_id: null,
          alvo_nome: 'Batalha',
          valor: null,
          tipo_dano: null,
          descricao: entradaInicial.descricao,
        })

        assinarRealtime()

        return batalha.id as string
      },

      encerrarBatalha: async () => {
        const { sessaoId, batalhaId, combatentes, log, rodadaAtual, nomeBatalha, iniciadaEm } = get()

        set(state => {
          state.ativa = false
          state.statusBatalha = 'concluida'
        })

        if (!sessaoId) return null

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const conteudo = montarConteudoDiario({ nomeBatalha, rodadaAtual, iniciadaEm, log, combatentes })

        // sessoes não é mais tocado aqui — a sessão é um estado independente
        // da batalha (pode continuar ativa com outras batalhas depois), só
        // encerrada explicitamente pelo DM via useCampanha.encerrarSessao().

        const { data: entradaDiario } = await supabase.from('diario_entradas')
          .update({
            conteudo,
            titulo: `⚔️ ${nomeBatalha} — ${rodadaAtual} rodada${rodadaAtual !== 1 ? 's' : ''}`,
            visibilidade: 'grupo',
            criado_por: user?.id ?? null,
            tipo: 'batalha',
          })
          .eq('batalha_id', batalhaId)
          .eq('tipo', 'batalha')
          .select('id')
          .single()

        if (batalhaId) {
          await supabase.from('batalhas').update({
            status: 'encerrada',
            encerrada_em: new Date().toISOString(),
          }).eq('id', batalhaId)
        }

        encerrarRealtime()

        return entradaDiario?.id ?? null
      },

      pausarBatalha: async () => {
        const { batalhaId } = get()
        if (!batalhaId) return
        set(state => { state.ativa = false; state.statusBatalha = 'pausada' })
        const ok = await persistirBatalha({ status: 'pausada' })
        if (!ok) set(state => { state.ativa = true; state.statusBatalha = 'ativa' })
      },

      retomarBatalha: async () => {
        const { batalhaId, rodadaAtual, turnoAtual } = get()
        if (!batalhaId) return

        const entrada = novaEntradaLog(rodadaAtual, turnoAtual, {
          tipo: 'sistema', origem: 'Sistema', alvo: 'Batalha', valor: null, tipo_dano: null,
          descricao: '▶ Batalha retomada',
        })

        set(state => {
          state.ativa = true
          state.statusBatalha = 'ativa'
          state.log.push(entrada)
        })

        const ok = await persistirBatalha({ status: 'ativa' })
        if (!ok) set(state => { state.ativa = false; state.statusBatalha = 'pausada' })
        persistirLog(entrada)
      },

      carregarBatalhaAtiva: async (campanhaId) => {
        const supabase = createClient()

        // Compatibilidade: avisa sobre batalha antiga pausada no formato legado
        // (sessoes.batalha_estado), sem tentar migrar automaticamente.
        const { data: sessaoLegada } = await supabase
          .from('sessoes')
          .select('id, titulo, status')
          .eq('campanha_id', campanhaId)
          .in('status', ['ativa', 'pausada'])
          .not('batalha_estado', 'is', null)
          .order('iniciada_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (sessaoLegada) {
          console.warn(
            `[batalha] Sessão legada "${sessaoLegada.titulo}" (${sessaoLegada.id}, status "${sessaoLegada.status}") ainda tem batalha_estado no formato antigo. Não foi migrada automaticamente — encerre manualmente se necessário.`
          )
        }

        const { data: batalha } = await supabase
          .from('batalhas')
          .select('*')
          .eq('campanha_id', campanhaId)
          .neq('status', 'encerrada')
          .maybeSingle()

        if (!batalha) return

        const [{ data: combatentesDb }, { data: logDb }] = await Promise.all([
          supabase.from('batalha_combatentes').select('*').eq('batalha_id', batalha.id).order('ordem'),
          supabase.from('batalha_log').select('*').eq('batalha_id', batalha.id).order('criado_em'),
        ])

        const combatentesDaLinha = (combatentesDb ?? []).map(combatenteFromDB)
        const idsDePersonagem = [...new Set(
          combatentesDaLinha.map(c => c.personagem_id).filter((id): id is string => !!id)
        )]
        // Falha avisa com toast e mantém os valores da linha de batalha como
        // fallback — seguir em silêncio poria jogador em combate com PV errado.
        const personagensDaBatalha = await buscarFichas(idsDePersonagem) ?? {}
        const combatentes = combatentesDaLinha.map(c => aplicarFicha(c, personagensDaBatalha))
        const log = (logDb ?? []).map(logFromDB)
        const turnoAtual = calcularIndiceTurno(combatentes, batalha.turno_combatente_id)

        set(state => {
          state.batalhaId = batalha.id
          state.campanhaId = batalha.campanha_id
          state.personagensDaBatalha = personagensDaBatalha
          state.sessaoId = batalha.sessao_id
          state.nomeBatalha = batalha.nome
          state.statusBatalha = batalha.status === 'pausada' ? 'pausada' : 'ativa'
          state.ativa = batalha.status !== 'pausada'
          state.combatentes = combatentes
          state.log = log
          state.rodadaAtual = batalha.rodada_atual
          state.turnoAtual = turnoAtual
          state.turnoCombatenteId = batalha.turno_combatente_id
          state.iniciadaEm = new Date(batalha.criado_em)
          state.xpDistribuido = batalha.xp_distribuido
          state.revelacaoPv = batalha.revelacao_pv
        })

        assinarRealtime()
      },

      resetarBatalha: () => {
        encerrarRealtime()
        set(state => {
          state.combatentes = []
          state.log = []
          state.rodadaAtual = 1
          state.turnoAtual = 0
          state.turnoCombatenteId = null
          state.ativa = false
          state.batalhaId = null
          state.campanhaId = null
          state.personagensDaBatalha = {}
          state.xpGanhoNaBatalha = 0
          state.xpDistribuido = false
          state.sessaoId = null
          state.nomeBatalha = ''
          state.statusBatalha = 'inativa'
          state.iniciadaEm = null
          state.revelacaoPv = 'padrao'
        })
      },

      marcarXPDistribuido: (xpPorJogador, nomes) => {
        const { rodadaAtual, turnoAtual } = get()
        const entrada = novaEntradaLog(rodadaAtual, turnoAtual, {
          tipo: 'sistema', origem: 'DM', alvo: 'Grupo', valor: xpPorJogador, tipo_dano: null,
          descricao: `⭐ XP distribuído: ${xpPorJogador} XP para ${nomes.join(', ')}`,
        })
        set(state => { state.xpDistribuido = true; state.log.push(entrada) })
        persistirLog(entrada)
        persistirBatalha({ xp_distribuido: true })
      },

      adicionarCombatente: (c) => {
        const state0 = get()
        const nomes = new Set(state0.combatentes.map(x => x.nome))
        let nome = c.nome
        if (nomes.has(nome)) {
          let n = 2
          while (nomes.has(`${c.nome} ${n}`)) n++
          nome = `${c.nome} ${n}`
        }
        // Sempre maior que a ordem atual — nunca confia no valor que o
        // chamador mandou (as telas que adicionam combatente ainda passam um
        // placeholder fixo). Isso é só desempate estável da lista antes de
        // qualquer sorteio/confirmação; não é a iniciativa da mesa.
        const maiorOrdem = state0.combatentes.reduce((max, x) => Math.max(max, x.ordem), -1)
        const novo: Combatente = {
          ...c,
          nome,
          ordem: maiorOrdem + 1,
          id: crypto.randomUUID(),
          batalha_id: state0.batalhaId ?? '',
          dano_input: 0,
          dano_tipo: null,
          dano_total: 0,
          cura_total: 0,
          reacao_usada: false,
          efeitos_ativos: [],
          flash: null,
        }
        set(state => { state.combatentes.push(novo) })

        // A ficha é lida para o mapa, que passa a responder por PV e espaços.
        // Até a leitura responder, o combatente fica SEM entrada no mapa e
        // aplicarFicha cai para a linha da batalha. Não semear o mapa a partir
        // do combatente: isso inverte a fonte da verdade e, se a leitura da
        // ficha falhar, a batalha passa a ditar o PV máximo e os espaços.
        if (novo.personagem_id) carregarFichas([novo.personagem_id])

        if (state0.batalhaId) {
          const linha = combatenteParaLinha(novo, state0.batalhaId)
          createClient().from('batalha_combatentes').insert(linha).then(({ error }) => {
            if (error) {
              console.error('Erro ao adicionar combatente:', error)
              toast.error(`Erro ao salvar ${novo.nome} — removido`)
              set(state => { state.combatentes = state.combatentes.filter(x => x.id !== novo.id) })
            }
          })
        }
      },

      removerCombatente: (id) => {
        const state0 = get()
        const removido = state0.combatentes.find(c => c.id === id)
        if (!removido) return
        set(state => { state.combatentes = state.combatentes.filter(c => c.id !== id) })

        if (state0.batalhaId) {
          createClient().from('batalha_combatentes').delete().eq('id', id).then(({ error }) => {
            if (error) {
              console.error('Erro ao remover combatente:', error)
              toast.error(`Erro ao remover ${removido.nome} — restaurado`)
              set(state => { if (!state.combatentes.some(c => c.id === id)) state.combatentes.push(removido) })
            }
          })
        }
      },

      atualizarCombatente: (id, dados) => {
        const anterior = get().combatentes.find(x => x.id === id)
        if (!anterior) return
        set(state => {
          const idx = state.combatentes.findIndex(c => c.id === id)
          if (idx !== -1) Object.assign(state.combatentes[idx], dados)
        })
        persistirCombatente(id, anterior)
        // PV vai como par (atual + temporário), como sempre foi; pv_maximo e
        // espaços só se vieram em dados.
        if ('pv_atual' in dados || 'pv_temporarios' in dados) gravarFicha(id, CAMPOS_PV)
        const camposFicha: CampoFicha[] = []
        if ('pv_maximo' in dados) camposFicha.push('pv_maximo')
        if ('espacos_magia' in dados) camposFicha.push('slots_magia')
        if (camposFicha.length > 0) gravarFicha(id, camposFicha)
      },

      definirIniciativa: (id, valor) => mutarCombatente(id, c => { c.iniciativa = valor }),

      rolarIniciativasMonstros: () => {
        const afetados: string[] = []
        set(state => {
          state.combatentes.forEach(c => {
            if (c.tipo === 'monstro' || c.tipo === 'npc') {
              const desMod = c.dados_monstro
                ? Math.floor((c.dados_monstro.destreza - 10) / 2)
                : 0
              c.iniciativa = Math.floor(Math.random() * 20) + 1 + desMod
              afetados.push(c.id)
            }
          })
        })
        afetados.forEach(id => persistirCombatente(id))
      },

      confirmarIniciativa: () => {
        const anteriores = get().combatentes.map(c => ({ id: c.id, ordem: c.ordem }))
        let idsOrdem: { id: string; ordem: number }[] = []
        let primeiroAtivoId: string | null = null

        set(state => {
          state.combatentes.sort((a, b) => {
            if (a.ausente && !b.ausente) return 1
            if (!a.ausente && b.ausente) return -1
            return b.iniciativa - a.iniciativa
          })
          state.combatentes.forEach((c, i) => { c.ordem = i })
          idsOrdem = state.combatentes.map(c => ({ id: c.id, ordem: c.ordem }))
          const primeiroAtivo = state.combatentes.find(c => !c.ausente && !c.morto)
          primeiroAtivoId = primeiroAtivo?.id ?? null
          state.turnoAtual = 0
          state.turnoCombatenteId = primeiroAtivoId
        })

        persistirOrdem(idsOrdem, anteriores)
        persistirBatalha({
          turno_combatente_id: primeiroAtivoId,
          iniciativa_confirmada: true,
          status: 'ativa',
          rodada_atual: get().rodadaAtual,
        })
      },

      setarDanoInput: (id, valor) => set(state => {
        const c = state.combatentes.find(c => c.id === id)
        if (c) c.dano_input = valor
      }),

      setarTipoDano: (id, tipo) => set(state => {
        const c = state.combatentes.find(c => c.id === id)
        if (c) c.dano_tipo = tipo
      }),

      adicionarEntradaLog: (entrada) => {
        const { rodadaAtual, turnoAtual } = get()
        const nova = novaEntradaLog(rodadaAtual, turnoAtual, entrada)
        set(state => { state.log.push(nova) })
        persistirLog(nova)
      },

      proximoTurno: () => {
        const state0 = get()
        const anterior = { turnoAtual: state0.turnoAtual, turnoCombatenteId: state0.turnoCombatenteId, rodadaAtual: state0.rodadaAtual }
        const ordenados = [...state0.combatentes].sort((a, b) => a.ordem - b.ordem)
        if (ordenados.length === 0) return
        const idxAtual = ordenados.findIndex(c => c.id === state0.turnoCombatenteId)
        const { idx, novaRodada } = proximoIndiceAtivo(ordenados, idxAtual)
        if (idx === -1) return

        const novoId = ordenados[idx].id
        const novaRodadaAtual = novaRodada ? state0.rodadaAtual + 1 : state0.rodadaAtual

        set(state => {
          state.turnoCombatenteId = novoId
          state.turnoAtual = calcularIndiceTurno(state.combatentes, novoId)
          state.rodadaAtual = novaRodadaAtual
        })

        // Rede de segurança para batalhas criadas antes da correção que
        // ficaram presas em 'preparacao' — passar o turno já promove a 'ativa'.
        persistirBatalha({ turno_combatente_id: novoId, rodada_atual: novaRodadaAtual, status: 'ativa' }).then(ok => {
          if (!ok) set(state => {
            state.turnoAtual = anterior.turnoAtual
            state.turnoCombatenteId = anterior.turnoCombatenteId
            state.rodadaAtual = anterior.rodadaAtual
          })
        })
      },

      turnoAnterior: () => {
        const state0 = get()
        const anterior = { turnoAtual: state0.turnoAtual, turnoCombatenteId: state0.turnoCombatenteId, rodadaAtual: state0.rodadaAtual }
        const ordenados = [...state0.combatentes].sort((a, b) => a.ordem - b.ordem)
        if (ordenados.length === 0) return
        const idxAtual = ordenados.findIndex(c => c.id === state0.turnoCombatenteId)
        const { idx, novaRodada } = indiceAnteriorAtivo(ordenados, idxAtual)
        if (idx === -1) return

        const novoId = ordenados[idx].id
        const novaRodadaAtual = novaRodada ? Math.max(1, state0.rodadaAtual - 1) : state0.rodadaAtual

        set(state => {
          state.turnoCombatenteId = novoId
          state.turnoAtual = calcularIndiceTurno(state.combatentes, novoId)
          state.rodadaAtual = novaRodadaAtual
        })

        persistirBatalha({ turno_combatente_id: novoId, rodada_atual: novaRodadaAtual, status: 'ativa' }).then(ok => {
          if (!ok) set(state => {
            state.turnoAtual = anterior.turnoAtual
            state.turnoCombatenteId = anterior.turnoCombatenteId
            state.rodadaAtual = anterior.rodadaAtual
          })
        })
      },

      proximaRodada: () => {
        const state0 = get()
        const anterior = { turnoAtual: state0.turnoAtual, turnoCombatenteId: state0.turnoCombatenteId, rodadaAtual: state0.rodadaAtual }
        const ordenados = [...state0.combatentes].sort((a, b) => a.ordem - b.ordem)
        const primeiroAtivo = ordenados.find(c => !c.ausente && !c.morto)
        const novoId = primeiroAtivo?.id ?? null
        const novaRodadaAtual = state0.rodadaAtual + 1
        const idsComReacaoUsada = state0.combatentes.filter(c => c.reacao_usada).map(c => c.id)

        set(state => {
          state.rodadaAtual = novaRodadaAtual
          state.turnoCombatenteId = novoId
          state.turnoAtual = calcularIndiceTurno(state.combatentes, novoId)
          state.combatentes.forEach(c => { c.reacao_usada = false })
        })

        persistirBatalha({ turno_combatente_id: novoId, rodada_atual: novaRodadaAtual, status: 'ativa' }).then(ok => {
          if (!ok) set(state => {
            state.turnoAtual = anterior.turnoAtual
            state.turnoCombatenteId = anterior.turnoCombatenteId
            state.rodadaAtual = anterior.rodadaAtual
          })
        })

        if (state0.batalhaId && idsComReacaoUsada.length > 0) {
          createClient()
            .from('batalha_combatentes')
            .update({ reacao_usada: false })
            .in('id', idsComReacaoUsada)
            .then(({ error }) => { if (error) console.error('Erro ao resetar reação da rodada:', error) })
        }
      },

      // Mesa por cartas: o DM tira a carta e aponta de quem é a vez — não
      // avança relativo a ninguém, define direto. Não mexe em rodada nem em
      // reacao_usada (isso é proximaRodada); é só "a vez agora é este".
      definirTurnoPara: (combatenteId) => {
        const state0 = get()
        const anterior = { turnoAtual: state0.turnoAtual, turnoCombatenteId: state0.turnoCombatenteId }
        if (!state0.combatentes.some(c => c.id === combatenteId)) return
        const novoTurnoAtual = calcularIndiceTurno(state0.combatentes, combatenteId)

        set(state => {
          state.turnoCombatenteId = combatenteId
          state.turnoAtual = novoTurnoAtual
        })

        persistirBatalha({ turno_combatente_id: combatenteId, status: 'ativa' }).then(ok => {
          if (!ok) set(state => {
            state.turnoAtual = anterior.turnoAtual
            state.turnoCombatenteId = anterior.turnoCombatenteId
          })
        })
      },

      toggleAusencia: (id) => mutarCombatente(id, c => { c.ausente = !c.ausente }),

      reordenarCombatentes: (idAtivo, idSobre) => {
        const state0 = get()
        const anteriores = state0.combatentes.map(c => ({ id: c.id, ordem: c.ordem }))
        const indexAtivo = state0.combatentes.findIndex(c => c.id === idAtivo)
        const indexSobre = state0.combatentes.findIndex(c => c.id === idSobre)
        if (indexAtivo === -1 || indexSobre === -1) return

        const removidoNome = state0.combatentes[indexAtivo].nome
        const entrada = novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
          tipo: 'iniciativa', origem: 'DM', alvo: removidoNome, valor: null, tipo_dano: null,
          descricao: 'Ordem de iniciativa ajustada manualmente',
        })

        let idsOrdem: { id: string; ordem: number }[] = []
        set(state => {
          const ia = state.combatentes.findIndex(c => c.id === idAtivo)
          const is = state.combatentes.findIndex(c => c.id === idSobre)
          if (ia === -1 || is === -1) return
          const [removido] = state.combatentes.splice(ia, 1)
          state.combatentes.splice(is, 0, removido)
          state.combatentes.forEach((c, i) => { c.ordem = i })
          idsOrdem = state.combatentes.map(c => ({ id: c.id, ordem: c.ordem }))
          state.log.push(entrada)
        })

        persistirOrdem(idsOrdem, anteriores)
        persistirLog(entrada)
      },

      setVantagem: (id, valor) => {
        const state0 = get()
        const c = state0.combatentes.find(x => x.id === id)
        if (!c) return
        const entrada = novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
          tipo: 'sistema', origem: 'DM', alvo: c.nome, valor: null, tipo_dano: null,
          descricao: `${c.nome}: ${
            valor === 'vantagem' ? '▲ Vantagem ativada' :
            valor === 'desvantagem' ? '▼ Desvantagem ativada' :
            'Vantagem/Desvantagem removida'
          }`,
        })
        set(state => {
          const comb = state.combatentes.find(x => x.id === id)
          if (comb) { comb.vantagem = valor; state.log.push(entrada) }
        })
        persistirCombatente(id, c)
        persistirLog(entrada)
      },

      atualizarCombatentePorPersonagem: (personagemId, dados) => {
        const c = get().combatentes.find(x => x.personagem_id === personagemId)
        if (!c) return
        set(state => {
          const comb = state.combatentes.find(x => x.personagem_id === personagemId)
          if (comb) Object.assign(comb, dados)
        })
        persistirCombatente(c.id, c)
        // Chamado depois que a ficha já gravou em personagens.
        espelharFicha(c.id, camposFichaEm(dados))
      },

      // Só a tela: a gravação é da API, e persistir aqui aplicaria o efeito
      // duas vezes. Espelha no mapa das fichas para o eco de
      // batalha_combatentes não trazer o PV antigo. Devolve a reversão, que
      // restaura apenas os campos tocados (para o caso de a API recusar).
      aplicarPreviaAcao: (previa) => {
        const state0 = get()
        const tocados = new Set([...(previa.atorId ? [previa.atorId] : []), ...previa.alvos.map(a => a.combatenteId)])
        const anteriores = state0.combatentes
          .filter(c => tocados.has(c.id))
          .map(c => ({
            id: c.id,
            pv_atual: c.pv_atual,
            pv_temporarios: c.pv_temporarios,
            pv_maximo: c.pv_maximo,
            dano_total: c.dano_total,
            cura_total: c.cura_total,
            morto: c.morto,
            condicoes: c.condicoes,
            espacos_magia: c.espacos_magia,
            slots_monstro: c.slots_monstro,
            reacao_usada: c.reacao_usada,
            efeitos_ativos: c.efeitos_ativos,
          }))
        const pids = [...new Set(state0.combatentes
          .filter(c => tocados.has(c.id) && c.personagem_id)
          .map(c => c.personagem_id as string))]
        const fichasAnteriores = Object.fromEntries(pids.map(pid => [pid, state0.personagensDaBatalha[pid]]))
        const xpAnterior = state0.xpGanhoNaBatalha
        const idsAlvo = previa.alvos.map(a => a.combatenteId)

        set(s => {
          for (const alvo of previa.alvos) {
            const c = s.combatentes.find(x => x.id === alvo.combatenteId)
            if (!c) continue
            const valor = alvo.valor ?? 0
            switch (previa.efeito) {
              case 'cura': {
                if (!(valor > 0)) break
                c.pv_atual = calcularCura(valor, c).pvFinal
                c.cura_total += valor
                c.flash = 'cura'
                break
              }
              case 'dano': {
                if (!(valor > 0)) break
                const { danoFinal, absorvidoTemporario } = calcularDano(valor, alvo.tipoDano ?? null, c)
                const pvAntes = c.pv_atual
                c.pv_temporarios -= absorvidoTemporario
                c.pv_atual = Math.max(0, pvAntes - (danoFinal - absorvidoTemporario))
                c.dano_total += danoFinal
                c.flash = 'dano'
                if (pvAntes > 0 && c.pv_atual === 0) {
                  c.morto = false
                  if (c.tipo === 'monstro' && c.dados_monstro?.xp) s.xpGanhoNaBatalha += c.dados_monstro.xp
                }
                break
              }
              case 'ajustar_pv':
                c.pv_atual = Math.max(0, Math.min(c.pv_maximo, valor))
                break
              case 'definir_pv_maximo':
                if (!(valor > 0)) break
                c.pv_maximo = valor
                c.pv_atual = Math.min(c.pv_atual, valor)
                break
              case 'definir_espacos': {
                const nivel = alvo.nivelMagia
                if (nivel === undefined) break
                const nivelStr = String(nivel)
                if (c.personagem_id) {
                  const espaco = c.espacos_magia[nivel]
                  if (alvo.usar) c.espacos_magia = consumirEspaco(c.espacos_magia, nivel).novosEspacos
                  else if (espaco) c.espacos_magia = { ...c.espacos_magia, [nivel]: { ...espaco, usados: Math.max(0, espaco.usados - 1) } }
                } else {
                  const slots = c.slots_monstro ?? {}
                  c.slots_monstro = { ...slots, [nivelStr]: (slots[nivelStr] ?? 0) + (alvo.usar ? -1 : 1) }
                }
                break
              }
              case 'zerar':
                c.dano_total = 0
                c.cura_total = 0
                c.pv_atual = c.pv_maximo
                c.morto = false
                break
              case 'definir_morto':
                c.morto = !!alvo.morto
                if (alvo.morto) c.pv_atual = 0
                break
              case 'aplicar_condicao':
                if (alvo.condicao && !c.condicoes.includes(alvo.condicao)) c.condicoes = [...c.condicoes, alvo.condicao]
                break
              case 'remover_condicao':
                if (alvo.condicao) c.condicoes = c.condicoes.filter(x => x !== alvo.condicao)
                break
            }
          }

          const ator = previa.atorId ? s.combatentes.find(x => x.id === previa.atorId) : undefined
          if (ator) {
            if (previa.nivelMagia !== undefined) {
              if (ator.personagem_id) {
                ator.espacos_magia = consumirEspaco(ator.espacos_magia, previa.nivelMagia).novosEspacos
              } else {
                const slots = ator.slots_monstro ?? {}
                const nivelStr = String(previa.nivelMagia)
                ator.slots_monstro = { ...slots, [nivelStr]: (slots[nivelStr] ?? 0) - 1 }
              }
            }
            if (previa.reacao) ator.reacao_usada = true
            if (previa.marcarEfeitoAtivo) {
              ator.efeitos_ativos = [...ator.efeitos_ativos, { nome: previa.marcarEfeitoAtivo, rodada_inicio: s.rodadaAtual }]
            }
          }

          for (const c of s.combatentes) {
            if (!tocados.has(c.id) || !c.personagem_id || !s.personagensDaBatalha[c.personagem_id]) continue
            s.personagensDaBatalha[c.personagem_id] = {
              ...s.personagensDaBatalha[c.personagem_id],
              pv_atual: c.pv_atual,
              pv_temporarios: c.pv_temporarios,
              pv_maximo: c.pv_maximo,
              slots_magia: c.espacos_magia as Record<string, { total: number; usados: number }>,
            }
          }
        })

        setTimeout(() => {
          set(s => {
            s.combatentes.forEach(c => { if (idsAlvo.includes(c.id)) c.flash = null })
          })
        }, 600)

        return () => {
          set(s => {
            for (const a of anteriores) {
              const c = s.combatentes.find(x => x.id === a.id)
              if (c) Object.assign(c, a)
            }
            for (const pid of pids) {
              const ficha = fichasAnteriores[pid]
              if (ficha) s.personagensDaBatalha[pid] = ficha
            }
            s.xpGanhoNaBatalha = xpAnterior
          })
        }
      },

      // Edição de estado pelo mestre: prévia na tela, gravação pela API,
      // reversão com toast se ela recusar. Sem batalha no banco (combate em
      // preparação) não há onde gravar: monstros e NPCs ficam só na tela,
      // como sempre ficaram até o início; combatente com ficha é recusado,
      // porque a mudança iria para a ficha sem passar pela API.
      editarEstado: (edicao) => {
        const state0 = get()
        const recusa = recusaEdicaoLocal(edicao, state0.combatentes)
        if (recusa) { toast.error(recusa); return }

        const previa: PreviaAcao = {
          efeito: EFEITO_PREVIA[edicao.tipo],
          alvos: edicao.alvos.map(a => ({
            combatenteId: a.combatenteId,
            valor: edicao.tipo === 'definir_pv_maximo' ? a.pvMaximo : a.valor,
            tipoDano: edicao.tipoDano,
            nivelMagia: a.nivelMagia,
            usar: a.usar,
            morto: a.morto,
            condicao: a.condicao,
          })),
        }
        // Zerar sem alvos = a batalha inteira, igual à API.
        if (edicao.tipo === 'zerar_contadores' && edicao.alvos.length === 0) {
          previa.alvos = state0.combatentes.map(c => ({ combatenteId: c.id }))
        }

        if (!state0.batalhaId) {
          const comFicha = previa.alvos.some(a => state0.combatentes.find(c => c.id === a.combatenteId)?.personagem_id)
          if (comFicha) {
            toast.error('Inicie a batalha para alterar PV ou espaços de personagens com ficha')
            return
          }
          get().aplicarPreviaAcao(previa)
          return
        }

        const reverter = get().aplicarPreviaAcao(previa)
        const batalhaId = state0.batalhaId
        void chamarAcaoApi({ ...edicao, batalhaId }).then(resultado => {
          if (resultado.ok) return
          reverter()
          toast.error(resultado.erro ?? 'Erro ao salvar a alteração')
        })
      },

      usarInspiracao: (id) => {
        const state0 = get()
        const c = state0.combatentes.find(x => x.id === id)
        if (!c || !c.inspiracao || c.inspiracao <= 0) return

        const novaInspiracao = c.inspiracao - 1
        const pid = c.personagem_id
        const nome = c.nome

        const entrada = novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
          tipo: 'sistema', origem: 'DM', alvo: nome, valor: null, tipo_dano: null,
          descricao: `${nome} usou 1 inspiração heroica (restam ${novaInspiracao})`,
        })

        set(state => {
          const comb = state.combatentes.find(x => x.id === id)
          if (comb) { comb.inspiracao = novaInspiracao; state.log.push(entrada) }
        })

        persistirCombatente(id, c)
        persistirLog(entrada)

        if (pid) {
          createClient()
            .from('personagens')
            .update({ inspiracao: novaInspiracao })
            .eq('id', pid)
            .then(({ error }) => {
              if (error) console.error('Erro ao usar inspiração:', error)
            })
        }
      },

      definirRevelacaoPv: (modo) => {
        const anterior = get().revelacaoPv
        if (anterior === modo) return
        set(state => { state.revelacaoPv = modo })
        persistirBatalha({ revelacao_pv: modo }).then(ok => {
          if (!ok) set(state => { state.revelacaoPv = anterior })
        })
      },

      togglePvRevelado: (id) => mutarCombatente(id, c => { c.pv_revelado = !c.pv_revelado }),

      definirArmaEmpunhada: (id, lado, arma) => mutarCombatente(id, c => {
        if (lado === 'esquerda') c.arma_esquerda = arma
        else c.arma_direita = arma
      }),
    }
  })
)
