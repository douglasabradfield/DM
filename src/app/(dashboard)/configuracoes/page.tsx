'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { PLANOS, formatarPreco } from '@/lib/stripe/produtos'
import type { Profile, Campanha } from '@/types/database'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { Check, Crown, X, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

function SecaoCampanhas() {
  const { campanhaAtiva, campanhas, setCampanhaAtiva, carregarCampanhas } = useCampanha()
  const [editando, setEditando] = useState<string | null>(null)
  const [formCampanha, setFormCampanha] = useState({ nome: '', descricao: '', sistema: 'D&D 5e' })
  const [salvando, setSalvando] = useState(false)
  const [encerrando, setEncerrando] = useState<string | null>(null)
  const [cronicaModal, setCronicaModal] = useState<{ nome: string; resumo: string } | null>(null)

  useEffect(() => { carregarCampanhas() }, [carregarCampanhas])

  async function salvarCampanha(id: string) {
    setSalvando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('campanhas')
        .update({ nome: formCampanha.nome, descricao: formCampanha.descricao, sistema: formCampanha.sistema })
        .eq('id', id)
      if (error) throw error
      toast.success('Campanha atualizada!')
      setEditando(null)
      await carregarCampanhas()
    } catch {
      toast.error('Erro ao salvar campanha')
    } finally {
      setSalvando(false)
    }
  }

  async function encerrarCampanha(id: string, nome: string) {
    if (!confirm(`Encerrar a campanha "${nome}"? A IA irá gerar uma crônica final.`)) return
    setEncerrando(id)
    try {
      let resumo = ''
      try {
        const res = await fetch('/api/ia/resumo-campanha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campanhaId: id }),
        })
        const dados = await res.json()
        resumo = dados.resumo || ''
      } catch {
        // IA falhou — encerra sem crônica
      }

      const supabase = createClient()
      await supabase.from('campanhas').update({ ativa: false }).eq('id', id)
      if (campanhaAtiva?.id === id) setCampanhaAtiva(null)
      await carregarCampanhas()
      toast.success('Campanha encerrada!')

      if (resumo) {
        setCronicaModal({ nome, resumo })
      }
    } catch {
      toast.error('Erro ao encerrar campanha')
    } finally {
      setEncerrando(null)
    }
  }

  async function reativarCampanha(id: string) {
    const supabase = createClient()
    await supabase.from('campanhas').update({ ativa: true }).eq('id', id)
    toast.success('Campanha reativada')
    await carregarCampanhas()
  }

  async function criarCampanha() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('campanhas')
      .insert({ dm_id: user.id, nome: 'Nova Campanha', sistema: 'D&D 5e', ativa: true })
      .select()
      .single()
    if (error) { toast.error(`Erro: ${error.message}`); return }
    toast.success('Campanha criada!')
    await carregarCampanhas()
    if (data) setCampanhaAtiva(data as Campanha)
  }

  const ativas = campanhas.filter(c => c.ativa !== false)
  const encerradas = campanhas.filter(c => c.ativa === false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-cinzel text-[var(--gold)] text-base font-bold">Campanhas</h3>
        <button
          onClick={criarCampanha}
          className="px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] rounded font-cinzel text-xs transition-colors"
        >
          + Nova Campanha
        </button>
      </div>

      <div className="space-y-2">
        {ativas.map(campanha => (
          <CampanhaCard
            key={campanha.id}
            campanha={campanha}
            ativa={campanhaAtiva?.id === campanha.id}
            editando={editando === campanha.id}
            form={formCampanha}
            salvando={salvando}
            encerrando={encerrando === campanha.id}
            onAtivar={() => setCampanhaAtiva(campanha)}
            onEditar={() => {
              setFormCampanha({ nome: campanha.nome, descricao: campanha.descricao ?? '', sistema: campanha.sistema ?? 'D&D 5e' })
              setEditando(campanha.id)
            }}
            onSalvar={() => salvarCampanha(campanha.id)}
            onCancelar={() => setEditando(null)}
            onEncerrar={() => encerrarCampanha(campanha.id, campanha.nome)}
            onChange={setFormCampanha}
          />
        ))}

        {encerradas.length > 0 && (
          <>
            <p className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wider pt-2">Encerradas</p>
            {encerradas.map(campanha => (
              <div key={campanha.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 opacity-60 flex items-center justify-between">
                <div>
                  <p className="font-cinzel text-[var(--text2)] text-sm">{campanha.nome}</p>
                  <p className="text-[var(--text3)] text-xs">{campanha.sistema}</p>
                </div>
                <div className="flex items-center gap-1">
                  {campanha.resumo_final && (
                    <button
                      onClick={() => setCronicaModal({ nome: campanha.nome, resumo: campanha.resumo_final! })}
                      className="text-xs px-2 py-1 border border-[var(--accent)] text-[var(--accent)] rounded hover:bg-[var(--accent)]/10 transition-colors flex items-center gap-1"
                    >
                      <BookOpen className="w-3 h-3" /> Crônica
                    </button>
                  )}
                  <button
                    onClick={() => reativarCampanha(campanha.id)}
                    className="text-xs px-2 py-1 border border-[var(--border2)] text-[var(--text2)] rounded hover:bg-[var(--surface2)] transition-colors"
                  >
                    Reativar
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {campanhas.length === 0 && (
          <p className="text-[var(--text3)] text-sm font-crimson text-center py-4">Nenhuma campanha criada</p>
        )}
      </div>

      {/* Modal Crônica Final */}
      {cronicaModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setCronicaModal(null)}>
          <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-cinzel text-[var(--gold)] text-xl font-bold">📜 Crônica Final</h3>
                <p className="text-[var(--text3)] text-sm font-crimson italic">{cronicaModal.nome}</p>
              </div>
              <button onClick={() => setCronicaModal(null)} className="text-[var(--border)] hover:text-[var(--text)] transition-colors">
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

interface CampanhaCardProps {
  campanha: Campanha
  ativa: boolean
  editando: boolean
  form: { nome: string; descricao: string; sistema: string }
  salvando: boolean
  encerrando?: boolean
  onAtivar: () => void
  onEditar: () => void
  onSalvar: () => void
  onCancelar: () => void
  onEncerrar: () => void
  onChange: (f: { nome: string; descricao: string; sistema: string }) => void
}

function CampanhaCard({ campanha, ativa, editando, form, salvando, encerrando, onAtivar, onEditar, onSalvar, onCancelar, onEncerrar, onChange }: CampanhaCardProps) {
  return (
    <div className={`bg-[var(--surface)] border rounded-xl p-4 transition-all ${ativa ? 'border-[var(--gold)]' : 'border-[var(--border)]'}`}>
      {editando ? (
        <div className="space-y-3">
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Nome</label>
            <input type="text" value={form.nome} onChange={e => onChange({ ...form, nome: e.target.value })} className="input-dd w-full" />
          </div>
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={e => onChange({ ...form, descricao: e.target.value })} rows={2} className="input-dd w-full resize-none" />
          </div>
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Sistema</label>
            <select value={form.sistema} onChange={e => onChange({ ...form, sistema: e.target.value })} className="input-dd w-full">
              <option value="D&D 5e">D&D 5e</option>
              <option value="Pathfinder">Pathfinder</option>
              <option value="Call of Cthulhu">Call of Cthulhu</option>
              <option value="Tormenta">Tormenta</option>
              <option value="Vampiro: A Máscara">Vampiro: A Máscara</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={onSalvar} disabled={salvando} className="flex-1 py-1.5 bg-[var(--accent)] text-[var(--bg)] rounded font-cinzel text-xs disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onCancelar} className="flex-1 py-1.5 border border-[var(--border)] text-[var(--text2)] rounded text-xs">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-cinzel text-[var(--text)] font-bold text-sm">{campanha.nome}</p>
              {ativa && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--gold)]/20 border border-[var(--gold)] text-[var(--gold)] rounded font-cinzel">ATIVA</span>
              )}
            </div>
            {campanha.descricao && <p className="text-[var(--text3)] text-xs mt-0.5 truncate">{campanha.descricao}</p>}
            <p className="text-[var(--text3)] text-xs mt-0.5">{campanha.sistema}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!ativa && (
              <button onClick={onAtivar} className="text-xs px-2 py-1 border border-[var(--gold)] text-[var(--gold)] rounded hover:bg-[var(--gold)]/10 transition-colors">
                Ativar
              </button>
            )}
            <button onClick={onEditar} className="text-xs px-2 py-1 border border-[var(--border)] text-[var(--text2)] rounded hover:bg-[var(--surface2)] transition-colors">
              Editar
            </button>
            <button onClick={onEncerrar} disabled={encerrando} className="text-xs px-2 py-1 border border-[var(--red2)] text-[var(--red2)] rounded hover:bg-[var(--red2)]/10 transition-colors disabled:opacity-50">
              {encerrando ? '⏳ Encerrando...' : 'Encerrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data as Profile)
        setNome(data.nome ?? '')
      }
      setCarregando(false)
    }
    carregar()
  }, [])

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ nome }).eq('id', user.id)
      toast.success('Perfil atualizado!')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function assinar(priceId: string) {
    try {
      const res = await fetch('/api/stripe/criar-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      toast.error('Erro ao iniciar checkout')
    }
  }

  const planoAtual = profile?.plano ?? 'free'

  if (carregando) return <div className="p-4 text-[var(--text3)]">Carregando...</div>

  return (
    <div className="p-4 max-w-4xl space-y-6">
      <h2 className="font-cinzel text-[var(--gold)] text-xl font-bold">Configurações</h2>

      {/* Perfil */}
      <PainelGrimorio titulo="Perfil do DM" ornamentado>
        <form onSubmit={salvarPerfil} className="space-y-3 max-w-sm">
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Nome do DM</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full input-dd mt-1" />
          </div>
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Email</label>
            <input type="text" value={profile?.email ?? ''} disabled className="w-full input-dd mt-1 opacity-50" />
          </div>
          <BotaoRunico type="submit" variante="ouro" tamanho="sm" carregando={salvando}>
            Salvar Perfil
          </BotaoRunico>
        </form>
      </PainelGrimorio>

      <DivisorOrnamentado texto="Campanhas" />

      {/* Campanhas */}
      <PainelGrimorio titulo="Gerenciar Campanhas" ornamentado>
        <SecaoCampanhas />
      </PainelGrimorio>

      <DivisorOrnamentado texto="Planos" />

      {/* Planos */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {PLANOS.map(plano => {
          const atual = planoAtual === plano.id
          return (
            <div
              key={plano.id}
              className={`relative bg-[var(--bg2)] border rounded-lg p-4 transition-all ${
                plano.destaque ? 'border-[var(--gold)]' : atual ? 'border-[var(--accent)]' : 'border-[var(--border)]'
              }`}
            >
              {plano.destaque && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[var(--gold)] text-[var(--bg)] text-[10px] font-cinzel font-bold rounded">
                  POPULAR
                </div>
              )}
              {atual && (
                <div className="absolute -top-2 right-3 flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)] text-white text-[10px] font-cinzel rounded">
                  <Crown className="w-2.5 h-2.5" /> Seu plano
                </div>
              )}

              <h3 className="font-cinzel text-[var(--text)] font-bold mb-1">{plano.nome}</h3>
              <div className="mb-2">
                <span className="font-cinzel text-xl font-bold" style={{ color: `var(--${plano.cor})` }}>
                  {formatarPreco(plano.preco)}
                </span>
                <span className="text-[var(--text3)] text-xs">{plano.periodo}</span>
              </div>
              <p className="text-[var(--text3)] text-xs font-crimson mb-3">{plano.descricao}</p>

              <ul className="space-y-1 mb-4">
                {plano.recursos.map(r => (
                  <li key={r} className="flex items-start gap-1.5 text-xs text-[var(--text2)] font-crimson">
                    <Check className="w-3 h-3 text-[var(--green2)] flex-shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>

              {!atual && plano.preco > 0 && (
                <BotaoRunico
                  variante={plano.destaque ? 'ouro' : 'secundario'}
                  tamanho="sm"
                  className="w-full"
                  onClick={() => assinar(plano.stripe_price_id ?? '')}
                >
                  Assinar
                </BotaoRunico>
              )}
              {atual && (
                <div className="text-center text-xs text-[var(--accent)] font-cinzel">✦ Plano Ativo ✦</div>
              )}
              {!atual && plano.preco === 0 && planoAtual !== 'free' && (
                <div className="text-center text-xs text-[var(--border)] font-crimson">Plano gratuito</div>
              )}
            </div>
          )
        })}
      </div>

      <DivisorOrnamentado />

      {/* Zona de perigo */}
      <PainelGrimorio titulo="Zona de Perigo" compacto>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--text)] text-sm font-crimson">Excluir conta permanentemente</p>
            <p className="text-[var(--text3)] text-xs">Esta ação não pode ser desfeita</p>
          </div>
          <BotaoRunico variante="perigo" tamanho="sm" onClick={() => toast.error('Contate o suporte para excluir sua conta')}>
            Excluir Conta
          </BotaoRunico>
        </div>
      </PainelGrimorio>
    </div>
  )
}
