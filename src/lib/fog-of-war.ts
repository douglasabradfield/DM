import type { FogImagem } from '@/store/campanha'

const TETO_GRID = 100

// Mesma fórmula usada pelo servidor (que só valida os tetos) — ver
// src/app/api/mapa/fog/route.ts. ~50 células no lado menor da imagem.
export function calcularGridFog(largura: number, altura: number) {
  const menorDimensao = Math.min(largura, altura)
  const celula = Math.max(menorDimensao / 50, 20)
  const colunas = Math.min(TETO_GRID, Math.ceil(largura / celula))
  const linhas = Math.min(TETO_GRID, Math.ceil(altura / celula))
  return { colunas, linhas }
}

// Dimensões naturais da imagem, mesmo quando ela só existe como miniatura
// pequena na listagem — o navegador já baixou o recurso original, então
// naturalWidth/naturalHeight refletem o tamanho real independente do
// tamanho de exibição.
export function carregarDimensoesImagem(url: string): Promise<{ largura: number; altura: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ largura: img.naturalWidth, altura: img.naturalHeight })
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
    img.src = url
  })
}

export function percentualRevelado(fog: { colunas: number; linhas: number; reveladas: Set<number> } | undefined) {
  if (!fog) return 0
  const total = fog.colunas * fog.linhas
  if (total <= 0) return 0
  return Math.round((fog.reveladas.size / total) * 100)
}

interface FogRow {
  ativo: boolean
  colunas: number
  linhas: number
  reveladas: number[]
}

function paraFogImagem(row: FogRow): FogImagem {
  return { ativo: row.ativo, colunas: row.colunas, linhas: row.linhas, reveladas: new Set(row.reveladas ?? []) }
}

export async function chamarApiFog(body: Record<string, unknown>): Promise<FogImagem> {
  const resp = await fetch('/api/mapa/fog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.erro ?? 'Erro ao atualizar a névoa de guerra')
  return paraFogImagem(json.fog as FogRow)
}

type DefinirFogImagem = (imagemId: string, fog: FogImagem) => void

// Ativar sempre recalcula o grid a partir das dimensões atuais e reseta a
// máscara (tudo oculto) — mesmo em uma imagem que já teve fog antes.
export async function ativarFogImagem(imagemId: string, url: string, definirFogImagem: DefinirFogImagem) {
  const { largura, altura } = await carregarDimensoesImagem(url)
  const { colunas, linhas } = calcularGridFog(largura, altura)
  const fog = await chamarApiFog({ acao: 'ativar', imagemId, colunas, linhas })
  definirFogImagem(imagemId, fog)
  return fog
}

export async function desativarFogImagem(imagemId: string, definirFogImagem: DefinirFogImagem) {
  const fog = await chamarApiFog({ acao: 'desativar', imagemId })
  definirFogImagem(imagemId, fog)
  return fog
}

export async function revelarTudoImagem(imagemId: string, definirFogImagem: DefinirFogImagem) {
  const fog = await chamarApiFog({ acao: 'revelar_tudo', imagemId })
  definirFogImagem(imagemId, fog)
  return fog
}

export async function ocultarTudoImagem(imagemId: string, definirFogImagem: DefinirFogImagem) {
  const fog = await chamarApiFog({ acao: 'ocultar_tudo', imagemId })
  definirFogImagem(imagemId, fog)
  return fog
}
