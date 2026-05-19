'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import type { Campanha } from '@/types/database'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { cn } from '@/lib/utils'
import { Plus, X, BookOpen, UserPlus, ChevronLeft, Link2 } from 'lucide-react'
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
  const [form, setForm] = useState({
    nome: campanha.nome,
    descricao: campanha.descricao ?? '',
    sistema: campanha.sistema ?? 'D&D 5e',
    moeda_custom_nome: campanha.moeda_custom_nome ?? '',
    sessao_data: campanha.sessao_data ?? null as string | null,
    sessao_formato: campanha.sessao_formato ?? null as 'presencial' | 'online' | null,
    sessao_local: campanha.sessao_local ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userPlano, setUserPlano] = useState('')
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)

  useEffect(() => {
    setForm({
      nome: campanha.nome,
      descricao: campanha.descricao ?? '',
      sistema: campanha.sistema ?? 'D&D 5e',
      moeda_custom_nome: campanha.moeda_custom_nome ?? '',
      sessao_data: campanha.sessao_data ?? null,
      sessao_formato: campanha.sessao_formato ?? null,
      sessao_local: campanha.sessao_local ?? '',
    })
  }, [campanha.id, campanha.nome, campanha.descricao, campanha.sistema, campanha.moeda_custom_nome, campanha.sessao_data, campanha.sessao_formato, campanha.sessao_local])

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
        .update({
          nome: form.nome,
          descricao: form.descricao,
          sistema: form.sistema,
          moeda_custom_nome: form.moeda_custom_nome || null,
          sessao_data: form.sessao_data || null,
          sessao_formato: form.sessao_formato || null,
          sessao_local: form.sessao_local || null,
        })
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
            {campanha.sessao_data && (
              <span className="text-[var(--text3)] text-[10px] font-crimson">
                📅 {new Date(campanha.sessao_data).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {campanha.sessao_formato && ` · ${campanha.sessao_formato}`}
              </span>
            )}
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
            <div>
              <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">📅 Próxima Sessão</label>
              <input
                type="datetime-local"
                value={form.sessao_data ? new Date(form.sessao_data).toISOString().slice(0, 16) : ''}
                onChange={e => setForm(f => ({ ...f, sessao_data: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                className="input-dd w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Formato</label>
                <div className="flex gap-1">
                  {([{ value: 'presencial', label: '🎲 Presencial' }, { value: 'online', label: '💻 Online' }] as const).map(op => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, sessao_formato: f.sessao_formato === op.value ? null : op.value }))}
                      className={`flex-1 py-1.5 rounded text-xs font-cinzel border transition-all ${
                        form.sessao_formato === op.value
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Local / Link</label>
                <input
                  type="text"
                  value={form.sessao_local}
                  onChange={e => setForm(f => ({ ...f, sessao_local: e.target.value }))}
                  placeholder={form.sessao_formato === 'online' ? 'Link da sala...' : 'Endereço...'}
                  className="input-dd w-full"
                />
              </div>
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

      {/* Jogadores com Plano Efetivo */}
      {ehDm && ['mesa_pro', 'guild_master', 'dm_supremo'].includes(userPlano) && (
        <SecaoMembrosEfetivos campanhaId={campanha.id} userPlano={userPlano} />
      )}

      {/* Zona de Perigo */}
      {ehDm && ['guild_master', 'dm_supremo'].includes(userPlano) && (
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

function SecaoMembrosEfetivos({ campanhaId, userPlano }: { campanhaId: string; userPlano: string }) {
  const [membros, setMembros] = useState<Array<{
    id: string; email: string; status: string; plano_efetivo: string; criado_em: string
  }>>([])
  const [emailConvite, setEmailConvite] = useState('')
  const [linkConvite, setLinkConvite] = useState('')
  const [convidando, setConvidando] = useState(false)
  const [gerandoLink, setGerandoLink] = useState(false)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('campanha_membros')
      .select('id, email, status, plano_efetivo, criado_em')
      .eq('campanha_id', campanhaId)
      .in('status', ['convidado', 'ativo'])
      .order('criado_em', { ascending: false })
    setMembros(data ?? [])
  }, [campanhaId])

  useEffect(() => { carregar() }, [carregar])

  async function convidarPorEmail() {
    if (!emailConvite.trim()) return
    setConvidando(true)
    try {
      const res = await fetch('/api/campanha/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanhaId, email: emailConvite.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.erro)
      if (d.jaTemConta) {
        toast.success('Jogador adicionado! Notificação enviada.')
      } else {
        toast.success('Convite gerado! Compartilhe o link com o jogador.')
        setLinkConvite(d.link)
      }
      setEmailConvite('')
      await carregar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar')
    } finally {
      setConvidando(false)
    }
  }

  async function gerarLinkConvite() {
    setGerandoLink(true)
    try {
      const res = await fetch('/api/campanha/link-convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanhaId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.erro)
      setLinkConvite(d.link)
      toast.success('Link de convite gerado!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar link')
    } finally {
      setGerandoLink(false)
    }
  }

  async function removerMembro(id: string) {
    if (!confirm('Remover este jogador da campanha?')) return
    const supabase = createClient()
    await supabase.from('campanha_membros').update({ status: 'removido' }).eq('id', id)
    await carregar()
    toast.success('Jogador removido')
  }

  return (
    <PainelGrimorio titulo="👥 Jogadores da Campanha" compacto>
      <div className="space-y-3">
        <p className="text-[var(--text3)] text-xs font-crimson">
          Jogadores convidados herdam o plano{' '}
          <span className="text-[var(--accent2)]">{userPlano === 'guild_master' ? 'Guild Master' : userPlano === 'dm_supremo' ? 'DM Supremo' : 'Mesa Pro'}</span>{' '}
          enquanto estiverem na campanha.
        </p>

        {/* Lista de membros */}
        {membros.length > 0 && (
          <div className="space-y-1.5">
            {membros.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-[var(--bg3)] rounded px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[var(--text)] text-sm font-crimson truncate">{m.email}</p>
                  <p className="text-[var(--text3)] text-[10px]">
                    {m.status === 'convidado' ? '⏳ Convite pendente' : '✅ Ativo'}
                  </p>
                </div>
                <button
                  onClick={() => removerMembro(m.id)}
                  className="text-[var(--red2)] text-[10px] hover:opacity-80 font-cinzel flex-shrink-0 ml-2"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Convidar por email */}
        <div className="flex gap-2">
          <input
            type="email"
            value={emailConvite}
            onChange={e => setEmailConvite(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && convidarPorEmail()}
            placeholder="email@jogador.com"
            className="input-dd flex-1 text-sm"
          />
          <button
            onClick={convidarPorEmail}
            disabled={!emailConvite.trim() || convidando}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white rounded font-cinzel text-xs disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-3.5 h-3.5" /> {convidando ? '...' : 'Convidar'}
          </button>
        </div>

        {/* Link de convite aberto */}
        <div className="flex gap-2 items-center">
          <button
            onClick={gerarLinkConvite}
            disabled={gerandoLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] rounded font-cinzel text-xs hover:border-[var(--border2)] transition-colors disabled:opacity-50"
          >
            <Link2 className="w-3.5 h-3.5" /> {gerandoLink ? '...' : 'Gerar link aberto'}
          </button>
          {linkConvite && (
            <button
              onClick={() => { navigator.clipboard.writeText(linkConvite); toast.success('Link copiado!') }}
              className="text-[var(--accent)] text-xs hover:underline font-cinzel"
            >
              Copiar link
            </button>
          )}
        </div>

        {linkConvite && (
          <div className="bg-[var(--surface)] border border-[var(--accent)]/40 rounded p-2">
            <p className="text-[var(--text)] text-xs font-mono break-all">{linkConvite}</p>
          </div>
        )}
      </div>
    </PainelGrimorio>
  )
}

