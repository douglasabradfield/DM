export type NomeTema = 'grimorio' | 'medieval' | 'dragao' | 'elfico'

const CHAVE_LOCAL = 'dd-tema'

export const TEMAS: { id: NomeTema; label: string; icone: string }[] = [
  { id: 'grimorio', label: 'Grimório',         icone: '🌙' },
  { id: 'medieval', label: 'Pergaminho',       icone: '📜' },
  { id: 'dragao',   label: 'Sangue de Dragão', icone: '🔥' },
  { id: 'elfico',   label: 'Névoa Élfica',     icone: '🌿' },
]

export function getTemaAtual(): NomeTema {
  if (typeof window === 'undefined') return 'grimorio'
  return (localStorage.getItem(CHAVE_LOCAL) as NomeTema) ?? 'grimorio'
}

export function aplicarTema(nome: NomeTema) {
  const html = document.documentElement
  html.classList.remove('tema-medieval', 'tema-dragao', 'tema-elfico')
  if (nome !== 'grimorio') {
    html.classList.add(`tema-${nome}`)
  }
  localStorage.setItem(CHAVE_LOCAL, nome)
}
