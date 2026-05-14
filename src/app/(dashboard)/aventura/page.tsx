'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LocalAventura, Aventura } from '@/types/database'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { Search, Upload, Copy, ScrollText } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AventuraPage() {
  const [aventura, setAventura] = useState<Aventura | null>(null)
  const [locais, setLocais] = useState<LocalAventura[]>([])
  const [localSelecionado, setLocalSelecionado] = useState<LocalAventura | null>(null)
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      if (!campanhas?.[0]) { setCarregando(false); return }

      const { data: avs } = await supabase.from('aventuras').select('*').eq('campanha_id', campanhas[0].id).order('criado_em', { ascending: false }).limit(1)
      if (avs?.[0]) {
        setAventura(avs[0] as Aventura)
        const conteudo = avs[0].conteudo_json
        if (conteudo?.capitulos) {
          const todosLocais = conteudo.capitulos.flatMap((c: { locais?: LocalAventura[] }) => c.locais ?? [])
          setLocais(todosLocais)
        }
      }
    } finally {
      setCarregando(false)
    }
  }

  async function enviarAventura() {
    if (!arquivo) return
    setEnviando(true)
    try {
      const formData = new FormData()
      formData.append('arquivo', arquivo)

      const res = await fetch('/api/aventura/processar', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Erro ao processar')
      toast.success('Aventura processada com sucesso!')
      carregar()
    } catch {
      toast.error('Erro ao processar aventura')
    } finally {
      setEnviando(false)
    }
  }

  const locaisFiltrados = locais.filter(l =>
    busca === '' || l.nome.toLowerCase().includes(busca.toLowerCase()) || l.codigo.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="flex h-full">
      {/* Lista de locais */}
      <div className="w-72 border-r border-[#4a3060] flex flex-col">
        <div className="p-3 border-b border-[#4a3060] space-y-2">
          <p className="font-cinzel text-[#d4a843] text-xs uppercase tracking-wider">
            {aventura ? aventura.titulo : 'Aventura'}
          </p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8870a8]" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar local..." className="w-full input-dd pl-7 text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!aventura && !carregando ? (
            <div className="p-4 space-y-3">
              <p className="text-[#4a3060] text-xs text-center font-crimson">Nenhuma aventura carregada</p>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[#8870a8] text-xs font-cinzel uppercase">Upload PDF</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={e => setArquivo(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs text-[#8870a8] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-[#4a3060] file:bg-[#261a2e] file:text-[#d4a843] file:text-xs file:font-cinzel cursor-pointer"
                  />
                </label>
                {arquivo && (
                  <BotaoRunico variante="ouro" tamanho="sm" className="w-full" onClick={enviarAventura} carregando={enviando}>
                    <Upload className="w-3 h-3" /> Processar Aventura
                  </BotaoRunico>
                )}
              </div>
            </div>
          ) : carregando ? (
            <div className="p-4 text-center text-[#8870a8] text-sm">Carregando...</div>
          ) : locaisFiltrados.length === 0 ? (
            <div className="p-4 text-center text-[#4a3060] text-sm">Nenhum local encontrado</div>
          ) : (
            locaisFiltrados.map(local => (
              <button
                key={local.id}
                onClick={() => setLocalSelecionado(local)}
                className={`w-full text-left px-3 py-2 border-b border-[#1e1525] transition-colors ${localSelecionado?.id === local.id ? 'bg-[#261a2e]' : 'hover:bg-[#1e1525]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#d4a843] text-xs font-cinzel">{local.codigo}</span>
                  <span className="text-[#e8dff0] text-sm font-crimson flex-1 truncate">{local.nome}</span>
                </div>
                {local.capitulo && <p className="text-[#4a3060] text-[10px]">{local.capitulo}</p>}
              </button>
            ))
          )}
        </div>

        {aventura && (
          <div className="p-2 border-t border-[#4a3060]">
            <label className="block cursor-pointer">
              <div className="flex items-center gap-2 text-xs text-[#8870a8] hover:text-[#b8a8cc] transition-colors">
                <Upload className="w-3 h-3" /> Trocar aventura (PDF)
              </div>
              <input type="file" accept=".pdf" onChange={e => setArquivo(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
            {arquivo && (
              <BotaoRunico variante="ouro" tamanho="sm" className="w-full mt-1" onClick={enviarAventura} carregando={enviando}>
                Processar
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
              <ScrollText className="w-12 h-12 text-[#4a3060] mx-auto mb-3" />
              <p className="font-cinzel text-[#4a3060] text-lg mb-2">Selecione um local</p>
              <p className="text-[#4a3060] text-sm font-crimson">Escolha um local na lista para ver o texto narrativo</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-cinzel text-[#d4a843] text-sm bg-[#261a2e] border border-[#4a3060] px-2 py-0.5 rounded">
                    {localSelecionado.codigo}
                  </span>
                  {localSelecionado.capitulo && (
                    <span className="text-[#8870a8] text-xs">{localSelecionado.capitulo}</span>
                  )}
                </div>
                <h2 className="font-cinzel text-[#e8dff0] text-xl font-bold">{localSelecionado.nome}</h2>
              </div>
            </div>

            {/* Texto narrativo */}
            {localSelecionado.texto_narrativo && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-cinzel text-[#d4a843] text-xs uppercase tracking-wider flex items-center gap-1">
                    📜 Leia em Voz Alta
                  </span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(localSelecionado.texto_narrativo); toast.success('Copiado!') }}
                    className="text-[#8870a8] hover:text-[#d4a843] transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="bg-[#1e1525] border border-[#d4a843]/30 rounded p-4">
                  <p className="text-[#f0c060] font-crimson text-base leading-relaxed italic">
                    {localSelecionado.texto_narrativo}
                  </p>
                </div>
              </div>
            )}

            <DivisorOrnamentado />

            {/* Notas do DM */}
            {localSelecionado.notas_dm && (
              <PainelGrimorio titulo="Notas do Mestre" compacto className="mb-3">
                <p className="text-[#b8a8cc] font-crimson whitespace-pre-wrap leading-relaxed">{localSelecionado.notas_dm}</p>
              </PainelGrimorio>
            )}

            {/* NPCs */}
            {localSelecionado.npcs && localSelecionado.npcs.length > 0 && (
              <PainelGrimorio titulo="NPCs" compacto className="mb-3">
                <div className="space-y-3">
                  {localSelecionado.npcs.map((npc, i) => (
                    <div key={i} className="border-l-2 border-[#9b59b6] pl-3">
                      <p className="font-cinzel text-[#c39bd3] text-sm">{npc.nome}</p>
                      <p className="text-[#b8a8cc] text-sm font-crimson">{npc.descricao}</p>
                      {npc.personalidade && <p className="text-[#8870a8] text-xs mt-1">Personalidade: {npc.personalidade}</p>}
                    </div>
                  ))}
                </div>
              </PainelGrimorio>
            )}

            {/* Encontros */}
            {localSelecionado.encontros && localSelecionado.encontros.length > 0 && (
              <PainelGrimorio titulo="Encontros" compacto className="mb-3">
                <div className="space-y-2">
                  {localSelecionado.encontros.map((enc, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-[#1e1525] pb-1">
                      <span className="text-[#e8dff0] font-crimson">{enc.quantidade}x {enc.nome}</span>
                      <span className="text-[#d4a843] text-xs font-cinzel">CR {enc.cr}</span>
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
