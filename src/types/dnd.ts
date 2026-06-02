export type TipoDano =
  | 'acido' | 'frio' | 'fogo' | 'forca' | 'cortante'
  | 'trovejante' | 'eletrico' | 'necrotico' | 'perfurante'
  | 'veneno' | 'psiquico' | 'radiante' | 'contundente'

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

export interface Monster {
  id: string
  slug: string
  name_pt: string
  name_en: string
  size_pt: string | null
  type_pt: string | null
  alignment_pt: string | null
  armor_class: number
  hit_points: number
  hit_dice: string | null
  speed_pt: string | null
  str_score: number
  dex_score: number
  con_score: number
  int_score: number
  wis_score: number
  cha_score: number
  challenge_rating: string
  xp: number | null
  proficiency_bonus: number | null
  passive_perception: number | null
  senses_pt: string | null
  languages_pt: string | null
  traits_pt: string | null
  actions_pt: string | null
  traits_rules_pt: string | null
  actions_rules_pt: string | null
  source_page_start: number | null
  darkvision_ft: number | null
  blindsight_ft: number | null
  tremorsense_ft: number | null
  truesight_ft: number | null
}

export interface MonsterAction {
  id: number
  monster_id: number
  action_type: string
  name_pt: string
  name_en?: string | null
  attack_type?: string | null
  attack_bonus?: number | null
  reach_ft?: number | null
  range_normal_ft?: number | null
  range_long_ft?: number | null
  target_pt?: string | null
  damage_dice?: string | null
  damage_type_en?: string | null
  damage_type_pt?: string | null
  damage2_dice?: string | null
  damage2_type_en?: string | null
  damage2_type_pt?: string | null
  save_ability?: string | null
  save_dc?: number | null
  save_effect_pt?: string | null
  recharge?: string | null
  condition_applied_pt?: string | null
  legendary_cost?: number | null
  description_pt: string
}

export interface MonsterSave {
  id?: number
  monster_id?: number
  ability: string
  bonus: number
}

export interface MonsterSkill {
  id?: number
  monster_id?: number
  skill_en?: string | null
  skill_pt: string
  bonus: number
}

export interface MonsterDamageModifier {
  id?: number
  monster_id?: number
  modifier_type: string
  damage_type_pt: string
  note_pt?: string | null
}

export interface MonsterConditionImmunity {
  id?: number
  monster_id?: number
  condition_pt: string
}

export interface MonsterDetailed extends Monster {
  monster_actions?: MonsterAction[]
  monster_saves?: MonsterSave[]
  monster_skills?: MonsterSkill[]
  monster_damage_modifiers?: MonsterDamageModifier[]
  monster_condition_immunities?: MonsterConditionImmunity[]
}

export interface Spell {
  id: string
  slug: string
  name_pt: string
  name_en: string
  level: number
  school_pt: string | null
  casting_time_pt: string | null
  range_pt: string | null
  components_pt: string | null
  duration_pt: string | null
  concentration: boolean
  ritual: boolean
  description_pt: string | null
  classes_pt: string | null
  classes_en: string | null
}

export interface MagicItem {
  id: string
  slug: string
  name_pt: string
  name_en: string
  category: string | null
  rarity: string | null
  requires_attunement: boolean
  attunement_notes_pt: string | null
  is_consumable: boolean
  has_charges: boolean
  charges_max: number | null
  activation_type: string | null
  description_pt: string | null
  mechanics_pt: string | null
  source_page_start: number | null
}

export interface EquipmentWeapon {
  id: string
  slug: string
  name_pt: string
  name_en: string
  category_en: string | null
  category_pt: string | null
  damage_dice: string | null
  damage_type_pt: string | null
  properties_pt: string | null
  mastery_pt: string | null
  weight_lb: number | null
  cost_cp: number | null
}

export interface EquipmentArmor {
  id: string
  slug: string
  name_pt: string
  name_en: string
  category_pt: string | null
  base_ac_formula_pt: string | null
  strength_requirement: number | null
  stealth_disadvantage: boolean
  weight_lb: number | null
  cost_cp: number | null
}

export interface EquipmentGear {
  id: string
  slug: string
  name_pt: string
  name_en: string
  category_pt: string | null
  cost_gp: number | null
  weight_lb: number | null
  description_pt: string | null
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

export interface Moedas {
  pc: number
  pp: number
  po: number
  pe: number
  platina: number
  pl?: number
  custom?: number
}

export interface Personagem {
  id: string
  campanha_id: string
  user_id?: string | null
  jogador_nome: string
  jogador_email: string | null
  nome: string
  tipo_personagem: 'jogador' | 'npc' | 'monstro' | null
  visibilidade?: string | null
  visibilidade_jogador_id?: string | null
  imagem_url: string | null
  classe: string | null
  nivel: number
  antecedente: string | null
  raca: string | null
  alinhamento: string | null
  pontos_experiencia: number
  moedas: Moedas | null
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
  inspiracao: number
  salvaguardas: Record<string, boolean>
  pericias: Record<string, boolean>
  ataques: Ataque[]
  inventario: ItemInventario[] | null
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

export interface ItemInventario {
  id: string
  nome: string
  tipo: string | null
  raridade: string | null
  quantidade: number
  descricao: string | null
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
