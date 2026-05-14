import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Combatente, EntradaLog, TipoCondicao } from '@/types/batalha'
import type { TipoDano } from '@/types/dnd'
import { aplicarResistencias } from '@/lib/dados-dnd/tipos-dano'

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

  // Ações de gerenciamento
  iniciarBatalha: () => void
  encerrarBatalha: () => void
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
}

export const useBatalha = create<EstadoBatalhaStore>()(
  immer((set, get) => ({
    combatentes: [],
    log: [],
    rodadaAtual: 1,
    turnoAtual: 0,
    ativa: false,
    batalhaId: null,

    iniciarBatalha: () => set(state => {
      state.ativa = true
      state.batalhaId = gerarId()
      state.rodadaAtual = 1
      state.turnoAtual = 0
    }),

    encerrarBatalha: () => set(state => {
      state.ativa = false
    }),

    resetarBatalha: () => set(state => {
      state.combatentes = []
      state.log = []
      state.rodadaAtual = 1
      state.turnoAtual = 0
      state.ativa = false
      state.batalhaId = null
    }),

    adicionarCombatente: (c) => set(state => {
      state.combatentes.push({
        ...c,
        id: gerarId(),
        batalha_id: state.batalhaId ?? '',
        dano_input: 0,
        dano_tipo: 'corte',
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

      const { danoFinal } = aplicarResistencias(dano, tipo, c.resistencias, c.imunidades, c.vulnerabilidades)

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

      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'dano',
        origem: 'DM',
        alvo: c.nome,
        valor: danoFinal,
        tipo_dano: tipo,
        descricao: `${c.nome} sofreu ${danoFinal} de dano ${tipo}`,
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

      c.pv_atual = Math.min(c.pv_maximo, c.pv_atual + cura)
      c.cura_total += cura
      c.flash = 'cura'

      state.log.push({
        id: gerarId(),
        rodada: state.rodadaAtual,
        turno: state.turnoAtual,
        tipo: 'cura',
        origem: 'DM',
        alvo: c.nome,
        valor: cura,
        tipo_dano: null,
        descricao: `${c.nome} foi curado em ${cura} PV`,
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

    zerarContadores: () => set(state => {
      state.combatentes.forEach(c => {
        c.dano_total = 0
        c.cura_total = 0
        c.dano_input = 0
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
  }))
)
