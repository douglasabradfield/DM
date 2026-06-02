import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Combatente, EntradaLog, TipoCondicao } from '@/types/batalha'
import type { TipoDano } from '@/types/dnd'
import { aplicarResistencias } from '@/lib/dados-dnd/tipos-dano'
import { createClient } from '@/lib/supabase/client'

function gerarId(): string {
  return Math.random().toString(36).substr(2, 9)
}

interface EstadoBatalhaStore {
  combatentes: Combatente[]
  log: EntradaLog[]
  rodadaAtual: number
  turnoAtual: number
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
  iniciarBatalha: (nome: string, campanhaId: string) => Promise<void>
  encerrarBatalha: () => Promise<{ resumoIA: string }>
  pausarBatalha: () => Promise<void>
  retomarBatalha: () => Promise<void>
  carregarBatalhaAtiva: (campanhaId: string) => Promise<void>
  resetarBatalha: () => void

  // Combatentes
  adicionarCombatente: (c: Omit<Combatente, 'id' | 'batalha_id' | 'dano_input' | 'dano_tipo' | 'dano_total' | 'cura_total' | 'flash'>) => void
  removerCombatente: (id: string) => void
  atualizarCombatente: (id: string, dados: Partial<Combatente>) => void

  // Iniciativa
  definirIniciativa: (id: string, valor: number) => void
  rolarIniciativasMonstros: () => void
  confirmarIniciativa: () => void

  // PV
  aplicarDano: (id: string, dano: number, tipo: TipoDano) => void
  aplicarCura: (id: string, cura: number) => void
  atualizarPV: (id: string, pvAtual: number) => void
  atualizarPVMax: (id: string, pvMax: number) => void
  setarDanoInput: (id: string, valor: number) => void
  setarTipoDano: (id: string, tipo: TipoDano) => void
  aplicarTodosDanos: () => void
  aplicarTodasCuras: () => void
  zerarContadores: () => void

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

export const useBatalha = create<EstadoBatalhaStore>()(
  immer((set, get) => ({
    combatentes: [],
    log: [],
    rodadaAtual: 1,
    turnoAtual: 0,
    ativa: false,
    batalhaId: null,
    xpGanhoNaBatalha: 0,
    xpDistribuido: false,
    sessaoId: null,
    nomeBatalha: '',
    statusBatalha: 'inativa',
    iniciadaEm: null,

    iniciarBatalha: async (nome, campanhaId) => {
      const supabase = createClient()

      const { data: sessao, error } = await supabase
        .from('sessoes')
        .insert({
          campanha_id: campanhaId,
          titulo: nome,
          status: 'ativa',
          iniciada_em: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('diario_entradas').insert({
        campanha_id: campanhaId,
        sessao_id: sessao.id,
        tipo: 'batalha',
        titulo: nome,
        conteudo: `Batalha iniciada em ${new Date().toLocaleString('pt-BR')}`,
        tags: ['batalha'],
      })

      set(state => {
        const jogadores = state.combatentes.filter(c => c.tipo === 'jogador')
        const monstros = state.combatentes.filter(c => c.tipo === 'monstro')
        const npcs = state.combatentes.filter(c => c.tipo === 'npc')

        const linhas: string[] = [`⚔️ Batalha "${nome}" iniciada`]
        if (jogadores.length > 0) linhas.push(`👤 Jogadores: ${jogadores.map(c => c.nome).join(', ')}`)
        if (npcs.length > 0) linhas.push(`🧑 NPCs: ${npcs.map(c => c.nome).join(', ')}`)
        if (monstros.length > 0) linhas.push(`👹 Monstros: ${monstros.map(c => c.nome).join(', ')}`)

        state.sessaoId = sessao.id
        state.nomeBatalha = nome
        state.statusBatalha = 'ativa'
        state.ativa = true
        state.batalhaId = gerarId()
        state.rodadaAtual = 1
        state.turnoAtual = 0
        state.iniciadaEm = new Date()
        state.log.push({
          id: gerarId(),
          rodada: 0,
          turno: 0,
          tipo: 'sistema',
          origem: 'Sistema',
          alvo: 'Batalha',
          valor: null,
          tipo_dano: null,
          descricao: linhas.join(' | '),
          criado_em: new Date().toISOString(),
        })
      })
    },

    encerrarBatalha: async () => {
      const { sessaoId, combatentes, log, rodadaAtual, nomeBatalha } = get()

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

      const conteudoFinal = [
        resumoIA ? `## 📜 Narrativa da Batalha\n\n${resumoIA}` : '',
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

      return { resumoIA }
    },

    pausarBatalha: async () => {
      const { sessaoId, combatentes, log, rodadaAtual, turnoAtual } = get()
      if (!sessaoId) return

      const supabase = createClient()

      await supabase.from('sessoes').update({
        status: 'pausada',
        pausada_em: new Date().toISOString(),
        batalha_estado: { combatentes, log, rodadaAtual, turnoAtual },
      }).eq('id', sessaoId)

      set(state => {
        state.ativa = false
        state.statusBatalha = 'pausada'
      })
    },

    retomarBatalha: async () => {
      const { sessaoId } = get()
      if (!sessaoId) return

      const supabase = createClient()

      await supabase.from('sessoes').update({
        status: 'ativa',
        pausada_em: null,
      }).eq('id', sessaoId)

      set(state => {
        state.ativa = true
        state.statusBatalha = 'ativa'
        state.log.push({
          id: gerarId(),
          rodada: state.rodadaAtual,
          turno: state.turnoAtual,
          tipo: 'sistema',
          origem: 'Sistema',
          alvo: 'Batalha',
          valor: null,
          tipo_dano: null,
          descricao: '▶ Batalha retomada',
          criado_em: new Date().toISOString(),
        })
      })
    },

    carregarBatalhaAtiva: async (campanhaId) => {
      const supabase = createClient()

      const { data: sessao } = await supabase
        .from('sessoes')
        .select('*')
        .eq('campanha_id', campanhaId)
        .in('status', ['ativa', 'pausada'])
        .order('iniciada_em', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!sessao || !sessao.batalha_estado) return

      const estado = sessao.batalha_estado as {
        combatentes: Combatente[]
        log: EntradaLog[]
        rodadaAtual: number
        turnoAtual: number
      }

      set(state => {
        state.sessaoId = sessao.id
        state.nomeBatalha = sessao.titulo || 'Batalha'
        state.statusBatalha = sessao.status as 'ativa' | 'pausada'
        state.ativa = sessao.status === 'ativa'
        state.combatentes = estado.combatentes || []
        state.log = estado.log || []
        state.rodadaAtual = estado.rodadaAtual || 1
        state.turnoAtual = estado.turnoAtual || 0
        state.iniciadaEm = new Date(sessao.iniciada_em)
      })
    },

    resetarBatalha: () => set(state => {
      state.combatentes = []
      state.log = []
      state.rodadaAtual = 1
      state.turnoAtual = 0
      state.ativa = false
      state.batalhaId = null
      state.xpGanhoNaBatalha = 0
      state.xpDistribuido = false
      state.sessaoId = null
      state.nomeBatalha = ''
      state.statusBatalha = 'inativa'
      state.iniciadaEm = null
    }),

    marcarXPDistribuido: (xpPorJogador, nomes) => set(state => {
      state.xpDistribuido = true
      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'sistema',
        origem: 'DM',
        alvo: 'Grupo',
        valor: xpPorJogador,
        tipo_dano: null,
        descricao: `⭐ XP distribuído: ${xpPorJogador} XP para ${nomes.join(', ')}`,
        criado_em: new Date().toISOString(),
      })
    }),

    adicionarCombatente: (c) => set(state => {
      const nomes = new Set(state.combatentes.map(x => x.nome))
      let nome = c.nome
      if (nomes.has(nome)) {
        let n = 2
        while (nomes.has(`${c.nome} ${n}`)) n++
        nome = `${c.nome} ${n}`
      }
      state.combatentes.push({
        ...c,
        nome,
        id: gerarId(),
        batalha_id: state.batalhaId ?? '',
        dano_input: 0,
        dano_tipo: 'cortante',
        dano_total: 0,
        cura_total: 0,
        flash: null,
      })
    }),

    removerCombatente: (id) => set(state => {
      state.combatentes = state.combatentes.filter(c => c.id !== id)
    }),

    atualizarCombatente: (id, dados) => set(state => {
      const idx = state.combatentes.findIndex(c => c.id === id)
      if (idx !== -1) Object.assign(state.combatentes[idx], dados)
    }),

    definirIniciativa: (id, valor) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c) c.iniciativa = valor
    }),

    rolarIniciativasMonstros: () => set(state => {
      state.combatentes.forEach(c => {
        if (c.tipo === 'monstro' || c.tipo === 'npc') {
          const desMod = c.dados_monstro
            ? Math.floor((c.dados_monstro.destreza - 10) / 2)
            : 0
          c.iniciativa = Math.floor(Math.random() * 20) + 1 + desMod
        }
      })
    }),

    confirmarIniciativa: () => set(state => {
      state.combatentes.sort((a, b) => {
        if (a.ausente && !b.ausente) return 1
        if (!a.ausente && b.ausente) return -1
        return b.iniciativa - a.iniciativa
      })
      state.combatentes.forEach((c, i) => { c.ordem = i })
      state.turnoAtual = 0
    }),

    aplicarDano: (id, dano, tipo) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (!c) return

      // Identificar o combatente ativo (atacante) antes de modificar o estado
      const ordenados = [...state.combatentes].sort((a, b) => a.ordem - b.ordem)
      const ativos = ordenados.filter(x => !x.ausente && !x.morto)
      const combatenteAtivo = ativos[state.turnoAtual] || null
      const nomeAtacante = combatenteAtivo?.nome || 'DM'

      const { danoFinal, modificador } = aplicarResistencias(dano, tipo, c.resistencias, c.imunidades, c.vulnerabilidades)

      const pvAntes = c.pv_atual
      if (c.pv_temporarios > 0) {
        const absTemp = Math.min(c.pv_temporarios, danoFinal)
        c.pv_temporarios -= absTemp
        const resto = danoFinal - absTemp
        c.pv_atual = Math.max(0, c.pv_atual - resto)
      } else {
        c.pv_atual = Math.max(0, c.pv_atual - danoFinal)
      }

      c.dano_total += danoFinal
      c.flash = 'dano'

      if (pvAntes > 0 && c.pv_atual === 0) {
        c.morto = false // Inconsciente, não necessariamente morto
        if (c.tipo === 'monstro' && c.dados_monstro?.xp) {
          state.xpGanhoNaBatalha += c.dados_monstro.xp
        }
        state.log.push({
          id: gerarId(),
          rodada: state.rodadaAtual,
          turno: state.turnoAtual,
          tipo: 'morte',
          origem: 'Sistema',
          alvo: c.nome,
          valor: danoFinal,
          tipo_dano: tipo,
          descricao: `${c.nome} caiu inconsciente!`,
          criado_em: new Date().toISOString(),
        })
      }

      let descricao: string
      if (danoFinal === 0) {
        descricao = `${c.nome} é IMUNE a ${tipo}`
      } else {
        descricao = `${nomeAtacante} causou ${danoFinal} de dano${tipo ? ` (${tipo})` : ''} em ${c.nome}`
        if (modificador === 'resistencia') descricao += ` (resistência: ${dano}→${danoFinal})`
        else if (modificador === 'vulnerabilidade') descricao += ` (vulnerabilidade: ${dano}→${danoFinal})`
        if (c.pv_atual <= 0 && pvAntes > 0) descricao += ` — ${c.nome} caiu! 💀`
      }

      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'dano',
        origem: nomeAtacante,
        alvo: c.nome,
        valor: danoFinal,
        tipo_dano: tipo,
        descricao,
        criado_em: new Date().toISOString(),
      })

      setTimeout(() => {
        set(s => {
          const comb = s.combatentes.find(x => x.id === id)
          if (comb) comb.flash = null
        })
      }, 600)
    }),

    aplicarCura: (id, cura) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (!c) return

      const ordenados = [...state.combatentes].sort((a, b) => a.ordem - b.ordem)
      const ativos = ordenados.filter(x => !x.ausente && !x.morto)
      const nomeAtacante = ativos[state.turnoAtual]?.nome || 'DM'

      c.pv_atual = Math.min(c.pv_maximo, c.pv_atual + cura)
      c.cura_total += cura
      c.flash = 'cura'

      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'cura',
        origem: nomeAtacante,
        alvo: c.nome,
        valor: cura,
        tipo_dano: null,
        descricao: `${nomeAtacante} curou ${cura} PV de ${c.nome}`,
        criado_em: new Date().toISOString(),
      })

      setTimeout(() => {
        set(s => {
          const comb = s.combatentes.find(x => x.id === id)
          if (comb) comb.flash = null
        })
      }, 600)
    }),

    atualizarPV: (id, pvAtual) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c) c.pv_atual = Math.max(0, Math.min(c.pv_maximo, pvAtual))
    }),

    atualizarPVMax: (id, pvMax) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c) {
        c.pv_maximo = pvMax
        c.pv_atual = Math.min(c.pv_atual, pvMax)
      }
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

    zerarContadores: () => set(state => {
      state.combatentes.forEach(c => {
        c.dano_total = 0
        c.cura_total = 0
        c.dano_input = 0
        c.pv_atual = c.pv_maximo
        c.morto = false
      })
      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'sistema',
        origem: 'DM',
        alvo: 'Todos',
        valor: null,
        tipo_dano: null,
        descricao: 'Contadores zerados — PV restaurados ao máximo e mortos revividos',
        criado_em: new Date().toISOString(),
      })
    }),

    adicionarCondicao: (id, condicao) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c && !c.condicoes.includes(condicao)) {
        c.condicoes.push(condicao)
        state.log.push({
          id: gerarId(),
          rodada: state.rodadaAtual,
          turno: state.turnoAtual,
          tipo: 'condicao',
          origem: 'DM',
          alvo: c.nome,
          valor: null,
          tipo_dano: null,
          descricao: `${c.nome} ficou ${condicao}`,
          criado_em: new Date().toISOString(),
        })
      }
    }),

    removerCondicao: (id, condicao) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c) {
        c.condicoes = c.condicoes.filter(x => x !== condicao)
        state.log.push({
          id: gerarId(),
          rodada: state.rodadaAtual,
          turno: state.turnoAtual,
          tipo: 'condicao',
          origem: 'DM',
          alvo: c.nome,
          valor: null,
          tipo_dano: null,
          descricao: `${c.nome} não está mais ${condicao}`,
          criado_em: new Date().toISOString(),
        })
      }
    }),

    usarEspaco: (id, nivel) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c && c.espacos_magia[nivel]) {
        const espaco = c.espacos_magia[nivel]
        if (espaco.utilizados < espaco.total) {
          espaco.utilizados++
        }
      }
    }),

    recuperarEspaco: (id, nivel) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c && c.espacos_magia[nivel]) {
        const espaco = c.espacos_magia[nivel]
        if (espaco.utilizados > 0) {
          espaco.utilizados--
        }
      }
    }),

    proximoTurno: () => set(state => {
      const ativos = state.combatentes.filter(c => !c.ausente && !c.morto)
      if (ativos.length === 0) return

      state.turnoAtual++
      if (state.turnoAtual >= ativos.length) {
        state.turnoAtual = 0
        state.rodadaAtual++
      }
    }),

    turnoAnterior: () => set(state => {
      const ativos = state.combatentes.filter(c => !c.ausente && !c.morto)
      if (ativos.length === 0) return

      state.turnoAtual--
      if (state.turnoAtual < 0) {
        state.rodadaAtual = Math.max(1, state.rodadaAtual - 1)
        state.turnoAtual = ativos.length - 1
      }
    }),

    proximaRodada: () => set(state => {
      state.rodadaAtual++
      state.turnoAtual = 0
    }),

    toggleAusencia: (id) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c) c.ausente = !c.ausente
    }),

    toggleMorto: (id) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (c) {
        c.morto = !c.morto
        if (c.morto) c.pv_atual = 0
      }
    }),

    reordenarCombatentes: (idAtivo, idSobre) => set(state => {
      const indexAtivo = state.combatentes.findIndex(c => c.id === idAtivo)
      const indexSobre = state.combatentes.findIndex(c => c.id === idSobre)
      if (indexAtivo === -1 || indexSobre === -1) return
      const [removido] = state.combatentes.splice(indexAtivo, 1)
      state.combatentes.splice(indexSobre, 0, removido)
      state.combatentes.forEach((c, i) => { c.ordem = i })
      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'iniciativa',
        origem: 'DM',
        alvo: removido.nome,
        valor: null,
        tipo_dano: null,
        descricao: 'Ordem de iniciativa ajustada manualmente',
        criado_em: new Date().toISOString(),
      })
    }),

    setVantagem: (id, valor) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (!c) return
      c.vantagem = valor
      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'sistema',
        origem: 'DM',
        alvo: c.nome,
        valor: null,
        tipo_dano: null,
        descricao: `${c.nome}: ${
          valor === 'vantagem' ? '▲ Vantagem ativada' :
          valor === 'desvantagem' ? '▼ Desvantagem ativada' :
          'Vantagem/Desvantagem removida'
        }`,
        criado_em: new Date().toISOString(),
      })
    }),

    atualizarCombatentePorPersonagem: (personagemId, dados) => set(state => {
      const c = state.combatentes.find(c => c.personagem_id === personagemId)
      if (c) Object.assign(c, dados)
    }),

    usarInspiracao: (id) => set(state => {
      const c = state.combatentes.find(c => c.id === id)
      if (!c || !c.inspiracao || c.inspiracao <= 0) return

      const novaInspiracao = c.inspiracao - 1
      const pid = c.personagem_id
      const nome = c.nome

      c.inspiracao = novaInspiracao
      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'sistema',
        origem: 'DM',
        alvo: nome,
        valor: null,
        tipo_dano: null,
        descricao: `${nome} usou 1 inspiração heroica (restam ${novaInspiracao})`,
        criado_em: new Date().toISOString(),
      })

      if (pid) {
        createClient()
          .from('personagens')
          .update({ inspiracao: novaInspiracao })
          .eq('id', pid)
          .then(({ error }) => {
            if (error) console.error('Erro ao usar inspiração:', error)
          })
      }
    }),
  }))
)
