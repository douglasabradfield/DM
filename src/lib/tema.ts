export type NomeTema = 'grimorio' | 'medieval' | 'dragao' | 'elfico'

const CHAVE_LOCAL = 'dd-tema'

export const TEMAS: { id: NomeTema; label: string; icone: string }[] = [
  { id: 'grimorio', label: 'Grimório',         icone: '🌙' },
  { id: 'medieval', label: 'Pergaminho',       icone: '📜' },
  { id: 'dragao',   label: 'Sangue de Dragão', icone: '🔥' },
  { id: 'elfico',   label: 'Névoa Élfica',     icone: '🌿' },
]

// Cor de fundo (--dd-black) de cada tema — usada na status bar do PWA
// (meta theme-color). Mantida em sincronia manualmente com globals.css.
export const CORES_TEMA: Record<NomeTema, string> = {
  grimorio: '#0a0810',
  medieval: '#f5edd8',
  dragao:   '#0e0808',
  elfico:   '#f0f4f8',
}

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

  // Sincroniza a status bar do PWA (meta theme-color) com o tema —
  // sem isso, a barra fica escura mesmo em temas claros como
  // "medieval" e "élfico".
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', CORES_TEMA[nome])
}
