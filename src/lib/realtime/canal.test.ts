import { describe, expect, it } from 'vitest'
import { chaveDeIds, nomeCanalUnico } from './canal'

describe('chaveDeIds', () => {
  it('é estável para a mesma lista em outra ordem ou referência', () => {
    expect(chaveDeIds(['b', 'a', 'c'])).toBe(chaveDeIds(['c', 'a', 'b']))
  })
  it('remove repetidos e devolve vazio para lista vazia', () => {
    expect(chaveDeIds(['a', 'a', 'b'])).toBe('a,b')
    expect(chaveDeIds([])).toBe('')
  })
})

describe('nomeCanalUnico', () => {
  it('é único por instância mesmo com a mesma lista de ids', () => {
    const chave = chaveDeIds(['a', 'b'])
    expect(nomeCanalUnico('ac-personagens', chave, ':r1:')).not.toBe(nomeCanalUnico('ac-personagens', chave, ':r2:'))
  })
  it('é estável para a mesma instância e a mesma lista', () => {
    expect(nomeCanalUnico('ac', chaveDeIds(['b', 'a']), ':r1:')).toBe(nomeCanalUnico('ac', chaveDeIds(['a', 'b']), ':r1:'))
  })
  it('limita o trecho dos ids sem perder o sufixo da instância', () => {
    const nome = nomeCanalUnico('ac', 'x'.repeat(500), ':r9:')
    expect(nome.endsWith(':r9:')).toBe(true)
    expect(nome.length).toBeLessThan(100)
  })
})
