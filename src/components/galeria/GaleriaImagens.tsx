'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { X, Upload, Search, Trash2, ExternalLink, Eye, EyeOff, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  percentualRevelado, ativarFogImagem, desativarFogImagem, revelarTudoImagem, ocultarTudoImagem,
} from '@/lib/fog-of-war'
import { useFogPincel } from '@/hooks/useFogPincel'
import { FogToolbar } from './FogToolbar'
import { FogThumbOverlay } from './FogThumbOverlay'

interface ImagemGaleria {
  id: string
  campanha_id: string
  nome: string
  url: string
  storage_path: string | null
  tipo: 'imagem' | 'mapa'
  visivel_jogadores: boolean
  compartilhado: boolean
  criado_em: string
}

interface GaleriaImagensProps {
  tipo: 'imagem' | 'mapa'
}

export function GaleriaImagens({ tipo }: GaleriaImagensProps) {
  const { campanhaAtiva, papelPorCampanha, fogPorImagem, definirFogImagem } = useCampanha()
  const [imagens, setImagens] = useState<ImagemGaleria[]>([])
  const [processandoFog, setProcessandoFog] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<ImagemGaleria | null>(null)
  const [visualizando, setVisualizando] = useState<ImagemGaleria | null>(null)
  const [modalAdicionar, setModalAdicionar] = useState(false)
  const [nome, setNome] = useState('')
  const [url, setUrl] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [modoUpload, setModoUpload] = useState<'url' | 'arquivo'>('arquivo')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewArquivo, setPreviewArquivo] = useState<string | null>(null)
  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const selecionadaRef = useRef(selecionada)
  selecionadaRef.current = selecionada

  const ehJogador = papelPorCampanha[campanhaAtiva?.id ?? ''] === 'jogador'

  useEffect(() => {
    if (!campanhaAtiva?.id) { setCarregando(false); return }
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaAtiva?.id, ehJogador])

  // Realtime — upload/edição/remoção em outra aba (ou pelo DM, pro jogador)
  // aparece sem precisar de reload. Escopo local ao componente (só existe
  // enquanto a tela de Mapas/Imagens está montada), diferente do canal de
  // sessão/fog em store/campanha.ts, que precisa sobreviver entre telas.
  useEffect(() => {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`imagens:${campanhaAtiva.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'imagens', filter: `campanha_id=eq.${campanhaAtiva.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const antiga = payload.old as { id?: string }
            if (!antiga.id) return
            setImagens(prev => prev.filter(i => i.id !== antiga.id))
            return
          }
          const linha = payload.new as ImagemGaleria
          if (!linha?.id || linha.tipo !== tipo) return
          // Jogador só enxerga imagens visivel_jogadores=true — se o DM
          // acabou de ocultar, remove da lista local em vez de atualizar.
          if (ehJogador && !linha.visivel_jogadores) {
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

    return () => { supabase.removeChannel(channel) }
  }, [campanhaAtiva?.id, tipo, ehJogador])

  async function carregar() {
    if (!campanhaAtiva?.id) return
    setCarregando(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('imagens')
        .select('id, campanha_id, nome, url, storage_path, tipo, visivel_jogadores, compartilhado, criado_em')
        .eq('campanha_id', campanhaAtiva.id)
        .eq('tipo', tipo)
        .order('criado_em', { ascending: false })

      if (ehJogador) query = query.eq('visivel_jogadores', true)

      const { data, error } = await query
      if (error) { console.error('Erro ao buscar imagens:', error); toast.error('Erro ao carregar imagens'); return }
      setImagens((data ?? []) as ImagemGaleria[])
    } finally {
      setCarregando(false)
    }
  }

  function fecharModal() {
    setModalAdicionar(false)
    setArquivo(null)
    setPreviewArquivo(null)
    setNome('')
    setUrl('')
  }

  function selecionarArquivo(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo: 5 MB'); return }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('Formato não suportado. Use JPEG, PNG, GIF ou WebP'); return
    }
    setArquivo(file)
    const reader = new FileReader()
    reader.onload = e => setPreviewArquivo(e.target?.result as string)
    reader.readAsDataURL(file)
    if (!nome) setNome(file.name.replace(/\.[^.]+$/, ''))
  }

  async function adicionar() {
    if (!nome.trim() || !campanhaAtiva?.id) return
    if (modoUpload === 'url' && !url.trim()) return
    if (modoUpload === 'arquivo' && !arquivo) return
    setSalvando(true)
    try {
      const supabase = createClient()
      let finalUrl = url.trim()
      let storagePath: string | null = null

      if (modoUpload === 'arquivo' && arquivo) {
        const ext = arquivo.name.split('.').pop()
        const path = `${campanhaAtiva.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('dungeon-desk-imagens')
          .upload(path, arquivo, { contentType: arquivo.type })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('dungeon-desk-imagens').getPublicUrl(path)
        finalUrl = urlData.publicUrl
        storagePath = path
      }

      const { data, error } = await supabase
        .from('imagens')
        .insert({
          campanha_id: campanhaAtiva.id,
          nome: nome.trim(),
          url: finalUrl,
          tipo,
          visivel_jogadores: false,
          compartilhado: false,
          ...(storagePath ? { storage_path: storagePath } : { storage_path: null }),
        })
        .select('id, campanha_id, nome, url, storage_path, tipo, visivel_jogadores, compartilhado, criado_em')
        .single()
      if (error) throw error
      setImagens(prev => [data as ImagemGaleria, ...prev])
      fecharModal()
      toast.success(`${tipo === 'mapa' ? 'Mapa' : 'Imagem'} adicionada!`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao adicionar')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover esta imagem?')) return
    const supabase = createClient()
    const alvo = imagens.find(i => i.id === id)
    if (alvo?.storage_path) {
      await supabase.storage.from('dungeon-desk-imagens').remove([alvo.storage_path])
    }
    await supabase.from('imagens').delete().eq('id', id)
    setImagens(prev => prev.filter(i => i.id !== id))
    if (selecionadaRef.current?.id === id) setSelecionada(null)
    setVisualizando(prev => prev?.id === id ? null : prev)
    toast.success('Removida')
  }

  async function toggleVisibilidade(img: ImagemGaleria) {
    const supabase = createClient()
    const novoValor = !img.visivel_jogadores
    const { error } = await supabase
      .from('imagens')
      .update({ visivel_jogadores: novoValor })
      .eq('id', img.id)
    if (error) { toast.error('Erro ao atualizar visibilidade'); return }
    setImagens(prev => prev.map(i => i.id === img.id ? { ...i, visivel_jogadores: novoValor } : i))
    if (selecionadaRef.current?.id === img.id) {
      setSelecionada(prev => prev ? { ...prev, visivel_jogadores: novoValor } : null)
    }
    setVisualizando(prev => prev?.id === img.id ? { ...prev, visivel_jogadores: novoValor } : prev)
    toast.success(novoValor ? 'Visível para jogadores' : 'Oculto para jogadores')
  }

  async function alternarFog(img: ImagemGaleria) {
    const fog = fogPorImagem[img.id]
    setProcessandoFog(img.id)
    try {
      if (fog?.ativo) {
        if (!confirm('Desativar a névoa de guerra? O mapa fica totalmente visível para os jogadores.')) return
        await desativarFogImagem(img.id, definirFogImagem)
        toast.success('Névoa de guerra desativada')
      } else {
        await ativarFogImagem(img.id, img.url, definirFogImagem)
        toast.success('Névoa de guerra ativada — mapa oculto até você revelar')
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar a névoa de guerra')
    } finally {
      setProcessandoFog(null)
    }
  }

  const filtradas = imagens.filter(i =>
    !busca || i.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const labelTipo = tipo === 'mapa' ? 'Mapa' : 'Imagem'

  if (!campanhaAtiva) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[var(--border)] font-cinzel text-lg">Selecione uma campanha na barra lateral</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mobile: busca + adicionar + grade de miniaturas */}
      <div className="flex md:hidden flex-col h-full">
        <div className="flex items-center gap-2 p-3 border-b border-[var(--border)] flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={`Buscar ${labelTipo.toLowerCase()}...`}
              className="w-full input-dd pl-9 text-sm"
            />
          </div>
          {!ehJogador && (
            <button
              onClick={() => setModalAdicionar(true)}
              className="flex-shrink-0 w-9 h-9 rounded bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] flex items-center justify-center transition-colors"
              title={`Adicionar ${labelTipo}`}
            >
              <Upload className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {carregando ? (
            <p className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando...</p>
          ) : filtradas.length === 0 ? (
            <p className="p-4 text-center text-[var(--border)] text-sm font-crimson">
              {imagens.length === 0
                ? `Nenhum${tipo === 'mapa' ? '' : 'a'} ${labelTipo.toLowerCase()} adicionad${tipo === 'mapa' ? 'o' : 'a'}`
                : 'Nenhum resultado'}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtradas.map(img => (
                <button
                  key={img.id}
                  onClick={() => setVisualizando(img)}
                  className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg3)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.nome}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {tipo === 'mapa' && <FogThumbOverlay imagemId={img.id} ehDM={!ehJogador} />}
                  {!ehJogador && (
                    <span className={cn(
                      'absolute top-1 right-1 rounded-full p-1',
                      img.visivel_jogadores ? 'bg-[var(--green2)]/80 text-white' : 'bg-black/60 text-white/70'
                    )}>
                      {img.visivel_jogadores ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                    </span>
                  )}
                  {!ehJogador && tipo === 'mapa' && (
                    <span
                      onClick={e => { e.stopPropagation(); if (processandoFog !== img.id) alternarFog(img) }}
                      className={cn(
                        'absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-cinzel flex items-center gap-0.5',
                        fogPorImagem[img.id]?.ativo ? 'bg-[var(--accent)]/80 text-white' : 'bg-black/50 text-white/60'
                      )}
                      title={fogPorImagem[img.id]?.ativo ? 'Névoa de guerra ativa' : 'Ativar névoa de guerra'}
                    >
                      🌫️{fogPorImagem[img.id]?.ativo ? ` ${percentualRevelado(fogPorImagem[img.id])}%` : ''}
                    </span>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate text-left">
                    {img.nome}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-[var(--border)] text-center flex-shrink-0">
          <p className="text-[var(--text3)] text-xs font-cinzel">{filtradas.length} de {imagens.length}</p>
        </div>
      </div>

      {/* Desktop: lista lateral + visualizador, inalterados */}
      <div className="hidden md:flex h-full">
      {/* Lista lateral */}
      <div className="w-72 border-r border-[var(--border)] flex flex-col">
        <div className="p-3 border-b border-[var(--border)] space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={`Buscar ${labelTipo.toLowerCase()}...`}
              className="w-full input-dd pl-9 text-sm"
            />
          </div>
          {!ehJogador && (
            <button
              onClick={() => setModalAdicionar(true)}
              className="w-full py-1.5 bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] rounded font-cinzel text-xs transition-colors flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3" /> Adicionar {labelTipo}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <p className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando...</p>
          ) : filtradas.length === 0 ? (
            <p className="p-4 text-center text-[var(--border)] text-sm font-crimson">
              {imagens.length === 0
                ? `Nenhum${tipo === 'mapa' ? '' : 'a'} ${labelTipo.toLowerCase()} adicionad${tipo === 'mapa' ? 'o' : 'a'}`
                : 'Nenhum resultado'}
            </p>
          ) : (
            filtradas.map(img => (
              <button
                key={img.id}
                onClick={() => setSelecionada(img)}
                className={`w-full text-left p-2 border-b border-[var(--bg3)] hover:bg-[var(--bg3)] transition-colors ${selecionada?.id === img.id ? 'bg-[var(--surface)]' : ''}`}
              >
                <div className="flex gap-2 items-start">
                  <div className="relative w-12 h-12 bg-[var(--bg3)] rounded overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.nome}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    {tipo === 'mapa' && <FogThumbOverlay imagemId={img.id} ehDM={!ehJogador} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--text)] text-sm font-crimson truncate">{img.nome}</p>
                    <p className="text-[var(--text3)] text-[10px]">
                      {new Date(img.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                    {!ehJogador && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] mt-0.5 ${img.visivel_jogadores ? 'text-[var(--green2)]' : 'text-[var(--border)]'}`}>
                        {img.visivel_jogadores ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                        {img.visivel_jogadores ? 'Visível' : 'Oculto'}
                      </span>
                    )}
                    {!ehJogador && tipo === 'mapa' && (
                      <span
                        onClick={e => { e.stopPropagation(); if (processandoFog !== img.id) alternarFog(img) }}
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] mt-0.5 ml-2 hover:opacity-80',
                          fogPorImagem[img.id]?.ativo ? 'text-[var(--accent)]' : 'text-[var(--border)]'
                        )}
                        title={fogPorImagem[img.id]?.ativo ? 'Clique para desativar a névoa' : 'Clique para ativar a névoa de guerra'}
                      >
                        🌫️ {fogPorImagem[img.id]?.ativo ? `${percentualRevelado(fogPorImagem[img.id])}% revelado` : 'Sem névoa'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-[var(--border)] text-center">
          <p className="text-[var(--text3)] text-xs font-cinzel">{filtradas.length} de {imagens.length}</p>
        </div>
      </div>

      {/* Visualizador */}
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
        {!selecionada ? (
          <div className="text-center">
            <p className="font-cinzel text-[var(--border)] text-xl mb-2">Selecione um{tipo === 'mapa' ? '' : 'a'} {labelTipo.toLowerCase()}</p>
            <p className="text-[var(--border)] text-sm font-crimson">Clique em um item da lista para visualizar</p>
          </div>
        ) : (
          <div className="max-w-4xl w-full">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-cinzel text-[var(--gold)] text-xl font-bold">{selecionada.nome}</h2>
              <div className="flex gap-2 flex-wrap">
                {!ehJogador && (
                  <button
                    onClick={() => toggleVisibilidade(selecionada)}
                    className={`flex items-center gap-1 px-3 py-1.5 border rounded text-xs transition-colors ${
                      selecionada.visivel_jogadores
                        ? 'border-[var(--green2)] text-[var(--green2)] hover:bg-[var(--green2)]/10'
                        : 'border-[var(--border)] text-[var(--text3)] hover:border-[var(--green2)] hover:text-[var(--green2)]'
                    }`}
                  >
                    {selecionada.visivel_jogadores
                      ? <><Eye className="w-3 h-3" /> Visível aos jogadores</>
                      : <><EyeOff className="w-3 h-3" /> Oculto aos jogadores</>
                    }
                  </button>
                )}
                <a
                  href={selecionada.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 border border-[var(--border)] text-[var(--text2)] rounded text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Abrir original
                </a>
                {!ehJogador && tipo === 'mapa' && (
                  <button
                    onClick={() => setVisualizando(selecionada)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] rounded text-xs hover:bg-[var(--accent)]/10 transition-colors"
                    title="Abrir em tela cheia para pintar a névoa de guerra"
                  >
                    <Maximize2 className="w-3 h-3" /> Tela cheia / Névoa
                    {fogPorImagem[selecionada.id]?.ativo ? ` (${percentualRevelado(fogPorImagem[selecionada.id])}%)` : ''}
                  </button>
                )}
                {!ehJogador && (
                  <button
                    onClick={() => remover(selecionada.id)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[var(--red2)] text-[var(--red2)] rounded text-xs hover:bg-[var(--red2)]/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Remover
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selecionada.url}
                alt={selecionada.nome}
                className="w-full rounded-lg border border-[var(--border)] shadow-xl object-contain max-h-[70vh]"
                onError={e => { (e.target as HTMLImageElement).alt = 'Erro ao carregar imagem' }}
              />
              {tipo === 'mapa' && <FogThumbOverlay imagemId={selecionada.id} ehDM={!ehJogador} />}
            </div>
          </div>
        )}
      </div>

      {/* Modal adicionar */}
      {modalAdicionar && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={fecharModal}>
          <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-cinzel text-[var(--gold)] text-lg font-bold">+ Adicionar {labelTipo}</h3>
              <button onClick={fecharModal} className="text-[var(--border)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs URL / Arquivo */}
            <div className="flex border border-[var(--border)] rounded overflow-hidden mb-4 text-xs font-cinzel">
              {(['arquivo', 'url'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setModoUpload(m)}
                  className={`flex-1 py-1.5 transition-colors ${modoUpload === m ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--text3)] hover:text-[var(--text)]'}`}
                >
                  {m === 'arquivo' ? 'Enviar arquivo' : 'URL externa'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder={`Nome d${tipo === 'mapa' ? 'o mapa' : 'a imagem'}...`}
                  className="input-dd w-full"
                  autoFocus
                />
              </div>

              {modoUpload === 'arquivo' ? (
                <div>
                  <input
                    ref={inputArquivoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) selecionarArquivo(f) }}
                  />
                  {!arquivo ? (
                    <button
                      onClick={() => inputArquivoRef.current?.click()}
                      className="w-full border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center hover:border-[var(--accent)] transition-colors"
                    >
                      <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--text3)]" />
                      <p className="text-[var(--text3)] text-sm font-crimson">Clique para selecionar</p>
                      <p className="text-[var(--border)] text-xs mt-1">JPEG, PNG, GIF ou WebP · máx. 5 MB</p>
                    </button>
                  ) : (
                    <div className="relative">
                      {previewArquivo && (
                        <div className="rounded overflow-hidden border border-[var(--border)] h-32">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewArquivo} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[var(--text3)] text-xs font-crimson truncate flex-1">{arquivo.name}</p>
                        <button onClick={() => { setArquivo(null); setPreviewArquivo(null) }} className="text-[var(--border)] hover:text-[var(--red2)] ml-2">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">URL da Imagem</label>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="input-dd w-full"
                  />
                  {url && (
                    <div className="mt-2 rounded overflow-hidden border border-[var(--border)] h-32">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={fecharModal} className="flex-1 py-2 border border-[var(--border)] rounded text-[var(--text2)] text-sm">Cancelar</button>
              <button
                onClick={adicionar}
                disabled={!nome.trim() || (modoUpload === 'url' ? !url.trim() : !arquivo) || salvando}
                className="flex-1 py-2 bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] rounded font-cinzel text-sm disabled:opacity-50"
              >
                {salvando ? 'Enviando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>

      {/* Visualizador fullscreen — mobile */}
      {visualizando && (
        <VisualizadorFullscreen
          imagem={visualizando}
          ehJogador={ehJogador}
          onClose={() => setVisualizando(null)}
          onToggleVis={() => toggleVisibilidade(visualizando)}
          onRemover={() => remover(visualizando.id)}
        />
      )}
    </div>
  )
}

function VisualizadorFullscreen({ imagem, ehJogador, onClose, onToggleVis, onRemover }: {
  imagem: ImagemGaleria
  ehJogador: boolean
  onClose: () => void
  onToggleVis: () => void
  onRemover: () => void
}) {
  // "scale" é SEMPRE relativo ao pixel natural da imagem (1 = tamanho real),
  // nunca ao CSS de shrink-to-fit — foi exatamente essa dependência de
  // max-width/max-height percentual que cortava mapas grandes (max-height
  // percentual não resolve contra um pai de altura automática, só
  // max-width; ver diagnóstico). fitScale é calculada em JS a partir das
  // dimensões naturais da imagem e do container, e é o "1x" que o usuário
  // vê ao abrir o visualizador.
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [fitScale, setFitScale] = useState(1)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const startDist = useRef(0)
  const startScale = useRef(1)
  const startPos = useRef({ x: 0, y: 0 })
  const startMid = useRef({ x: 0, y: 0 })
  const arrastandoUnico = useRef(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const panContainerRef = useRef<HTMLDivElement>(null)
  // true enquanto o usuário não deu zoom manual — resize do container (ex.:
  // toolbar de fog aparecendo/sumindo, rotação de tela) recalcula a escala
  // de ajuste e realinha automaticamente só nesse caso.
  const semZoomManual = useRef(true)

  const ehDM = !ehJogador
  const mostraFog = ehDM && imagem.tipo === 'mapa'
  const fog = useFogPincel({ imagemId: imagem.id, ehDM })
  const pronto = !!naturalSize
  const ampliado = scale > fitScale * 1.01

  function medirContainer() {
    const rect = panContainerRef.current?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  }

  function calcularFit(natural: { width: number; height: number }, container: { width: number; height: number }) {
    if (!natural.width || !natural.height || !container.width || !container.height) return 1
    return Math.min(container.width / natural.width, container.height / natural.height)
  }

  function clampPos(x: number, y: number, escalaAtual: number) {
    if (!naturalSize) return { x: 0, y: 0 }
    const { width: cw, height: ch } = medirContainer()
    const maxX = Math.max(0, (naturalSize.width * escalaAtual - cw) / 2)
    const maxY = Math.max(0, (naturalSize.height * escalaAtual - ch) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }

  function medirEAjustar() {
    const w = imgRef.current?.naturalWidth ?? 0
    const h = imgRef.current?.naturalHeight ?? 0
    if (!w || !h) return
    const natural = { width: w, height: h }
    const fit = calcularFit(natural, medirContainer())
    setNaturalSize(natural)
    setFitScale(fit)
    setScale(fit)
    setPos({ x: 0, y: 0 })
    semZoomManual.current = true
  }

  // Imagem em cache do navegador: o evento onLoad já pode ter disparado
  // antes do handler ser anexado, e nunca mais dispara de novo.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth) medirEAjustar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagem.url])

  // Recalcula a escala de ajuste quando o container muda de tamanho
  // (toolbar de fog surgindo/sumindo, rotação de tela) — só realinha a
  // escala atual se o usuário ainda não deu zoom manual.
  useEffect(() => {
    const el = panContainerRef.current
    if (!el || !naturalSize || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(() => {
      const novoFit = calcularFit(naturalSize, medirContainer())
      setFitScale(novoFit)
      if (semZoomManual.current) { setScale(novoFit); setPos({ x: 0, y: 0 }) }
    })
    obs.observe(el)
    return () => obs.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalSize])
  const [processandoFog, setProcessandoFog] = useState(false)
  // Um traço de pincel (1 ponteiro) só pinta quando o pincel está
  // explicitamente ligado (modoPincel !== null) — enquanto ele está
  // desligado, 1 dedo/mouse continua navegando (pan) como antes. Pinça de
  // 2 dedos sempre dá zoom/pan, pincel ligado ou não — assim o DM nunca
  // fica preso sem conseguir se reposicionar no mapa. Ver seção 2 do plano
  // da Fase 7 para a justificativa completa dessa escolha.
  const pincelAtivo = mostraFog && fog.fogAtivo && !fog.verComoJogador && !!fog.modoPincel

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function distancia(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  function pontoMedio(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pincelAtivo && pointers.current.size === 1) {
      fog.iniciarTraco()
      fog.pintarEm(e.clientX, e.clientY)
      return
    }

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      startDist.current = distancia(a, b)
      startScale.current = scale
      startMid.current = pontoMedio(a, b)
      startPos.current = pos
      arrastandoUnico.current = false
    } else if (pointers.current.size === 1) {
      arrastandoUnico.current = ampliado
      startPos.current = pos
      startMid.current = { x: e.clientX, y: e.clientY }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pincelAtivo && pointers.current.size === 1) {
      fog.pintarEm(e.clientX, e.clientY)
      return
    }

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const novaDist = distancia(a, b)
      // Limites relativos à escala de ajuste (0,5x–4x), mas nunca "prendem"
      // uma escala que já esteja fora desse intervalo (ex.: usuário clicou
      // em "100%" antes de dar pinça) — evita um salto brusco no primeiro
      // movimento do gesto.
      const escalaMin = Math.min(fitScale * 0.5, startScale.current)
      const escalaMax = Math.max(fitScale * 4, startScale.current)
      const novaEscala = Math.min(escalaMax, Math.max(escalaMin, startScale.current * (novaDist / (startDist.current || novaDist))))
      const novoMid = pontoMedio(a, b)
      setScale(novaEscala)
      setPos(clampPos(
        startPos.current.x + (novoMid.x - startMid.current.x),
        startPos.current.y + (novoMid.y - startMid.current.y),
        novaEscala
      ))
      semZoomManual.current = false
    } else if (pointers.current.size === 1 && arrastandoUnico.current) {
      const p = [...pointers.current.values()][0]
      setPos(clampPos(
        startPos.current.x + (p.x - startMid.current.x),
        startPos.current.y + (p.y - startMid.current.y),
        scale
      ))
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      fog.finalizarTraco()
      arrastandoUnico.current = false
      if (scale <= fitScale * 1.02) {
        setScale(fitScale)
        setPos({ x: 0, y: 0 })
        semZoomManual.current = true
      }
    } else if (pointers.current.size === 1) {
      const p = [...pointers.current.values()][0]
      arrastandoUnico.current = ampliado
      startPos.current = pos
      startMid.current = p
    }
  }

  function alternarZoom() {
    if (ampliado) {
      setScale(fitScale)
      setPos({ x: 0, y: 0 })
      semZoomManual.current = true
    } else {
      const alvo = Math.min(fitScale * 4, fitScale * 2)
      setScale(alvo)
      semZoomManual.current = false
    }
  }

  function ajustarTela() {
    setScale(fitScale)
    setPos({ x: 0, y: 0 })
    semZoomManual.current = true
  }

  function zoom100() {
    setScale(1)
    setPos(clampPos(0, 0, 1))
    semZoomManual.current = false
  }

  async function handleAtivarFog() {
    setProcessandoFog(true)
    try {
      await ativarFogImagem(imagem.id, imagem.url, useCampanha.getState().definirFogImagem)
      toast.success('Névoa de guerra ativada — mapa oculto até você revelar')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao ativar a névoa de guerra')
    } finally {
      setProcessandoFog(false)
    }
  }

  async function handleDesativarFog() {
    if (!confirm('Desativar a névoa de guerra? O mapa fica totalmente visível para os jogadores.')) return
    setProcessandoFog(true)
    try {
      await desativarFogImagem(imagem.id, useCampanha.getState().definirFogImagem)
      toast.success('Névoa de guerra desativada')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao desativar a névoa de guerra')
    } finally {
      setProcessandoFog(false)
    }
  }

  async function handleRevelarTudo() {
    if (!confirm('Revelar o mapa inteiro para os jogadores?')) return
    setProcessandoFog(true)
    try {
      await revelarTudoImagem(imagem.id, useCampanha.getState().definirFogImagem)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao revelar o mapa')
    } finally {
      setProcessandoFog(false)
    }
  }

  async function handleOcultarTudo() {
    if (!confirm('Ocultar o mapa inteiro dos jogadores?')) return
    setProcessandoFog(true)
    try {
      await ocultarTudoImagem(imagem.id, useCampanha.getState().definirFogImagem)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao ocultar o mapa')
    } finally {
      setProcessandoFog(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={e => { if (e.target === e.currentTarget && !ampliado) onClose() }}
    >
      <div className="flex items-center justify-between gap-2 p-3 flex-shrink-0">
        <p className="text-white/80 text-sm font-crimson truncate pr-2">{imagem.nome}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:bg-white/20 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        ref={panContainerRef}
        className="relative flex-1 overflow-hidden touch-none flex items-center justify-center select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={alternarZoom}
      >
        {/* Wrapper é dimensionado em px NATURAIS da imagem (nunca por
            max-width/max-height percentual — max-height percentual não
            resolve contra um pai de altura automática, foi isso que cortava
            mapas grandes) e escalado via transform a partir de fitScale
            (calculada em JS). A imagem e o canvas da névoa são desenhados
            nesse MESMO sistema de coordenadas e recebem o MESMO transform —
            é isso que mantém a máscara colada à imagem em qualquer zoom, e
            também não desalinha com Ctrl+/- do navegador (getBoundingClientRect
            usado nos handlers de pintura já reflete o zoom do navegador). */}
        <div
          className="relative flex-shrink-0"
          style={{
            width: naturalSize?.width,
            height: naturalSize?.height,
            // flex-shrink:1 é o default — sem zerar aqui, o container flex
            // comprime a LARGURA (eixo principal) pra caber, sem tocar a
            // altura (eixo cruzado), distorcendo a proporção da imagem e,
            // com isso, todo o grid de células da névoa (calculado a partir
            // dessa largura errada). Foi exatamente esse o bug: mapa
            // "esticado numa faixa vertical estreita" e máscara desalinhada.
            flexShrink: 0,
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: pointers.current.size > 0 ? 'none' : 'transform 0.15s ease-out',
            opacity: pronto ? 1 : 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imagem.url}
            alt={imagem.nome}
            className="block"
            style={{ width: naturalSize?.width, height: naturalSize?.height }}
            draggable={false}
            onLoad={medirEAjustar}
          />
          {fog.fogAtivo && (
            <canvas
              ref={fog.canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ filter: 'blur(5px)' }}
            />
          )}
        </div>

        {pronto && (
          <div
            className="absolute top-3 right-3 z-10 flex gap-1.5"
            onPointerDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            <button
              onClick={ajustarTela}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-cinzel bg-black/50 text-white/80 hover:bg-black/70 transition-colors"
              title="Ajustar imagem inteira à tela"
            >
              ⤢ Ajustar
            </button>
            <button
              onClick={zoom100}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-cinzel bg-black/50 text-white/80 hover:bg-black/70 transition-colors"
              title="Ver em tamanho real (100%)"
            >
              100%
            </button>
          </div>
        )}
      </div>

      {mostraFog && (
        <FogToolbar
          fogAtivo={fog.fogAtivo}
          percentual={fog.percentual}
          processando={processandoFog}
          salvando={fog.salvando}
          modoPincel={fog.modoPincel}
          onModoPincel={fog.setModoPincel}
          tamanhoPincel={fog.tamanhoPincel}
          onTamanhoPincel={fog.setTamanhoPincel}
          verComoJogador={fog.verComoJogador}
          onVerComoJogador={fog.setVerComoJogador}
          onAtivar={handleAtivarFog}
          onDesativar={handleDesativarFog}
          onRevelarTudo={handleRevelarTudo}
          onOcultarTudo={handleOcultarTudo}
        />
      )}

      {!ehJogador && (
        <div className="flex items-center justify-center gap-3 p-3 flex-shrink-0 bg-black/40">
          <button
            onClick={onToggleVis}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-cinzel transition-colors',
              imagem.visivel_jogadores ? 'bg-[var(--green2)]/20 text-[var(--green2)]' : 'bg-white/10 text-white/70'
            )}
          >
            {imagem.visivel_jogadores ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {imagem.visivel_jogadores ? 'Visível' : 'Oculto'}
          </button>
          <a
            href={imagem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-cinzel bg-white/10 text-white/70"
          >
            <ExternalLink className="w-4 h-4" /> Original
          </a>
          <button
            onClick={onRemover}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-cinzel bg-[var(--red2)]/20 text-[var(--red2)]"
          >
            <Trash2 className="w-4 h-4" /> Remover
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
