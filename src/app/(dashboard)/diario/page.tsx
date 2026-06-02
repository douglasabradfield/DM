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
type Visibilidade = 'dm' | 'grupo' | 'privado' | 'jogador_especifico'

interface EntradaDiario {
  id: string
  tipo: TipoEntrada
  titulo: string | null
  conteudo: string
  tags: string[]
  criado_em: string
  campanha_id: string
  sessao_id: string | null
  criado_por: string | null
  visibilidade: Visibilidade
  visibilidade_jogador_id: string | null
  profiles: { nome: string | null; username: string | null } | null
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
  const [visibilidade, setVisibilidade] = useState<Visibilidade>('dm')
  const [jogadorEspecifico, setJogadorEspecifico] = useState<string | null>(null)
  const [jogadoresCampanha, setJogadoresCampanha] = useState<Array<{ id: string; nome: string; user_id: string | null }>>([])
  const [filtroTipo, setFiltroTipo] = useState<TipoEntrada | ''>('')
  const [userId, setUserId] = useState<string | null>(null)
  const [entradaEditando, setEntradaEditando] = useState<EntradaDiario | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [editConteudo, setEditConteudo] = useState('')
  const [editVisibilidade, setEditVisibilidade] = useState<Visibilidade>('grupo')
  const [editJogador, setEditJogador] = useState<string | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const { log } = useBatalha()
  const { campanhaAtiva, papelPorCampanha } = useCampanha()

  const ehJogador = campanhaAtiva ? papelPorCampanha[campanhaAtiva.id] === 'jogador' : false
  const isDM = !ehJogador

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (!isDM || !campanhaAtiva?.id) return
    const supabase = createClient()
    supabase
      .from('campanha_membros')
      .select('id, email, user_id, status')
      .eq('campanha_id', campanhaAtiva.id)
      .eq('status', 'ativo')
      .then(async ({ data: membros }) => {
        if (!membros?.length) return
        const userIds = membros.map(m => m.user_id).filter(Boolean) as string[]
        if (!userIds.length) return
        const { data: personagens } = await supabase
          .from('personagens')
          .select('id, nome, user_id')
          .eq('campanha_id', campanhaAtiva.id)
          .eq('tipo_personagem', 'jogador')
          .in('user_id', userIds)
        setJogadoresCampanha((personagens ?? []).map(p => ({ id: p.user_id!, nome: p.nome, user_id: p.user_id })))
      })
  }, [isDM, campanhaAtiva?.id])

  const carregar = useCallback(async () => {
    if (!campanhaAtiva) { setCarregando(false); return }
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      let query = supabase
        .from('diario_entradas')
        .select('*, profiles!criado_por(nome, username)')
        .eq('campanha_id', campanhaAtiva.id)
      if (filtroTipo) query = query.eq('tipo', filtroTipo)

      if (user?.id) {
        if (ehJogador) {
          query = query.or(
            `visibilidade.eq.grupo,` +
            `and(visibilidade.eq.privado,criado_por.eq.${user.id}),` +
            `and(visibilidade.eq.jogador_especifico,visibilidade_jogador_id.eq.${user.id})`
          )
        } else {
          // DM: vê tudo exceto entradas privadas de outros usuários
          query = query.or(`visibilidade.neq.privado,criado_por.eq.${user.id}`)
        }
      }

      const { data } = await query.order('criado_em', { ascending: false })
      setEntradas((data ?? []) as EntradaDiario[])
    } finally {
      setCarregando(false)
    }
  }, [campanhaAtiva, filtroTipo, ehJogador])

  useEffect(() => { carregar() }, [carregar])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
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
        criado_por: userId ?? null,
        visibilidade,
        visibilidade_jogador_id: visibilidade === 'jogador_especifico' ? jogadorEspecifico : null,
      })

      // Notificar membros visíveis
      if (!error && (visibilidade === 'grupo' || visibilidade === 'jogador_especifico')) {
        const destinatarios = visibilidade === 'jogador_especifico' && jogadorEspecifico
          ? [jogadorEspecifico]
          : jogadoresCampanha.map(j => j.user_id).filter(Boolean) as string[]

        for (const uid of destinatarios) {
          if (uid === userId) continue
          await supabase.from('notificacoes').insert({
            user_id: uid,
            tipo: 'diario_entrada',
            titulo: '📝 Nova entrada no diário',
            mensagem: titulo.trim() || conteudo.trim().slice(0, 80),
            link: '/diario',
            lida: false,
          })
        }
      }
      if (error) {
        toast.error(`Erro: ${error.message}`)
        return
      }
      toast.success('Entrada criada!')
      setCriando(false)
      setTitulo('')
      setConteudo('')
      setVisibilidade('dm')
      setJogadorEspecifico(null)
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

  function abrirEdicao(entrada: EntradaDiario) {
    setEntradaEditando(entrada)
    setEditTitulo(entrada.titulo || '')
    setEditConteudo(entrada.conteudo)
    setEditVisibilidade(entrada.visibilidade)
    setEditJogador(entrada.visibilidade_jogador_id)
  }

  async function salvarEdicao() {
    if (!entradaEditando) return
    setSalvandoEdicao(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('diario_entradas')
        .update({
          titulo: editTitulo.trim() || null,
          conteudo: editConteudo.trim(),
          visibilidade: editVisibilidade,
          visibilidade_jogador_id: editVisibilidade === 'jogador_especifico' ? editJogador : null,
        })
        .eq('id', entradaEditando.id)
      if (error) { toast.error('Erro ao salvar'); return }
      toast.success('Entrada atualizada!')
      setEntradaEditando(null)
      carregar()
    } finally {
      setSalvandoEdicao(false)
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
        criado_por: userId ?? null,
        visibilidade: 'grupo',
      })
      toast.success('Log exportado para o diário!')
      carregar()
    } catch {
      toast.error('Erro ao exportar log')
    }
  }

  const podeDeletar = (entrada: EntradaDiario) =>
    !ehJogador || entrada.criado_por === userId

  const podeEditarEntrada = (entrada: EntradaDiario) =>
    !ehJogador || entrada.criado_por === userId

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-cinzel text-[var(--gold)] text-lg font-bold">Diário de Campanha</h2>
          <p className="text-[var(--text3)] text-sm font-crimson">{entradas.length} entradas registradas</p>
        </div>
        <div className="flex gap-2">
          {log.length > 0 && !ehJogador && (
            <BotaoRunico variante="secundario" tamanho="sm" onClick={exportarLogBatalha}>
              <Sword className="w-3 h-3" /> Exportar Log de Batalha
            </BotaoRunico>
          )}
          <BotaoRunico variante="ouro" tamanho="sm" onClick={() => { setVisibilidade(ehJogador ? 'grupo' : 'dm'); setCriando(true) }}>
            <Plus className="w-3 h-3" /> Nova Entrada
          </BotaoRunico>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--text3)] text-xs font-cinzel">Visível para:</span>
              {[
                { value: 'grupo',   label: '👥 Grupo',   desc: 'Todos da campanha' },
                { value: 'privado', label: '🙈 Privado', desc: 'Só quem criou' },
                ...(!ehJogador ? [{ value: 'dm', label: '🔒 Só DM', desc: 'Apenas você vê' }] : []),
              ].map(op => (
                <button
                  key={op.value}
                  type="button"
                  title={op.desc}
                  onClick={() => { setVisibilidade(op.value as Visibilidade); setJogadorEspecifico(null) }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-cinzel border transition-all ${
                    visibilidade === op.value && !jogadorEspecifico
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface)]'
                  }`}
                >
                  {op.label}
                </button>
              ))}
              {!ehJogador && jogadoresCampanha.length > 0 && (
                <select
                  value={jogadorEspecifico || ''}
                  onChange={e => {
                    if (e.target.value) {
                      setVisibilidade('jogador_especifico')
                      setJogadorEspecifico(e.target.value)
                    }
                  }}
                  className={`input-dd text-xs py-1 ${visibilidade === 'jogador_especifico' ? 'border-[var(--accent)]' : ''}`}
                >
                  <option value="">👤 Para jogador...</option>
                  {jogadoresCampanha.map(j => (
                    <option key={j.user_id} value={j.user_id!}>{j.nome}</option>
                  ))}
                </select>
              )}
            </div>
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
      ) : entradas.length === 0 ? (
        <div className="text-center py-12">
          <BookMarked className="w-12 h-12 text-[var(--border)] mx-auto mb-3" />
          <p className="font-cinzel text-[var(--border)] text-lg mb-2">Nenhuma entrada</p>
          <p className="text-[var(--border)] text-sm font-crimson">Registre eventos importantes da campanha</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {entradas.map(entrada => {
            const podeEditar = podeEditarEntrada(entrada)
            const estaEditando = entradaEditando?.id === entrada.id
            return (
              <PainelGrimorio key={entrada.id} compacto>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span style={{ color: COR_TIPO[entrada.tipo] }}>{ICONES_TIPO[entrada.tipo]}</span>
                    {entrada.titulo && (
                      <span className="font-cinzel text-sm" style={{ color: COR_TIPO[entrada.tipo] }}>{entrada.titulo}</span>
                    )}
                    <span className="text-[var(--border)] text-xs capitalize">{entrada.tipo}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-cinzel ${
                      entrada.visibilidade === 'grupo' ? 'text-[var(--green2)] bg-[var(--green2)]/10' :
                      entrada.visibilidade === 'privado' ? 'text-[var(--text3)] bg-[var(--surface2)]' :
                      entrada.visibilidade === 'jogador_especifico' ? 'text-[var(--accent2)] bg-[var(--accent2)]/10' :
                      'text-[var(--gold)] bg-[var(--gold)]/10'
                    }`}>
                      {entrada.visibilidade === 'grupo' ? '👥 Grupo' :
                       entrada.visibilidade === 'privado' ? '🙈 Privado' :
                       entrada.visibilidade === 'jogador_especifico' ? '👤 Jogador' :
                       '🔒 DM'}
                    </span>
                    {(() => {
                      const prof = entrada.profiles
                      const nomeAutor = prof?.nome ?? (prof?.username ? `@${prof.username}` : null)
                      return nomeAutor
                        ? <span className="text-[var(--text3)] text-[10px] font-crimson">por {nomeAutor}</span>
                        : null
                    })()}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[var(--border)] text-xs">
                      {format(new Date(entrada.criado_em), "d 'de' MMM, HH:mm", { locale: ptBR })}
                    </span>
                    {podeEditar && !estaEditando && (
                      <button onClick={() => abrirEdicao(entrada)} className="text-[var(--text3)] hover:text-[var(--gold)] transition-colors text-xs">
                        ✏️
                      </button>
                    )}
                    {podeDeletar(entrada) && (
                      <button onClick={() => excluir(entrada.id)} className="text-[var(--border)] hover:text-[var(--red2)] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {estaEditando ? (
                  <div className="space-y-2 mt-2">
                    <input
                      type="text"
                      value={editTitulo}
                      onChange={e => setEditTitulo(e.target.value)}
                      placeholder="Título (opcional)"
                      className="w-full input-dd text-sm"
                    />
                    <EditorComMencoes
                      value={editConteudo}
                      onChange={setEditConteudo}
                      rows={4}
                      placeholder="Conteúdo..."
                      className="w-full input-dd text-sm resize-y"
                      campanhaId={campanhaAtiva?.id ?? null}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[var(--text3)] text-xs font-cinzel">Visível para:</span>
                      {[
                        { value: 'grupo',   label: '👥 Grupo' },
                        { value: 'privado', label: '🙈 Privado' },
                        ...(!ehJogador ? [{ value: 'dm', label: '🔒 Só DM' }] : []),
                      ].map(op => (
                        <button
                          key={op.value}
                          type="button"
                          onClick={() => { setEditVisibilidade(op.value as Visibilidade); setEditJogador(null) }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-cinzel border transition-all ${
                            editVisibilidade === op.value && !editJogador
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface)]'
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                      {!ehJogador && jogadoresCampanha.length > 0 && (
                        <select
                          value={editJogador || ''}
                          onChange={e => { if (e.target.value) { setEditVisibilidade('jogador_especifico'); setEditJogador(e.target.value) } }}
                          className={`input-dd text-xs py-1 ${editVisibilidade === 'jogador_especifico' ? 'border-[var(--accent)]' : ''}`}
                        >
                          <option value="">👤 Para jogador...</option>
                          {jogadoresCampanha.map(j => (
                            <option key={j.user_id} value={j.user_id!}>{j.nome}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <BotaoRunico variante="ouro" tamanho="sm" onClick={salvarEdicao} carregando={salvandoEdicao}>Salvar</BotaoRunico>
                      <BotaoRunico variante="fantasma" tamanho="sm" onClick={() => setEntradaEditando(null)}>Cancelar</BotaoRunico>
                    </div>
                  </div>
                ) : (
                  <TextoComMencoes texto={entrada.conteudo} className="text-[var(--text2)] font-crimson text-sm whitespace-pre-wrap" />
                )}
              </PainelGrimorio>
            )
          })}
        </div>
      )}
    </div>
  )
}
