import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type {
  Combatente, EntradaLog, TipoCondicao, TipoCombatente,
  CombatenteDB, LogDB, BatalhaDB,
} from '@/types/batalha'
import type { TipoDano } from '@/types/dnd'
import { aplicarResistencias } from '@/lib/dados-dnd/tipos-dano'
import { createClient } from '@/lib/supabase/client'
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
    vantagem: c.vantagem ?? null,
    inspiracao: c.inspiracao ?? 0,
    dano_total: c.dano_total,
    cura_total: c.cura_total,
  }
}

function assinaturaCombatente(c: Combatente): string {
  return jsonEstavel(combatenteParaLinha(c, c.batalha_id))
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
    espacos_magia: row.espacos_magia,
    notas: row.notas ?? '',
    dados_monstro: row.dados_monstro,
    dados_personagem: row.dados_personagem ?? null,
    ordem: row.ordem,
    vantagem: row.vantagem,
    inspiracao: row.inspiracao,
    nivel: row.nivel ?? undefined,
    slots_monstro: row.slots_monstro ?? undefined,
    ataques_estruturados: row.ataques_estruturados ?? undefined,
    dano_input: 0,
    dano_tipo: 'cortante',
    dano_total: row.dano_total,
    cura_total: row.cura_total,
    flash: null,
  }
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
    criado_em: row.criado_em,
  }
}

function novaEntradaLog(
  rodada: number,
  turno: number,
  partial: Omit<EntradaLog, 'id' | 'rodada' | 'turno' | 'criado_em'>
): EntradaLog {
  return {
    ...partial,
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
  xpGanhoNaBatalha: number
  xpDistribuido: boolean
  marcarXPDistribuido: (xpPorJogador: number, nomes: string[]) => void

  // Sessão / persistência
  sessaoId: string | null
  nomeBatalha: string
  statusBatalha: 'inativa' | 'ativa' | 'pausada' | 'concluida'
  iniciadaEm: Date | null

  // Ações de gerenciamento
  iniciarBatalha: (nome: string, campanhaId: string) => Promise<string>
  encerrarBatalha: () => Promise<{ resumoIA: string }>
  pausarBatalha: () => Promise<void>
  retomarBatalha: () => Promise<void>
  carregarBatalhaAtiva: (campanhaId: string) => Promise<void>
  resetarBatalha: () => void

  // Realtime
  assinarRealtime: () => void
  encerrarRealtime: () => void

  // Combatentes
  adicionarCombatente: (c: Omit<Combatente, 'id' | 'batalha_id' | 'dano_input' | 'dano_tipo' | 'dano_total' | 'cura_total' | 'flash'>) => void
  removerCombatente: (id: string) => void
  atualizarCombatente: (id: string, dados: Partial<Combatente>) => void

  // Iniciativa
  definirIniciativa: (id: string, valor: number) => void
  rolarIniciativasMonstros: () => void
  confirmarIniciativa: () => void

  // PV
  aplicarDano: (id: string, dano: number, tipo: TipoDano, silencioso?: boolean) => void
  aplicarCura: (id: string, cura: number, silencioso?: boolean) => void
  atualizarPV: (id: string, pvAtual: number) => void
  atualizarPVMax: (id: string, pvMax: number) => void
  setarDanoInput: (id: string, valor: number) => void
  setarTipoDano: (id: string, tipo: TipoDano) => void
  aplicarTodosDanos: () => void
  aplicarTodasCuras: () => void
  zerarContadores: () => void
  adicionarEntradaLog: (entrada: Omit<EntradaLog, 'id' | 'rodada' | 'turno' | 'criado_em'>) => void

  // Condições
  adicionarCondicao: (id: string, condicao: TipoCondicao) => void
  removerCondicao: (id: string, condicao: TipoCondicao) => void

  // Espaços de magia
  usarEspaco: (id: string, nivel: number) => void
  recuperarEspaco: (id: string, nivel: number) => void

  // Turnos
  proximoTurno: () => void
  turnoAnterior: () => void
  proximaRodada: () => void

  // Presença
  toggleAusencia: (id: string) => void
  toggleMorto: (id: string) => void

  // Reordenação manual
  reordenarCombatentes: (idAtivo: string, idSobre: string) => void

  // Vantagem / Desvantagem
  setVantagem: (id: string, valor: 'vantagem' | 'desvantagem' | null) => void

  // Inspiração
  usarInspiracao: (id: string) => void

  // Sincronização com ficha
  atualizarCombatentePorPersonagem: (personagemId: string, dados: Partial<Combatente>) => void
}

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
      const remoto = combatenteFromDB(linha)

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

    function assinarRealtime() {
      const { batalhaId } = get()
      if (!batalhaId) return
      if (canalAtual && canalBatalhaId === batalhaId) return
      encerrarRealtime()

      const supabase = createClient()
      const channel = supabase
        .channel(`batalha:${batalhaId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'batalhas', filter: `id=eq.${batalhaId}` }, reconciliarBatalha)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'batalha_combatentes', filter: `batalha_id=eq.${batalhaId}` }, reconciliarCombatente)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'batalha_log', filter: `batalha_id=eq.${batalhaId}` }, reconciliarLog)
        .subscribe()

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
      xpGanhoNaBatalha: 0,
      xpDistribuido: false,
      sessaoId: null,
      nomeBatalha: '',
      statusBatalha: 'inativa',
      iniciadaEm: null,

      assinarRealtime,
      encerrarRealtime,

      iniciarBatalha: async (nome, campanhaId) => {
        const supabase = createClient()

        const { data: sessao, error: erroSessao } = await supabase
          .from('sessoes')
          .insert({
            campanha_id: campanhaId,
            titulo: nome,
            status: 'ativa',
            iniciada_em: new Date().toISOString(),
          })
          .select()
          .single()

        if (erroSessao) throw erroSessao

        await supabase.from('diario_entradas').insert({
          campanha_id: campanhaId,
          sessao_id: sessao.id,
          tipo: 'batalha',
          titulo: nome,
          conteudo: `Batalha iniciada em ${new Date().toLocaleString('pt-BR')}`,
          tags: ['batalha'],
        })

        const { data: userData } = await supabase.auth.getUser()

        const { data: batalha, error: erroBatalha } = await supabase
          .from('batalhas')
          .insert({
            campanha_id: campanhaId,
            sessao_id: sessao.id,
            nome,
            status: 'preparacao',
            criado_por: userData.user?.id ?? null,
          })
          .select()
          .single()

        if (erroBatalha) throw erroBatalha

        const combatentesAtuais = get().combatentes
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
          criado_em: new Date().toISOString(),
        }

        set(state => {
          state.sessaoId = sessao.id
          state.nomeBatalha = nome
          state.statusBatalha = 'ativa'
          state.ativa = true
          state.batalhaId = batalha.id
          state.rodadaAtual = 1
          state.turnoAtual = 0
          state.turnoCombatenteId = null
          state.iniciadaEm = new Date()
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
        const { sessaoId, batalhaId, combatentes, log, rodadaAtual, nomeBatalha } = get()

        set(state => {
          state.ativa = false
          state.statusBatalha = 'concluida'
        })

        if (!sessaoId) return { resumoIA: '' }

        const supabase = createClient()

        const mortos = combatentes.filter(c => c.morto || c.pv_atual <= 0)
        const totalDano = log.filter(l => l.tipo === 'dano').reduce((acc, l) => acc + (l.valor || 0), 0)
        const totalCura = log.filter(l => l.tipo === 'cura').reduce((acc, l) => acc + (l.valor || 0), 0)

        const narrativaLog = log
          .filter(l => l.tipo !== 'sistema')
          .map(l => `[Rodada ${l.rodada}] ${l.descricao}`)
          .join('\n')

        let resumoIA = ''
        try {
          const resp = await fetch('/api/ia/resumo-batalha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nomeBatalha,
              rodadas: rodadaAtual,
              totalDano,
              totalCura,
              mortos: mortos.map(c => c.nome),
              combatentes: combatentes.map(c => ({
                nome: c.nome, tipo: c.tipo, pvFinal: c.pv_atual, pvMax: c.pv_maximo,
                status: c.morto || c.pv_atual <= 0 ? 'morto' : 'vivo',
                condicoes: c.condicoes,
              })),
              log: narrativaLog.slice(0, 3000),
            }),
          })
          const data = await resp.json()
          resumoIA = data.resumo || ''
        } catch (e) {
          console.error('Erro ao gerar resumo IA:', e)
        }

        const tabelaTecnica = [
          '## 📊 Resumo Técnico',
          '',
          '| Combatente | Tipo | PV Final | PV Máx | Status |',
          '|------------|------|----------|--------|--------|',
          ...combatentes.map(c =>
            `| ${c.nome} | ${c.tipo} | ${c.pv_atual} | ${c.pv_maximo} | ${c.morto ? '💀 Morto' : '✅ Vivo'} |`
          ),
          '',
          `**Total de rodadas:** ${rodadaAtual}`,
          `**Dano total causado:** ${totalDano}`,
          `**Cura total:** ${totalCura}`,
          `**Baixas:** ${mortos.length} (${mortos.map(m => m.nome).join(', ') || 'nenhuma'})`,
        ].join('\n')

        const logNarrativo = log
          .filter(l => l.tipo !== 'sistema')
          .map(l => `**[R${l.rodada}]** ${l.descricao}`)
          .join('\n')

        const TIPOS_MANUAIS = [
          'ataque', 'ataque_extra', 'magia', 'usar_item', 'ajudar', 'agarrar', 'recuar',
          'acao_bonus_ataque', 'acao_bonus_magia', 'cura_bonus', 'forma_alternativa',
          'ataque_oportunidade', 'contra_magia', 'escudo', 'absorver_elementos', 'queda_controlada', 'outra_reacao',
          'pv_temporarios', 'estabilizar', 'condicao_aplicada', 'condicao_removida', 'concentracao', 'outro',
        ]
        const acoesManuais = log.filter(l => TIPOS_MANUAIS.includes(l.tipo))
        const categorias: Array<{ titulo: string; tipos: string[] }> = [
          { titulo: '⚔️ Ações Principais', tipos: ['ataque', 'ataque_extra', 'magia', 'usar_item', 'ajudar', 'agarrar', 'recuar'] },
          { titulo: '✨ Ações Bônus', tipos: ['acao_bonus_ataque', 'acao_bonus_magia', 'cura_bonus', 'forma_alternativa'] },
          { titulo: '🛡️ Reações', tipos: ['ataque_oportunidade', 'contra_magia', 'escudo', 'absorver_elementos', 'queda_controlada', 'outra_reacao'] },
          { titulo: '🔮 Efeitos/Resultados', tipos: ['pv_temporarios', 'estabilizar', 'condicao_aplicada', 'condicao_removida', 'concentracao'] },
          { titulo: '📝 Outros', tipos: ['outro'] },
        ]
        const acoesSection = acoesManuais.length > 0
          ? `## ⚔️ Ações Registradas\n\n${categorias
              .map(cat => {
                const itens = acoesManuais.filter(l => cat.tipos.includes(l.tipo))
                if (!itens.length) return ''
                return `### ${cat.titulo}\n${itens.map(l => `- [R${l.rodada}] ${l.descricao}`).join('\n')}`
              })
              .filter(Boolean)
              .join('\n\n')}`
          : ''

        const conteudoFinal = [
          resumoIA ? `## 📜 Narrativa da Batalha\n\n${resumoIA}` : '',
          acoesSection,
          `## 📋 Log de Ações\n\n${logNarrativo || '_Nenhuma ação registrada_'}`,
          tabelaTecnica,
        ].filter(Boolean).join('\n\n')

        await supabase.from('sessoes').update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
          total_rodadas: rodadaAtual,
          resumo_ia: resumoIA,
          batalha_estado: null,
        }).eq('id', sessaoId)

        await supabase.from('diario_entradas')
          .update({
            conteudo: conteudoFinal,
            titulo: `⚔️ ${nomeBatalha} — ${rodadaAtual} rodada${rodadaAtual !== 1 ? 's' : ''}`,
          })
          .eq('sessao_id', sessaoId)
          .eq('tipo', 'batalha')

        if (batalhaId) {
          await supabase.from('batalhas').update({
            status: 'encerrada',
            encerrada_em: new Date().toISOString(),
          }).eq('id', batalhaId)
        }

        encerrarRealtime()

        return { resumoIA }
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

        const combatentes = (combatentesDb ?? []).map(combatenteFromDB)
        const log = (logDb ?? []).map(logFromDB)
        const turnoAtual = calcularIndiceTurno(combatentes, batalha.turno_combatente_id)

        set(state => {
          state.batalhaId = batalha.id
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
          state.xpGanhoNaBatalha = 0
          state.xpDistribuido = false
          state.sessaoId = null
          state.nomeBatalha = ''
          state.statusBatalha = 'inativa'
          state.iniciadaEm = null
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
        const novo: Combatente = {
          ...c,
          nome,
          id: crypto.randomUUID(),
          batalha_id: state0.batalhaId ?? '',
          dano_input: 0,
          dano_tipo: 'cortante',
          dano_total: 0,
          cura_total: 0,
          flash: null,
        }
        set(state => { state.combatentes.push(novo) })

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
        if ('pv_atual' in dados || 'pv_temporarios' in dados) {
          const c = get().combatentes.find(x => x.id === id)
          if (c?.personagem_id) {
            createClient().from('personagens')
              .update({ pv_atual: c.pv_atual, pv_temporarios: c.pv_temporarios })
              .eq('id', c.personagem_id)
              .then(({ error }) => { if (error) console.error('Sync PV batalha→ficha:', error) })
          }
        }
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

      aplicarDano: (id, dano, tipo, silencioso = false) => {
        const state0 = get()
        const c = state0.combatentes.find(x => x.id === id)
        if (!c) return

        const ordenados = [...state0.combatentes].sort((a, b) => a.ordem - b.ordem)
        const ativos = ordenados.filter(x => !x.ausente && !x.morto)
        const combatenteAtivo = ativos[state0.turnoAtual] || null
        const nomeAtacante = combatenteAtivo?.nome || 'DM'

        const { danoFinal, modificador } = aplicarResistencias(dano, tipo, c.resistencias, c.imunidades, c.vulnerabilidades)

        const pvAntes = c.pv_atual
        let novoPvTemp = c.pv_temporarios
        let novoPv: number
        if (c.pv_temporarios > 0) {
          const absTemp = Math.min(c.pv_temporarios, danoFinal)
          novoPvTemp = c.pv_temporarios - absTemp
          const resto = danoFinal - absTemp
          novoPv = Math.max(0, c.pv_atual - resto)
        } else {
          novoPv = Math.max(0, c.pv_atual - danoFinal)
        }

        const caiu = pvAntes > 0 && novoPv === 0
        const xpGanho = caiu && c.tipo === 'monstro' && c.dados_monstro?.xp ? c.dados_monstro.xp : 0

        let descricao: string
        if (danoFinal === 0) {
          descricao = `${c.nome} é IMUNE a ${tipo}`
        } else {
          descricao = `${nomeAtacante} causou ${danoFinal} de dano${tipo ? ` (${tipo})` : ''} em ${c.nome}`
          if (modificador === 'resistencia') descricao += ` (resistência: ${dano}→${danoFinal})`
          else if (modificador === 'vulnerabilidade') descricao += ` (vulnerabilidade: ${dano}→${danoFinal})`
          if (novoPv <= 0 && pvAntes > 0) descricao += ` — ${c.nome} caiu! 💀`
        }

        const entradasLog: EntradaLog[] = []
        if (caiu) {
          entradasLog.push(novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
            tipo: 'morte', origem: 'Sistema', alvo: c.nome, valor: danoFinal, tipo_dano: tipo,
            descricao: `${c.nome} caiu inconsciente!`,
          }))
        }
        if (!silencioso) {
          entradasLog.push(novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
            tipo: 'dano', origem: nomeAtacante, alvo: c.nome, valor: danoFinal, tipo_dano: tipo,
            descricao,
          }))
        }

        set(state => {
          const comb = state.combatentes.find(x => x.id === id)
          if (!comb) return
          comb.pv_temporarios = novoPvTemp
          comb.pv_atual = novoPv
          comb.dano_total += danoFinal
          comb.flash = 'dano'
          if (caiu) comb.morto = false
          if (xpGanho > 0) state.xpGanhoNaBatalha += xpGanho
          entradasLog.forEach(e => state.log.push(e))
        })

        persistirCombatente(id, c)
        entradasLog.forEach(persistirLog)

        if (c.personagem_id) {
          const pid = c.personagem_id
          setTimeout(() => {
            createClient().from('personagens')
              .update({ pv_atual: novoPv, pv_temporarios: novoPvTemp })
              .eq('id', pid)
              .then(({ error }) => { if (error) console.error('Sync PV batalha→ficha:', error) })
          }, 0)
        }

        setTimeout(() => {
          set(s => {
            const comb = s.combatentes.find(x => x.id === id)
            if (comb) comb.flash = null
          })
        }, 600)
      },

      aplicarCura: (id, cura, silencioso = false) => {
        const state0 = get()
        const c = state0.combatentes.find(x => x.id === id)
        if (!c) return

        const ordenados = [...state0.combatentes].sort((a, b) => a.ordem - b.ordem)
        const ativos = ordenados.filter(x => !x.ausente && !x.morto)
        const nomeAtacante = ativos[state0.turnoAtual]?.nome || 'DM'

        const novoPv = Math.min(c.pv_maximo, c.pv_atual + cura)
        const novoCuraTotal = c.cura_total + cura

        const entrada = !silencioso ? novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
          tipo: 'cura', origem: nomeAtacante, alvo: c.nome, valor: cura, tipo_dano: null,
          descricao: `${nomeAtacante} curou ${cura} PV de ${c.nome}`,
        }) : null

        set(state => {
          const comb = state.combatentes.find(x => x.id === id)
          if (!comb) return
          comb.pv_atual = novoPv
          comb.cura_total = novoCuraTotal
          comb.flash = 'cura'
          if (entrada) state.log.push(entrada)
        })

        persistirCombatente(id, c)
        if (entrada) persistirLog(entrada)

        if (c.personagem_id) {
          const pid = c.personagem_id
          const novoTemp = c.pv_temporarios
          setTimeout(() => {
            createClient().from('personagens')
              .update({ pv_atual: novoPv, pv_temporarios: novoTemp })
              .eq('id', pid)
              .then(({ error }) => { if (error) console.error('Sync PV batalha→ficha:', error) })
          }, 0)
        }

        setTimeout(() => {
          set(s => {
            const comb = s.combatentes.find(x => x.id === id)
            if (comb) comb.flash = null
          })
        }, 600)
      },

      atualizarPV: (id, pvAtual) => {
        mutarCombatente(id, c => { c.pv_atual = Math.max(0, Math.min(c.pv_maximo, pvAtual)) })
        const c = get().combatentes.find(x => x.id === id)
        if (c?.personagem_id) {
          createClient().from('personagens')
            .update({ pv_atual: c.pv_atual, pv_temporarios: c.pv_temporarios })
            .eq('id', c.personagem_id)
            .then(({ error }) => { if (error) console.error('Sync PV batalha→ficha:', error) })
        }
      },

      atualizarPVMax: (id, pvMax) => mutarCombatente(id, c => {
        c.pv_maximo = pvMax
        c.pv_atual = Math.min(c.pv_atual, pvMax)
      }),

      setarDanoInput: (id, valor) => set(state => {
        const c = state.combatentes.find(c => c.id === id)
        if (c) c.dano_input = valor
      }),

      setarTipoDano: (id, tipo) => set(state => {
        const c = state.combatentes.find(c => c.id === id)
        if (c) c.dano_tipo = tipo
      }),

      aplicarTodosDanos: () => {
        const { combatentes, aplicarDano } = get()
        combatentes.forEach(c => {
          if (c.dano_input > 0 && !c.ausente && !c.morto) {
            aplicarDano(c.id, c.dano_input, c.dano_tipo)
            set(s => {
              const comb = s.combatentes.find(x => x.id === c.id)
              if (comb) comb.dano_input = 0
            })
          }
        })
      },

      aplicarTodasCuras: () => {
        const { combatentes, aplicarCura } = get()
        combatentes.forEach(c => {
          if (c.dano_input > 0 && !c.ausente && !(c.morto && c.tipo === 'monstro')) {
            aplicarCura(c.id, c.dano_input)
            set(s => {
              const comb = s.combatentes.find(x => x.id === c.id)
              if (comb) comb.dano_input = 0
            })
          }
        })
      },

      zerarContadores: () => {
        const state0 = get()
        const ids = state0.combatentes.map(c => c.id)
        const entrada = novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
          tipo: 'sistema', origem: 'DM', alvo: 'Todos', valor: null, tipo_dano: null,
          descricao: 'Contadores zerados — PV restaurados ao máximo e mortos revividos',
        })
        set(state => {
          state.combatentes.forEach(c => {
            c.dano_total = 0
            c.cura_total = 0
            c.dano_input = 0
            c.pv_atual = c.pv_maximo
            c.morto = false
          })
          state.log.push(entrada)
        })
        ids.forEach(id => persistirCombatente(id))
        persistirLog(entrada)
      },

      adicionarEntradaLog: (entrada) => {
        const { rodadaAtual, turnoAtual } = get()
        const nova = novaEntradaLog(rodadaAtual, turnoAtual, entrada)
        set(state => { state.log.push(nova) })
        persistirLog(nova)
      },

      adicionarCondicao: (id, condicao) => {
        const state0 = get()
        const c = state0.combatentes.find(x => x.id === id)
        if (!c || c.condicoes.includes(condicao)) return
        const entrada = novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
          tipo: 'condicao', origem: 'DM', alvo: c.nome, valor: null, tipo_dano: null,
          descricao: `${c.nome} ficou ${condicao}`,
        })
        set(state => {
          const comb = state.combatentes.find(x => x.id === id)
          if (comb && !comb.condicoes.includes(condicao)) {
            comb.condicoes.push(condicao)
            state.log.push(entrada)
          }
        })
        persistirCombatente(id, c)
        persistirLog(entrada)
      },

      removerCondicao: (id, condicao) => {
        const state0 = get()
        const c = state0.combatentes.find(x => x.id === id)
        if (!c) return
        const entrada = novaEntradaLog(state0.rodadaAtual, state0.turnoAtual, {
          tipo: 'condicao', origem: 'DM', alvo: c.nome, valor: null, tipo_dano: null,
          descricao: `${c.nome} não está mais ${condicao}`,
        })
        set(state => {
          const comb = state.combatentes.find(x => x.id === id)
          if (comb) {
            comb.condicoes = comb.condicoes.filter(x => x !== condicao)
            state.log.push(entrada)
          }
        })
        persistirCombatente(id, c)
        persistirLog(entrada)
      },

      usarEspaco: (id, nivel) => mutarCombatente(id, c => {
        const espaco = c.espacos_magia[nivel]
        if (espaco && espaco.utilizados < espaco.total) espaco.utilizados++
      }),

      recuperarEspaco: (id, nivel) => mutarCombatente(id, c => {
        const espaco = c.espacos_magia[nivel]
        if (espaco && espaco.utilizados > 0) espaco.utilizados--
      }),

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

        persistirBatalha({ turno_combatente_id: novoId, rodada_atual: novaRodadaAtual }).then(ok => {
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

        persistirBatalha({ turno_combatente_id: novoId, rodada_atual: novaRodadaAtual }).then(ok => {
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

        set(state => {
          state.rodadaAtual = novaRodadaAtual
          state.turnoCombatenteId = novoId
          state.turnoAtual = calcularIndiceTurno(state.combatentes, novoId)
        })

        persistirBatalha({ turno_combatente_id: novoId, rodada_atual: novaRodadaAtual }).then(ok => {
          if (!ok) set(state => {
            state.turnoAtual = anterior.turnoAtual
            state.turnoCombatenteId = anterior.turnoCombatenteId
            state.rodadaAtual = anterior.rodadaAtual
          })
        })
      },

      toggleAusencia: (id) => mutarCombatente(id, c => { c.ausente = !c.ausente }),

      toggleMorto: (id) => mutarCombatente(id, c => {
        c.morto = !c.morto
        if (c.morto) c.pv_atual = 0
      }),

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
    }
  })
)
