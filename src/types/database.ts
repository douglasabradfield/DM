export interface Profile {
  id: string
  email: string
  nome: string | null
  plano: 'free' | 'heroi' | 'solo' | 'mesa_pro' | 'guild_master'
  is_admin: boolean
  stripe_customer_id: string | null
  avatar_url: string | null
  username: string | null
  telefone: string | null
  criado_em: string
  atualizado_em: string
}

export interface Assinatura {
  id: string
  user_id: string
  plano: string
  status: 'ativo' | 'cancelado' | 'pendente' | 'trial'
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  criado_em: string
}

export interface Campanha {
  id: string
  dm_id: string
  nome: string
  descricao: string | null
  sistema: string
  ativa: boolean
  link_token: string | null
  criado_em: string
  resumo_final?: string | null
  moeda_custom_nome?: string | null
  aventura_bloqueada_ate?: string | null
}

export interface Aventura {
  id: string
  campanha_id: string
  titulo: string
  titulo_original: string | null
  idioma_original: string
  conteudo_json: AventuraConteudo | null
  arquivo_url: string | null
  processada: boolean
  criado_em: string
}

export interface AventuraConteudo {
  titulo: string
  sistema: string
  capitulos: Capitulo[]
  npcs_globais: NPC[]
  notas_gerais: string
}

export interface Capitulo {
  numero: number
  titulo: string
  locais: LocalAventura[]
}

export interface LocalAventura {
  id: string
  codigo: string
  nome: string
  capitulo: string
  texto_narrativo: string
  notas_dm: string
  encontros: Encontro[]
  npcs: NPC[]
  ordem: number
}

export interface Encontro {
  nome: string
  cr: string
  quantidade: number
  notas: string
}

export interface NPC {
  nome: string
  descricao: string
  personalidade: string
  objetivo: string
  segredos: string
}

export interface Sessao {
  id: string
  campanha_id: string
  numero: number | null
  titulo: string | null
  data: string
  resumo: string | null
  resumo_ia: string | null
  notas_dm: string | null
  duracao_minutos: number | null
  encerrada: boolean
}

export interface CampaignMember {
  id: string
  campanha_id: string
  user_id: string
  papel: 'dm' | 'jogador'
  joined_at: string
  profiles?: { email: string; nome: string | null; avatar_url: string | null }
}

export interface CampaignInvite {
  id: string
  campanha_id: string
  email: string
  token: string
  usado: boolean
  expires_at: string
  criado_em: string
}
