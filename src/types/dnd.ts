export type TipoDano =
  | 'acido' | 'frio' | 'fogo' | 'forca' | 'corte'
  | 'trovejante' | 'eletrico' | 'necrotico' | 'perfurante'
  | 'veneno' | 'psiquico' | 'radiante' | 'contundente' | 'deslumbramento'

export type Alinhamento =
  | 'Leal e Bom' | 'Neutro e Bom' | 'Caótico e Bom'
  | 'Leal e Neutro' | 'Neutro' | 'Caótico e Neutro'
  | 'Leal e Mau' | 'Neutro e Mau' | 'Caótico e Mau'
  | 'Sem Alinhamento'

export type Escola =
  | 'Abjuração' | 'Adivinhação' | 'Conjuração' | 'Encantamento'
  | 'Evocação' | 'Ilusão' | 'Necromancia' | 'Transmutação'

export interface Monstro {
  id: string
  nome: string
  nome_original: string | null
  tipo: string | null
  ca: number | null
  ca_texto: string | null
  pv: number | null
  pv_texto: string | null
  deslocamento: string | null
  cr: string | null
  forca: number | null
  destreza: number | null
  constituicao: number | null
  inteligencia: number | null
  sabedoria: number | null
  carisma: number | null
  salvaguardas: string | null
  pericias: string | null
  imunidade_dano: string | null
  resistencia_dano: string | null
  imunidade_condicao: string | null
  sentidos: string | null
  habilidades: string | null
  acoes: string | null
  reacoes: string | null
  acoes_lendarias: string | null
  sistema: string
}

export interface Magia {
  id: string
  nome: string
  nome_original: string | null
  nivel: number
  escola: string | null
  tempo_conjuracao: string | null
  alcance: string | null
  componentes: string | null
  duracao: string | null
  descricao: string | null
  em_nivel_superior: string | null
  classes: string[] | null
  sistema: string
}

export interface Item {
  id: string
  nome: string
  nome_original: string | null
  tipo: string | null
  raridade: string | null
  requer_sintonizacao: boolean
  descricao: string | null
  valor: string | null
  peso: string | null
  propriedades: Record<string, unknown> | null
  sistema: string
}

export interface Arma {
  id: string
  nome: string
  nome_original: string | null
  categoria: string | null
  dano: string | null
  tipo_dano: string | null
  propriedades: string[] | null
  peso: string | null
  valor: string | null
  sistema: string
}

export interface Condicao {
  id: string
  nome: string
  icone: string | null
  descricao: string
  efeitos: string[]
  como_sair: string | null
  sistema: string
}

export interface Personagem {
  id: string
  campanha_id: string
  jogador_nome: string
  jogador_email: string | null
  nome: string
  classe: string | null
  nivel: number
  antecedente: string | null
  raca: string | null
  alinhamento: string | null
  pontos_experiencia: number
  forca: number
  destreza: number
  constituicao: number
  inteligencia: number
  sabedoria: number
  carisma: number
  ca: number
  iniciativa: number
  deslocamento: number
  pv_maximo: number
  pv_atual: number
  pv_temporarios: number
  dado_vida: string
  bonus_proficiencia: number
  inspiracao: boolean
  salvaguardas: Record<string, boolean>
  pericias: Record<string, boolean>
  ataques: Ataque[]
  equipamento: string | null
  outras_proficiencias: string | null
  tracos_personalidade: string | null
  ideais: string | null
  vinculos: string | null
  fraquezas: string | null
  caracteristicas_talentos: string | null
  idade: string | null
  altura: string | null
  peso: string | null
  cor_olhos: string | null
  cor_pele: string | null
  cor_cabelo: string | null
  aparencia: string | null
  historia: string | null
  aliados_organizacoes: string | null
  tesouros: string | null
  resistencias: TipoDano[]
  imunidades: TipoDano[]
  vulnerabilidades: TipoDano[]
  dndbeyond_url: string | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface Ataque {
  nome: string
  bonus_ataque: string
  dano: string
  tipo_dano: string
  notas: string
}

export interface EspacoMagia {
  nivel: number
  total: number
  utilizados: number
}

export type ClasseConjuradora =
  | 'Bardo' | 'Clérigo' | 'Druida' | 'Feiticeiro'
  | 'Mago' | 'Paladino' | 'Patrulheiro' | 'Bruxo'

export const CLASSES_DND = [
  'Bárbaro', 'Bardo', 'Bruxo', 'Clérigo', 'Druida',
  'Feiticeiro', 'Guerreiro', 'Ladino', 'Mago', 'Monge',
  'Paladino', 'Patrulheiro'
] as const

export const RACAS_DND = [
  'Anão da Colina', 'Anão da Montanha', 'Alto Elfo', 'Elfo da Floresta',
  'Drow', 'Halfling Pés-Leves', 'Halfling Robusto', 'Humano',
  'Draconato', 'Gnomo da Floresta', 'Gnomo das Rochas', 'Meio-Elfo',
  'Meio-Orc', 'Tiefling'
] as const
