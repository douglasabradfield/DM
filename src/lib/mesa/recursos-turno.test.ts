import { describe, it, expect } from 'vitest'
import {
  validarUsoRecurso, descontarInspiracao, descontarUsoRecurso, descricaoEventoRecurso,
  reconhecerEventoRecurso, ehCanalizarDivindade, ehTipoRecursoTurno,
} from './recursos-turno'

const base = { ehDM: false, controla: true, ehVezDoCombatente: true, disponiveis: 1 }

describe('validarUsoRecurso', () => {
  it('jogador dono, na vez, com uso: ok', () => {
    expect(validarUsoRecurso('canalizar_divindade', base)).toEqual({ ok: true })
    expect(validarUsoRecurso('inspiracao_heroica', base)).toEqual({ ok: true })
  })
  it('recusa sem usos disponíveis', () => {
    const r = validarUsoRecurso('canalizar_divindade', { ...base, disponiveis: 0 })
    expect(r).toMatchObject({ ok: false, status: 403 })
    expect(validarUsoRecurso('inspiracao_heroica', { ...base, disponiveis: 0 }).ok).toBe(false)
  })
  it('recusa contador negativo', () => {
    expect(validarUsoRecurso('canalizar_divindade', { ...base, disponiveis: -1 }).ok).toBe(false)
  })
  it('recusa fora da vez', () => {
    const r = validarUsoRecurso('canalizar_divindade', { ...base, ehVezDoCombatente: false })
    expect(r).toMatchObject({ ok: false, status: 403 })
  })
  it('recusa jogador de outro personagem', () => {
    const r = validarUsoRecurso('inspiracao_heroica', { ...base, controla: false })
    expect(r).toMatchObject({ ok: false, status: 403 })
  })
  it('DM age fora da vez e sem ser dono', () => {
    const ctx = { ...base, ehDM: true, controla: false, ehVezDoCombatente: false }
    expect(validarUsoRecurso('canalizar_divindade', ctx)).toEqual({ ok: true })
  })
  it('DM também não gasta sem usos', () => {
    expect(validarUsoRecurso('canalizar_divindade', { ...base, ehDM: true, disponiveis: 0 }).ok).toBe(false)
  })
})

describe('desconto', () => {
  it('inspiração nunca fica negativa', () => {
    expect(descontarInspiracao(1)).toBe(0)
    expect(descontarInspiracao(0)).toBe(0)
  })
  it('usos nunca passam do total', () => {
    expect(descontarUsoRecurso(0, 2)).toBe(1)
    expect(descontarUsoRecurso(2, 2)).toBe(2)
  })
})

describe('evento', () => {
  it('descrição fixa e reconhecida só pelo texto exato', () => {
    const d = descricaoEventoRecurso('Aelar', 'canalizar_divindade')
    expect(d).toBe('Aelar usou Canalizar Divindade')
    expect(reconhecerEventoRecurso('Aelar', d)).toBe('canalizar_divindade')
    expect(reconhecerEventoRecurso('Aelar', 'Aelar usou Inspiração heroica')).toBe('inspiracao_heroica')
    expect(reconhecerEventoRecurso('Aelar', 'Aelar sofreu dano (PV 10 → 4)')).toBeNull()
    expect(reconhecerEventoRecurso('Aelar', null)).toBeNull()
  })
  it('reconhece ids de Canalizar Divindade', () => {
    expect(ehCanalizarDivindade('canalizar-divindade-clerigo')).toBe(true)
    expect(ehCanalizarDivindade('canalizar-divindade-paladino')).toBe(true)
    expect(ehCanalizarDivindade('furia')).toBe(false)
    expect(ehCanalizarDivindade(null)).toBe(false)
  })
  it('valida o tipo recebido', () => {
    expect(ehTipoRecursoTurno('canalizar_divindade')).toBe(true)
    expect(ehTipoRecursoTurno('furia')).toBe(false)
  })
})
