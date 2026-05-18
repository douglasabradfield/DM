export type PlanoId = 'free' | 'heroi' | 'solo' | 'mesa_pro' | 'guild_master'

export interface LimitesPlano {
  personagens: number | 'ilimitado'
  campanhas: number | 'ilimitado'
  mensagens_ia: number | 'ilimitado'
  aventura: 'bloqueado' | 'limitado' | 'ilimitado'
  aventura_cooldown_meses?: number
  batalha_log: boolean
  diario: boolean
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
    },
  },
  heroi: {
    id: 'heroi',
    nome: 'Herói',
    preco: 'R$9/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 3,
      mensagens_ia: 0,
      aventura: 'bloqueado',
      batalha_log: true,
      diario: true,
    },
  },
  solo: {
    id: 'solo',
    nome: 'DM Solo',
    preco: 'R$19/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 3,
      mensagens_ia: 100,
      aventura: 'limitado',
      aventura_cooldown_meses: 3,
      batalha_log: true,
      diario: true,
    },
  },
  mesa_pro: {
    id: 'mesa_pro',
    nome: 'Mesa Pro',
    preco: 'R$59/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 'ilimitado',
      mensagens_ia: 500,
      aventura: 'ilimitado',
      batalha_log: true,
      diario: true,
    },
  },
  guild_master: {
    id: 'guild_master',
    nome: 'Guild Master',
    preco: 'R$129/mês',
    limites: {
      personagens: 'ilimitado',
      campanhas: 'ilimitado',
      mensagens_ia: 'ilimitado',
      aventura: 'ilimitado',
      batalha_log: true,
      diario: true,
    },
  },
}

const ORDEM_PLANOS: PlanoId[] = ['free', 'heroi', 'solo', 'mesa_pro', 'guild_master']

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
