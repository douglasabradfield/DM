'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useCampanha } from '@/store/campanha'
import { createClient } from '@/lib/supabase/client'
import { chamarApiFog, percentualRevelado, desenharMascaraFog } from '@/lib/fog-of-war'

export type ModoPincel = 'revelar' | 'ocultar' | null
export type TamanhoPincel = 'pequeno' | 'medio' | 'grande'

const RAIO_POR_TAMANHO: Record<TamanhoPincel, number> = { pequeno: 1, medio: 3, grande: 6 }
const DEBOUNCE_MS = 300

// Pintura da névoa de guerra: desenha a máscara num <canvas> sobreposto à
// imagem e acumula as células alteradas por um traço (mouse/dedo) num Set
// local, aplicando na tela na hora (otimista) e só falando com a API 300ms
// depois da última célula pintada — ver seção 3 do plano da Fase 7.
export function useFogPincel({ imagemId, ehDM }: { imagemId: string; ehDM: boolean }) {
  const fog = useCampanha(s => s.fogPorImagem[imagemId])
  const definirFogImagem = useCampanha(s => s.definirFogImagem)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const revealedRef = useRef<Set<number>>(new Set(fog?.reveladas ?? []))
  const pendentesRevelarRef = useRef<Set<number>>(new Set())
  const pendentesOcultarRef = useRef<Set<number>>(new Set())
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bloqueia a reconciliação com o store no meio de um traço — senão um
  // evento Realtime chegando durante o arrasto "puxaria o tapete" da
  // pintura em andamento.
  const pintandoRef = useRef(false)

  const [modoPincel, setModoPincel] = useState<ModoPincel>(null)
  const [tamanhoPincel, setTamanhoPincel] = useState<TamanhoPincel>('medio')
  const [verComoJogador, setVerComoJogador] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const desenhar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !fog || !fog.ativo) return
    const wrapper = canvas.parentElement
    if (!wrapper) return

    // O wrapper (pai do canvas) é dimensionado em px NATURAIS da imagem (ver
    // VisualizadorFullscreen) — offsetWidth/Height é a resolução nativa do
    // mapa. Passa esse tamanho de exibição para o rasterizador único
    // (desenharMascaraFog), que CAPA o backing store: sem esse teto, um mapa
    // grande estoura o limite de canvas do Safari/iOS e a máscara some
    // inteira (o jogador via o mapa completo em tela cheia). O canvas
    // continua com CSS w-full/h-full do wrapper e o blur esconde a diferença
    // de resolução.
    const largura = wrapper.offsetWidth
    const altura = wrapper.offsetHeight
    if (largura === 0 || altura === 0) return

    desenharMascaraFog(
      canvas, largura, altura,
      { colunas: fog.colunas, linhas: fog.linhas, reveladas: revealedRef.current },
      { ehDM, modoPreviewJogador: verComoJogador },
    )
  }, [fog, ehDM, verComoJogador])

  // Reconcilia o Set local com o store (carga inicial, mudança feita em
  // outra aba/DM via Realtime, ou resultado de ativar/desativar/tudo).
  useEffect(() => {
    if (pintandoRef.current) return
    revealedRef.current = new Set(fog?.reveladas ?? [])
    desenhar()
  }, [fog, desenhar])

  // Redesenha em resize/orientação — o tamanho base do canvas (offsetWidth/
  // Height) só muda em relayout, nunca no transform de zoom/pan (que é
  // compartilhado com a imagem via o wrapper comum).
  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = canvas?.parentElement
    if (!wrapper || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(() => desenhar())
    obs.observe(wrapper)
    return () => obs.disconnect()
  }, [desenhar])

  const recarregarDoServidor = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('mapa_fog').select('*').eq('imagem_id', imagemId).maybeSingle()
    if (data) {
      definirFogImagem(imagemId, {
        ativo: data.ativo, colunas: data.colunas, linhas: data.linhas,
        reveladas: new Set(data.reveladas ?? []),
      })
    }
  }, [imagemId, definirFogImagem])

  const enviarPendentes = useCallback(async () => {
    const revelar = [...pendentesRevelarRef.current]
    const ocultar = [...pendentesOcultarRef.current]
    pendentesRevelarRef.current = new Set()
    pendentesOcultarRef.current = new Set()
    if (revelar.length === 0 && ocultar.length === 0) return

    setSalvando(true)
    try {
      let ultima = fog
      if (revelar.length > 0) ultima = await chamarApiFog({ acao: 'revelar', imagemId, celulas: revelar })
      if (ocultar.length > 0) ultima = await chamarApiFog({ acao: 'ocultar', imagemId, celulas: ocultar })
      if (ultima) definirFogImagem(imagemId, ultima)
    } catch (err) {
      console.error('Erro ao salvar fog of war:', err)
      toast.error('Erro ao salvar a névoa — recarregando o estado salvo')
      await recarregarDoServidor()
    } finally {
      setSalvando(false)
    }
  }, [imagemId, fog, definirFogImagem, recarregarDoServidor])

  const agendarEnvio = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => { void enviarPendentes() }, DEBOUNCE_MS)
  }, [enviarPendentes])

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const pintarEm = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas || !fog?.ativo || !modoPincel) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const relX = (clientX - rect.left) / rect.width
    const relY = (clientY - rect.top) / rect.height
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return

    const cx = Math.min(fog.colunas - 1, Math.max(0, Math.floor(relX * fog.colunas)))
    const cy = Math.min(fog.linhas - 1, Math.max(0, Math.floor(relY * fog.linhas)))
    const raio = RAIO_POR_TAMANHO[tamanhoPincel]

    let mudou = false
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (dx * dx + dy * dy > raio * raio) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || x >= fog.colunas || y < 0 || y >= fog.linhas) continue
        const indice = y * fog.colunas + x
        if (modoPincel === 'revelar') {
          if (!revealedRef.current.has(indice)) { revealedRef.current.add(indice); mudou = true }
          pendentesRevelarRef.current.add(indice)
          pendentesOcultarRef.current.delete(indice)
        } else {
          if (revealedRef.current.has(indice)) { revealedRef.current.delete(indice); mudou = true }
          pendentesOcultarRef.current.add(indice)
          pendentesRevelarRef.current.delete(indice)
        }
      }
    }
    if (mudou) desenhar()
    agendarEnvio()
  }, [fog?.ativo, fog?.colunas, fog?.linhas, modoPincel, tamanhoPincel, desenhar, agendarEnvio])

  return {
    fog,
    fogAtivo: !!fog?.ativo,
    percentual: percentualRevelado(fog),
    canvasRef,
    modoPincel,
    setModoPincel,
    tamanhoPincel,
    setTamanhoPincel,
    verComoJogador,
    setVerComoJogador,
    salvando,
    pintarEm,
    // Redesenho manual — o visualizador chama quando descobre as dimensões
    // naturais da imagem (o <canvas> monta antes disso e os efeitos internos
    // não observam esse estado externo).
    redesenhar: desenhar,
    iniciarTraco: () => { pintandoRef.current = true },
    finalizarTraco: () => { pintandoRef.current = false },
  }
}
