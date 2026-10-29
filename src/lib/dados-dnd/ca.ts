// Cálculo de CA (classe de armadura) derivado dos itens equipados.
// Módulo puro: sem banco, sem efeitos. O AC calculado NUNCA é gravado — toda
// leitura passa por getAcEfetivo / calcularAC.

import { calcularModificador } from './espacos-magia'

export type CategoriaItem = 'armadura' | 'escudo' | 'arma' | 'outro'
export type TipoArmadura = 'leve' | 'media' | 'pesada'

export interface ModificadorItem {
  // 'ac' | 'deslocamento' | 'save_*' | 'ataque' | 'dano' | ...
  alvo: string
  valor: number
  // 'soma' (padrão) | 'base' (substitui a base do AC)
  tipo?: 'soma' | 'base'
}

// Campos mecânicos de um item (todos opcionais — item comum não tem nenhum).
export interface ItemMecanico {
  nome?: string
  categoria?: CategoriaItem | null
  tipo_armadura?: TipoArmadura | null
  ac_base?: number | null
  max_des?: number | null
  req_for?: number | null
  desv_furtividade?: boolean | null
  modificadores?: ModificadorItem[] | null
}

// O que o cálculo precisa da ficha.
export interface FichaParaAC {
  forca?: number | null
  destreza?: number | null
  constituicao?: number | null
  sabedoria?: number | null
  classe?: string | null
  ac_manual?: number | null
}

export interface ParcelaAC {
  rotulo: string
  valor: number
}

export interface ResultadoAC {
  calculado: number
  // Precedência: override (batalha) ?? manual (ficha) ?? calculado
  efetivo: number
  manual: number | null
  // CA temporária da batalha (batalha_combatentes.ac_override); nunca vai para a ficha
  override: number | null
  // Ex.: "Armadura 14 + DES 2 + Escudo 2 = 18"
  parcelas: ParcelaAC[]
  detalhe: string
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Defesa sem Armadura: base 10 + DES + outro atributo.
type AtributoDefesa = 'constituicao' | 'sabedoria'
const DEFESA_SEM_ARMADURA: Record<string, { atributo: AtributoDefesa; rotulo: string }> = {
  barbaro: { atributo: 'constituicao', rotulo: 'CON' },
  barbarian: { atributo: 'constituicao', rotulo: 'CON' },
  monge: { atributo: 'sabedoria', rotulo: 'SAB' },
  monk: { atributo: 'sabedoria', rotulo: 'SAB' },
}

const modDe = (valor: number | null | undefined) => calcularModificador(valor ?? 10)

const ehArmadura = (i: ItemMecanico) => i.categoria === 'armadura' && typeof i.ac_base === 'number'
const ehEscudo = (i: ItemMecanico) => i.categoria === 'escudo'

// Soma (ou base) de um alvo nos modificadores de um item.
function modificadoresDe(item: ItemMecanico, alvo: string) {
  return (item.modificadores ?? []).filter(m => m.alvo === alvo && Number.isFinite(m.valor))
}

export function calcularAC(ficha: FichaParaAC, itensEquipados: ItemMecanico[] = [], acOverride: number | null = null): ResultadoAC {
  const modDes = modDe(ficha.destreza)
  const parcelas: ParcelaAC[] = []

  // Só 1 armadura conta (a API já desequipa a anterior; aqui é defesa extra
  // contra dado inconsistente: vale a de maior base).
  const armadura = itensEquipados
    .filter(ehArmadura)
    .sort((a, b) => (b.ac_base ?? 0) - (a.ac_base ?? 0))[0]

  // Modificadores 'base' (ex.: item que fixa a base de AC) substituem a base.
  const basesDeItens = itensEquipados.flatMap(i => modificadoresDe(i, 'ac').filter(m => m.tipo === 'base'))
  const baseSubstituta = basesDeItens.length ? Math.max(...basesDeItens.map(m => m.valor)) : null

  if (armadura) {
    const limite = armadura.max_des ?? Infinity
    // Armadura pesada (max_des 0) ignora o DES inteiro, inclusive o negativo.
    const desAplicado = limite === 0 ? 0 : Math.min(modDes, limite)
    parcelas.push({ rotulo: 'Armadura', valor: armadura.ac_base as number })
    if (desAplicado !== 0) parcelas.push({ rotulo: 'DES', valor: desAplicado })
  } else {
    const defesa = ficha.classe ? DEFESA_SEM_ARMADURA[semAcento(ficha.classe)] : undefined
    const modExtra = defesa ? modDe(ficha[defesa.atributo]) : 0
    // Maior base entre 10+DES e a Defesa sem Armadura da classe.
    if (defesa && modExtra > 0) {
      parcelas.push({ rotulo: 'Base', valor: 10 })
      if (modDes !== 0) parcelas.push({ rotulo: 'DES', valor: modDes })
      parcelas.push({ rotulo: defesa.rotulo, valor: modExtra })
    } else {
      parcelas.push({ rotulo: 'Base', valor: 10 })
      if (modDes !== 0) parcelas.push({ rotulo: 'DES', valor: modDes })
    }
  }

  if (baseSubstituta !== null) {
    const totalAtual = parcelas.reduce((s, p) => s + p.valor, 0)
    if (baseSubstituta > totalAtual) {
      parcelas.length = 0
      parcelas.push({ rotulo: 'Base', valor: baseSubstituta })
    }
  }

  // Escudo e demais itens: soma dos modificadores 'ac' (tipo soma/padrão). A API
  // garante no máximo 1 escudo equipado.
  for (const item of itensEquipados) {
    const soma = modificadoresDe(item, 'ac')
      .filter(m => m.tipo !== 'base')
      .reduce((s, m) => s + m.valor, 0)
    if (soma === 0) continue
    parcelas.push({ rotulo: ehEscudo(item) ? 'Escudo' : item.nome ?? 'Item', valor: soma })
  }

  const calculado = parcelas.reduce((s, p) => s + p.valor, 0)
  const manual = ficha.ac_manual ?? null
  const override = acOverride ?? null
  const efetivo = override ?? manual ?? calculado

  const detalhe = `${parcelas
    .map((p, idx) => {
      const sinal = p.valor < 0 ? '-' : '+'
      const base = `${p.rotulo} ${Math.abs(p.valor)}`
      return idx === 0 ? (p.valor < 0 ? `-${base}` : base) : `${sinal} ${base}`
    })
    .join(' ')} = ${calculado}`

  return { calculado, efetivo, manual, override, parcelas, detalhe }
}

// Aplica (ou remove, com null) a CA temporária da batalha sobre um resultado já
// calculado, sem refazer a conta. É a mesma precedência de calcularAC.
export function aplicarOverrideAc(r: ResultadoAC, acOverride: number | null | undefined): ResultadoAC {
  const override = acOverride ?? null
  return { ...r, override, efetivo: override ?? r.manual ?? r.calculado }
}

// Única porta de leitura do AC de um personagem. Precedência:
// acOverride (CA temporária da batalha) ?? ac_manual (ficha) ?? calculado.
// (personagens.ca é legado: não é lido aqui.)
export function getAcEfetivo(ficha: FichaParaAC, itensEquipados: ItemMecanico[] = [], acOverride: number | null = null): number {
  return calcularAC(ficha, itensEquipados, acOverride).efetivo
}

// Armadura equipada exigindo mais FOR do que o personagem tem: pode equipar,
// mas o deslocamento cai 3 m.
export function armaduraPesadaDemais(ficha: FichaParaAC, itensEquipados: ItemMecanico[]): ItemMecanico | null {
  const forca = ficha.forca ?? 10
  return itensEquipados.find(i => i.categoria === 'armadura' && (i.req_for ?? 0) > forca) ?? null
}

export const PENALIDADE_DESLOCAMENTO_FOR_M = 3

export function temDesvantagemFurtividade(itensEquipados: ItemMecanico[]): boolean {
  return itensEquipados.some(i => !!i.desv_furtividade)
}

// Item que ocupa o mesmo "slot" que `item` (1 armadura, 1 escudo).
export function mesmoSlot(a: ItemMecanico, b: ItemMecanico): boolean {
  return (a.categoria === 'armadura' && b.categoria === 'armadura')
    || (a.categoria === 'escudo' && b.categoria === 'escudo')
}

// Item que ganha o botão "Equipar": categoria mecânica, flag do catálogo ou os
// tipos antigos (armas/armaduras sem dados estruturados continuam equipáveis).
export function itemEquipavel(i: ItemMecanico & { equipavel?: boolean | null; tipo?: string | null }): boolean {
  return !!i.equipavel
    || i.categoria === 'armadura' || i.categoria === 'escudo' || i.categoria === 'arma'
    || i.tipo === 'arma' || i.tipo === 'armadura'
    || (i.modificadores?.length ?? 0) > 0
}

// Armadura/escudo marcados no banco como tal, mas sem número de CA (linhas antigas
// sem correspondência no catálogo): equipam, porém não mexem na CA.
export function semDadosDeCA(i: ItemMecanico & { tipo?: string | null }): boolean {
  return i.tipo === 'armadura' && !i.categoria
}
