import type { TipoDano } from './dnd'

export type TipoCombatente = 'jogador' | 'monstro' | 'npc'

export type TipoCondicao =
  | 'Agarrado' | 'Amedrontado' | 'Atordoado' | 'Cego' | 'Caído'
  | 'Concentrado' | 'Encantado' | 'Envenenado' | 'Exausto' | 'Incapacitado'
  | 'Inconsciente' | 'Invisível' | 'Paralisado' | 'Petrificado' | 'Retido'

export interface EspacosMagiaBatalha {
  [nivel: number]: { total: number; utilizados: number }
}

export interface Combatente {
  id: string
  batalha_id: string
  personagem_id: string | null
  nome: string
  tipo: TipoCombatente
  iniciativa: number
  ca: number
  pv_maximo: number
  pv_atual: number
  pv_temporarios: number
  ausente: boolean
  morto: boolean
  condicoes: TipoCondicao[]
  resistencias: TipoDano[]
  imunidades: TipoDano[]
  vulnerabilidades: TipoDano[]
  espacos_magia: EspacosMagiaBatalha
  notas: string
  dados_monstro: DadosMonstroSimples | null
  ordem: number
  // estado local (não salvo)
  dano_input: number
  dano_tipo: TipoDano
  dano_total: number
  cura_total: number
  flash?: 'dano' | 'cura' | null
}

export interface DadosMonstroSimples {
  cr: string
  tipo: string
  habilidades: string
  acoes: string
  forca: number
  destreza: number
  constituicao: number
  inteligencia: number
  sabedoria: number
  carisma: number
}

export interface Batalha {
  id: string
  sessao_id: string
  nome: string | null
  rodada_atual: number
  turno_atual: number
  ativa: boolean
  estado_json: EstadoBatalha | null
  iniciada_em: string
  encerrada_em: string | null
}

export interface EstadoBatalha {
  combatentes: Combatente[]
  log: EntradaLog[]
}

export interface EntradaLog {
  id: string
  rodada: number
  turno: number
  tipo: 'dano' | 'cura' | 'condicao' | 'morte' | 'magia' | 'iniciativa' | 'nota'
  origem: string
  alvo: string
  valor: number | null
  tipo_dano: TipoDano | null
  descricao: string
  criado_em: string
}

export interface ResultadoDado {
  dado: string
  resultado: number
  total: number
  critico?: boolean
  falha?: boolean
}
