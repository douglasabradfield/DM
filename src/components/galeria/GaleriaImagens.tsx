'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { X, Upload, Search, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const { campanhaAtiva, papelPorCampanha } = useCampanha()
  const [imagens, setImagens] = useState<ImagemGaleria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<ImagemGaleria | null>(null)
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
    toast.success(novoValor ? 'Visível para jogadores' : 'Oculto para jogadores')
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
    <div className="flex h-full">
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
                  <div className="w-12 h-12 bg-[var(--bg3)] rounded overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.nome}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selecionada.url}
              alt={selecionada.nome}
              className="w-full rounded-lg border border-[var(--border)] shadow-xl object-contain max-h-[70vh]"
              onError={e => { (e.target as HTMLImageElement).alt = 'Erro ao carregar imagem' }}
            />
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
  )
}
