import { describe, it, expect } from 'vitest'
import { ehDmDaCampanha } from './permissao-campanha'

describe('ehDmDaCampanha', () => {
  it('é DM quando o usuário é o dm_id da campanha', () => {
    expect(ehDmDaCampanha({ dm_id: 'u1' }, 'u1')).toBe(true)
  })
  it('outro usuário (mesmo admin) não é DM', () => {
    expect(ehDmDaCampanha({ dm_id: 'u1' }, 'admin')).toBe(false)
  })
  it('sem campanha, sem usuário ou sem dm_id não é DM', () => {
    expect(ehDmDaCampanha(null, 'u1')).toBe(false)
    expect(ehDmDaCampanha({ dm_id: 'u1' }, null)).toBe(false)
    expect(ehDmDaCampanha({ dm_id: null }, null)).toBe(false)
    expect(ehDmDaCampanha({}, undefined)).toBe(false)
  })
})
