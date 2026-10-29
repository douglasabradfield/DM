// Decide como adicionar um usuário a uma campanha respeitando os UNIQUE
// (campanha_id, email) e (campanha_id, user_id) de campanha_membros.

export interface LinhaMembro {
  id: string
  user_id: string | null
  email: string | null
  status: string
}

export type DecisaoMembro =
  | { acao: 'inserir' }
  | { acao: 'reativar'; id: string }
  | { acao: 'ja_ativo'; id: string }

const normalizar = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()

export function decidirAdicaoMembro(
  linhas: LinhaMembro[],
  userId: string,
  email: string | null | undefined,
): DecisaoMembro {
  const emailNorm = normalizar(email)
  // a linha por user_id tem precedência: é a que o UNIQUE (campanha_id, user_id) protege
  const linha =
    linhas.find(l => l.user_id === userId) ??
    (emailNorm ? linhas.find(l => normalizar(l.email) === emailNorm) : undefined)

  if (!linha) return { acao: 'inserir' }
  if (linha.status === 'ativo') return { acao: 'ja_ativo', id: linha.id }
  return { acao: 'reativar', id: linha.id }
}
