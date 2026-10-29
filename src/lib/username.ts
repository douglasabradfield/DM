export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

/** Normaliza o que a pessoa digita: minúsculas, sem espaços, só [a-z0-9_]. */
export function normalizarUsername(valor: string): string {
  return valor.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX)
}

/** Retorna a mensagem de erro, ou null se o username é válido. */
export function validarUsername(valor: string): string | null {
  if (valor.length < USERNAME_MIN) return `O nome de usuário deve ter pelo menos ${USERNAME_MIN} caracteres`
  if (valor.length > USERNAME_MAX) return `O nome de usuário deve ter no máximo ${USERNAME_MAX} caracteres`
  if (!/^[a-z0-9_]+$/.test(valor)) return 'Use apenas letras minúsculas, números e _ (sem espaços)'
  return null
}

export const MSG_USERNAME_EM_USO = 'Este nome de usuário já existe. Escolha outro.'
export const AVISO_TROCA_USERNAME = 'Quem for adicionar você a uma campanha precisará usar o novo nome.'

/** Violação da unique index em profiles.username (Postgres 23505). */
export function erroUsernameEmUso(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return e?.code === '23505' || /profiles_username/.test(e?.message ?? '')
}
