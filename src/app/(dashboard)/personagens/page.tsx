'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import type { Personagem } from '@/types/dnd'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoImportarFicha } from '@/components/personagem/BotaoImportarFicha'
import { Plus, RefreshCw, Users, Download, MoreVertical, X, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPlano } from '@/lib/planos'
import { usePlanoEfetivo } from '@/hooks/usePlanoEfetivo'

type FiltroTipo = 'todos' | 'jogador' | 'npc' | 'monstro'
type Ordenacao = 'nome' | 'nivel' | 'xp' | 'ca' | 'pv'

function estiloTipo(tipo: string | null) {
  switch (tipo) {
    case 'npc':     return {
      borda: 'border-[var(--green2)]',
      header: 'bg-[var(--green2)]/10',
      texto: 'text-[var(--green2)]',
      tag: 'border-[var(--green2)] text-[var(--green2)]',
    }
    case 'monstro': return {
      borda: 'border-[var(--red2)]',
      header: 'bg-[var(--red2)]/10',
      texto: 'text-[var(--red2)]',
      tag: 'border-[var(--red2)] text-[var(--red2)]',
    }
    default: return {
      borda: 'border-[var(--gold)]',
      header: 'bg-[var(--gold)]/10',
      texto: 'text-[var(--gold)]',
      tag: 'border-[var(--gold)] text-[var(--gold)]',
    }
  }
}

interface CardPersonagemProps {
  p: Personagem
  isDm: boolean
  menuAberto: boolean
  onToggleMenu: () => void
  onInativar: () => void
  onDeletar: () => void
  inativo?: boolean
  onReativar?: () => void
}

function CardPersonagem({ p, isDm, menuAberto, onToggleMenu, onInativar, onDeletar, inativo, onReativar }: CardPersonagemProps) {
  const estilo = estiloTipo(p.tipo_personagem)
  const pct = p.pv_maximo > 0 ? (p.pv_atual / p.pv_maximo) * 100 : 0
  const corPV = pct > 50 ? 'var(--green2)' : pct > 25 ? '#f59e0b' : 'var(--red2)'
  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="relative">
      <Link href={inativo ? '#' : `/personagens/${p.id}`} onClick={e => inativo && e.preventDefault()}>
        <div className={`bg-[var(--surface)] border-2 rounded-xl overflow-hidden transition-all cursor-pointer ${inativo ? 'opacity-50 grayscale' : 'hover:opacity-90'} ${estilo.borda}`}>
          <div className={`${estilo.header} px-4 py-3 flex items-start justify-between`}>
            <div className="min-w-0 flex-1">
              <h3 className={`font-cinzel font-bold text-base leading-tight truncate ${estilo.texto}`}>
                {p.nome}
                {inativo && <span className="ml-2 text-[10px] text-[var(--text3)] font-normal font-crimson">(inativo)</span>}
              </h3>
              {p.classe && (
                <p className="text-[var(--text2)] text-sm mt-0.5">
                  {p.raca ? `${p.raca} · ` : ''}{p.classe} Nv{p.nivel || 1}
                </p>
              )}
              <p className="text-[var(--text3)] text-xs mt-0.5">{p.jogador_nome}</p>
            </div>
            <div className="text-right ml-3 flex-shrink-0 pr-6">
              <p className="text-[var(--text3)] text-xs font-cinzel">CA</p>
              <p className={`font-cinzel font-bold text-xl leading-none ${estilo.texto}`}>{p.ca || 10}</p>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text3)] font-cinzel">PV</span>
                <span className="font-bold" style={{ color: corPV }}>{p.pv_atual}/{p.pv_maximo}</span>
              </div>
              <div className="h-2 bg-[var(--bg3)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: corPV }} />
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1 text-center">
              {[
                { label: 'FOR', val: p.forca },
                { label: 'DES', val: p.destreza },
                { label: 'CON', val: p.constituicao },
                { label: 'INT', val: p.inteligencia },
                { label: 'SAB', val: p.sabedoria },
                { label: 'CAR', val: p.carisma },
              ].map(({ label, val }) => {
                const mod = Math.floor(((val || 10) - 10) / 2)
                return (
                  <div key={label} className="bg-[var(--bg3)] rounded p-1">
                    <p className="text-[var(--text3)] text-[9px] font-cinzel">{label}</p>
                    <p className="text-[var(--text)] text-sm font-bold">{val || 10}</p>
                    <p className="text-[var(--text2)] text-[10px]">{mod >= 0 ? `+${mod}` : mod}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className={`text-[10px] px-2 py-0.5 border rounded font-cinzel ${estilo.tag}`}>
                {p.tipo_personagem === 'monstro' ? '👹 Monstro' :
                 p.tipo_personagem === 'npc' ? '🧙 NPC' : '👤 Jogador'}
              </span>
              {inativo && onReativar && (
                <button
                  onClick={e => { e.preventDefault(); onReativar() }}
                  className="text-[10px] px-2 py-0.5 border border-[var(--green2)] text-[var(--green2)] rounded font-cinzel hover:bg-[var(--green2)]/10 transition-colors"
                >
                  Reativar
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>

      {isDm && !inativo && (
        <div ref={menuRef} className="absolute top-2 right-2 z-10">
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleMenu() }}
            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuAberto && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg2)] border border-[var(--border)] rounded shadow-xl z-50">
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onInativar() }}
                className="w-full text-left px-3 py-2 text-xs font-crimson text-[var(--text2)] hover:bg-[var(--surface)] transition-colors flex items-center gap-2"
              >
                <EyeOff className="w-3 h-3" /> Inativar
              </button>
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onDeletar() }}
                className="w-full text-left px-3 py-2 text-xs font-crimson text-[var(--red2)] hover:bg-[var(--red2)]/10 transition-colors flex items-center gap-2"
              >
                <X className="w-3 h-3" /> Excluir permanentemente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PersonagensPage() {
  const { campanhaAtiva, papelPorCampanha } = useCampanha()
  const [personagens, setPersonagens] = useState<Personagem[]>([])
  const [personagensInativos, setPersonagensInativos] = useState<Personagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [criando, setCriando] = useState(false)
  const [nomeNovo, setNomeNovo] = useState('')
  const [jogadorNovo, setJogadorNovo] = useState('')
  const [tipoNovo, setTipoNovo] = useState<'jogador' | 'npc' | 'monstro'>('jogador')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('nome')
  const [plano, setPlano] = useState<string>('free')
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [confirmarDeletar, setConfirmarDeletar] = useState<string | null>(null)
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const ehJogador = papelPorCampanha[campanhaAtiva?.id ?? ''] === 'jogador'
  const planoEfetivo = usePlanoEfetivo()

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('nome, plano').eq('id', user.id).single()
      if (profile?.nome) setNomeUsuario(profile.nome)
      if (profile?.plano) setPlano(profile.plano)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (!campanhaAtiva?.id) {
      setPersonagens([])
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
      const { data } = await supabase
        .from('personagens')
        .select('*')
        .eq('campanha_id', campanhaAtiva.id)
        .eq('ativo', true)
        .order('nome')
      setPersonagens((data ?? []) as Personagem[])
    } finally {
      setCarregando(false)
    }
  }

  async function criarPersonagem(e: React.FormEvent) {
    e.preventDefault()
    if (!campanhaAtiva?.id) { toast.error('Selecione uma campanha primeiro'); return }
    const limites = getPlano(plano).limites
    if (limites.personagens !== 'ilimitado' && personagens.length >= limites.personagens) {
      toast.error(`Limite de ${limites.personagens} personagens atingido no plano ${getPlano(plano).nome}. Faça upgrade para continuar.`)
      return
    }
    try {
      const supabase = createClient()
      const novoPersonagem: Record<string, unknown> = {
        campanha_id: campanhaAtiva.id,
        nome: nomeNovo,
        jogador_nome: jogadorNovo || (ehJogador ? nomeUsuario : 'Jogador'),
        tipo_personagem: ehJogador ? 'jogador' : tipoNovo,
        nivel: 1,
        forca: 10, destreza: 10, constituicao: 10,
        inteligencia: 10, sabedoria: 10, carisma: 10,
        ca: 10, pv_maximo: 10, pv_atual: 10,
        bonus_proficiencia: 2,
        ataques: [],
        salvaguardas: {},
        pericias: {},
        resistencias: [],
        imunidades: [],
        vulnerabilidades: [],
      }
      if (ehJogador && userId) novoPersonagem.user_id = userId

      const { error } = await supabase.from('personagens').insert(novoPersonagem)
      if (error) throw error
      toast.success('Personagem criado!')
      setCriando(false)
      setNomeNovo('')
      setJogadorNovo('')
      carregar()
    } catch {
      toast.error('Erro ao criar personagem')
    }
  }

  async function carregarInativos() {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    const { data } = await supabase
      .from('personagens')
      .select('*')
      .eq('campanha_id', campanhaAtiva.id)
      .eq('ativo', false)
      .order('nome')
    setPersonagensInativos((data ?? []) as Personagem[])
  }

  async function inativarPersonagem(id: string) {
    setMenuAberto(null)
    const supabase = createClient()
    const { error } = await supabase.from('personagens').update({ ativo: false }).eq('id', id)
    if (error) { toast.error('Erro ao inativar personagem'); return }
    toast.success('Personagem inativado')
    setPersonagens(prev => prev.filter(p => p.id !== id))
    if (mostrarInativos) carregarInativos()
  }

  async function deletarPersonagem(id: string) {
    setConfirmarDeletar(null)
    const supabase = createClient()
    const { error } = await supabase.from('personagens').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir personagem'); return }
    toast.success('Personagem excluído permanentemente')
    setPersonagens(prev => prev.filter(p => p.id !== id))
    setPersonagensInativos(prev => prev.filter(p => p.id !== id))
  }

  async function reativarPersonagem(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('personagens').update({ ativo: true }).eq('id', id)
    if (error) { toast.error('Erro ao reativar personagem'); return }
    toast.success('Personagem reativado')
    setPersonagensInativos(prev => prev.filter(p => p.id !== id))
    carregar()
  }

  const filtrados = personagens.filter(p => {
    if (filtroTipo === 'todos') return true
    return (p.tipo_personagem || 'jogador') === filtroTipo
  })

  const ordenados = [...filtrados].sort((a, b) => {
    switch (ordenacao) {
      case 'nivel': return ((b.nivel || 1) - (a.nivel || 1))
      case 'xp': return ((b.pontos_experiencia || 0) - (a.pontos_experiencia || 0))
      case 'ca': return ((b.ca || 10) - (a.ca || 10))
      case 'pv': return ((b.pv_maximo || 10) - (a.pv_maximo || 10))
      default: return a.nome.localeCompare(b.nome, 'pt-BR')
    }
  })

  const labelFiltro: Record<FiltroTipo, string> = {
    todos: 'Todos',
    jogador: '👤 Jogadores',
    npc: '🧙 NPCs',
    monstro: '👹 Monstros',
  }

  if (!campanhaAtiva) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <Users className="w-12 h-12 text-[var(--border)] mx-auto mb-3" />
          <p className="font-cinzel text-[var(--text3)] text-xl mb-2">Nenhuma campanha selecionada</p>
          <p className="text-[var(--text3)] text-sm font-crimson">
            Selecione uma campanha no menu lateral para ver os personagens
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-cinzel text-[var(--gold)] text-xl font-bold">Personagens</h2>
          <p className="text-[var(--text3)] text-sm font-crimson">
            {ordenados.length} de {personagens.length} personagens · {campanhaAtiva.nome}
            {(() => {
              const lim = getPlano(plano).limites.personagens
              if (typeof lim === 'number') return (
                <span className={`ml-2 text-xs font-cinzel ${personagens.length >= lim ? 'text-[var(--red2)]' : 'text-[var(--text3)]'}`}>
                  ({personagens.length}/{lim})
                </span>
              )
            })()}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <BotaoRunico variante="secundario" tamanho="sm" onClick={carregar}>
            <RefreshCw className="w-3 h-3" />
          </BotaoRunico>
          {!ehJogador && (
            <button
              onClick={() => {
                const next = !mostrarInativos
                setMostrarInativos(next)
                if (next) carregarInativos()
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs font-cinzel transition-colors ${mostrarInativos ? 'border-[var(--accent2)] text-[var(--accent2)]' : 'border-[var(--border)] text-[var(--text3)] hover:border-[var(--gold)] hover:text-[var(--gold)]'}`}
            >
              {mostrarInativos ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {mostrarInativos ? 'Ocultar inativos' : 'Ver inativos'}
            </button>
          )}
          <a
            href="/ficha-dnd5e-pt.pdf"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] text-[var(--text2)] rounded text-xs font-cinzel hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
          >
            <Download className="w-3 h-3" /> Ficha Oficial
          </a>
          <BotaoImportarFicha />
          {ehJogador && !!campanhaAtiva && (
            <Link
              href="/personagens/criar"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent2)] text-[var(--bg)] rounded text-xs font-cinzel hover:opacity-90 transition-opacity"
            >
              ✨ Criar Personagem
            </Link>
          )}
          <BotaoRunico variante="ouro" tamanho="sm" onClick={() => setCriando(true)}>
            <Plus className="w-3 h-3" /> {ehJogador ? 'Minha Ficha' : 'Novo Personagem'}
          </BotaoRunico>
        </div>
      </div>

      {!ehJogador && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <div className="flex gap-1">
            {(['todos', 'jogador', 'npc', 'monstro'] as FiltroTipo[]).map(tipo => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={`px-2 py-1 rounded text-xs font-cinzel transition-colors ${
                  filtroTipo === tipo
                    ? 'bg-[var(--accent)] text-[var(--bg)]'
                    : 'bg-[var(--surface)] text-[var(--text3)] hover:bg-[var(--surface2)]'
                }`}
              >
                {labelFiltro[tipo]}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <select
            value={ordenacao}
            onChange={e => setOrdenacao(e.target.value as Ordenacao)}
            className="input-dd text-xs py-1"
          >
            <option value="nome">Nome A-Z</option>
            <option value="nivel">Nível ↓</option>
            <option value="xp">Experiência ↓</option>
            <option value="ca">CA ↓</option>
            <option value="pv">PV ↓</option>
          </select>
        </div>
      )}

      {criando && (
        <PainelGrimorio titulo={ehJogador ? 'Criar Minha Ficha' : 'Novo Personagem'} ornamentado className="mb-4 max-w-md">
          <form onSubmit={criarPersonagem} className="space-y-3">
            {!ehJogador && (
              <div>
                <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Tipo</label>
                <select value={tipoNovo} onChange={e => setTipoNovo(e.target.value as typeof tipoNovo)} className="w-full input-dd mt-1">
                  <option value="jogador">👤 Jogador</option>
                  <option value="npc">🧙 NPC</option>
                  <option value="monstro">👹 Monstro</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Nome do Personagem</label>
              <input type="text" value={nomeNovo} onChange={e => setNomeNovo(e.target.value)} className="w-full input-dd mt-1" placeholder="Gandalf" required />
            </div>
            {!ehJogador && (
              <div>
                <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Nome do Jogador</label>
                <input type="text" value={jogadorNovo} onChange={e => setJogadorNovo(e.target.value)} className="w-full input-dd mt-1" placeholder="João" />
              </div>
            )}
            <div className="flex gap-2">
              <BotaoRunico type="submit" variante="ouro" tamanho="sm">Criar</BotaoRunico>
              <BotaoRunico type="button" variante="fantasma" tamanho="sm" onClick={() => setCriando(false)}>Cancelar</BotaoRunico>
            </div>
          </form>
        </PainelGrimorio>
      )}

      {/* Fechar menu ao clicar fora */}
      {menuAberto && (
        <div className="fixed inset-0 z-[5]" onClick={() => setMenuAberto(null)} />
      )}

      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 bg-[var(--bg2)] border border-[var(--border)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : ordenados.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-cinzel text-[var(--border)] text-lg mb-2">
            {filtroTipo !== 'todos' ? `Nenhum ${labelFiltro[filtroTipo]}` : 'Nenhum aventureiro'}
          </p>
          <p className="text-[var(--border)] text-sm font-crimson mb-4">Crie o primeiro personagem da campanha</p>
          <BotaoRunico variante="ouro" onClick={() => setCriando(true)}>
            <Plus className="w-4 h-4" /> Criar Personagem
          </BotaoRunico>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {ordenados.map(p => (
            <CardPersonagem
              key={p.id}
              p={p}
              isDm={!ehJogador}
              menuAberto={menuAberto === p.id}
              onToggleMenu={() => setMenuAberto(menuAberto === p.id ? null : p.id)}
              onInativar={() => inativarPersonagem(p.id)}
              onDeletar={() => { setMenuAberto(null); setConfirmarDeletar(p.id) }}
            />
          ))}
        </div>
      )}

      {/* Seção de personagens inativos */}
      {mostrarInativos && personagensInativos.length > 0 && (
        <div className="mt-6">
          <h3 className="font-cinzel text-[var(--text3)] text-sm mb-3 flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5" /> Personagens Inativos ({personagensInativos.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {personagensInativos.map(p => (
              <CardPersonagem
                key={p.id}
                p={p}
                isDm={!ehJogador}
                menuAberto={false}
                onToggleMenu={() => {}}
                onInativar={() => {}}
                onDeletar={() => setConfirmarDeletar(p.id)}
                inativo
                onReativar={() => reativarPersonagem(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {mostrarInativos && personagensInativos.length === 0 && (
        <div className="mt-6 text-center py-4">
          <p className="text-[var(--border)] text-sm font-crimson">Nenhum personagem inativo</p>
        </div>
      )}

      {/* Modal de confirmação de exclusão permanente */}
      {confirmarDeletar && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setConfirmarDeletar(null)}
        >
          <div
            className="bg-[var(--bg2)] border border-[var(--red2)] rounded-lg p-5 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-cinzel text-[var(--red2)] text-base font-bold mb-2">Excluir Permanentemente?</h3>
            <p className="text-[var(--text2)] text-sm font-crimson mb-1">
              Você está prestes a excluir <span className="text-[var(--text)] font-bold">
                {[...personagens, ...personagensInativos].find(p => p.id === confirmarDeletar)?.nome ?? 'este personagem'}
              </span>.
            </p>
            <p className="text-[var(--text3)] text-xs font-crimson mb-4">Esta ação é irreversível. Todos os dados do personagem serão apagados.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmarDeletar(null)}
                className="px-3 py-1.5 text-xs font-cinzel text-[var(--text2)] border border-[var(--border)] rounded hover:border-[var(--text)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deletarPersonagem(confirmarDeletar)}
                className="px-3 py-1.5 text-xs font-cinzel text-white bg-[var(--red2)] rounded hover:opacity-90 transition-colors"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
