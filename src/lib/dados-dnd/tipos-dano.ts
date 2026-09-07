import type { TipoDano } from '@/types/dnd'

export interface InfoTipoDano {
  id: TipoDano
  nome: string
  icone: string
  cor: string
}

export const TIPOS_DANO: InfoTipoDano[] = [
  { id: 'acido',       nome: 'Ácido',        icone: '🧪', cor: '#a8e063' },
  { id: 'contundente', nome: 'Contundente',  icone: '🔨', cor: '#adb5bd' },
  { id: 'cortante',    nome: 'Cortante',     icone: '⚔️', cor: '#e63946' },
  { id: 'eletrico',    nome: 'Elétrico',     icone: '⚡', cor: '#ffd166' },
  { id: 'fogo',        nome: 'Fogo',         icone: '🔥', cor: '#f4a261' },
  { id: 'forca',       nome: 'Força',        icone: '✨', cor: '#e9c46a' },
  { id: 'frio',        nome: 'Frio',         icone: '❄️', cor: '#89d4e3' },
  { id: 'necrotico',   nome: 'Necrótico',    icone: '💀', cor: '#6d2b8f' },
  { id: 'perfurante',  nome: 'Perfurante',   icone: '🗡️', cor: '#e63946' },
  { id: 'psiquico',    nome: 'Psíquico',     icone: '🧠', cor: '#c77dff' },
  { id: 'radiante',    nome: 'Radiante',     icone: '☀️', cor: '#ffdd57' },
  { id: 'trovejante',  nome: 'Trovejante',   icone: '🌩️', cor: '#adb5bd' },
  { id: 'veneno',      nome: 'Veneno',       icone: '☠️', cor: '#57cc99' },
]

export function getTipoDano(id: TipoDano): InfoTipoDano {
  return TIPOS_DANO.find(t => t.id === id) ?? TIPOS_DANO[0]
}

// Dados legados gravam tipo_dano capitalizado (ex. "Cortante"), diferente do
// id em minúsculo que aplicarResistencias() espera. Para os 13 tipos, o
// `nome` normalizado (minúsculo, sem acento) é idêntico ao `id` — então essa
// normalização cobre tanto ids já corretos quanto valores legados, sempre
// validando contra TIPOS_DANO (nunca aceita string solta).
export function normalizarTipoDano(raw: string | null | undefined): TipoDano | null {
  if (!raw) return null
  const norm = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  return TIPOS_DANO.find(t => t.id === norm)?.id ?? null
}

// monster_damage_modifiers e monster_actions guardam o tipo de dano em dois
// campos: damage_type_en (inglês canônico do SRD, quase sempre presente) e um
// rótulo PT livre que às vezes diverge do nosso id — "concussão" no lugar de
// "contundente", "relâmpago" no lugar de "elétrico", "Veneno" capitalizado.
// Resolver pelo inglês primeiro; o PT normalizado é só reserva.
const MAPA_DANO_EN: Record<string, TipoDano> = {
  acid: 'acido',
  bludgeoning: 'contundente',
  cold: 'frio',
  fire: 'fogo',
  force: 'forca',
  lightning: 'eletrico',
  necrotic: 'necrotico',
  piercing: 'perfurante',
  poison: 'veneno',
  psychic: 'psiquico',
  radiant: 'radiante',
  slashing: 'cortante',
  thunder: 'trovejante',
}

export function resolverTipoDanoSRD(
  fonte: { damage_type_en?: string | null; damage_type_pt?: string | null }
): TipoDano | null {
  const en = fonte.damage_type_en?.trim().toLowerCase()
  if (en && MAPA_DANO_EN[en]) return MAPA_DANO_EN[en]
  return normalizarTipoDano(fonte.damage_type_pt)
}

// Converte as linhas de monster_damage_modifiers de um monstro nos três
// vetores que o combatente/motor esperam. Tipos que não resolvem (rótulo
// desconhecido) são ignorados — melhor não aplicar do que aplicar errado.
export function separarModificadoresDano(
  mods: { modifier_type: string; damage_type_en?: string | null; damage_type_pt?: string | null }[] | null | undefined
): { resistencias: TipoDano[]; imunidades: TipoDano[]; vulnerabilidades: TipoDano[] } {
  const resistencias: TipoDano[] = []
  const imunidades: TipoDano[] = []
  const vulnerabilidades: TipoDano[] = []
  for (const m of mods ?? []) {
    const tipo = resolverTipoDanoSRD(m)
    if (!tipo) continue
    const destino =
      m.modifier_type === 'immunity' ? imunidades :
      m.modifier_type === 'vulnerability' ? vulnerabilidades :
      m.modifier_type === 'resistance' ? resistencias : null
    if (destino && !destino.includes(tipo)) destino.push(tipo)
  }
  return { resistencias, imunidades, vulnerabilidades }
}

export const MODIFICADOR_IMUNIDADE = 'Imunidade'
export const MODIFICADOR_RESISTENCIA = 'Resistência'
export const MODIFICADOR_VULNERABILIDADE = 'Vulnerabilidade'

export function aplicarResistencias(
  dano: number,
  tipo: TipoDano,
  resistencias: TipoDano[],
  imunidades: TipoDano[],
  vulnerabilidades: TipoDano[]
): { danoFinal: number; modificador: string } {
  if (imunidades.includes(tipo)) {
    return { danoFinal: 0, modificador: MODIFICADOR_IMUNIDADE }
  }
  if (resistencias.includes(tipo)) {
    return { danoFinal: Math.floor(dano / 2), modificador: MODIFICADOR_RESISTENCIA }
  }
  if (vulnerabilidades.includes(tipo)) {
    return { danoFinal: dano * 2, modificador: MODIFICADOR_VULNERABILIDADE }
  }
  return { danoFinal: dano, modificador: '' }
}
