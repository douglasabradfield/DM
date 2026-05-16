'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { EditorComMencoes } from '@/components/diario/EditorComMencoes'
import { TextoComMencoes } from '@/components/diario/TextoComMencoes'
import { useBatalha } from '@/store/batalha'
import { useCampanha } from '@/store/campanha'
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
  const { campanhaAtiva } = useCampanha()

  const carregar = useCallback(async () => {
    if (!campanhaAtiva) { setCarregando(false); return }
    setCarregando(true)
    try {
      const supabase = createClient()
      let query = supabase.from('diario_entradas').select('*').eq('campanha_id', campanhaAtiva.id)
      if (filtroTipo) query = query.eq('tipo', filtroTipo)
      const { data } = await query.order('criado_em', { ascending: false })
      setEntradas((data ?? []) as EntradaDiario[])
    } finally {
      setCarregando(false)
    }
  }, [campanhaAtiva, filtroTipo])

  useEffect(() => { carregar() }, [carregar])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    console.log('campanhaAtiva:', campanhaAtiva)
    if (!campanhaAtiva?.id) { toast.error('Selecione uma campanha ativa primeiro'); return }
    if (!conteudo.trim()) { toast.error('Preencha o conteúdo da entrada'); return }
    try {
      const supabase = createClient()
      const { error } = await supabase.from('diario_entradas').insert({
        campanha_id: campanhaAtiva.id,
        sessao_id: null,
        tipo,
        titulo: titulo.trim() || null,
        conteudo: conteudo.trim(),
        tags: [],
      })
      if (error) {
        console.error('Erro ao criar entrada:', error)
        toast.error(`Erro: ${error.message}`)
        return
      }
      toast.success('Entrada criada!')
      setCriando(false)
      setTitulo('')
      setConteudo('')
      carregar()
    } catch (err) {
      console.error('Exceção ao criar entrada:', err)
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
    if (!campanhaAtiva) { toast.error('Nenhuma campanha ativa selecionada'); return }
    try {
      const supabase = createClient()
      const resumo = log.map(e => `R${e.rodada}: ${e.descricao}`).join('\n')
      await supabase.from('diario_entradas').insert({
        campanha_id: campanhaAtiva.id,
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
          <h2 className="font-cinzel text-[var(--gold)] text-lg font-bold">Diário de Campanha</h2>
          <p className="text-[var(--text3)] text-sm font-crimson">{entradas.length} entradas registradas</p>
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
          className={`px-3 py-1 text-xs font-cinzel rounded border transition-colors ${filtroTipo === '' ? 'bg-[var(--surface)] border-[#d4a843] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text3)]'}`}
        >
          Todos
        </button>
        {(['nota', 'batalha', 'npc', 'item', 'plot'] as TipoEntrada[]).map(t => (
          <button
            key={t}
            onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1 text-xs font-cinzel rounded border transition-colors capitalize ${filtroTipo === t ? 'bg-[var(--surface)] border-[#d4a843] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text3)]'}`}
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
            <EditorComMencoes
              value={conteudo}
              onChange={setConteudo}
              rows={5}
              placeholder="Conteúdo da entrada... Use @Nome para mencionar personagens"
              className="w-full input-dd text-sm resize-y"
              campanhaId={campanhaAtiva?.id ?? null}
            />
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
            <div key={i} className="h-24 bg-[var(--bg2)] border border-[var(--border)] rounded animate-pulse" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12">
          <BookMarked className="w-12 h-12 text-[var(--border)] mx-auto mb-3" />
          <p className="font-cinzel text-[var(--border)] text-lg mb-2">Nenhuma entrada</p>
          <p className="text-[var(--border)] text-sm font-crimson">Registre eventos importantes da campanha</p>
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
                  <span className="text-[var(--border)] text-xs capitalize">{entrada.tipo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--border)] text-xs">
                    {format(new Date(entrada.criado_em), "d 'de' MMM, HH:mm", { locale: ptBR })}
                  </span>
                  <button onClick={() => excluir(entrada.id)} className="text-[var(--border)] hover:text-[var(--red2)] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <TextoComMencoes texto={entrada.conteudo} className="text-[var(--text2)] font-crimson text-sm whitespace-pre-wrap" />
            </PainelGrimorio>
          ))}
        </div>
      )}
    </div>
  )
}
