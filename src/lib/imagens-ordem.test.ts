import { describe, it, expect } from 'vitest'
import { compararLiberacao } from './imagens-ordem'

describe('compararLiberacao', () => {
  it('liberada por último vem primeiro, mesmo sendo a mais antiga', () => {
    const lista = [
      { id: 'a', criado_em: '2026-01-02', liberado_em: '2026-02-01' },
      { id: 'b', criado_em: '2026-01-01', liberado_em: '2026-03-01' },
    ].sort(compararLiberacao)
    expect(lista.map(i => i.id)).toEqual(['b', 'a'])
  })
  it('sem liberado_em fica depois, por criado_em desc', () => {
    const lista = [
      { id: 'velha', criado_em: '2026-01-01', liberado_em: null },
      { id: 'nova', criado_em: '2026-01-05' },
      { id: 'lib', criado_em: '2026-01-01', liberado_em: '2026-02-01' },
    ].sort(compararLiberacao)
    expect(lista.map(i => i.id)).toEqual(['lib', 'nova', 'velha'])
  })
})
