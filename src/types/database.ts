export interface Profile {
  id: string
  email: string
  nome: string | null
  plano: 'free' | 'heroi' | 'solo' | 'mesa_pro' | 'guild_master' | 'dm_supremo'
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
  status?: string
  link_token: string | null
  criado_em: string
  resumo_final?: string | null
  moeda_custom_nome?: string | null
  aventura_bloqueada_ate?: string | null
  sessao_data?: string | null
  sessao_formato?: 'presencial' | 'online' | null
  sessao_local?: string | null
  papel?: 'dm' | 'jogador'
  plano_efetivo?: string
}

export interface Aventura {
  id: string
  campanha_id: string
  titulo: string
  titulo_original: string | null
  idioma_original: string
  conteudo_json: ConteudoAventura | null
  arquivo_url: string | null
  processada: boolean
  criado_em: string
}

export interface Local {
  codigo: string
  nome: string
  texto_narrativo: string
  notas_dm: string
  criaturas: string[]
  tesouros: string[]
  armadilhas: string[]
}

export interface Capitulo {
  numero: number
  titulo_pt: string
  titulo_en: string
  plano: string
  nivel_recomendado: string
  resumo: string
  npcs: Array<{ nome: string; descricao: string }>
  locais: Local[]
  traduzido?: boolean
}

export interface NPCGlobal {
  nome: string
  papel: string
  descricao: string
  motivacao: string
}

export interface ConteudoAventura {
  titulo: string
  titulo_original: string
  sistema: string
  nivel_recomendado: string
  numero_jogadores: string
  resumo_geral: string
  npcs_globais: NPCGlobal[]
  artefato_central?: { nome: string; descricao: string; fragmentos: string[] }
  mecanica_especial?: { nome: string; descricao: string }
  capitulos: Capitulo[]
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
