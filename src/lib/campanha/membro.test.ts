import { describe, expect, it } from 'vitest'
import { decidirAdicaoMembro, type LinhaMembro } from './membro'

const linha = (o: Partial<LinhaMembro>): LinhaMembro => ({
  id: 'l1', user_id: null, email: null, status: 'ativo', ...o,
})

describe('decidirAdicaoMembro', () => {
  it('insere quando não há linha', () => {
    expect(decidirAdicaoMembro([], 'u1', 'a@b.com')).toEqual({ acao: 'inserir' })
  })

  it('ignora linhas de outros usuários e e-mails', () => {
    const outras = [linha({ id: 'x', user_id: 'u2', email: 'c@d.com' })]
    expect(decidirAdicaoMembro(outras, 'u1', 'a@b.com')).toEqual({ acao: 'inserir' })
  })

  it('reativa linha removida encontrada pelo e-mail (user_id nulo)', () => {
    const l = linha({ id: 'rem', email: 'A@B.com', status: 'removido' })
    expect(decidirAdicaoMembro([l], 'u1', 'a@b.com')).toEqual({ acao: 'reativar', id: 'rem' })
  })

  it('reativa linha removida encontrada pelo user_id', () => {
    const l = linha({ id: 'rem', user_id: 'u1', email: 'outro@x.com', status: 'removido' })
    expect(decidirAdicaoMembro([l], 'u1', 'a@b.com')).toEqual({ acao: 'reativar', id: 'rem' })
  })

  it('reativa convite pendente', () => {
    const l = linha({ id: 'cv', email: 'a@b.com', status: 'convidado' })
    expect(decidirAdicaoMembro([l], 'u1', 'a@b.com')).toEqual({ acao: 'reativar', id: 'cv' })
  })

  it('reconhece membro já ativo', () => {
    const l = linha({ id: 'at', user_id: 'u1', status: 'ativo' })
    expect(decidirAdicaoMembro([l], 'u1', 'a@b.com')).toEqual({ acao: 'ja_ativo', id: 'at' })
  })

  it('prefere a linha do user_id quando e-mail e user_id apontam para linhas diferentes', () => {
    const porEmail = linha({ id: 'em', email: 'a@b.com', status: 'removido' })
    const porUser = linha({ id: 'us', user_id: 'u1', email: 'velho@x.com', status: 'removido' })
    expect(decidirAdicaoMembro([porEmail, porUser], 'u1', 'a@b.com')).toEqual({ acao: 'reativar', id: 'us' })
  })
})
