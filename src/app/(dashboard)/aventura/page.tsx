'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import type { LocalAventura, Aventura } from '@/types/database'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { Search, Upload, Copy, ScrollText } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AventuraPage() {
  const { campanhaAtiva } = useCampanha()
  const [aventura, setAventura] = useState<Aventura | null>(null)
  const [locais, setLocais] = useState<LocalAventura[]>([])
  const [localSelecionado, setLocalSelecionado] = useState<LocalAventura | null>(null)
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState<'idle' | 'enviando' | 'processando'>('idle')
  const [arquivo, setArquivo] = useState<File | null>(null)

  useEffect(() => {
    if (!campanhaAtiva?.id) {
      setAventura(null)
      setLocais([])
      setLocalSelecionado(null)
      setCarregando(false)
      return
    }
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaAtiva?.id])

  async function carregar() {
    if (!campanhaAtiva?.id) return
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data: avs } = await supabase
        .from('aventuras')
        .select('*')
        .eq('campanha_id', campanhaAtiva.id)
        .order('criado_em', { ascending: false })
        .limit(1)
      if (avs?.[0]) {
        setAventura(avs[0] as Aventura)
        const conteudo = avs[0].conteudo_json
        if (conteudo?.capitulos) {
          const todosLocais = conteudo.capitulos.flatMap((c: { locais?: LocalAventura[] }) => c.locais ?? [])
          setLocais(todosLocais)
        }
      } else {
        setAventura(null)
        setLocais([])
      }
    } finally {
      setCarregando(false)
    }
  }

  async function enviarAventura() {
    if (!arquivo || !campanhaAtiva?.id) return
    const MAX_MB = 150
    if (arquivo.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (${(arquivo.size / 1024 / 1024).toFixed(0)} MB). Limite: ${MAX_MB} MB.`)
      return
    }
    setEnviando(true)
    setProgresso('enviando')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Envia direto ao Supabase Storage — sem passar pelo Vercel
      const nomeArquivo = `${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storagePath = `${user.id}/${nomeArquivo}`
      const { error: uploadError } = await supabase.storage
        .from('aventuras')
        .upload(storagePath, arquivo, { upsert: true })
      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

      // API processa a partir do caminho no Storage
      setProgresso('processando')
      const res = await fetch('/api/aventura/processar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, campanhaId: campanhaAtiva.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.erro ?? 'Erro ao processar')
      }
      toast.success('Aventura processada com sucesso!')
      setArquivo(null)
      setProgresso('idle')
      carregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar aventura')
      setProgresso('idle')
    } finally {
      setEnviando(false)
    }
  }

  const locaisFiltrados = locais.filter(l =>
    busca === '' || l.nome.toLowerCase().includes(busca.toLowerCase()) || l.codigo.toLowerCase().includes(busca.toLowerCase())
  )

  if (!campanhaAtiva) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <ScrollText className="w-12 h-12 text-[var(--border)] mx-auto mb-3" />
          <p className="font-cinzel text-[var(--text3)] text-xl mb-2">Nenhuma campanha selecionada</p>
          <p className="text-[var(--text3)] text-sm font-crimson">
            Selecione uma campanha no menu lateral para ver a aventura
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Lista de locais */}
      <div className="w-72 border-r border-[var(--border)] flex flex-col">
        <div className="p-3 border-b border-[var(--border)] space-y-2">
          <p className="font-cinzel text-[var(--gold)] text-xs uppercase tracking-wider">
            {aventura ? aventura.titulo : campanhaAtiva.nome}
          </p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar local..." className="w-full input-dd pl-7 text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!aventura && !carregando ? (
            <div className="p-4 space-y-3">
              <p className="text-[var(--border)] text-xs text-center font-crimson">Nenhuma aventura carregada</p>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[var(--text3)] text-xs font-cinzel uppercase">Upload PDF / MD / TXT</span>
                  <input
                    type="file"
                    accept=".pdf,.md,.txt"
                    onChange={e => setArquivo(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs text-[var(--text3)] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-[var(--border)] file:bg-[var(--surface)] file:text-[var(--gold)] file:text-xs file:font-cinzel cursor-pointer"
                  />
                </label>
                {arquivo && (
                  <BotaoRunico variante="ouro" tamanho="sm" className="w-full" onClick={enviarAventura} disabled={enviando}>
                    {progresso === 'enviando'
                      ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Enviando PDF...</>
                      : progresso === 'processando'
                      ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processando com IA...</>
                      : <><Upload className="w-3 h-3" /> Processar Aventura</>}
                  </BotaoRunico>
                )}
              </div>
            </div>
          ) : carregando ? (
            <div className="p-4 text-center text-[var(--text3)] text-sm">Carregando...</div>
          ) : locaisFiltrados.length === 0 ? (
            <div className="p-4 text-center text-[var(--border)] text-sm">Nenhum local encontrado</div>
          ) : (
            locaisFiltrados.map(local => (
              <button
                key={local.id}
                onClick={() => setLocalSelecionado(local)}
                className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${localSelecionado?.id === local.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[var(--gold)] text-xs font-cinzel">{local.codigo}</span>
                  <span className="text-[var(--text)] text-sm font-crimson flex-1 truncate">{local.nome}</span>
                </div>
                {local.capitulo && <p className="text-[var(--border)] text-[10px]">{local.capitulo}</p>}
              </button>
            ))
          )}
        </div>

        {aventura && (
          <div className="p-2 border-t border-[var(--border)]">
            <label className="block cursor-pointer">
              <div className="flex items-center gap-2 text-xs text-[var(--text3)] hover:text-[var(--text2)] transition-colors">
                <Upload className="w-3 h-3" /> Trocar aventura (PDF / MD / TXT)
              </div>
              <input type="file" accept=".pdf,.md,.txt" onChange={e => setArquivo(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
            {arquivo && (
              <BotaoRunico variante="ouro" tamanho="sm" className="w-full mt-1" onClick={enviarAventura} disabled={enviando}>
                {progresso === 'enviando'
                  ? 'Enviando...'
                  : progresso === 'processando'
                  ? 'Processando...'
                  : 'Processar'}
              </BotaoRunico>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo do local */}
      <div className="flex-1 overflow-y-auto p-4">
        {!localSelecionado ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <ScrollText className="w-12 h-12 text-[var(--border)] mx-auto mb-3" />
              <p className="font-cinzel text-[var(--border)] text-lg mb-2">Selecione um local</p>
              <p className="text-[var(--border)] text-sm font-crimson">Escolha um local na lista para ver o texto narrativo</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-cinzel text-[var(--gold)] text-sm bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded">
                    {localSelecionado.codigo}
                  </span>
                  {localSelecionado.capitulo && (
                    <span className="text-[var(--text3)] text-xs">{localSelecionado.capitulo}</span>
                  )}
                </div>
                <h2 className="font-cinzel text-[var(--text)] text-xl font-bold">{localSelecionado.nome}</h2>
              </div>
            </div>

            {localSelecionado.texto_narrativo && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-cinzel text-[var(--gold)] text-xs uppercase tracking-wider flex items-center gap-1">
                    📜 Leia em Voz Alta
                  </span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(localSelecionado.texto_narrativo); toast.success('Copiado!') }}
                    className="text-[var(--text3)] hover:text-[var(--gold)] transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="bg-[var(--bg3)] border border-[var(--gold)]/30 rounded p-4">
                  <p className="text-[var(--gold2)] font-crimson text-base leading-relaxed italic">
                    {localSelecionado.texto_narrativo}
                  </p>
                </div>
              </div>
            )}

            <DivisorOrnamentado />

            {localSelecionado.notas_dm && (
              <PainelGrimorio titulo="Notas do Mestre" compacto className="mb-3">
                <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{localSelecionado.notas_dm}</p>
              </PainelGrimorio>
            )}

            {localSelecionado.npcs && localSelecionado.npcs.length > 0 && (
              <PainelGrimorio titulo="NPCs" compacto className="mb-3">
                <div className="space-y-3">
                  {localSelecionado.npcs.map((npc, i) => (
                    <div key={i} className="border-l-2 border-[var(--accent)] pl-3">
                      <p className="font-cinzel text-[var(--accent2)] text-sm">{npc.nome}</p>
                      <p className="text-[var(--text2)] text-sm font-crimson">{npc.descricao}</p>
                      {npc.personalidade && <p className="text-[var(--text3)] text-xs mt-1">Personalidade: {npc.personalidade}</p>}
                    </div>
                  ))}
                </div>
              </PainelGrimorio>
            )}

            {localSelecionado.encontros && localSelecionado.encontros.length > 0 && (
              <PainelGrimorio titulo="Encontros" compacto className="mb-3">
                <div className="space-y-2">
                  {localSelecionado.encontros.map((enc, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-[var(--bg3)] pb-1">
                      <span className="text-[var(--text)] font-crimson">{enc.quantidade}x {enc.nome}</span>
                      <span className="text-[var(--gold)] text-xs font-cinzel">CR {enc.cr}</span>
                    </div>
                  ))}
                </div>
              </PainelGrimorio>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
