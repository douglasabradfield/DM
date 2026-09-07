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

// Único ponto de decisão da opacidade da célula oculta — NUNCA reimplementar
// essa conta em outro lugar. Depende só do papel real de quem está olhando
// (ehDM), não do estado de preview local do hook: um jogador de verdade
// nunca tem como alternar "ver como jogador" (a toolbar que faz isso só
// existe para o DM), então se a opacidade dependesse apenas do preview, todo
// jogador cairia no valor "leve" pensado pro DM enxergar por baixo — foi
// exatamente esse o bug reportado (jogador via o mapa através da névoa).
// Jogador (ou DM em preview) precisa de alfa OPACO: nada do mapa pode ser
// inferido por trás da névoa.
export function opacidadeOculta(ehDM: boolean, modoPreviewJogador: boolean): number {
  return ehDM && !modoPreviewJogador ? 0.45 : 1.0
}

// Teto de resolução do backing store do canvas da máscara. A névoa é sempre
// exibida borrada (filter: blur), então não precisa da resolução total do
// mapa. SEM esse teto, um mapa grande (ex.: 3000x4000 = 12 Mpx, ou maior)
// estoura o limite de área de canvas do Safari/iOS (~16,7 Mpx / 4096 px por
// lado) e o canvas INTEIRO passa a renderizar transparente — a máscara some
// e o jogador vê o mapa completo. Foi exatamente essa a causa do bug "a
// névoa some ao abrir em tela cheia" que voltou: dependia da resolução do
// arquivo do mapa, então só acontecia em alguns mapas / alguns aparelhos
// (jogador no celular), nunca no desktop do DM. A miniatura nunca sofreu
// disso porque o canvas dela é pequeno.
const MAX_CANVAS_LADO = 1600

export function dimensoesCanvasFog(larguraExib: number, alturaExib: number) {
  const maior = Math.max(larguraExib, alturaExib)
  const fator = maior > MAX_CANVAS_LADO ? MAX_CANVAS_LADO / maior : 1
  return {
    width: Math.max(1, Math.round(larguraExib * fator)),
    height: Math.max(1, Math.round(alturaExib * fator)),
  }
}

interface FogMascara {
  colunas: number
  linhas: number
  reveladas: Set<number>
}

// ÚNICO lugar do app que sabe rasterizar a máscara de névoa — miniatura,
// pré-visualização, tela cheia (jogador) e tela cheia (DM, via useFogPincel)
// todos passam por aqui. Recebe o canvas e o tamanho de EXIBIÇÃO em CSS px
// do elemento renderizado (a caixa real da <img>, não de um wrapper que
// possa ter proporção diferente). Ajusta o backing store respeitando o teto
// de resolução e desenha as células reveladas recortando o preto.
export function desenharMascaraFog(
  canvas: HTMLCanvasElement,
  larguraExib: number,
  alturaExib: number,
  fog: FogMascara | undefined,
  opcoes: { ehDM: boolean; modoPreviewJogador?: boolean },
) {
  if (!fog || larguraExib <= 0 || alturaExib <= 0) return
  const { width, height } = dimensoesCanvasFog(larguraExib, alturaExib)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const opacidade = opacidadeOculta(opcoes.ehDM, opcoes.modoPreviewJogador ?? false)
  ctx.fillStyle = `rgba(0, 0, 0, ${opacidade})`
  ctx.fillRect(0, 0, width, height)

  if (fog.colunas > 0 && fog.linhas > 0) {
    const largCel = width / fog.colunas
    const altCel = height / fog.linhas
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000'
    for (const indice of fog.reveladas) {
      const col = indice % fog.colunas
      const lin = Math.floor(indice / fog.colunas)
      ctx.fillRect(col * largCel, lin * altCel, largCel + 1, altCel + 1)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
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
