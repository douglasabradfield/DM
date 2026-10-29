import { describe, it, expect } from 'vitest'
import type { ImagemGaleria } from '@/components/galeria/GaleriaImagens'
import {
  aplicarEventoImagem, contarNovas, escolherMapa, filtrarPorPapel, ordenarImagens, separarMapasEFotos,
} from './imagens-mesa'

function img(id: string, extra: Partial<ImagemGaleria> = {}): ImagemGaleria {
  return {
    id, campanha_id: 'c1', nome: id, url: `u/${id}`, storage_path: null, tipo: 'imagem',
    visivel_jogadores: true, compartilhado: false, criado_em: '2026-01-01T00:00:00Z', liberado_em: null,
    ...extra,
  }
}

describe('ordenarImagens', () => {
  it('liberado_em desc, depois criado_em desc, sem liberado_em por último', () => {
    const a = img('a', { liberado_em: '2026-02-01T00:00:00Z' })
    const b = img('b', { liberado_em: '2026-03-01T00:00:00Z' })
    const c = img('c', { criado_em: '2026-05-01T00:00:00Z' })
    const d = img('d', { criado_em: '2026-04-01T00:00:00Z' })
    expect(ordenarImagens([d, a, c, b]).map(i => i.id)).toEqual(['b', 'a', 'c', 'd'])
  })
  it('não muta a lista original', () => {
    const lista = [img('a'), img('b', { liberado_em: '2026-02-01T00:00:00Z' })]
    ordenarImagens(lista)
    expect(lista.map(i => i.id)).toEqual(['a', 'b'])
  })
})

describe('filtrarPorPapel', () => {
  const lista = [img('a'), img('b', { visivel_jogadores: false })]
  it('jogador só vê as liberadas', () => {
    expect(filtrarPorPapel(lista, false).map(i => i.id)).toEqual(['a'])
  })
  it('DM da campanha vê tudo', () => {
    expect(filtrarPorPapel(lista, true)).toHaveLength(2)
  })
})

describe('separarMapasEFotos, contarNovas e escolherMapa', () => {
  const lista = [img('m1', { tipo: 'mapa' }), img('m2', { tipo: 'mapa' }), img('f1'), img('f2')]
  const { mapas, fotos } = separarMapasEFotos(lista)
  it('separa por tipo', () => {
    expect(mapas.map(i => i.id)).toEqual(['m1', 'm2'])
    expect(fotos.map(i => i.id)).toEqual(['f1', 'f2'])
  })
  it('conta só fotos não vistas', () => {
    expect(contarNovas(fotos, new Set())).toBe(2)
    expect(contarNovas(fotos, new Set(['f1', 'm1']))).toBe(1)
  })
  it('escolhe o mapa pelo id, ou o primeiro', () => {
    expect(escolherMapa(mapas, 'm2')?.id).toBe('m2')
    expect(escolherMapa(mapas, 'sumiu')?.id).toBe('m1')
    expect(escolherMapa([], null)).toBeNull()
  })
})

describe('aplicarEventoImagem', () => {
  const base = [img('a'), img('b')]
  it('DELETE remove', () => {
    expect(aplicarEventoImagem(base, { tipo: 'DELETE', id: 'a' }, false).map(i => i.id)).toEqual(['b'])
  })
  it('jogador: imagem que deixou de ser visível some', () => {
    const r = aplicarEventoImagem(base, { tipo: 'UPSERT', linha: img('a', { visivel_jogadores: false }) }, false)
    expect(r.map(i => i.id)).toEqual(['b'])
  })
  it('DM: imagem oculta continua na lista', () => {
    const r = aplicarEventoImagem(base, { tipo: 'UPSERT', linha: img('a', { visivel_jogadores: false }) }, true)
    expect(r).toHaveLength(2)
  })
  it('INSERT entra e a lista é reordenada', () => {
    const nova = img('n', { liberado_em: '2026-09-01T00:00:00Z' })
    expect(aplicarEventoImagem(base, { tipo: 'UPSERT', linha: nova }, false)[0].id).toBe('n')
  })
})
