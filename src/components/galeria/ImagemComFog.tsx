'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useCampanha } from '@/store/campanha'
import { desenharMascaraFog } from '@/lib/fog-of-war'
import { cn } from '@/lib/utils'

// Fonte ÚNICA de verdade para exibir um mapa que PODE ter névoa de guerra.
// Usado em TODOS os pontos que mostram a imagem de um mapa: miniatura (grid
// mobile e linha da lista desktop), pré-visualização (painel desktop) e o
// visualizador em tela cheia do jogador. Sem registro de fog ativo => a
// imagem normal. Com fog ativo => a <img> NUNCA aparece sem o canvas da
// máscara por cima, em nenhum estado, nenhuma rota.
//
// O canvas é medido e posicionado a partir do retângulo REAL ocupado pela
// <img> renderizada — não de um wrapper que possa ter proporção diferente
// (foi um wrapper `w-fit` mais largo que a imagem limitada por `max-h` que
// descolava a máscara da imagem: o desalinhamento que "voltou"). E o backing
// store do canvas é capado em desenharMascaraFog, senão mapas grandes
// estouram o limite de canvas do Safari/iOS e a máscara some inteira.

// Retângulo que a imagem realmente ocupa dentro da caixa do elemento. Com
// object-fit: contain (miniatura) é a área útil dentro do letterbox; quando
// a caixa já hugueia a imagem (preview/tela cheia) é a própria caixa.
function retanguloImagem(img: HTMLImageElement) {
  const cw = img.clientWidth
  const ch = img.clientHeight
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!cw || !ch || !nw || !nh) return null
  const escala = Math.min(cw / nw, ch / nh)
  const w = nw * escala
  const h = nh * escala
  return {
    left: img.offsetLeft + (cw - w) / 2,
    top: img.offsetTop + (ch - h) / 2,
    width: w,
    height: h,
  }
}

interface ImagemComFogProps {
  imagemId: string
  url: string
  alt: string
  ehDM: boolean
  imgClassName?: string
  wrapperClassName?: string
  blurPx?: number
}

export function ImagemComFog({
  imagemId, url, alt, ehDM, imgClassName, wrapperClassName, blurPx = 3,
}: ImagemComFogProps) {
  const fog = useCampanha(s => s.fogPorImagem[imagemId])
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fogAtivo = !!fog?.ativo

  const redesenhar = useCallback(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas || !fog?.ativo) return
    const rect = retanguloImagem(img)
    if (!rect) return
    canvas.style.left = `${rect.left}px`
    canvas.style.top = `${rect.top}px`
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    desenharMascaraFog(
      canvas, rect.width, rect.height,
      { colunas: fog.colunas, linhas: fog.linhas, reveladas: fog.reveladas },
      { ehDM },
    )
  }, [fog, ehDM])

  useEffect(() => {
    if (!fogAtivo) return
    redesenhar()
    const img = imgRef.current
    const obs = img && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redesenhar) : null
    if (img) obs?.observe(img)
    window.addEventListener('resize', redesenhar)
    window.addEventListener('orientationchange', redesenhar)
    return () => {
      obs?.disconnect()
      window.removeEventListener('resize', redesenhar)
      window.removeEventListener('orientationchange', redesenhar)
    }
  }, [fogAtivo, redesenhar])

  // wrapperClassName precisa estabelecer o contexto de posicionamento
  // (relative/absolute) — o canvas é posicionado em px absolutos relativos a
  // este span, que é o offsetParent da <img>.
  return (
    <span className={cn('leading-[0]', wrapperClassName)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        className={imgClassName}
        draggable={false}
        onLoad={redesenhar}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
      {fogAtivo && (
        <canvas
          ref={canvasRef}
          className="absolute pointer-events-none"
          style={{ filter: `blur(${blurPx}px)`, left: 0, top: 0 }}
        />
      )}
    </span>
  )
}
