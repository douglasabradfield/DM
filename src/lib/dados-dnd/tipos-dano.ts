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

export function aplicarResistencias(
  dano: number,
  tipo: TipoDano,
  resistencias: TipoDano[],
  imunidades: TipoDano[],
  vulnerabilidades: TipoDano[]
): { danoFinal: number; modificador: string } {
  if (imunidades.includes(tipo)) {
    return { danoFinal: 0, modificador: 'Imunidade' }
  }
  if (resistencias.includes(tipo)) {
    return { danoFinal: Math.floor(dano / 2), modificador: 'Resistência' }
  }
  if (vulnerabilidades.includes(tipo)) {
    return { danoFinal: dano * 2, modificador: 'Vulnerabilidade' }
  }
  return { danoFinal: dano, modificador: '' }
}
