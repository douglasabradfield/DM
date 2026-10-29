'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { ehDmDaCampanha } from '@/lib/permissao-campanha'
import type { ImagemGaleria } from '@/components/galeria/GaleriaImagens'
import {
  aplicarEventoImagem, chaveVistas, contarNovas, escolherMapa, gravarVistas, lerVistas,
  ordenarImagens, separarMapasEFotos,
} from '@/lib/mesa/imagens-mesa'

const COLUNAS = 'id, campanha_id, nome, url, storage_path, tipo, visivel_jogadores, compartilhado, criado_em, liberado_em'

export interface ImagensMesa {
  carregando: boolean
  erro: boolean
  // Só o DM da campanha ativa; admin/plano não conta (ver permissao-campanha).
  ehDM: boolean
  mapas: ImagemGaleria[]
  fotos: ImagemGaleria[]
  novas: number
  vistas: Set<string>
  mapaAtual: ImagemGaleria | null
  selecionarMapa: (id: string) => void
  marcarVista: (id: string) => void
  recarregar: () => void
  // Imagem ainda existe (e continua visível para este usuário) na lista atual.
  existe: (id: string) => boolean
}

// Dados do painel Mapa e imagens da /mesa: consulta a `imagens`, UM canal
// Realtime por campanha, imagens já vistas (localStorage) e mapa selecionado.
// Chamado uma vez em MesaCliente — o painel só renderiza. A névoa vem do
// store da campanha (fogPorImagem), lida por ImagemComFog.
export function useImagensMesa(userId: string | null): ImagensMesa {
  const campanhaAtiva = useCampanha(s => s.campanhaAtiva)
  const campanhaId = campanhaAtiva?.id

  const [imagens, setImagens] = useState<ImagemGaleria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [mapaId, setMapaId] = useState<string | null>(null)
  const [vistas, setVistas] = useState<Set<string>>(new Set())

  const ehDM = ehDmDaCampanha(campanhaAtiva, userId)
  const chave = userId && campanhaId ? chaveVistas(userId, campanhaId) : null

  useEffect(() => { setVistas(lerVistas(chave)) }, [chave])

  // Trocou de campanha: não mostra as imagens da anterior enquanto carrega.
  useEffect(() => {
    setImagens([])
    setCarregando(true)
    setMapaId(null)
  }, [campanhaId])

  const carregar = useCallback(async () => {
    if (!campanhaId) { setCarregando(false); return }
    try {
      let query = createClient()
        .from('imagens')
        .select(COLUNAS)
        .eq('campanha_id', campanhaId)
        .order('liberado_em', { ascending: false, nullsFirst: false })
        .order('criado_em', { ascending: false })
      if (!ehDM) query = query.eq('visivel_jogadores', true)
      const { data, error } = await query
      if (error) { console.error('Erro ao buscar imagens:', error); setErro(true); return }
      setErro(false)
      setImagens(ordenarImagens((data ?? []) as ImagemGaleria[]))
    } finally {
      setCarregando(false)
    }
  }, [campanhaId, ehDM])

  // Carrega ao montar e quando a janela volta ao foco.
  useEffect(() => {
    carregar()
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [carregar])

  // Realtime no mesmo padrão da Galeria, em canal próprio (a Galeria não está
  // montada na /mesa; o nome distinto evita colisão se estiver).
  useEffect(() => {
    if (!campanhaId) return
    const supabase = createClient()
    const canal = supabase
      .channel(`mesa-imagens:${campanhaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'imagens', filter: `campanha_id=eq.${campanhaId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const antiga = payload.old as { id?: string }
            setImagens(prev => aplicarEventoImagem(prev, { tipo: 'DELETE', id: antiga.id }, ehDM))
            return
          }
          const linha = payload.new as ImagemGaleria
          setImagens(prev => aplicarEventoImagem(prev, { tipo: 'UPSERT', linha }, ehDM))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [campanhaId, ehDM])

  const { mapas, fotos } = useMemo(() => separarMapasEFotos(imagens), [imagens])
  const novas = contarNovas(fotos, vistas)
  const mapaAtual = escolherMapa(mapas, mapaId)

  const marcarVista = useCallback((id: string) => {
    if (vistas.has(id)) return
    const proximas = new Set(vistas).add(id)
    setVistas(proximas)
    gravarVistas(chave, proximas)
  }, [vistas, chave])

  const existe = useCallback((id: string) => imagens.some(i => i.id === id), [imagens])

  return {
    carregando, erro, ehDM, mapas, fotos, novas, vistas, mapaAtual,
    selecionarMapa: setMapaId, marcarVista, recarregar: carregar, existe,
  }
}
