'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Spell } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoAdicionarPersonagem } from '@/components/ui/BotaoAdicionarPersonagem'
import { BotaoReportar } from '@/components/ui/BotaoReportar'
import { BloqueioPlano } from '@/components/ui/BloqueioPlano'
import { Search, Plus, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPlano } from '@/lib/planos'
import toast from 'react-hot-toast'

const ESCOLAS = ['Abjuração', 'Adivinhação', 'Conjuração', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação']
const CLASSES = ['Bardo', 'Clérigo', 'Druida', 'Feiticeiro', 'Guardião', 'Mago', 'Paladino', 'Bruxo', 'Artífice']

const COR_ESCOLA: Record<string, string> = {
  'Abjuração': 'var(--accent2)',
  'Adivinhação': 'var(--gold)',
  'Conjuração': 'var(--accent)',
  'Encantamento': '#e91e63',
  'Evocação': 'var(--red2)',
  'Ilusão': 'var(--green2)',
  'Necromancia': '#6d2b8f',
  'Transmutação': 'var(--green2)',
}

type SpellStub = Pick<Spell, 'id' | 'slug' | 'name_pt' | 'name_en' | 'level' | 'school_pt' | 'casting_time_pt' | 'classes_pt' | 'concentration' | 'ritual'>

interface MagiaPersonalizada {
  id: string
  nome: string
  dados: {
    nivel: number
    escola: string
    tempo_conjuracao: string
    alcance: string
    componentes: string
    duracao: string
    descricao: string
  }
}

function AbaPersonalizadoMagias({ userId }: { userId: string }) {
  const [lista, setLista] = useState<MagiaPersonalizada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionada, setSelecionada] = useState<MagiaPersonalizada | null>(null)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    nome: '', nivel: 0, escola: 'Evocação',
    tempo_conjuracao: '1 ação', alcance: '18 metros',
    componentes: 'V, S', duracao: 'Instantânea', descricao: '',
  })

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('conteudo_personalizado')
        .select('id, nome, dados')
        .eq('user_id', userId)
        .eq('tipo', 'magia')
        .order('nome')
      setLista((data ?? []) as MagiaPersonalizada[])
      setCarregando(false)
    }
    carregar()
  }, [userId])

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('conteudo_personalizado').insert({
        user_id: userId,
        tipo: 'magia',
        nome: form.nome.trim(),
        dados: {
          nivel: form.nivel, escola: form.escola,
          tempo_conjuracao: form.tempo_conjuracao, alcance: form.alcance,
          componentes: form.componentes, duracao: form.duracao, descricao: form.descricao,
        },
        publico: false,
      }).select('id, nome, dados').single()
      if (error) throw error
      setLista(l => [...l, data as MagiaPersonalizada].sort((a, b) => a.nome.localeCompare(b.nome)))
      setModalAberto(false)
      setForm({ nome: '', nivel: 0, escola: 'Evocação', tempo_conjuracao: '1 ação', alcance: '18 metros', componentes: 'V, S', duracao: 'Instantânea', descricao: '' })
      toast.success(`Magia "${form.nome.trim()}" criada!`)
    } catch {
      toast.error('Erro ao salvar magia')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir a magia "${nome}"?`)) return
    const supabase = createClient()
    await supabase.from('conteudo_personalizado').delete().eq('id', id)
    setLista(l => l.filter(m => m.id !== id))
    if (selecionada?.id === id) { setSelecionada(null); setVisao('lista') }
    toast.success('Magia excluída')
  }

  return (
    <>
      <div className="flex flex-col md:flex-row h-full gap-0 md:gap-4">
        <div className={cn(
          "flex flex-col w-full md:w-72 overflow-y-auto border-r border-[var(--border)]",
          visao === 'detalhe' ? "hidden md:flex" : "flex"
        )}>
          <div className="p-3 border-b border-[var(--border)]">
            <button
              onClick={() => setModalAberto(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Criar Nova Magia
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando...</div>
            ) : lista.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[var(--border)] text-sm font-cinzel mb-1">Nenhuma magia personalizada</p>
                <p className="text-[var(--text3)] text-xs font-crimson">Crie suas próprias magias homebrew</p>
              </div>
            ) : (
              lista.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelecionada(m); setVisao('detalhe') }}
                  className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${selecionada?.id === m.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">{m.nome}</span>
                    <span className="text-xs text-[var(--dd-text2)] truncate">
                      {m.dados.escola} · {m.dados.nivel === 0 ? 'Truque' : `${m.dados.nivel}º Nível`}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="p-2 border-t border-[var(--border)] text-center">
            <p className="text-[var(--text3)] text-xs font-cinzel">{lista.length} magia(s) personalizada(s)</p>
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto p-4", visao === 'lista' ? "hidden md:block" : "block")}>
          <button onClick={() => setVisao('lista')} className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)] hover:text-[var(--dd-text)] mb-4 transition-colors">
            ← Voltar às Magias
          </button>
          {!selecionada ? (
            <div className="h-full flex items-center justify-center">
              <p className="font-cinzel text-[var(--border)]">Selecione uma magia para ver detalhes</p>
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-cinzel text-[var(--accent2)] text-2xl font-bold">{selecionada.nome}</h2>
                  <p className="text-[var(--text2)] text-sm mt-1">
                    {selecionada.dados.nivel === 0 ? 'Truque de ' : `Magia de ${selecionada.dados.nivel}º nível de `}
                    <span style={{ color: COR_ESCOLA[selecionada.dados.escola] ?? 'var(--text3)' }}>{selecionada.dados.escola}</span>
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">✨ Personalizada</span>
                </div>
                <button
                  onClick={() => excluir(selecionada.id, selecionada.nome)}
                  className="p-2 text-[var(--red2)] hover:bg-[var(--red2)]/10 rounded transition-colors"
                  title="Excluir magia"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <PainelGrimorio compacto className="mb-3">
                <div className="grid grid-cols-2 gap-2 text-sm font-crimson">
                  <div><span className="text-[var(--text3)] font-cinzel text-xs">Tempo: </span><span className="text-[var(--text)]">{selecionada.dados.tempo_conjuracao}</span></div>
                  <div><span className="text-[var(--text3)] font-cinzel text-xs">Alcance: </span><span className="text-[var(--text)]">{selecionada.dados.alcance}</span></div>
                  <div><span className="text-[var(--text3)] font-cinzel text-xs">Componentes: </span><span className="text-[var(--text)]">{selecionada.dados.componentes}</span></div>
                  <div><span className="text-[var(--text3)] font-cinzel text-xs">Duração: </span><span className="text-[var(--text)]">{selecionada.dados.duracao}</span></div>
                </div>
              </PainelGrimorio>
              {selecionada.dados.descricao && (
                <PainelGrimorio titulo="Descrição" compacto>
                  <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionada.dados.descricao}</p>
                </PainelGrimorio>
              )}
            </div>
          )}
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="font-cinzel text-[var(--accent2)] font-bold">✨ Nova Magia</h2>
              <button onClick={() => setModalAberto(false)} className="text-[var(--border)] hover:text-[var(--red2)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nome da Magia *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Bola de Fogo Aprimorada..." className="w-full input-dd mt-1" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nível</label>
                  <select value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: parseInt(e.target.value) }))} className="w-full input-dd mt-1 text-sm">
                    <option value={0}>Truque</option>
                    {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}º Nível</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Escola</label>
                  <select value={form.escola} onChange={e => setForm(f => ({ ...f, escola: e.target.value }))} className="w-full input-dd mt-1 text-sm">
                    {ESCOLAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Tempo de Conjuração</label>
                  <input type="text" value={form.tempo_conjuracao} onChange={e => setForm(f => ({ ...f, tempo_conjuracao: e.target.value }))} className="w-full input-dd mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Alcance</label>
                  <input type="text" value={form.alcance} onChange={e => setForm(f => ({ ...f, alcance: e.target.value }))} className="w-full input-dd mt-1 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Componentes</label>
                  <input type="text" value={form.componentes} onChange={e => setForm(f => ({ ...f, componentes: e.target.value }))} className="w-full input-dd mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Duração</label>
                  <input type="text" value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))} className="w-full input-dd mt-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={4} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Descreva os efeitos da magia..." />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setModalAberto(false)} className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors">Cancelar</button>
                <button
                  onClick={salvar}
                  disabled={!form.nome.trim() || salvando}
                  className="px-3 py-1.5 text-xs font-cinzel text-[var(--accent2)] bg-[var(--surface)] border border-[var(--accent2)]/50 rounded hover:bg-[var(--accent2)]/10 transition-colors disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Criar Magia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function MagiasCliente() {
  const [userPlano, setUserPlano] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [aba, setAba] = useState<'oficial' | 'personalizado'>('oficial')
  const [lista, setLista] = useState<SpellStub[]>([])
  const [selecionada, setSelecionada] = useState<Spell | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [busca, setBusca] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<number | ''>('')
  const [filtroEscola, setFiltroEscola] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setUserPlano('free'); return }
      setUserId(user.id)
      supabase.from('profiles').select('plano').eq('id', user.id).single()
        .then(({ data }) => setUserPlano(data?.plano ?? 'free'))
    })
  }, [])

  useEffect(() => {
    if (!userPlano || !getPlano(userPlano).limites.magias_itens) return
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('spells')
        .select('id, slug, name_pt, name_en, level, school_pt, casting_time_pt, classes_pt, concentration, ritual')
        .order('level')
        .order('name_pt')
      setLista((data ?? []) as SpellStub[])
      setCarregando(false)
    }
    carregar()
  }, [userPlano])

  async function selecionarMagia(stub: SpellStub) {
    if (selecionada?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('spells').select('*').eq('id', stub.id).single()
    setSelecionada(data as Spell)
    setCarregandoDetalhe(false)
    setVisao('detalhe')
  }

  const filtradas = useMemo(() => lista.filter(m => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!m.name_pt.toLowerCase().includes(q) && !m.name_en.toLowerCase().includes(q)) return false
    }
    if (filtroNivel !== '' && m.level !== filtroNivel) return false
    if (filtroEscola && m.school_pt !== filtroEscola) return false
    if (filtroClasse && !m.classes_pt?.toLowerCase().includes(filtroClasse.toLowerCase())) return false
    return true
  }), [lista, busca, filtroNivel, filtroEscola, filtroClasse])

  const corEscola = (escola: string | null) => COR_ESCOLA[escola ?? ''] ?? 'var(--text3)'

  if (userPlano === null) return null

  const plano = getPlano(userPlano)

  if (!plano.limites.magias_itens) {
    return <BloqueioPlano recurso="Magias" planoNecessario="Herói" />
  }

  return (
    <div className="flex flex-col h-full">
      {plano.limites.conteudo_personalizado && (
        <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex">
          <button
            onClick={() => setAba('oficial')}
            className={`px-4 py-2 text-xs font-cinzel border-b-2 transition-colors ${aba === 'oficial' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'}`}
          >
            📖 Oficial
          </button>
          <button
            onClick={() => setAba('personalizado')}
            className={`px-4 py-2 text-xs font-cinzel border-b-2 transition-colors ${aba === 'personalizado' ? 'border-[var(--accent2)] text-[var(--accent2)]' : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'}`}
          >
            ✨ Personalizado
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {aba === 'personalizado' && userId ? (
          <AbaPersonalizadoMagias userId={userId} />
        ) : (
          <div className="flex flex-col md:flex-row h-full gap-0 md:gap-4">
            <div className={cn(
              "flex flex-col gap-4 w-full md:w-72 overflow-y-auto border-r border-[var(--border)]",
              visao === 'detalhe' ? "hidden md:flex" : "flex"
            )}>
              <div className="p-3 border-b border-[var(--border)] space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
                  <input
                    type="text"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar magia (PT ou EN)..."
                    className="w-full input-dd pl-9 text-sm"
                  />
                </div>
                <div className="flex gap-1">
                  <select
                    value={filtroNivel}
                    onChange={e => setFiltroNivel(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="flex-1 input-dd text-xs"
                  >
                    <option value="">Nível</option>
                    <option value={0}>Truque</option>
                    {Array.from({ length: 9 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}º Nível</option>
                    ))}
                  </select>
                  <select
                    value={filtroEscola}
                    onChange={e => setFiltroEscola(e.target.value)}
                    className="flex-1 input-dd text-xs"
                  >
                    <option value="">Escola</option>
                    {ESCOLAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <select
                  value={filtroClasse}
                  onChange={e => setFiltroClasse(e.target.value)}
                  className="w-full input-dd text-xs"
                >
                  <option value="">Todas as classes</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto">
                {carregando ? (
                  <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando magias...</div>
                ) : filtradas.length === 0 ? (
                  <div className="p-4 text-center text-[var(--border)] text-sm">Nenhuma magia encontrada</div>
                ) : (
                  filtradas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => selecionarMagia(m)}
                      className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${
                        selecionada?.id === m.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">
                          {m.name_pt}
                        </span>
                        <span className="text-xs text-[var(--dd-text2)] truncate">
                          {m.school_pt} · Nível {m.level}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-[var(--border)] text-center">
                <p className="text-[var(--text3)] text-xs font-cinzel">{filtradas.length} de {lista.length} magia(s)</p>
              </div>
            </div>

            <div className={cn(
              "flex-1 overflow-y-auto p-4",
              visao === 'lista' ? "hidden md:block" : "block"
            )}>
              <button
                onClick={() => setVisao('lista')}
                className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)] hover:text-[var(--dd-text)] mb-4 transition-colors"
              >
                ← Voltar às Magias
              </button>
              {carregandoDetalhe ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[var(--text3)] font-cinzel animate-pulse">Carregando detalhes...</p>
                </div>
              ) : !selecionada ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-cinzel text-[var(--border)]">Selecione uma magia para ver detalhes</p>
                </div>
              ) : (
                <div className="max-w-2xl">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-cinzel text-[var(--accent2)] text-2xl font-bold">{selecionada.name_pt}</h2>
                      <p className="text-[var(--border)] text-sm italic">{selecionada.name_en}</p>
                      <p className="text-[var(--text2)] text-sm mt-1">
                        {selecionada.level === 0 ? 'Truque de ' : `Magia de ${selecionada.level}º nível de `}
                        <span style={{ color: corEscola(selecionada.school_pt) }}>{selecionada.school_pt}</span>
                      </p>
                      <div className="flex gap-2 mt-1">
                        {selecionada.concentration && (
                          <span className="text-[10px] px-1.5 py-0.5 border border-[var(--gold)] text-[var(--gold)] rounded font-cinzel">Concentração</span>
                        )}
                        {selecionada.ritual && (
                          <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">Ritual</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BotaoReportar
                        itemSlug={selecionada.slug}
                        itemNome={selecionada.name_pt}
                        itemTipo="magia"
                        pagina="/magias"
                      />
                      <BotaoAdicionarPersonagem
                        tipo="magia"
                        nome={selecionada.name_pt}
                        dadosExtras={{ spell_id: selecionada.id, nivel: selecionada.level, escola: selecionada.school_pt }}
                      />
                    </div>
                  </div>

                  <PainelGrimorio compacto className="mb-3">
                    <div className="grid grid-cols-2 gap-2 text-sm font-crimson">
                      <div><span className="text-[var(--text3)] font-cinzel text-xs">Tempo: </span><span className="text-[var(--text)]">{selecionada.casting_time_pt}</span></div>
                      <div><span className="text-[var(--text3)] font-cinzel text-xs">Alcance: </span><span className="text-[var(--text)]">{selecionada.range_pt}</span></div>
                      <div><span className="text-[var(--text3)] font-cinzel text-xs">Componentes: </span><span className="text-[var(--text)]">{selecionada.components_pt}</span></div>
                      <div><span className="text-[var(--text3)] font-cinzel text-xs">Duração: </span><span className="text-[var(--text)]">{selecionada.duration_pt}</span></div>
                    </div>
                  </PainelGrimorio>

                  <PainelGrimorio titulo="Descrição" compacto className="mb-3">
                    <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionada.description_pt}</p>
                  </PainelGrimorio>

                  {selecionada.classes_pt && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selecionada.classes_pt.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                        <span key={c} className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-xs rounded font-crimson">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
