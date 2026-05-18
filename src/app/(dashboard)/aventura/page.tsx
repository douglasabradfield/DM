'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { Upload, Copy, ScrollText, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface Local {
  codigo: string
  nome: string
  texto_narrativo: string
  notas_dm: string
  criaturas: string[]
  tesouros: string[]
  armadilhas: string[]
}

interface Capitulo {
  numero: number
  titulo_pt: string
  titulo_en: string
  plano: string
  nivel_recomendado: string
  resumo: string
  npcs: Array<{ nome: string; descricao: string }>
  locais: Local[]
}

interface ConteudoAventura {
  titulo: string
  titulo_original: string
  sistema: string
  nivel_recomendado: string
  numero_jogadores: string
  resumo_geral: string
  npcs_globais: Array<{ nome: string; papel: string; descricao: string; motivacao: string }>
  artefato_central?: { nome: string; descricao: string; fragmentos: string[] }
  mecanica_especial?: { nome: string; descricao: string }
  capitulos: Capitulo[]
}

export default function AventuraPage() {
  const { campanhaAtiva } = useCampanha()
  const router = useRouter()
  const [aventura, setAventura] = useState<ConteudoAventura | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [capSelecionado, setCapSelecionado] = useState<number>(1)
  const [localSelecionado, setLocalSelecionado] = useState<Local | null>(null)
  const [secao, setSecao] = useState<'capitulos' | 'npcs' | 'artefato'>('capitulos')
  const [buscaLocal, setBuscaLocal] = useState('')

  // Upload state
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState<'idle' | 'enviando' | 'processando'>('idle')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)

  useEffect(() => {
    if (!campanhaAtiva?.id) {
      setAventura(null)
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
      const { data, error } = await supabase
        .from('aventuras')
        .select('id, titulo, titulo_original, conteudo_json, processada')
        .eq('campanha_id', campanhaAtiva.id)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('aventura data:', data, 'erro:', error, 'campanhaId:', campanhaAtiva?.id)

      if (error) console.error('Erro ao carregar aventura:', error)

      if (data?.conteudo_json) {
        const conteudo = typeof data.conteudo_json === 'string'
          ? JSON.parse(data.conteudo_json)
          : data.conteudo_json
        setAventura(conteudo as ConteudoAventura)
        setCapSelecionado(1)
        setLocalSelecionado(null)
      } else {
        setAventura(null)
      }
    } finally {
      setCarregando(false)
    }
  }

  async function criarNpcComoPersonagem(npc: { nome: string; descricao: string }) {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    const { data: existente } = await supabase
      .from('personagens')
      .select('id')
      .eq('campanha_id', campanhaAtiva.id)
      .eq('nome', npc.nome)
      .maybeSingle()
    if (existente) {
      toast(`${npc.nome} já existe nos personagens!`, { icon: 'ℹ️' })
      return
    }
    const { error } = await supabase.from('personagens').insert({
      campanha_id: campanhaAtiva.id,
      nome: npc.nome,
      tipo_personagem: 'npc',
      tracos_personalidade: npc.descricao || '',
      forca: 10, destreza: 10, constituicao: 10,
      inteligencia: 10, sabedoria: 10, carisma: 10,
      nivel: 1, ca: 10, pv_maximo: 10, pv_atual: 10,
      bonus_proficiencia: 2,
      deslocamento: '9 m',
      ativo: true,
    })
    if (error) { toast.error('Erro ao criar personagem'); return }
    toast.success(`${npc.nome} criado como NPC!`)
  }

  function navegarParaMonstro(nomeCriatura: string) {
    router.push(`/bestiario?busca=${encodeURIComponent(nomeCriatura)}`)
  }

  async function apagarAventura() {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    const { error } = await supabase
      .from('aventuras')
      .delete()
      .eq('campanha_id', campanhaAtiva.id)
    if (error) { toast.error('Erro ao apagar aventura'); return }
    setAventura(null)
    setConfirmandoApagar(false)
    toast.success('Aventura apagada')
  }

  function getMimeType(arquivo: File): string {
    const ext = arquivo.name.split('.').pop()?.toLowerCase()
    const tipos: Record<string, string> = {
      'md':  'text/markdown',
      'txt': 'text/plain',
      'pdf': 'application/pdf',
    }
    return tipos[ext || ''] || arquivo.type || 'text/plain'
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

      const nomeArquivo = `${Date.now()}_${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storagePath = `${user.id}/${nomeArquivo}`
      const mimeType = getMimeType(arquivo)
      const { error: uploadError } = await supabase.storage
        .from('aventuras')
        .upload(storagePath, arquivo, { contentType: mimeType, upsert: true })
      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

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

  const capAtual = aventura?.capitulos.find(c => c.numero === capSelecionado)

  const locaisFiltrados = capAtual?.locais.filter(l =>
    !buscaLocal ||
    l.nome.toLowerCase().includes(buscaLocal.toLowerCase()) ||
    l.codigo.toLowerCase().includes(buscaLocal.toLowerCase()) ||
    l.criaturas?.some(cr => cr.toLowerCase().includes(buscaLocal.toLowerCase()))
  ) ?? []

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

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--text3)] font-cinzel animate-pulse">Carregando aventura...</p>
      </div>
    )
  }

  if (!aventura) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <p className="text-5xl">📖</p>
        <p className="text-[var(--text2)] font-cinzel text-lg">Nenhuma aventura carregada</p>
        <p className="text-[var(--text3)] text-sm text-center max-w-sm font-crimson">
          Faça upload de um arquivo .md, .pdf ou .txt para começar.
          A IA vai organizar locais, NPCs, encontros e mais.
        </p>
        <div className="w-full max-w-xs space-y-2 mt-2">
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
                ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Enviando...</>
                : progresso === 'processando'
                ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processando com IA...</>
                : <><Upload className="w-3 h-3" /> Processar Aventura</>}
            </BotaoRunico>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── SIDEBAR ─────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg2)] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-3 border-b border-[var(--border)]">
          <h2 className="font-cinzel text-[var(--gold)] text-sm font-bold leading-tight line-clamp-2">
            {aventura.titulo}
          </h2>
          {(aventura.nivel_recomendado || aventura.numero_jogadores) && (
            <p className="text-[var(--text3)] text-[10px] mt-0.5">
              {aventura.nivel_recomendado && `Nv ${aventura.nivel_recomendado}`}
              {aventura.nivel_recomendado && aventura.numero_jogadores && ' · '}
              {aventura.numero_jogadores && `${aventura.numero_jogadores} jogadores`}
            </p>
          )}
        </div>

        {/* Abas da sidebar */}
        <div className="flex border-b border-[var(--border)]">
          {([
            { id: 'capitulos', label: '📖', title: 'Capítulos' },
            { id: 'npcs',      label: '👥', title: 'NPCs Globais' },
            { id: 'artefato',  label: '✨', title: 'Artefato' },
          ] as const).map(s => (
            <button
              key={s.id}
              onClick={() => setSecao(s.id)}
              title={s.title}
              className={`flex-1 py-2 text-sm transition-colors ${
                secao === s.id
                  ? 'bg-[var(--accent)]/20 text-[var(--gold)]'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Lista de capítulos */}
        {secao === 'capitulos' && (
          <div className="flex-1 overflow-y-auto py-1">
            {aventura.capitulos.map(cap => (
              <button
                key={cap.numero}
                onClick={() => { setCapSelecionado(cap.numero); setLocalSelecionado(null); setBuscaLocal('') }}
                className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
                  capSelecionado === cap.numero
                    ? 'border-[var(--gold)] bg-[var(--surface)] text-[var(--gold)]'
                    : 'border-transparent text-[var(--text2)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
              >
                <p className="font-cinzel text-xs font-bold">Cap. {cap.numero}</p>
                <p className="text-[10px] text-[var(--text3)] leading-tight mt-0.5">
                  {(cap.titulo_pt ?? '').replace(/^Capítulo \d+:\s*/i, '').replace(/^Chapter \d+:\s*/i, '')}
                </p>
                {cap.plano && (
                  <p className="text-[9px] text-[var(--text3)]/60 mt-0.5">{cap.plano}</p>
                )}
              </button>
            ))}

            {/* Enriquecer / Apagar */}
            <div className="px-3 py-3 mt-1 border-t border-[var(--border)] space-y-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--text2)] text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors font-cinzel">
                ✨ Enriquecer com IA
                <input type="file" accept=".pdf,.md,.txt" onChange={e => setArquivo(e.target.files?.[0] ?? null)} className="hidden" />
              </label>
              {arquivo && (
                <BotaoRunico variante="ouro" tamanho="sm" className="w-full" onClick={enviarAventura} disabled={enviando}>
                  {progresso === 'enviando' ? 'Enviando...' : progresso === 'processando' ? 'Processando...' : 'Processar'}
                </BotaoRunico>
              )}
              {!confirmandoApagar ? (
                <button
                  onClick={() => setConfirmandoApagar(true)}
                  className="w-full px-3 py-1.5 border border-[var(--red2)]/30 text-[var(--red2)] text-xs rounded-lg hover:bg-[var(--red2)]/10 transition-colors font-cinzel"
                >
                  🗑️ Apagar aventura
                </button>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[var(--text3)] text-[10px] text-center font-cinzel">Confirmar apagar?</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={apagarAventura}
                      className="flex-1 py-1.5 bg-[var(--red2)] text-white text-xs rounded-lg hover:opacity-90 font-cinzel"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setConfirmandoApagar(false)}
                      className="flex-1 py-1.5 border border-[var(--border)] text-[var(--text2)] text-xs rounded-lg font-cinzel"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NPCs Globais */}
        {secao === 'npcs' && (
          <div className="flex-1 overflow-y-auto py-1">
            {aventura.npcs_globais?.length > 0 ? aventura.npcs_globais.map((npc, i) => (
              <div key={i} className="px-3 py-2.5 border-b border-[var(--border)]/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-cinzel text-[var(--text)] text-xs font-bold">{npc.nome}</p>
                    {npc.papel && (
                      <p className="text-[var(--accent)] text-[9px] uppercase tracking-wide mt-0.5">{npc.papel}</p>
                    )}
                    {npc.descricao && (
                      <p className="text-[var(--text3)] text-[10px] mt-1 leading-relaxed">{npc.descricao}</p>
                    )}
                    {npc.motivacao && (
                      <p className="text-[var(--text3)]/70 text-[10px] italic mt-1">💭 {npc.motivacao}</p>
                    )}
                  </div>
                  <button
                    onClick={() => criarNpcComoPersonagem({ nome: npc.nome, descricao: [npc.descricao, npc.motivacao && `Motivação: ${npc.motivacao}`].filter(Boolean).join(' | ') })}
                    title="Criar como personagem"
                    className="flex-shrink-0 w-6 h-6 rounded border border-[var(--border)] text-[var(--text3)] hover:text-[var(--gold)] hover:border-[var(--gold)] text-xs transition-all flex items-center justify-center"
                  >
                    ＋
                  </button>
                </div>
              </div>
            )) : (
              <p className="text-[var(--border)] text-xs text-center p-4 font-crimson">Nenhum NPC global</p>
            )}
          </div>
        )}

        {/* Artefato Central */}
        {secao === 'artefato' && (
          <div className="flex-1 overflow-y-auto p-3">
            {aventura.artefato_central ? (
              <>
                <p className="font-cinzel text-[var(--gold)] text-xs font-bold mb-2">
                  ✨ {aventura.artefato_central.nome}
                </p>
                <p className="text-[var(--text2)] text-xs leading-relaxed mb-3">
                  {aventura.artefato_central.descricao}
                </p>
                {aventura.artefato_central.fragmentos?.length > 0 && (
                  <>
                    <p className="font-cinzel text-[var(--text3)] text-[10px] uppercase mb-2">Fragmentos</p>
                    {aventura.artefato_central.fragmentos.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 mb-1.5">
                        <span className="text-[var(--gold)] text-xs mt-0.5 flex-shrink-0">◆</span>
                        <p className="text-[var(--text2)] text-[10px] leading-relaxed">{f}</p>
                      </div>
                    ))}
                  </>
                )}
                {aventura.mecanica_especial && (
                  <div className="mt-4 pt-3 border-t border-[var(--border)]">
                    <p className="font-cinzel text-[var(--gold)] text-xs font-bold mb-1">
                      🎲 {aventura.mecanica_especial.nome}
                    </p>
                    <p className="text-[var(--text2)] text-[10px] leading-relaxed">
                      {aventura.mecanica_especial.descricao}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[var(--border)] text-xs text-center font-crimson">Sem artefato central</p>
            )}
          </div>
        )}
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ───────────────────── */}
      <main className="flex-1 flex overflow-hidden">

        {/* Grid de locais */}
        {capAtual && !localSelecionado && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header do capítulo */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <h2 className="font-cinzel text-[var(--gold)] text-lg font-bold">
                {capAtual.titulo_pt}
              </h2>
              <p className="text-[var(--text3)] text-xs mt-1">
                {[capAtual.plano, capAtual.nivel_recomendado && `Nível ${capAtual.nivel_recomendado}`].filter(Boolean).join(' · ')}
              </p>
              {capAtual.resumo && (
                <p className="text-[var(--text2)] text-sm mt-2 leading-relaxed font-crimson">
                  {capAtual.resumo}
                </p>
              )}
              {capAtual.npcs && capAtual.npcs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {capAtual.npcs.map((npc, i) => (
                    <button
                      key={i}
                      onClick={() => criarNpcComoPersonagem(npc)}
                      title={`Criar ${npc.nome} como personagem`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-[var(--text2)] text-xs font-cinzel hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all group"
                    >
                      <span>👤</span>
                      <span>{npc.nome}</span>
                      <span className="text-[var(--text3)] group-hover:text-[var(--gold)] text-[10px]">＋</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Busca de locais */}
            <div className="px-4 py-2 border-b border-[var(--border)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
                <input
                  type="text"
                  value={buscaLocal}
                  onChange={e => setBuscaLocal(e.target.value)}
                  placeholder="Buscar local ou criatura..."
                  className="input-dd w-full pl-9 text-sm"
                />
              </div>
            </div>

            {/* Grid de locais */}
            <div className="flex-1 overflow-y-auto p-4">
              {locaisFiltrados.length === 0 ? (
                <p className="text-[var(--text3)] text-sm text-center py-8 font-crimson">
                  Nenhum local encontrado
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {locaisFiltrados.map((local, i) => (
                    <button
                      key={i}
                      onClick={() => setLocalSelecionado(local)}
                      className="text-left p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--gold)] hover:bg-[var(--surface2)] transition-all group"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        {local.codigo && (
                          <span className="font-cinzel text-[var(--gold)] text-xs font-bold bg-[var(--gold)]/10 px-1.5 py-0.5 rounded flex-shrink-0">
                            {local.codigo}
                          </span>
                        )}
                        <p className="font-cinzel text-[var(--text)] text-sm font-bold leading-tight group-hover:text-[var(--gold)] transition-colors">
                          {local.nome}
                        </p>
                      </div>

                      {local.criaturas && local.criaturas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {local.criaturas.slice(0, 3).map((cr, j) => (
                            <button
                              key={j}
                              onClick={e => { e.stopPropagation(); navegarParaMonstro(cr) }}
                              className="text-[9px] px-1.5 py-0.5 bg-[var(--red2)]/10 text-[var(--red2)] rounded border border-[var(--red2)]/30 hover:bg-[var(--red2)]/20 transition-colors"
                            >
                              ⚔️ {cr}
                            </button>
                          ))}
                          {local.criaturas.length > 3 && (
                            <span className="text-[9px] text-[var(--text3)] px-1">+{local.criaturas.length - 3}</span>
                          )}
                        </div>
                      )}

                      {local.texto_narrativo && (
                        <p className="text-[var(--text3)] text-[10px] italic leading-relaxed line-clamp-2 font-crimson">
                          &ldquo;{local.texto_narrativo.slice(0, 120)}{local.texto_narrativo.length > 120 ? '...' : ''}&rdquo;
                        </p>
                      )}

                      <div className="flex gap-1 mt-2">
                        {local.tesouros?.length > 0 && (
                          <span className="text-[9px] text-[var(--gold)] bg-[var(--gold)]/10 px-1.5 py-0.5 rounded">💰 Tesouro</span>
                        )}
                        {local.armadilhas?.length > 0 && (
                          <span className="text-[9px] text-[#f97316] bg-[#f97316]/10 px-1.5 py-0.5 rounded">⚠️ Armadilha</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detalhe do local */}
        {localSelecionado && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header do local */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-3">
              <button
                onClick={() => setLocalSelecionado(null)}
                className="text-[var(--text3)] hover:text-[var(--text)] transition-colors text-sm font-cinzel flex-shrink-0"
              >
                ← Voltar
              </button>
              {localSelecionado.codigo && (
                <span className="font-cinzel text-[var(--gold)] text-sm font-bold bg-[var(--gold)]/10 px-2 py-1 rounded flex-shrink-0">
                  {localSelecionado.codigo}
                </span>
              )}
              <h2 className="font-cinzel text-[var(--gold)] font-bold text-lg flex-1 min-w-0 truncate">
                {localSelecionado.nome}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-3xl space-y-4">

                {/* Texto narrativo */}
                {localSelecionado.texto_narrativo && (
                  <div className="bg-[var(--bg3)] border border-[var(--gold)]/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-cinzel text-[var(--gold)] text-[10px] uppercase tracking-wider">
                        📢 Leia em Voz Alta
                      </p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(localSelecionado.texto_narrativo); toast.success('Copiado!') }}
                        className="text-[var(--text3)] hover:text-[var(--gold)] transition-colors"
                        title="Copiar texto"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[var(--gold2)] font-crimson text-base leading-relaxed italic">
                      &ldquo;{localSelecionado.texto_narrativo}&rdquo;
                    </p>
                  </div>
                )}

                <DivisorOrnamentado />

                {/* Notas do DM */}
                {localSelecionado.notas_dm && (
                  <PainelGrimorio titulo="Notas do Mestre" compacto>
                    <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed text-sm">
                      {localSelecionado.notas_dm}
                    </p>
                  </PainelGrimorio>
                )}

                {/* Criaturas */}
                {localSelecionado.criaturas && localSelecionado.criaturas.length > 0 && (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                    <p className="font-cinzel text-[var(--text3)] text-[10px] uppercase tracking-wider mb-3">⚔️ Criaturas</p>
                    <div className="flex flex-wrap gap-2">
                      {localSelecionado.criaturas.map((cr, i) => (
                        <button
                          key={i}
                          onClick={() => navegarParaMonstro(cr)}
                          title={`Ver ${cr} no Bestiário`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--red2)]/10 border border-[var(--red2)]/30 text-[var(--red2)] text-xs rounded-lg font-cinzel capitalize hover:bg-[var(--red2)]/20 hover:border-[var(--red2)] transition-all"
                        >
                          ⚔️ {cr}
                          <span className="text-[var(--red2)]/60 text-[10px]">→</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[var(--text3)] text-[10px] mt-2 italic">Clique para ver no Bestiário e adicionar à batalha</p>
                  </div>
                )}

                {/* Tesouros */}
                {localSelecionado.tesouros && localSelecionado.tesouros.length > 0 && (
                  <PainelGrimorio titulo="💰 Tesouro" compacto>
                    <div className="space-y-1">
                      {localSelecionado.tesouros.map((t, i) => (
                        <p key={i} className="text-[var(--gold)] text-sm font-crimson leading-relaxed">{t}</p>
                      ))}
                    </div>
                  </PainelGrimorio>
                )}

                {/* Armadilhas */}
                {localSelecionado.armadilhas && localSelecionado.armadilhas.length > 0 && (
                  <div className="bg-[#f97316]/5 border border-[#f97316]/30 rounded-xl p-4">
                    <p className="font-cinzel text-[#f97316] text-[10px] uppercase tracking-wider mb-3">
                      ⚠️ Armadilhas
                    </p>
                    <div className="space-y-1">
                      {localSelecionado.armadilhas.map((a, i) => (
                        <p key={i} className="text-[var(--text2)] text-sm font-crimson">{a}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fallback: sem capítulo ou local */}
        {!capAtual && !localSelecionado && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ScrollText className="w-12 h-12 text-[var(--border)] mx-auto mb-3" />
              <p className="font-cinzel text-[var(--border)] text-lg mb-2">Selecione um capítulo</p>
              <p className="text-[var(--border)] text-sm font-crimson">
                Use a barra lateral para navegar pelos capítulos
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
