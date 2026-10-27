'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { usePermissao } from '@/hooks/usePermissao'
import { percentualRevelado } from '@/lib/fog-of-war'
import { cn } from '@/lib/utils'
import { ImagemComFog } from '@/components/galeria/ImagemComFog'
import { VisualizadorFullscreen, type ImagemGaleria } from '@/components/galeria/GaleriaImagens'

// Acima da barra de abas (z-50) e abaixo dos popovers/modais críticos da
// mesa (9995 a 9999). Não altera o z-index de nenhum componente existente.
const Z_VISUALIZADOR = 9990

const COLUNAS = 'id, campanha_id, nome, url, storage_path, tipo, visivel_jogadores, compartilhado, criado_em'

function chaveVistas(userId: string, campanhaId: string) {
  return `dd-imagens-vistas:${userId}:${campanhaId}`
}

function lerVistas(chave: string | null): Set<string> {
  if (!chave) return new Set()
  try {
    const bruto = localStorage.getItem(chave)
    const lista = bruto ? JSON.parse(bruto) : []
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function gravarVistas(chave: string | null, vistas: Set<string>) {
  if (!chave) return
  try {
    localStorage.setItem(chave, JSON.stringify([...vistas]))
  } catch { /* sem localStorage: a tela segue funcionando */ }
}

// Aba Mapa do celular (abaixo de md). Somente leitura: sem edição de névoa,
// upload ou liberação — isso continua em /mapas.
export function AbaMapa() {
  const campanhaId = useCampanha(s => s.campanhaAtiva?.id)
  const fogPorImagem = useCampanha(s => s.fogPorImagem)
  const { ehDM } = usePermissao()

  const [imagens, setImagens] = useState<ImagemGaleria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [secao, setSecao] = useState<'mapa' | 'imagens'>('mapa')
  const [mapaId, setMapaId] = useState<string | null>(null)
  const [aberta, setAberta] = useState<ImagemGaleria | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [vistas, setVistas] = useState<Set<string>>(new Set())

  const chave = userId && campanhaId ? chaveVistas(userId, campanhaId) : null

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => { setVistas(lerVistas(chave)) }, [chave])

  const carregar = useCallback(async () => {
    if (!campanhaId) { setCarregando(false); return }
    try {
      let query = createClient()
        .from('imagens')
        .select(COLUNAS)
        .eq('campanha_id', campanhaId)
        .order('criado_em', { ascending: false })
      if (!ehDM) query = query.eq('visivel_jogadores', true)
      const { data, error } = await query
      if (error) { console.error('Erro ao buscar imagens:', error); setErro(true); return }
      setErro(false)
      setImagens((data ?? []) as ImagemGaleria[])
    } finally {
      setCarregando(false)
    }
  }, [campanhaId, ehDM])

  // Carrega ao abrir a aba e quando a janela volta ao foco.
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
            if (antiga.id) setImagens(prev => prev.filter(i => i.id !== antiga.id))
            return
          }
          const linha = payload.new as ImagemGaleria
          if (!linha?.id) return
          if (!ehDM && !linha.visivel_jogadores) {
            setImagens(prev => prev.filter(i => i.id !== linha.id))
            return
          }
          setImagens(prev => {
            const existe = prev.some(i => i.id === linha.id)
            const proxima = existe ? prev.map(i => i.id === linha.id ? linha : i) : [linha, ...prev]
            return proxima.slice().sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [campanhaId, ehDM])

  const mapas = useMemo(() => imagens.filter(i => i.tipo === 'mapa'), [imagens])
  const fotos = useMemo(() => imagens.filter(i => i.tipo === 'imagem'), [imagens])
  const novas = fotos.filter(i => !vistas.has(i.id)).length
  const mapaAtual = mapas.find(m => m.id === mapaId) ?? mapas[0] ?? null
  const fogMapa = mapaAtual ? fogPorImagem[mapaAtual.id] : undefined

  function abrir(imagem: ImagemGaleria) {
    setAberta(imagem)
    if (vistas.has(imagem.id)) return
    const proximas = new Set(vistas).add(imagem.id)
    setVistas(proximas)
    gravarVistas(chave, proximas)
  }

  // Se a imagem aberta for removida/ocultada, o visualizador fecha.
  const abertaViva = aberta && imagens.some(i => i.id === aberta.id) ? aberta : null

  return (
    <div className="flex flex-col gap-3 pb-24 safe-area-pb">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-cinzel text-[var(--gold)] text-base font-bold">Mapa e imagens</h2>
        <span className="text-[10px] font-cinzel px-2 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text3)]">
          Liberado pelo mestre
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {([['mapa', 'Mapa'], ['imagens', 'Imagens']] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSecao(id)}
            aria-pressed={secao === id}
            className={cn(
              'min-h-[44px] rounded-lg font-cinzel text-sm transition-colors flex items-center justify-center gap-1.5',
              secao === id ? 'bg-[var(--bg2)] text-[var(--gold)]' : 'text-[var(--text3)]'
            )}
          >
            {rotulo}
            {id === 'imagens' && novas > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--gold)] text-[var(--bg)] text-[10px] leading-[18px] font-bold">
                {novas}
              </span>
            )}
          </button>
        ))}
      </div>

      {carregando && <p className="text-center text-[var(--text3)] text-sm font-crimson py-6">Carregando…</p>}
      {!carregando && erro && (
        <p className="text-center text-[var(--text3)] text-sm font-crimson py-6">Não foi possível carregar. Tente novamente.</p>
      )}

      {!carregando && !erro && secao === 'mapa' && (
        mapaAtual ? (
          <div className="flex flex-col gap-2">
            {mapas.length > 1 && (
              <select
                value={mapaAtual.id}
                onChange={e => setMapaId(e.target.value)}
                aria-label="Escolher mapa"
                className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] font-crimson px-3"
              >
                {mapas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            )}
            <div className="relative flex items-center justify-center h-[300px] rounded-xl border border-[var(--border)] bg-black/40 overflow-hidden">
              <ImagemComFog
                key={mapaAtual.id}
                imagemId={mapaAtual.id}
                url={mapaAtual.url}
                alt={mapaAtual.nome}
                ehDM={false}
                wrapperClassName="relative"
                imgClassName="block max-w-full max-h-[300px] object-contain"
              />
              {fogMapa?.ativo && (
                <span className="absolute left-2 bottom-2 text-[11px] font-cinzel px-2 py-1 rounded-full bg-black/60 text-white/80">
                  Névoa: {percentualRevelado(fogMapa)}% revelado
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => abrir(mapaAtual)}
              className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] font-cinzel text-sm"
            >
              Tela cheia
            </button>
          </div>
        ) : (
          <p className="text-center text-[var(--text3)] text-sm font-crimson py-6">
            O mestre ainda não liberou nenhum mapa.
          </p>
        )
      )}

      {!carregando && !erro && secao === 'imagens' && (
        fotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {fotos.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => abrir(f)}
                className="relative flex flex-col text-left rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden min-h-[44px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.nome} loading="lazy" draggable={false} className="w-full h-28 object-cover bg-black/40" />
                <span className="px-2 py-2 text-[var(--text2)] font-crimson text-sm truncate">{f.nome}</span>
                {!vistas.has(f.id) && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-cinzel px-2 py-0.5 rounded-full bg-[var(--gold)] text-[var(--bg)]">
                    nova
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-[var(--text3)] text-sm font-crimson py-6">
            O mestre ainda não liberou nenhuma imagem.
          </p>
        )
      )}

      {ehDM && (
        <Link href="/mapas" className="self-center min-h-[44px] flex items-center text-xs font-crimson text-[var(--text3)] underline">
          Gerenciar em Mapas
        </Link>
      )}

      <p className="text-center text-[var(--text3)] text-xs font-crimson">
        Abre quando você quiser. A ficha continua a um toque de distância.
      </p>

      {abertaViva && (
        <VisualizadorFullscreen
          imagem={abertaViva}
          ehJogador
          zIndex={Z_VISUALIZADOR}
          onClose={() => setAberta(null)}
          onToggleVis={() => {}}
          onRemover={() => {}}
        />
      )}
    </div>
  )
}
