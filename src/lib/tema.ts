export type NomeTema = 'grimorio' | 'medieval'

const CHAVE_LOCAL = 'dd-tema'

export function getTemaAtual(): NomeTema {
  if (typeof window === 'undefined') return 'grimorio'
  return (localStorage.getItem(CHAVE_LOCAL) as NomeTema) ?? 'grimorio'
}

export function aplicarTema(nome: NomeTema) {
  const html = document.documentElement
  if (nome === 'medieval') {
    html.classList.add('tema-medieval')
  } else {
    html.classList.remove('tema-medieval')
  }
  localStorage.setItem(CHAVE_LOCAL, nome)
}
