import { describe, expect, it } from 'vitest'
import { erroUsernameEmUso, normalizarUsername, validarUsername } from './username'

describe('normalizarUsername', () => {
  it('converte para minúsculas e remove espaços e caracteres inválidos', () => {
    expect(normalizarUsername('Mestre Das-Dungeons!')).toBe('mestredasdungeons')
    expect(normalizarUsername('Seu_Usuário1')).toBe('seu_usurio1')
  })
  it('limita a 30 caracteres', () => {
    expect(normalizarUsername('a'.repeat(40))).toHaveLength(30)
  })
})

describe('validarUsername', () => {
  it('aceita nomes válidos', () => {
    expect(validarUsername('abc')).toBeNull()
    expect(validarUsername('mestre_01')).toBeNull()
    expect(validarUsername('a'.repeat(30))).toBeNull()
  })
  it('rejeita curto demais e longo demais', () => {
    expect(validarUsername('ab')).toMatch(/pelo menos 3/)
    expect(validarUsername('')).toMatch(/pelo menos 3/)
    expect(validarUsername('a'.repeat(31))).toMatch(/no máximo 30/)
  })
  it('rejeita maiúsculas, espaços e símbolos', () => {
    expect(validarUsername('Mestre')).not.toBeNull()
    expect(validarUsername('meu nome')).not.toBeNull()
    expect(validarUsername('nome-x')).not.toBeNull()
    expect(validarUsername('açaí')).not.toBeNull()
  })
})

describe('erroUsernameEmUso', () => {
  it('reconhece violação de unicidade', () => {
    expect(erroUsernameEmUso({ code: '23505' })).toBe(true)
    expect(erroUsernameEmUso({ message: 'duplicate key value violates unique constraint "profiles_username_key"' })).toBe(true)
  })
  it('ignora outros erros', () => {
    expect(erroUsernameEmUso({ code: '42501' })).toBe(false)
    expect(erroUsernameEmUso(null)).toBe(false)
  })
})
