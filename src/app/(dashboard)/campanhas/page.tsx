'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import type { Campanha, CampaignMember, CampaignInvite } from '@/types/database'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { cn } from '@/lib/utils'
import { Plus, X, BookOpen, UserPlus, Users, ChevronLeft, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'

const SISTEMAS = ['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Tormenta', 'Vampiro: A Máscara', 'Outro']

export default function CampanhasPage() {
  const { campanhas, campanhaAtiva, setCampanhaAtiva, carregarCampanhas, papelPorCampanha } = useCampanha()
  const [selecionada, setSelecionada] = useState<Campanha | null>(null)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [criandoNova, setCriandoNova] = useState(false)
  const [nomeCriando, setNomeCriando] = useState('')
  const [salvandoNova, setSalvandoNova] = useState(false)
  const [cronicaModal, setCronicaModal] = useState<{ nome: string; resumo: string } | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarCampanhas() }, [])

  useEffect(() => {
    if (!selecionada && campanhaAtiva) setSelecionada(campanhaAtiva)
  }, [campanhaAtiva, selecionada])

  function selecionar(c: Campanha) {
    setSelecionada(c)
    setVisao('detalhe')
  }

  async function criarCampanha(e: React.FormEvent) {
    e.preventDefault()
    if (!nomeCriando.trim()) return
    setSalvandoNova(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('campanhas')
        .insert({ dm_id: user.id, nome: nomeCriando.trim(), sistema: 'D&D 5e', ativa: true })
        .select().single()
      if (error) throw error
      toast.success(`Campanha "${(data as Campanha).nome}" criada!`)
      setCriandoNova(false)
      setNomeCriando('')
      await carregarCampanhas()
      setSelecionada(data as Campanha)
      setVisao('detalhe')
    } catch { toast.error('Erro ao criar campanha') }
    finally { setSalvandoNova(false) }
  }

  const ativas = campanhas.filter(c => c.ativa !== false)
  const encerradas = campanhas.filter(c => c.ativa === false)
  const ehDmGlobal = campanhas.some(c => papelPorCampanha[c.id] === 'dm')

  return (
    <div className="flex h-full overflow-hidden">
      {/* Lista esquerda */}
      <div className={cn(
        'flex flex-col w-full md:w-72 border-r border-[var(--border)] flex-shrink-0 overflow-y-auto',
        visao === 'detalhe' ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wider">Suas Campanhas</p>
            {ehDmGlobal && (
              <button
                onClick={() => setCriandoNova(true)}
                className="flex items-center gap-1 text-xs font-cinzel text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
              >
                <Plus className="w-3 h-3" /> Nova
              </button>
            )}
          </div>

          {criandoNova && (
            <form onSubmit={criarCampanha} className="space-y-2">
              <input
                type="text"
                value={nomeCriando}
                onChange={e => setNomeCriando(e.target.value)}
                placeholder="Nome da campanha..."
                className="w-full input-dd text-sm"
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  type="submit"
                  disabled={!nomeCriando.trim() || salvandoNova}
                  className="flex-1 py-1 bg-[var(--accent)] text-[var(--bg)] rounded font-cinzel text-xs disabled:opacity-50"
                >
                  {salvandoNova ? '...' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCriandoNova(false); setNomeCriando('') }}
                  className="px-2 py-1 border border-[var(--border)] rounded text-[var(--text3)] text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {ativas.length === 0 && encerradas.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[var(--border)] text-sm font-crimson">Nenhuma campanha ainda</p>
            </div>
          ) : (
            <>
              {ativas.map(c => (
                <CampanhaListItem
                  key={c.id}
                  campanha={c}
                  ativa={campanhaAtiva?.id === c.id}
                  selecionada={selecionada?.id === c.id}
                  papel={papelPorCampanha[c.id]}
                  onSelecionar={() => selecionar(c)}
                />
              ))}
              {encerradas.length > 0 && (
                <>
                  <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider px-3 py-2 border-t border-[var(--border)] mt-1">
                    Encerradas ({encerradas.length})
                  </p>
                  {encerradas.map(c => (
                    <CampanhaListItem
                      key={c.id}
                      campanha={c}
                      ativa={false}
                      selecionada={selecionada?.id === c.id}
                      papel={papelPorCampanha[c.id]}
                      onSelecionar={() => selecionar(c)}
                      encerrada
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Painel direito */}
      <div className={cn(
        'flex-1 overflow-y-auto',
        visao === 'lista' ? 'hidden md:block' : 'block'
      )}>
        <button
          onClick={() => setVisao('lista')}
          className="md:hidden flex items-center gap-1 text-sm text-[var(--text3)] hover:text-[var(--text)] p-3 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Campanhas
        </button>

        {!selecionada ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-cinzel text-[var(--border)] text-lg">Selecione uma campanha</p>
          </div>
        ) : (
          <DetalhesCampanha
            campanha={selecionada}
            ehDm={papelPorCampanha[selecionada.id] === 'dm'}
            campanhaAtiva={campanhaAtiva}
            onAtualizar={(c) => { setSelecionada(c); carregarCampanhas() }}
            onEncerrar={() => { carregarCampanhas(); setSelecionada(null) }}
            onReativar={() => carregarCampanhas()}
            onSetarAtiva={setCampanhaAtiva}
            onCronica={(nome, resumo) => setCronicaModal({ nome, resumo })}
          />
        )}
      </div>

      {/* Modal Crônica */}
      {cronicaModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setCronicaModal(null)}>
          <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-cinzel text-[var(--gold)] text-xl font-bold">Crônica Final</h3>
                <p className="text-[var(--text3)] text-sm font-crimson italic">{cronicaModal.nome}</p>
              </div>
              <button onClick={() => setCronicaModal(null)} className="text-[var(--border)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <p className="text-[var(--text)] font-crimson text-base leading-relaxed whitespace-pre-wrap">{cronicaModal.resumo}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function CampanhaListItem({ campanha, ativa, selecionada, papel, onSelecionar, encerrada }: {
  campanha: Campanha
  ativa: boolean
  selecionada: boolean
  papel?: 'dm' | 'jogador'
  onSelecionar: () => void
  encerrada?: boolean
}) {
  return (
    <button
      onClick={onSelecionar}
      className={cn(
        'w-full text-left px-3 py-2.5 border-b border-[var(--bg3)] transition-colors',
        selecionada ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]',
        encerrada && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', encerrada ? 'bg-[var(--border)]' : 'bg-[var(--green2)]')} />
        <div className="min-w-0">
          <p className="font-cinzel text-sm font-semibold text-[var(--dd-text)] truncate">{campanha.nome}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[var(--text3)] text-[10px]">{campanha.sistema}</span>
            {ativa && <span className="text-[10px] px-1 py-0 bg-[var(--gold)]/20 text-[var(--gold)] rounded font-cinzel">ATIVA</span>}
            {papel === 'jogador' && <span className="text-[10px] text-[var(--accent2)]">jogador</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

function DetalhesCampanha({ campanha, ehDm, campanhaAtiva, onAtualizar, onEncerrar, onReativar, onSetarAtiva, onCronica }: {
  campanha: Campanha
  ehDm: boolean
  campanhaAtiva: Campanha | null
  onAtualizar: (c: Campanha) => void
  onEncerrar: () => void
  onReativar: () => void
  onSetarAtiva: (c: Campanha) => void
  onCronica: (nome: string, resumo: string) => void
}) {
  const [form, setForm] = useState({ nome: campanha.nome, descricao: campanha.descricao ?? '', sistema: campanha.sistema ?? 'D&D 5e', moeda_custom_nome: campanha.moeda_custom_nome ?? '' })
  const [salvando, setSalvando] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userPlano, setUserPlano] = useState('')
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)

  useEffect(() => {
    setForm({ nome: campanha.nome, descricao: campanha.descricao ?? '', sistema: campanha.sistema ?? 'D&D 5e', moeda_custom_nome: campanha.moeda_custom_nome ?? '' })
  }, [campanha.id, campanha.nome, campanha.descricao, campanha.sistema, campanha.moeda_custom_nome])

  useEffect(() => {
    async function carregarUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('plano').eq('id', user.id).single()
      setUserPlano(data?.plano ?? '')
    }
    carregarUser()
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('campanhas')
        .update({ nome: form.nome, descricao: form.descricao, sistema: form.sistema, moeda_custom_nome: form.moeda_custom_nome || null })
        .eq('id', campanha.id)
        .select().single()
      if (error) throw error
      toast.success('Campanha salva!')
      onAtualizar(data as Campanha)
    } catch { toast.error('Erro ao salvar') }
    finally { setSalvando(false) }
  }

  async function encerrar() {
    if (!confirm(`Encerrar "${campanha.nome}"? A IA irá gerar uma crônica final.`)) return
    setEncerrando(true)
    try {
      let resumo = ''
      try {
        const res = await fetch('/api/ia/resumo-campanha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campanhaId: campanha.id }) })
        const d = await res.json()
        resumo = d.resumo || ''
      } catch { /* IA falhou — encerra sem crônica */ }

      const supabase = createClient()
      await supabase.from('campanhas').update({ ativa: false }).eq('id', campanha.id)
      toast.success('Campanha encerrada!')
      onEncerrar()
      if (resumo) onCronica(campanha.nome, resumo)
    } catch { toast.error('Erro ao encerrar') }
    finally { setEncerrando(false) }
  }

  async function reativar() {
    const supabase = createClient()
    await supabase.from('campanhas').update({ ativa: true }).eq('id', campanha.id)
    toast.success('Campanha reativada!')
    onReativar()
  }

  async function apagarCampanha() {
    if (!campanha?.id || !userId) return
    const supabase = createClient()
    const { error } = await supabase
      .from('campanhas')
      .delete()
      .eq('id', campanha.id)
      .eq('dm_id', userId)
    if (error) { toast.error('Erro ao apagar campanha'); return }
    toast.success('Campanha apagada')
    window.location.href = '/batalha'
  }

  const isAtiva = campanhaAtiva?.id === campanha.id

  return (
    <div className="p-4 max-w-2xl space-y-6">
      {/* Header da campanha */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-cinzel text-[var(--gold)] text-xl font-bold">{campanha.nome}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[var(--text3)] text-xs font-crimson">{campanha.sistema}</span>
            {campanha.ativa !== false
              ? <span className="text-[10px] px-1.5 py-0.5 bg-[var(--green2)]/20 text-[var(--green2)] border border-[var(--green2)]/40 rounded font-cinzel">Ativa</span>
              : <span className="text-[10px] px-1.5 py-0.5 bg-[var(--border)]/20 text-[var(--border)] border border-[var(--border)]/40 rounded font-cinzel">Encerrada</span>
            }
            {isAtiva && <span className="text-[10px] px-1.5 py-0.5 bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/40 rounded font-cinzel">Em Jogo</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isAtiva && campanha.ativa !== false && (
            <button
              onClick={() => onSetarAtiva(campanha)}
              className="text-xs px-2 py-1 border border-[var(--gold)] text-[var(--gold)] rounded hover:bg-[var(--gold)]/10 transition-colors font-cinzel"
            >
              Usar
            </button>
          )}
          {campanha.resumo_final && (
            <button
              onClick={() => onCronica(campanha.nome, campanha.resumo_final!)}
              className="flex items-center gap-1 text-xs px-2 py-1 border border-[var(--accent)] text-[var(--accent)] rounded hover:bg-[var(--accent)]/10 transition-colors"
            >
              <BookOpen className="w-3 h-3" /> Crônica
            </button>
          )}
        </div>
      </div>

      {/* Form de edição (DM only, campanha ativa) */}
      {ehDm && campanha.ativa !== false && (
        <PainelGrimorio titulo="Detalhes" compacto>
          <form onSubmit={salvar} className="space-y-3">
            <div>
              <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Nome</label>
              <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="input-dd w-full" required />
            </div>
            <div>
              <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Descrição</label>
              <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} className="input-dd w-full resize-none" />
            </div>
            <div>
              <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Sistema</label>
              <select value={form.sistema} onChange={e => setForm(f => ({ ...f, sistema: e.target.value }))} className="input-dd w-full">
                {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Nome da Moeda Especial</label>
              <input
                type="text"
                value={form.moeda_custom_nome}
                onChange={e => setForm(f => ({ ...f, moeda_custom_nome: e.target.value }))}
                placeholder="Ex: Pontos de Glória, Influência..."
                className="input-dd w-full"
              />
              <p className="text-[var(--text3)] text-[10px] mt-0.5 font-crimson">Aparece nas fichas de personagem como moeda adicional</p>
            </div>
            <div className="flex gap-2">
              <BotaoRunico type="submit" variante="ouro" tamanho="sm" carregando={salvando}>Salvar</BotaoRunico>
              <BotaoRunico type="button" variante="perigo" tamanho="sm" carregando={encerrando} onClick={encerrar}>
                {encerrando ? 'Encerrando...' : 'Encerrar Campanha'}
              </BotaoRunico>
            </div>
          </form>
        </PainelGrimorio>
      )}

      {/* Campanha encerrada — ações */}
      {campanha.ativa === false && ehDm && (
        <PainelGrimorio compacto>
          <div className="flex items-center justify-between">
            <p className="text-[var(--text3)] text-sm font-crimson">Esta campanha foi encerrada.</p>
            <button onClick={reativar} className="text-xs px-2 py-1 border border-[var(--border2)] text-[var(--text2)] rounded hover:bg-[var(--surface2)] transition-colors font-cinzel">
              Reativar
            </button>
          </div>
        </PainelGrimorio>
      )}

      {/* Info (jogador) */}
      {!ehDm && (
        <PainelGrimorio titulo="Sobre a Campanha" compacto>
          <div className="space-y-1">
            {campanha.descricao && <p className="text-[var(--text2)] font-crimson text-sm">{campanha.descricao}</p>}
            <p className="text-[var(--text3)] text-xs">Sistema: {campanha.sistema}</p>
          </div>
        </PainelGrimorio>
      )}

      {/* Membros */}
      <PainelGrimorio titulo="Membros & Convites" compacto>
        <MembrosSecao campanhaId={campanha.id} ehDm={ehDm} />
      </PainelGrimorio>

      {/* Zona de Perigo */}
      {ehDm && userPlano === 'guild_master' && (
        <div className="pt-4 border-t border-[var(--border)]">
          {!confirmandoApagar ? (
            <button
              onClick={() => setConfirmandoApagar(true)}
              className="text-[var(--red2)] text-sm font-cinzel border border-[var(--red2)]/30 px-4 py-2 rounded-lg hover:bg-[var(--red2)]/10 transition-colors"
            >
              🗑️ Apagar campanha
            </button>
          ) : (
            <div className="bg-[var(--red2)]/10 border border-[var(--red2)]/30 rounded-xl p-4">
              <p className="text-[var(--red2)] font-cinzel text-sm font-bold mb-2">
                ⚠️ Apagar &quot;{campanha.nome}&quot; permanentemente?
              </p>
              <p className="text-[var(--text3)] text-xs mb-3">
                Todos os personagens, batalhas, diário e imagens serão perdidos.
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmandoApagar(false)}
                  className="flex-1 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text2)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={apagarCampanha}
                  className="flex-1 py-2 bg-[var(--red2)] text-white rounded-lg text-sm font-cinzel"
                >
                  Apagar tudo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MembrosSecao({ campanhaId, ehDm }: { campanhaId: string; ehDm: boolean }) {
  const [membros, setMembros] = useState<CampaignMember[]>([])
  const [convites, setConvites] = useState<CampaignInvite[]>([])
  const [email, setEmail] = useState('')
  const [convidando, setConvidando] = useState(false)
  const [linkConvite, setLinkConvite] = useState('')
  const [linkEntrada, setLinkEntrada] = useState<string | null>(null)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!ehDm) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const res = await fetch(`/api/campanhas/${campanhaId}/membros`)
      if (res.ok) {
        const dados = await res.json()
        setMembros(dados.membros ?? [])
        setConvites(dados.convites ?? [])
        if (dados.link_token) {
          setLinkEntrada(`${window.location.origin}/entrar?c=${dados.link_token}`)
        }
      }
    } finally {
      setCarregando(false)
    }
  }, [campanhaId, ehDm])

  useEffect(() => { carregar() }, [carregar])

  async function convidar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setConvidando(true)
    try {
      const res = await fetch(`/api/campanhas/${campanhaId}/convidar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.erro)
      setLinkConvite(dados.link)
      setEmail('')
      toast.success('Convite gerado!')
      await carregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar')
    } finally {
      setConvidando(false)
    }
  }

  async function remover(userId: string) {
    if (!confirm('Remover este membro?')) return
    const res = await fetch(`/api/campanhas/${campanhaId}/membros?user_id=${userId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Membro removido'); await carregar() }
    else toast.error('Erro ao remover')
  }

  async function gerarLink() {
    setGerandoLink(true)
    try {
      const res = await fetch(`/api/campanhas/${campanhaId}/link-entrada`, { method: 'POST' })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.erro)
      setLinkEntrada(dados.link)
      toast.success('Link gerado!')
    } catch { toast.error('Erro ao gerar link') }
    finally { setGerandoLink(false) }
  }

  async function revogarLink() {
    if (!confirm('Revogar o link de entrada? Quem tiver o link antigo não conseguirá mais entrar.')) return
    const res = await fetch(`/api/campanhas/${campanhaId}/link-entrada`, { method: 'DELETE' })
    if (res.ok) { setLinkEntrada(null); toast.success('Link revogado') }
    else toast.error('Erro ao revogar link')
  }

  if (!ehDm) {
    return (
      <div className="flex items-center gap-2 text-[var(--text3)] text-sm font-crimson">
        <Users className="w-4 h-4" />
        <span>Membros gerenciados pelo DM</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <form onSubmit={convidar} className="flex gap-2">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@jogador.com" className="flex-1 input-dd text-sm" />
        <button type="submit" disabled={!email.trim() || convidando} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-[var(--bg)] rounded font-cinzel text-xs disabled:opacity-50 hover:opacity-90 transition-opacity">
          <UserPlus className="w-3.5 h-3.5" /> {convidando ? '...' : 'Convidar'}
        </button>
      </form>

      {linkConvite && (
        <div className="bg-[var(--surface)] border border-[var(--accent)]/40 rounded p-3 space-y-1">
          <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Link gerado · válido por 7 dias</p>
          <div className="flex gap-2 items-center">
            <p className="text-[var(--text)] text-xs font-mono truncate flex-1 bg-[var(--bg3)] px-2 py-1 rounded">{linkConvite}</p>
            <button onClick={() => { navigator.clipboard.writeText(linkConvite); toast.success('Copiado!') }} className="text-xs px-2 py-1 border border-[var(--border)] text-[var(--text2)] rounded hover:bg-[var(--surface2)] flex-shrink-0">Copiar</button>
          </div>
        </div>
      )}

      {carregando ? (
        <p className="text-[var(--text3)] text-sm animate-pulse">Carregando...</p>
      ) : (
        <>
          {membros.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider">Membros ({membros.length})</p>
              {membros.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5">
                  <div className="min-w-0">
                    <p className="text-[var(--text)] text-sm font-crimson truncate">{m.profiles?.nome || m.profiles?.email}</p>
                    {m.profiles?.nome && <p className="text-[var(--text3)] text-[10px] truncate">{m.profiles.email}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-cinzel border ${m.papel === 'dm' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--accent2)] text-[var(--accent2)]'}`}>
                      {m.papel === 'dm' ? 'DM' : 'Jogador'}
                    </span>
                    {m.papel !== 'dm' && (
                      <button onClick={() => remover(m.user_id)} className="text-[10px] px-1.5 py-0.5 border border-[var(--red2)] text-[var(--red2)] rounded hover:bg-[var(--red2)]/10">
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {convites.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider">Convites pendentes ({convites.length})</p>
              {convites.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 opacity-60">
                  <p className="text-[var(--text)] text-sm font-crimson">{c.email}</p>
                  <span className="text-[10px] text-[var(--text3)] font-cinzel">exp. {new Date(c.expires_at).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}

          {membros.length === 0 && convites.length === 0 && (
            <p className="text-[var(--text3)] text-sm font-crimson">Nenhum membro ainda. Convide jogadores pelo email ou gere um link de entrada.</p>
          )}
        </>
      )}

      {/* Link de Entrada */}
      <div className="border-t border-[var(--border)] pt-3 mt-1">
        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-1">Link de Entrada</p>
        <p className="text-[var(--text2)] text-xs font-crimson mb-2">
          Qualquer pessoa com este link pode entrar como jogador.
        </p>
        {linkEntrada ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[var(--text)] text-xs font-mono truncate flex-1 bg-[var(--bg3)] px-2 py-1 rounded">{linkEntrada}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(linkEntrada); toast.success('Copiado!') }}
                className="text-xs px-2 py-1 border border-[var(--border)] text-[var(--text2)] rounded hover:bg-[var(--surface2)] flex-shrink-0"
              >
                Copiar
              </button>
            </div>
            <button
              onClick={revogarLink}
              className="text-xs text-[var(--red2)] hover:underline font-cinzel"
            >
              Revogar link
            </button>
          </div>
        ) : (
          <button
            onClick={gerarLink}
            disabled={gerandoLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] rounded font-cinzel text-xs hover:border-[var(--border2)] transition-colors disabled:opacity-50"
          >
            <Link2 className="w-3.5 h-3.5" /> {gerandoLink ? '...' : 'Gerar Link de Entrada'}
          </button>
        )}
      </div>
    </div>
  )
}
