'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { useBatalha } from '@/store/batalha'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BookMarked, Plus, Trash2, Sword, Shield, ScrollText, Star, Map } from 'lucide-react'
import toast from 'react-hot-toast'

type TipoEntrada = 'nota' | 'batalha' | 'npc' | 'item' | 'plot'

interface EntradaDiario {
  id: string
  tipo: TipoEntrada
  titulo: string | null
  conteudo: string
  tags: string[]
  criado_em: string
  campanha_id: string
  sessao_id: string | null
}

const ICONES_TIPO: Record<TipoEntrada, React.ReactNode> = {
  nota: <ScrollText className="w-4 h-4" />,
  batalha: <Sword className="w-4 h-4" />,
  npc: <Shield className="w-4 h-4" />,
  item: <Star className="w-4 h-4" />,
  plot: <Map className="w-4 h-4" />,
}

const COR_TIPO: Record<TipoEntrada, string> = {
  nota: '#b8a8cc',
  batalha: '#e74c3c',
  npc: '#3498db',
  item: '#d4a843',
  plot: '#9b59b6',
}

export default function DiarioPage() {
  const [entradas, setEntradas] = useState<EntradaDiario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [tipo, setTipo] = useState<TipoEntrada>('nota')
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoEntrada | ''>('')
  const { log } = useBatalha()

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      if (!campanhas?.[0]) { setCarregando(false); return }

      let query = supabase.from('diario_entradas').select('*').eq('campanha_id', campanhas[0].id)
      if (filtroTipo) query = query.eq('tipo', filtroTipo)
      const { data } = await query.order('criado_em', { ascending: false })
      setEntradas((data ?? []) as EntradaDiario[])
    } finally {
      setCarregando(false)
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      if (!campanhas?.[0]) { toast.error('Sem campanha ativa'); return }

      const { error } = await supabase.from('diario_entradas').insert({
        campanha_id: campanhas[0].id,
        tipo,
        titulo: titulo || null,
        conteudo,
        tags: [],
      })
      if (error) throw error
      toast.success('Entrada criada!')
      setCriando(false)
      setTitulo('')
      setConteudo('')
      carregar()
    } catch {
      toast.error('Erro ao criar entrada')
    }
  }

  async function excluir(id: string) {
    try {
      const supabase = createClient()
      await supabase.from('diario_entradas').delete().eq('id', id)
      setEntradas(prev => prev.filter(e => e.id !== id))
      toast.success('Entrada excluída')
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  async function exportarLogBatalha() {
    if (log.length === 0) { toast.error('Nenhum log para exportar'); return }
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      if (!campanhas?.[0]) return

      const resumo = log.map(e => `R${e.rodada}: ${e.descricao}`).join('\n')
      await supabase.from('diario_entradas').insert({
        campanha_id: campanhas[0].id,
        tipo: 'batalha',
        titulo: `Log de Batalha — ${new Date().toLocaleDateString('pt-BR')}`,
        conteudo: resumo,
        tags: ['batalha', 'log'],
      })
      toast.success('Log exportado para o diário!')
      carregar()
    } catch {
      toast.error('Erro ao exportar log')
    }
  }

  const filtradas = filtroTipo ? entradas.filter(e => e.tipo === filtroTipo) : entradas

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-cinzel text-[#d4a843] text-lg font-bold">Diário de Campanha</h2>
          <p className="text-[#8870a8] text-sm font-crimson">{entradas.length} entradas registradas</p>
        </div>
        <div className="flex gap-2">
          {log.length > 0 && (
            <BotaoRunico variante="secundario" tamanho="sm" onClick={exportarLogBatalha}>
              <Sword className="w-3 h-3" /> Exportar Log de Batalha
            </BotaoRunico>
          )}
          <BotaoRunico variante="ouro" tamanho="sm" onClick={() => setCriando(true)}>
            <Plus className="w-3 h-3" /> Nova Entrada
          </BotaoRunico>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFiltroTipo('')}
          className={`px-3 py-1 text-xs font-cinzel rounded border transition-colors ${filtroTipo === '' ? 'bg-[#261a2e] border-[#d4a843] text-[#d4a843]' : 'border-[#4a3060] text-[#8870a8]'}`}
        >
          Todos
        </button>
        {(['nota', 'batalha', 'npc', 'item', 'plot'] as TipoEntrada[]).map(t => (
          <button
            key={t}
            onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1 text-xs font-cinzel rounded border transition-colors capitalize ${filtroTipo === t ? 'bg-[#261a2e] border-[#d4a843] text-[#d4a843]' : 'border-[#4a3060] text-[#8870a8]'}`}
          >
            {t === 'npc' ? 'NPC' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Formulário de criação */}
      {criando && (
        <PainelGrimorio titulo="Nova Entrada" ornamentado className="mb-4 max-w-2xl">
          <form onSubmit={criar} className="space-y-3">
            <div className="flex gap-2">
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoEntrada)} className="input-dd text-sm">
                <option value="nota">📝 Nota</option>
                <option value="batalha">⚔️ Batalha</option>
                <option value="npc">🛡️ NPC</option>
                <option value="item">⭐ Item</option>
                <option value="plot">🗺️ Plot</option>
              </select>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título (opcional)" className="flex-1 input-dd text-sm" />
            </div>
            <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Conteúdo da entrada..." rows={5} className="w-full input-dd text-sm resize-y" required />
            <div className="flex gap-2">
              <BotaoRunico type="submit" variante="ouro" tamanho="sm">Salvar</BotaoRunico>
              <BotaoRunico type="button" variante="fantasma" tamanho="sm" onClick={() => setCriando(false)}>Cancelar</BotaoRunico>
            </div>
          </form>
        </PainelGrimorio>
      )}

      {/* Entradas */}
      {carregando ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#150f18] border border-[#4a3060] rounded animate-pulse" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12">
          <BookMarked className="w-12 h-12 text-[#4a3060] mx-auto mb-3" />
          <p className="font-cinzel text-[#4a3060] text-lg mb-2">Nenhuma entrada</p>
          <p className="text-[#4a3060] text-sm font-crimson">Registre eventos importantes da campanha</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {filtradas.map(entrada => (
            <PainelGrimorio key={entrada.id} compacto>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: COR_TIPO[entrada.tipo] }}>{ICONES_TIPO[entrada.tipo]}</span>
                  {entrada.titulo && (
                    <span className="font-cinzel text-sm" style={{ color: COR_TIPO[entrada.tipo] }}>{entrada.titulo}</span>
                  )}
                  <span className="text-[#4a3060] text-xs capitalize">{entrada.tipo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#4a3060] text-xs">
                    {format(new Date(entrada.criado_em), "d 'de' MMM, HH:mm", { locale: ptBR })}
                  </span>
                  <button onClick={() => excluir(entrada.id)} className="text-[#4a3060] hover:text-[#e74c3c] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[#b8a8cc] font-crimson text-sm whitespace-pre-wrap">{entrada.conteudo}</p>
            </PainelGrimorio>
          ))}
        </div>
      )}
    </div>
  )
}
