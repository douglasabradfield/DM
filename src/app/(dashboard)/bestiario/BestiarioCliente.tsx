'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Monster } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { useBatalha } from '@/store/batalha'
import { calcularModificadorAtributo, formatarModificador, cn } from '@/lib/utils'
import { Search, Swords, Plus, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { BotaoReportar } from '@/components/ui/BotaoReportar'
import { getPlano } from '@/lib/planos'

const CRS = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '23', '24', '30']

type MonsterStub = Pick<Monster, 'id' | 'slug' | 'name_pt' | 'name_en' | 'type_pt' | 'challenge_rating' | 'armor_class' | 'hit_points'>

interface MonstroPersonalizado {
  id: string
  nome: string
  dados: {
    tipo: string
    cr: string
    ca: number
    pv: number
    forca: number
    destreza: number
    constituicao: number
    inteligencia: number
    sabedoria: number
    carisma: number
    habilidades: string
    acoes: string
    descricao: string
  }
}

const FORM_INICIAL = {
  nome: '', tipo: 'Humanóide', cr: '1',
  ca: 12, pv: 10,
  forca: 10, destreza: 10, constituicao: 10,
  inteligencia: 10, sabedoria: 10, carisma: 10,
  habilidades: '', acoes: '', descricao: '',
}

function AbaPersonalizadoBestiario({ userId }: { userId: string }) {
  const [lista, setLista] = useState<MonstroPersonalizado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<MonstroPersonalizado | null>(null)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const { adicionarCombatente } = useBatalha()

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('conteudo_personalizado')
        .select('id, nome, dados')
        .eq('user_id', userId)
        .eq('tipo', 'monstro')
        .order('nome')
      setLista((data ?? []) as MonstroPersonalizado[])
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
        tipo: 'monstro',
        nome: form.nome.trim(),
        dados: {
          tipo: form.tipo, cr: form.cr, ca: form.ca, pv: form.pv,
          forca: form.forca, destreza: form.destreza, constituicao: form.constituicao,
          inteligencia: form.inteligencia, sabedoria: form.sabedoria, carisma: form.carisma,
          habilidades: form.habilidades, acoes: form.acoes, descricao: form.descricao,
        },
        publico: false,
      }).select('id, nome, dados').single()
      if (error) throw error
      setLista(l => [...l, data as MonstroPersonalizado].sort((a, b) => a.nome.localeCompare(b.nome)))
      setModalAberto(false)
      setForm(FORM_INICIAL)
      toast.success(`Monstro "${form.nome.trim()}" criado!`)
    } catch {
      toast.error('Erro ao salvar monstro')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o monstro "${nome}"?`)) return
    const supabase = createClient()
    await supabase.from('conteudo_personalizado').delete().eq('id', id)
    setLista(l => l.filter(m => m.id !== id))
    if (selecionado?.id === id) { setSelecionado(null); setVisao('lista') }
    toast.success('Monstro excluído')
  }

  function adicionarNaBatalha(m: MonstroPersonalizado) {
    adicionarCombatente({
      personagem_id: null,
      nome: m.nome,
      tipo: 'monstro',
      iniciativa: 0,
      ca: m.dados.ca || 10,
      pv_maximo: m.dados.pv || 1,
      pv_atual: m.dados.pv || 1,
      pv_temporarios: 0,
      ausente: false,
      morto: false,
      condicoes: [],
      resistencias: [],
      imunidades: [],
      vulnerabilidades: [],
      espacos_magia: {},
      notas: '',
      dados_monstro: {
        cr: m.dados.cr,
        tipo: m.dados.tipo,
        habilidades: m.dados.habilidades,
        acoes: m.dados.acoes,
        forca: m.dados.forca,
        destreza: m.dados.destreza,
        constituicao: m.dados.constituicao,
        inteligencia: m.dados.inteligencia,
        sabedoria: m.dados.sabedoria,
        carisma: m.dados.carisma,
        xp: undefined,
        slug: m.id,
      },
      ordem: 999,
    })
    toast.success(`${m.nome} adicionado à batalha!`)
  }

  const atrs = selecionado ? [
    { label: 'FOR', val: selecionado.dados.forca },
    { label: 'DES', val: selecionado.dados.destreza },
    { label: 'CON', val: selecionado.dados.constituicao },
    { label: 'INT', val: selecionado.dados.inteligencia },
    { label: 'SAB', val: selecionado.dados.sabedoria },
    { label: 'CAR', val: selecionado.dados.carisma },
  ] : []

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <div className={cn(
          "flex flex-col border-r border-[var(--bg3)] overflow-y-auto w-full md:w-80",
          visao === 'detalhe' ? "hidden md:flex" : "flex"
        )}>
          <div className="p-3 border-b border-[var(--border)]">
            <button
              onClick={() => setModalAberto(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Criar Novo Monstro
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando...</div>
            ) : lista.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[var(--border)] text-sm font-cinzel mb-1">Nenhum monstro personalizado</p>
                <p className="text-[var(--text3)] text-xs font-crimson">Crie seus próprios monstros homebrew</p>
              </div>
            ) : (
              lista.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelecionado(m); setVisao('detalhe') }}
                  className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${selecionado?.id === m.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">{m.nome}</span>
                    <span className="text-xs text-[var(--dd-text2)] truncate">{m.dados.tipo} · CR {m.dados.cr}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="p-2 border-t border-[var(--border)] text-center">
            <p className="text-[var(--text3)] text-xs font-cinzel">{lista.length} monstro(s) personalizado(s)</p>
          </div>
        </div>

        <div className={cn(
          "overflow-y-auto p-4 md:p-6 bg-[var(--bg)] w-full md:flex-1",
          visao === 'lista' ? "hidden md:block" : "block"
        )}>
          <button onClick={() => setVisao('lista')} className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)] hover:text-[var(--dd-text)] mb-4 transition-colors">
            ← Voltar ao Bestiário
          </button>
          {!selecionado ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="font-cinzel text-[var(--border)] text-xl mb-2">Selecione um monstro</p>
                <p className="text-[var(--border)] text-sm font-crimson">Clique em um monstro da lista para ver seus detalhes</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold leading-tight">{selecionado.nome}</h2>
                  <p className="text-[var(--text2)] text-sm mt-1">{selecionado.dados.tipo} · CR {selecionado.dados.cr}</p>
                  <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">✨ Personalizado</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => excluir(selecionado.id, selecionado.nome)}
                    className="p-2 text-[var(--red2)] hover:bg-[var(--red2)]/10 rounded transition-colors"
                    title="Excluir monstro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => adicionarNaBatalha(selecionado)}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] border border-[var(--accent2)] text-[var(--bg)] rounded text-sm font-cinzel hover:opacity-90 transition-colors"
                  >
                    <Swords className="w-4 h-4" /> Adicionar à Batalha
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <PainelGrimorio compacto className="text-center">
                  <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Classe de Armadura</div>
                  <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.dados.ca}</div>
                </PainelGrimorio>
                <PainelGrimorio compacto className="text-center">
                  <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Pontos de Vida</div>
                  <div className="text-[var(--green2)] text-xl font-cinzel font-bold">{selecionado.dados.pv}</div>
                </PainelGrimorio>
                <PainelGrimorio compacto className="text-center">
                  <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Nível de Desafio</div>
                  <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.dados.cr}</div>
                </PainelGrimorio>
              </div>

              <PainelGrimorio titulo="Atributos" compacto className="mb-3">
                <div className="grid grid-cols-6 gap-2 text-center">
                  {atrs.map(({ label, val }) => {
                    const mod = calcularModificadorAtributo(val)
                    return (
                      <div key={label} className="bg-[var(--bg3)] rounded p-2">
                        <div className="text-[var(--text3)] text-[9px] font-cinzel">{label}</div>
                        <div className="text-[var(--text)] font-bold">{val}</div>
                        <div className="text-[var(--text2)] text-xs">{formatarModificador(mod)}</div>
                      </div>
                    )
                  })}
                </div>
              </PainelGrimorio>

              {selecionado.dados.habilidades && (
                <PainelGrimorio titulo="Habilidades Especiais" compacto className="mb-3">
                  <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.habilidades}</p>
                </PainelGrimorio>
              )}
              {selecionado.dados.acoes && (
                <PainelGrimorio titulo="Ações" compacto className="mb-3">
                  <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.acoes}</p>
                </PainelGrimorio>
              )}
              {selecionado.dados.descricao && (
                <PainelGrimorio titulo="Descrição" compacto>
                  <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.descricao}</p>
                </PainelGrimorio>
              )}
            </div>
          )}
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="font-cinzel text-[var(--gold)] font-bold">✨ Novo Monstro</h2>
              <button onClick={() => setModalAberto(false)} className="text-[var(--border)] hover:text-[var(--red2)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nome *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Goblin das Sombras..." className="w-full input-dd mt-1" autoFocus />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Tipo</label>
                  <input type="text" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="w-full input-dd mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">CR</label>
                  <input type="text" value={form.cr} onChange={e => setForm(f => ({ ...f, cr: e.target.value }))} className="w-full input-dd mt-1 text-sm" placeholder="1" />
                </div>
                <div></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Classe de Armadura</label>
                  <input type="number" min={0} max={30} value={form.ca} onChange={e => setForm(f => ({ ...f, ca: parseInt(e.target.value) || 0 }))} className="w-full input-dd mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Pontos de Vida</label>
                  <input type="number" min={1} value={form.pv} onChange={e => setForm(f => ({ ...f, pv: parseInt(e.target.value) || 1 }))} className="w-full input-dd mt-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Atributos</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([
                    { key: 'forca',        label: 'FOR' },
                    { key: 'destreza',     label: 'DES' },
                    { key: 'constituicao', label: 'CON' },
                    { key: 'inteligencia', label: 'INT' },
                    { key: 'sabedoria',    label: 'SAB' },
                    { key: 'carisma',      label: 'CAR' },
                  ] as const).map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[var(--text3)] text-[9px] font-cinzel">{label}</label>
                      <input
                        type="number" min={1} max={30}
                        value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 10 }))}
                        className="w-full input-dd mt-0.5 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Habilidades Especiais</label>
                <textarea value={form.habilidades} onChange={e => setForm(f => ({ ...f, habilidades: e.target.value }))} rows={3} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Visão no Escuro. Este monstro..." />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Ações</label>
                <textarea value={form.acoes} onChange={e => setForm(f => ({ ...f, acoes: e.target.value }))} rows={3} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Mordida. Ataque corpo a corpo..." />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Lore e aparência do monstro..." />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setModalAberto(false)} className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors">Cancelar</button>
                <button
                  onClick={salvar}
                  disabled={!form.nome.trim() || salvando}
                  className="px-3 py-1.5 text-xs font-cinzel text-[var(--gold)] bg-[var(--surface)] border border-[#d4a843]/50 rounded hover:bg-[#d4a843]/10 transition-colors disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Criar Monstro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function BestiarioCliente() {
  const [lista, setLista] = useState<MonsterStub[]>([])
  const [selecionado, setSelecionado] = useState<Monster | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [busca, setBusca] = useState('')
  const [filtroCR, setFiltroCR] = useState('')
  const [userPlano, setUserPlano] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [aba, setAba] = useState<'oficial' | 'personalizado'>('oficial')
  const { adicionarCombatente } = useBatalha()
  const router = useRouter()

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
    const params = new URLSearchParams(window.location.search)
    const slugParam = params.get('q')
    const buscaParam = params.get('busca')
    if (slugParam) setBusca(slugParam)
    else if (buscaParam) setBusca(buscaParam)
  }, [])

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('monsters')
        .select('id, slug, name_pt, name_en, type_pt, challenge_rating, armor_class, hit_points')
        .order('name_pt')
      setLista((data ?? []) as MonsterStub[])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionarMonstro(stub: MonsterStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('monsters').select('*').eq('id', stub.id).single()
    setSelecionado(data as Monster)
    setCarregandoDetalhe(false)
    setVisao('detalhe')
  }

  const filtrados = useMemo(() => lista.filter(m => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!m.name_pt.toLowerCase().includes(q) && !m.name_en.toLowerCase().includes(q)) return false
    }
    if (filtroCR && m.challenge_rating !== filtroCR) return false
    return true
  }), [lista, busca, filtroCR])

  function adicionarNaBatalha(m: Monster) {
    adicionarCombatente({
      personagem_id: null,
      nome: m.name_pt,
      tipo: 'monstro',
      iniciativa: 0,
      ca: m.armor_class,
      pv_maximo: m.hit_points,
      pv_atual: m.hit_points,
      pv_temporarios: 0,
      ausente: false,
      morto: false,
      condicoes: [],
      resistencias: [],
      imunidades: [],
      vulnerabilidades: [],
      espacos_magia: {},
      notas: '',
      dados_monstro: {
        cr: m.challenge_rating,
        tipo: m.type_pt ?? '',
        habilidades: m.traits_rules_pt || m.traits_pt || '',
        acoes: m.actions_rules_pt || m.actions_pt || '',
        forca: m.str_score,
        destreza: m.dex_score,
        constituicao: m.con_score,
        inteligencia: m.int_score,
        sabedoria: m.wis_score,
        carisma: m.cha_score,
        xp: m.xp ?? undefined,
        slug: m.slug,
      },
      ordem: 999,
    })
    toast.success(`${m.name_pt} adicionado à batalha!`)
  }

  const atrs = selecionado ? [
    { label: 'FOR', val: selecionado.str_score },
    { label: 'DES', val: selecionado.dex_score },
    { label: 'CON', val: selecionado.con_score },
    { label: 'INT', val: selecionado.int_score },
    { label: 'SAB', val: selecionado.wis_score },
    { label: 'CAR', val: selecionado.cha_score },
  ] : []

  const plano = userPlano ? getPlano(userPlano) : null
  const mostrarPersonalizado = plano?.limites.conteudo_personalizado ?? false

  return (
    <div className="flex flex-col h-full">
      {mostrarPersonalizado && (
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
          <AbaPersonalizadoBestiario userId={userId} />
        ) : (
          <div className="flex h-full overflow-hidden">
            <div className={cn(
              "flex flex-col border-r border-[var(--bg3)] overflow-y-auto",
              "w-full md:w-80",
              visao === 'detalhe' ? "hidden md:flex" : "flex"
            )}>
              <div className="p-3 border-b border-[var(--border)]">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
                  <input
                    type="text"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar monstro (PT ou EN)..."
                    className="w-full input-dd pl-9 text-sm"
                  />
                </div>
                <select value={filtroCR} onChange={e => setFiltroCR(e.target.value)} className="w-full input-dd text-sm">
                  <option value="">Todos os CRs</option>
                  {CRS.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto">
                {carregando ? (
                  <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando bestiário...</div>
                ) : filtrados.length === 0 ? (
                  <div className="p-4 text-center text-[var(--border)] text-sm">Nenhum monstro encontrado</div>
                ) : (
                  filtrados.map(m => (
                    <button
                      key={m.id}
                      onClick={() => selecionarMonstro(m)}
                      className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${
                        selecionado?.id === m.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">
                          {m.name_pt}
                        </span>
                        <span className="text-xs text-[var(--dd-text2)] truncate">
                          {m.type_pt} · CR {m.challenge_rating}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-[var(--border)] text-center">
                <p className="text-[var(--text3)] text-xs font-cinzel">{filtrados.length} de {lista.length} monstro(s)</p>
              </div>
            </div>

            <div className={cn(
              "overflow-y-auto p-4 md:p-6 bg-[var(--bg)]",
              "w-full md:flex-1",
              visao === 'lista' ? "hidden md:block" : "block"
            )}>
              <button
                onClick={() => setVisao('lista')}
                className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)] hover:text-[var(--dd-text)] mb-4 transition-colors"
              >
                ← Voltar ao Bestiário
              </button>
              {carregandoDetalhe ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[var(--text3)] font-cinzel animate-pulse">Carregando detalhes...</p>
                </div>
              ) : !selecionado ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="font-cinzel text-[var(--border)] text-xl mb-2">Selecione um monstro</p>
                    <p className="text-[var(--border)] text-sm font-crimson">Clique em um monstro da lista para ver seus detalhes</p>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold leading-tight">{selecionado.name_pt}</h2>
                      <p className="text-sm text-[var(--dd-text2)] italic mt-0.5">{selecionado.name_en}</p>
                      <p className="text-[var(--text2)] text-sm mt-1">
                        {[selecionado.size_pt, selecionado.type_pt, selecionado.alignment_pt].filter(Boolean).join(' · ')}
                      </p>
                      {selecionado.source_page_start && (
                        <p className="text-[var(--text3)] text-[10px] font-cinzel mt-0.5">SRD p.{selecionado.source_page_start}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <BotaoReportar
                        itemSlug={selecionado.slug}
                        itemNome={selecionado.name_pt}
                        itemTipo="monstro"
                        pagina="/bestiario"
                      />
                      <button
                        onClick={() => adicionarNaBatalha(selecionado)}
                        className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] border border-[var(--accent2)] text-[var(--bg)] rounded text-sm font-cinzel hover:opacity-90 transition-colors"
                      >
                        <Swords className="w-4 h-4" /> Adicionar à Batalha
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <PainelGrimorio compacto className="text-center">
                      <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Classe de Armadura</div>
                      <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.armor_class}</div>
                    </PainelGrimorio>
                    <PainelGrimorio compacto className="text-center">
                      <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Pontos de Vida</div>
                      <div className="text-[var(--green2)] text-xl font-cinzel font-bold">{selecionado.hit_points}</div>
                    </PainelGrimorio>
                    <PainelGrimorio compacto className="text-center">
                      <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Deslocamento</div>
                      <div className="text-[var(--text)] text-xs font-crimson mt-1 leading-tight">{selecionado.speed_pt ?? '—'}</div>
                    </PainelGrimorio>
                    <PainelGrimorio compacto className="text-center">
                      <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Nível de Desafio</div>
                      <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.challenge_rating}</div>
                      {selecionado.xp != null && (
                        <div className="text-[var(--border)] text-[10px]">{selecionado.xp.toLocaleString('pt-BR')} XP</div>
                      )}
                    </PainelGrimorio>
                  </div>

                  <PainelGrimorio titulo="Atributos" compacto className="mb-3">
                    <div className="grid grid-cols-6 gap-2 text-center">
                      {atrs.map(({ label, val }) => {
                        const mod = calcularModificadorAtributo(val)
                        return (
                          <div key={label} className="bg-[var(--bg3)] rounded p-2">
                            <div className="text-[var(--text3)] text-[9px] font-cinzel">{label}</div>
                            <div className="text-[var(--text)] font-bold">{val}</div>
                            <div className="text-[var(--text2)] text-xs">{formatarModificador(mod)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </PainelGrimorio>

                  {(selecionado.senses_pt || selecionado.languages_pt) && (
                    <PainelGrimorio titulo="Sentidos & Idiomas" compacto className="mb-3">
                      {selecionado.senses_pt && <p className="text-[var(--text2)] text-sm font-crimson">{selecionado.senses_pt}</p>}
                      {selecionado.languages_pt && <p className="text-[var(--text2)] text-sm font-crimson mt-1">{selecionado.languages_pt}</p>}
                    </PainelGrimorio>
                  )}

                  {(selecionado.traits_rules_pt || selecionado.traits_pt) && (
                    <PainelGrimorio titulo="Habilidades Especiais" compacto className="mb-3">
                      <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">
                        {selecionado.traits_rules_pt || selecionado.traits_pt}
                      </p>
                    </PainelGrimorio>
                  )}

                  {(selecionado.actions_rules_pt || selecionado.actions_pt) && (
                    <PainelGrimorio titulo="Ações" compacto className="mb-3">
                      <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">
                        {selecionado.actions_rules_pt || selecionado.actions_pt}
                      </p>
                    </PainelGrimorio>
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
