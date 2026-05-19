export type PlanoId = 'free' | 'heroi' | 'solo' | 'mesa_pro' | 'guild_master' | 'dm_supremo'

export interface LimitesPlano {
  personagens: number | 'ilimitado'
  campanhas: number | 'ilimitado'
  mensagens_ia: number | 'ilimitado'
  aventura: 'bloqueado' | 'limitado' | 'ilimitado'
  aventura_cooldown_meses?: number
  batalha_log: boolean
  diario: boolean
  magias_itens: boolean
  imagens_mapas: boolean
  bestiario_filtros: boolean
  interacao_jogadores: false | 'basica' | 'completa'
  modulo_jogador: boolean
  conteudo_personalizado: boolean
}

export interface Plano {
  id: PlanoId
  nome: string
  preco: string
  limites: LimitesPlano
}

export const PLANOS: Record<PlanoId, Plano> = {
  free: {
    id: 'free',
    nome: 'Aventureiro',
    preco: 'Grátis',
    limites: {
      personagens: 6,
      campanhas: 1,
      mensagens_ia: 0,
      aventura: 'bloqueado',
      batalha_log: false,
      diario: false,
      magias_itens: false,
      imagens_mapas: false,
      bestiario_filtros: false,
      interacao_jogadores: false,
      modulo_jogador: false,
      conteudo_personalizado: false,
    },
  },
  heroi: {
    id: 'heroi',
    nome: 'Herói (legado)',
    preco: 'R$9/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 3,
      mensagens_ia: 0,
      aventura: 'bloqueado',
      batalha_log: true,
      diario: true,
      magias_itens: true,
      imagens_mapas: false,
      bestiario_filtros: true,
      interacao_jogadores: false,
      modulo_jogador: false,
      conteudo_personalizado: false,
    },
  },
  solo: {
    id: 'solo',
    nome: 'Herói',
    preco: 'R$14,90/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 1,
      mensagens_ia: 30,
      aventura: 'limitado',
      aventura_cooldown_meses: 3,
      batalha_log: true,
      diario: true,
      magias_itens: true,
      imagens_mapas: false,
      bestiario_filtros: true,
      interacao_jogadores: false,
      modulo_jogador: false,
      conteudo_personalizado: false,
    },
  },
  mesa_pro: {
    id: 'mesa_pro',
    nome: 'Mestre',
    preco: 'R$29,90/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 3,
      mensagens_ia: 100,
      aventura: 'ilimitado',
      batalha_log: true,
      diario: true,
      magias_itens: true,
      imagens_mapas: false,
      bestiario_filtros: true,
      interacao_jogadores: 'basica',
      modulo_jogador: false,
      conteudo_personalizado: false,
    },
  },
  guild_master: {
    id: 'guild_master',
    nome: 'Guilda',
    preco: 'R$59,90/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 'ilimitado',
      mensagens_ia: 'ilimitado',
      aventura: 'ilimitado',
      batalha_log: true,
      diario: true,
      magias_itens: true,
      imagens_mapas: true,
      bestiario_filtros: true,
      interacao_jogadores: 'completa',
      modulo_jogador: true,
      conteudo_personalizado: false,
    },
  },
  dm_supremo: {
    id: 'dm_supremo',
    nome: 'DM Supremo',
    preco: 'R$99,90/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 'ilimitado',
      mensagens_ia: 'ilimitado',
      aventura: 'ilimitado',
      batalha_log: true,
      diario: true,
      magias_itens: true,
      imagens_mapas: true,
      bestiario_filtros: true,
      interacao_jogadores: 'completa',
      modulo_jogador: true,
      conteudo_personalizado: true,
    },
  },
}

const ORDEM_PLANOS: PlanoId[] = ['free', 'heroi', 'solo', 'mesa_pro', 'guild_master', 'dm_supremo']

export function getPlano(planoId: string | null | undefined): Plano {
  return PLANOS[(planoId as PlanoId) ?? 'free'] ?? PLANOS.free
}

export function planoSuficiente(planoAtual: string | null | undefined, planoMinimo: PlanoId): boolean {
  const idxAtual = ORDEM_PLANOS.indexOf((planoAtual as PlanoId) ?? 'free')
  const idxMin = ORDEM_PLANOS.indexOf(planoMinimo)
  return idxAtual >= idxMin
}

export function podeUsar(planoId: string | null | undefined, recurso: keyof LimitesPlano): boolean {
  const plano = getPlano(planoId)
  const limite = plano.limites[recurso]
  if (typeof limite === 'boolean') return limite
  if (limite === 'bloqueado') return false
  if (limite === 'ilimitado') return true
  if (typeof limite === 'number') return limite > 0
  return true
}
