'use client'

import { useEffect, useRef } from 'react'
import { useCampanha } from '@/store/campanha'
import { opacidadeOculta } from '@/lib/fog-of-war'

// Versão somente-leitura da máscara de névoa — reaproveita a mesma conta de
// opacidade/grid do useFogPincel, sem pintura/zoom/pan, pra cobrir
// miniatura (grid mobile, linha da lista desktop) e pré-visualização
// (painel desktop). Sem isso, jogador via o mapa inteiro sem abrir o
// visualizador — a névoa não tinha efeito nenhum até o clique.
export function FogThumbOverlay({ imagemId, ehDM }: { imagemId: string; ehDM: boolean }) {
  const fog = useCampanha(s => s.fogPorImagem[imagemId])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fog?.ativo) return
    const wrapper = canvas.parentElement
    if (!wrapper) return

    function desenhar() {
      const largura = wrapper!.offsetWidth
      const altura = wrapper!.offsetHeight
      if (!largura || !altura) return
      if (canvas!.width !== largura) canvas!.width = largura
      if (canvas!.height !== altura) canvas!.height = altura
      const ctx = canvas!.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, largura, altura)

      const opacidade = opacidadeOculta(ehDM, false)
      ctx.fillStyle = `rgba(0, 0, 0, ${opacidade})`
      ctx.fillRect(0, 0, largura, altura)

      const largCel = largura / fog!.colunas
      const altCel = altura / fog!.linhas
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = '#000'
      for (const indice of fog!.reveladas) {
        const col = indice % fog!.colunas
        const lin = Math.floor(indice / fog!.colunas)
        ctx.fillRect(col * largCel, lin * altCel, largCel + 1, altCel + 1)
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    desenhar()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(desenhar)
    obs.observe(wrapper)
    return () => obs.disconnect()
  }, [fog, ehDM])

  if (!fog?.ativo) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ filter: 'blur(3px)' }}
    />
  )
}
