import { describe, expect, it } from 'vitest'
import {
  aplicarOverrideAc, armaduraPesadaDemais, calcularAC, getAcEfetivo, mesmoSlot, temDesvantagemFurtividade,
  type FichaParaAC, type ItemMecanico,
} from './ca'

const ficha = (o: Partial<FichaParaAC> = {}): FichaParaAC => ({
  forca: 10, destreza: 14, constituicao: 10, sabedoria: 10, classe: 'Guerreiro', ac_manual: null, ...o,
})

const couro: ItemMecanico = { nome: 'Couro', categoria: 'armadura', tipo_armadura: 'leve', ac_base: 11, max_des: null }
const brunea: ItemMecanico = { nome: 'Peitoral', categoria: 'armadura', tipo_armadura: 'media', ac_base: 14, max_des: 2 }
const placas: ItemMecanico = { nome: 'Placas', categoria: 'armadura', tipo_armadura: 'pesada', ac_base: 18, max_des: 0, req_for: 15, desv_furtividade: true }
const escudo: ItemMecanico = { nome: 'Escudo', categoria: 'escudo', modificadores: [{ alvo: 'ac', valor: 2, tipo: 'soma' }] }
const anel: ItemMecanico = { nome: 'Anel de Proteção', categoria: 'outro', modificadores: [{ alvo: 'ac', valor: 1 }] }

describe('calcularAC', () => {
  it('sem armadura: 10 + DES', () => {
    const r = calcularAC(ficha(), [])
    expect(r.calculado).toBe(12)
    expect(r.detalhe).toBe('Base 10 + DES 2 = 12')
  })

  it('armadura leve: base + DES inteiro', () => {
    expect(getAcEfetivo(ficha({ destreza: 18 }), [couro])).toBe(15)
  })

  it('armadura média: DES limitado a +2', () => {
    expect(getAcEfetivo(ficha({ destreza: 18 }), [brunea])).toBe(16)
    expect(getAcEfetivo(ficha({ destreza: 12 }), [brunea])).toBe(15)
  })

  it('armadura pesada: DES ignorado (max_des 0)', () => {
    expect(getAcEfetivo(ficha({ destreza: 18 }), [placas])).toBe(18)
  })

  it('escudo soma +2', () => {
    const r = calcularAC(ficha({ destreza: 14 }), [brunea, escudo])
    expect(r.calculado).toBe(18)
    expect(r.detalhe).toBe('Armadura 14 + DES 2 + Escudo 2 = 18')
  })

  it('Bárbaro sem armadura: 10 + DES + CON', () => {
    expect(getAcEfetivo(ficha({ classe: 'Bárbaro', destreza: 14, constituicao: 16 }), [])).toBe(15)
  })

  it('Monge sem armadura: 10 + DES + SAB', () => {
    expect(getAcEfetivo(ficha({ classe: 'Monge', destreza: 16, sabedoria: 14 }), [])).toBe(15)
  })

  it('Bárbaro com armadura perde a Defesa sem Armadura', () => {
    expect(getAcEfetivo(ficha({ classe: 'Bárbaro', destreza: 14, constituicao: 18 }), [brunea])).toBe(16)
  })

  it('Defesa sem Armadura com CON negativo usa a base normal', () => {
    expect(getAcEfetivo(ficha({ classe: 'Bárbaro', destreza: 14, constituicao: 6 }), [])).toBe(12)
  })

  it('Bárbaro com escudo mantém a Defesa sem Armadura', () => {
    expect(getAcEfetivo(ficha({ classe: 'Bárbaro', destreza: 14, constituicao: 16 }), [escudo])).toBe(17)
  })

  it('item mágico +1 (anel) soma', () => {
    expect(getAcEfetivo(ficha(), [couro, escudo, anel])).toBe(11 + 2 + 2 + 1)
  })

  it('ac_manual vence o cálculo, mas o calculado continua disponível', () => {
    const r = calcularAC(ficha({ ac_manual: 20 }), [couro])
    expect(r.efetivo).toBe(20)
    expect(r.calculado).toBe(13)
    expect(r.manual).toBe(20)
  })

  it('ac_manual 0 ainda conta como preenchido', () => {
    expect(getAcEfetivo(ficha({ ac_manual: 0 }), [])).toBe(0)
  })

  it('DES negativo reduz a CA (inclusive em armadura média)', () => {
    expect(getAcEfetivo(ficha({ destreza: 6 }), [])).toBe(8)
    expect(getAcEfetivo(ficha({ destreza: 6 }), [brunea])).toBe(12)
    expect(getAcEfetivo(ficha({ destreza: 6 }), [placas])).toBe(18)
    expect(calcularAC(ficha({ destreza: 6 }), []).detalhe).toBe('Base 10 - DES 2 = 8')
  })

  it('modificador tipo base substitui a base quando maior', () => {
    const manto: ItemMecanico = { nome: 'Manto', modificadores: [{ alvo: 'ac', valor: 17, tipo: 'base' }] }
    expect(getAcEfetivo(ficha({ destreza: 14 }), [manto])).toBe(17)
    expect(getAcEfetivo(ficha({ destreza: 14 }), [placas, manto])).toBe(18)
  })

  it('ignora modificadores de outros alvos', () => {
    const botas: ItemMecanico = { nome: 'Botas', modificadores: [{ alvo: 'deslocamento', valor: 3 }] }
    expect(getAcEfetivo(ficha({ destreza: 10 }), [botas])).toBe(10)
  })

  it('atributos ausentes contam como 10', () => {
    expect(getAcEfetivo({}, [])).toBe(10)
  })
})

describe('auxiliares de equipar', () => {
  it('armaduraPesadaDemais: FOR menor que req_for', () => {
    expect(armaduraPesadaDemais(ficha({ forca: 12 }), [placas])).toBe(placas)
    expect(armaduraPesadaDemais(ficha({ forca: 15 }), [placas])).toBeNull()
  })

  it('temDesvantagemFurtividade', () => {
    expect(temDesvantagemFurtividade([placas])).toBe(true)
    expect(temDesvantagemFurtividade([couro, escudo])).toBe(false)
  })

  it('mesmoSlot: armadura com armadura, escudo com escudo', () => {
    expect(mesmoSlot(couro, placas)).toBe(true)
    expect(mesmoSlot(escudo, escudo)).toBe(true)
    expect(mesmoSlot(couro, escudo)).toBe(false)
  })
})

describe('precedência da CA: ac_override ?? ac_manual ?? calculado', () => {
  // DES 14 (+2) + couro 11 = 13 calculado
  const base = ficha()

  it('sem manual nem override: usa o calculado', () => {
    const r = calcularAC(base, [couro])
    expect(r.efetivo).toBe(13)
    expect(r.override).toBeNull()
  })

  it('ac_manual vence o calculado', () => {
    expect(getAcEfetivo(ficha({ ac_manual: 17 }), [couro])).toBe(17)
  })

  it('ac_override vence o calculado', () => {
    expect(getAcEfetivo(base, [couro], 20)).toBe(20)
  })

  it('ac_override vence o ac_manual e o calculado', () => {
    const r = calcularAC(ficha({ ac_manual: 17 }), [couro], 22)
    expect(r.efetivo).toBe(22)
    expect(r.override).toBe(22)
    expect(r.manual).toBe(17)
    expect(r.calculado).toBe(13)
  })

  it('override null cai no ac_manual, e sem manual cai no calculado', () => {
    expect(getAcEfetivo(ficha({ ac_manual: 17 }), [couro], null)).toBe(17)
    expect(getAcEfetivo(base, [couro], null)).toBe(13)
  })

  it('override 0 é valor válido (não é tratado como ausente)', () => {
    expect(getAcEfetivo(ficha({ ac_manual: 17 }), [couro], 0)).toBe(0)
  })

  it('o override não altera calculado nem manual (nada vai para a ficha)', () => {
    const r = calcularAC(ficha({ ac_manual: 17 }), [couro], 25)
    expect(r.calculado).toBe(13)
    expect(r.manual).toBe(17)
  })
})

describe('aplicarOverrideAc (usado pela batalha sobre o resultado já calculado)', () => {
  const r = calcularAC(ficha({ ac_manual: 17 }), [couro])

  it('aplica o override sem refazer a conta', () => {
    expect(aplicarOverrideAc(r, 21).efetivo).toBe(21)
  })

  it('limpar o override (null/undefined) volta ao manual', () => {
    expect(aplicarOverrideAc(aplicarOverrideAc(r, 21), null).efetivo).toBe(17)
    expect(aplicarOverrideAc(r, undefined).efetivo).toBe(17)
  })

  it('dá o mesmo resultado que passar o override direto a calcularAC', () => {
    expect(aplicarOverrideAc(r, 21)).toEqual(calcularAC(ficha({ ac_manual: 17 }), [couro], 21))
  })

  it('sem manual, limpar o override volta ao calculado', () => {
    const sem = calcularAC(ficha(), [couro])
    expect(aplicarOverrideAc(sem, 9).efetivo).toBe(9)
    expect(aplicarOverrideAc(aplicarOverrideAc(sem, 9), null).efetivo).toBe(13)
  })
})
