import type { ResultadoAcao } from '@/lib/batalha/acao-api'
import type { TipoEntradaLog } from '@/types/batalha'
import type { Personagem, Spell, TipoDano } from '@/types/dnd'

// =============================================================================
// Ação do jogador — sempre via API árbitro, nunca escrita direta (exceto arma)
// =============================================================================

export interface AlvoSelecionado {
  id: string
  nome: string
}

export interface AcaoPendente {
  tipo: TipoEntradaLog
  nomeAcao: string
  efeito: 'dano' | 'cura' | 'nenhum'
  precisaAlvo: boolean
  precisaValor: boolean
  tipoDanoPadrao: TipoDano | null
  nivelMagia?: number
  marcarEfeitoAtivo?: string
}

export interface ResultadoAcaoSessao extends ResultadoAcao {
  personagem?: Personagem
}

// Ação fora de combate — sempre sobre o próprio personagem (ou o que o DM
// está operando), nunca "alvos" de ataque. Mesma rota do modo combate,
// discriminada pela ausência de batalhaId.
// ajuste_ouro não está aqui — vive só em TipoAcaoInventario/chamarAcaoInventario
// (ModalOuro sempre manda `moedas` em lote, ver route.ts).
export type TipoAcaoSessao =
  | 'dano' | 'cura' | 'pv_temporarios'
  | 'condicao_aplicada' | 'condicao_removida'
  | 'usar_espaco' | 'recuperar_espaco'
  | 'usar_inspiracao'
  | 'descanso_longo' | 'descanso_curto'

// Inventário — mesma rota /api/mesa/acao, discriminada pelo `tipo` (não pela
// presença de batalhaId/sessaoId): funciona a partir de sessão, de batalha
// ou (para adicionar_item/definir_item, usados pela ficha) só com
// personagemId, sem sessão nem batalha ativa.
export type TipoAcaoInventario =
  | 'usar_item' | 'equipar_item' | 'descartar_item' | 'adicionar_item' | 'definir_item'
  | 'transferir_item' | 'transferir_moeda' | 'ajuste_ouro' | 'distribuir' | 'conceder_inspiracao'

export interface ItemDistribuidoPayload {
  nome: string
  tipo?: string | null
  raridade?: string | null
  descricao?: string | null
  quantidade: number
  itemRef?: string | null
}

export interface AcaoInventarioParams {
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
  moedas?: Partial<Record<'pc' | 'pp' | 'pe' | 'po' | 'pl', number>>
  paraPersonagemIds?: string[]
  itens?: ItemDistribuidoPayload[]
}

export interface ResultadoAcaoInventario extends ResultadoAcao {
  descricao?: string
}

export interface Destinatario {
  id: string
  nome: string
  imagemUrl?: string | null
}

export interface InfoPersonagem {
  imagem_url: string | null
  classe: string | null
  nivel: number | null
  deslocamento: number | null
  user_id: string | null
}

export interface AtaqueDisponivel {
  nome: string
  bonus: string
  dano: string
  tipo_dano?: string
}

export interface MagiaExibida {
  id: string
  nome: string
  nivel: number
  preparada: boolean
  danoDice: string | null
  tipoDano: TipoDano | null
  curaDice: string | null
  concentracao: boolean
  saveAbility: string | null
  tempoConjuracao?: string | null
  alcance?: string | null
  duracao?: string | null
}

export interface ConjuracaoEscolhida {
  magia: MagiaExibida
  nivelConjurado: number | null // null = truque, sem gasto de espaço
  efeitoAtivo: boolean
}

export interface MagiaPreparavel {
  id: string
  nome: string
  nivel: number
  preparada: boolean
}

export type ContextoAcao = { sessaoId: string } | { batalhaId: string; combatenteId: string }

export type LinhaMagia = {
  id: string; preparada: boolean; nivel: number
  spell: Pick<Spell, 'name_pt' | 'casting_time_pt' | 'range_pt' | 'duration_pt' | 'damage_dice' | 'damage_type_pt' | 'heal_dice' | 'concentration' | 'save_ability' | 'save_effect'> | null
}
