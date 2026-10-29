'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { percentualRevelado } from '@/lib/fog-of-war'
import { cn } from '@/lib/utils'
import { useCampanha } from '@/store/campanha'
import { ImagemComFog } from '@/components/galeria/ImagemComFog'
import { VisualizadorFullscreen, type ImagemGaleria } from '@/components/galeria/GaleriaImagens'
import type { ImagensMesa } from '@/hooks/useImagensMesa'

// Acima da barra de abas (z-50) e abaixo dos popovers/modais críticos da
// mesa (9995 a 9999). Não altera o z-index de nenhum componente existente.
const Z_VISUALIZADOR = 9990

// Aba Mapa do celular (abaixo de md). Somente visual: os dados vêm do hook
// useImagensMesa, chamado uma vez em MesaCliente. Somente leitura: sem edição
// de névoa, upload ou liberação — isso continua em /mapas.
export function AbaMapa({ dados, alturaMapa = 300 }: { dados: ImagensMesa; alturaMapa?: number }) {
  const {
    carregando, erro, ehDM, mapas, fotos, novas, vistas, mapaAtual,
    selecionarMapa, marcarVista, recarregar, existe,
  } = dados
  const fogPorImagem = useCampanha(s => s.fogPorImagem)

  const [secao, setSecao] = useState<'mapa' | 'imagens'>('mapa')
  const [aberta, setAberta] = useState<ImagemGaleria | null>(null)

  // Recarrega ao abrir o painel (o hook também recarrega ao voltar o foco).
  useEffect(() => { recarregar() }, [recarregar])

  const fogMapa = mapaAtual ? fogPorImagem[mapaAtual.id] : undefined

  function abrir(imagem: ImagemGaleria) {
    setAberta(imagem)
    marcarVista(imagem.id)
  }

  // Se a imagem aberta for removida/ocultada, o visualizador fecha.
  const abertaViva = aberta && existe(aberta.id) ? aberta : null

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
                onChange={e => selecionarMapa(e.target.value)}
                aria-label="Escolher mapa"
                className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] font-crimson px-3"
              >
                {mapas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            )}
            <div
              style={{ height: alturaMapa, ['--altura-mapa' as string]: `${alturaMapa}px` }}
              className="relative flex items-center justify-center rounded-xl border border-[var(--border)] bg-black/40 overflow-hidden"
            >
              <ImagemComFog
                key={mapaAtual.id}
                imagemId={mapaAtual.id}
                url={mapaAtual.url}
                alt={mapaAtual.nome}
                ehDM={false}
                wrapperClassName="relative"
                imgClassName="block max-w-full max-h-[var(--altura-mapa)] object-contain"
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
                <img src={f.url} alt={f.nome} loading="lazy" decoding="async" draggable={false} className="w-full h-28 object-cover bg-black/40" />
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
