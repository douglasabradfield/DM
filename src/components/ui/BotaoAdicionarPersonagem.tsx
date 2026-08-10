'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { UserPlus, ChevronDown, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Ataque } from '@/types/dnd'

interface BotaoAdicionarPersonagemProps {
  tipo: 'item' | 'arma' | 'magia'
  nome: string
  dadosExtras?: Record<string, unknown>
}

interface PersonagemOpcao {
  id: string
  nome: string
  classe: string | null
  nivel: number
}

export function BotaoAdicionarPersonagem({ tipo, nome, dadosExtras }: BotaoAdicionarPersonagemProps) {
  const { campanhaAtiva, papelPorCampanha } = useCampanha()
  const campanhaId = campanhaAtiva?.id ?? null
  const ehJogador = campanhaId ? papelPorCampanha[campanhaId] === 'jogador' : false

  const [aberto, setAberto] = useState(false)
  const [personagens, setPersonagens] = useState<PersonagemOpcao[]>([])
  const [jaTemMagia, setJaTemMagia] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [adicionando, setAdicionando] = useState<string | null>(null)
  const [preparada, setPreparada] = useState(false)
  const [quantidade, setQuantidade] = useState(1)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    carregarPersonagens()
    setPreparada(false)
    setQuantidade(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  async function carregarPersonagens() {
    if (!campanhaId) { setPersonagens([]); return }
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('personagens')
        .select('id, nome, classe, nivel, user_id')
        .eq('campanha_id', campanhaId)
        .eq('ativo', true)
        .eq('tipo_personagem', 'jogador')
        .order('nome')
      // Jogador só vê (e só pode alterar) o próprio personagem — a API de
      // inventário/magias já rejeitaria a escrita em ficha alheia, mas
      // nem oferecer a opção evita o "não controla este personagem" na cara.
      if (ehJogador) query = query.eq('user_id', user.id)

      const { data } = await query
      const lista = (data ?? []) as PersonagemOpcao[]
      setPersonagens(lista)

      const spellId = tipo === 'magia' ? Number(dadosExtras?.spell_id ?? dadosExtras?.magia_id) : null
      if (spellId && lista.length > 0) {
        const { data: existentes } = await supabase
          .from('magias_personagem')
          .select('personagem_id')
          .eq('spell_id', spellId)
          .in('personagem_id', lista.map(p => p.id))
        setJaTemMagia(new Set((existentes ?? []).map(e => e.personagem_id as string)))
      } else {
        setJaTemMagia(new Set())
      }
    } finally {
      setCarregando(false)
    }
  }

  async function adicionarItemViaApi(personagemId: string) {
    const resp = await fetch('/api/mesa/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personagemId,
        tipo: 'adicionar_item',
        itemRef: (dadosExtras?.slug as string) ?? (dadosExtras?.item_ref as string) ?? null,
        nome,
        tipoItem: (dadosExtras?.tipo as string) ?? null,
        raridade: (dadosExtras?.raridade as string) ?? null,
        descricaoItem: (dadosExtras?.descricao as string) ?? null,
        quantidade,
      }),
    })
    const resultado = await resp.json().catch(() => null)
    if (!resp.ok) throw new Error(resultado?.erro ?? 'Erro ao adicionar item')
  }

  async function adicionarMagia(personagem: PersonagemOpcao) {
    const spellId = Number(dadosExtras?.spell_id ?? dadosExtras?.magia_id)
    const supabase = createClient()
    const { error } = await supabase.from('magias_personagem').insert({
      personagem_id: personagem.id,
      spell_id: spellId,
      magia_id: null,
      nome,
      nivel: (dadosExtras?.nivel as number) ?? 0,
      preparada,
      classe_conjuradora: personagem.classe ?? '',
    })
    if (error) throw error
  }

  async function removerMagia(personagemId: string) {
    const spellId = Number(dadosExtras?.spell_id ?? dadosExtras?.magia_id)
    const supabase = createClient()
    const { error } = await supabase
      .from('magias_personagem')
      .delete()
      .eq('personagem_id', personagemId)
      .eq('spell_id', spellId)
    if (error) throw error
  }

  async function adicionarArma(personagem: PersonagemOpcao) {
    const supabase = createClient()
    const { data: p } = await supabase.from('personagens').select('ataques').eq('id', personagem.id).single()
    const ataques = ((p?.ataques ?? []) as Ataque[])
    const novoAtaque: Ataque = {
      nome,
      bonus_ataque: '+0',
      dano: (dadosExtras?.dano as string) ?? '',
      tipo_dano: (dadosExtras?.tipo_dano as string) ?? '',
      notas: '',
    }
    const { error } = await supabase.from('personagens').update({ ataques: [...ataques, novoAtaque] }).eq('id', personagem.id)
    if (error) throw error
  }

  async function tratarClique(personagem: PersonagemOpcao) {
    setAdicionando(personagem.id)
    try {
      if (tipo === 'magia') {
        if (jaTemMagia.has(personagem.id)) {
          if (!confirm(`Remover ${nome} de ${personagem.nome}?`)) return
          await removerMagia(personagem.id)
          setJaTemMagia(prev => { const novo = new Set(prev); novo.delete(personagem.id); return novo })
          toast.success(`${nome} removida de ${personagem.nome}`)
          return
        }
        await adicionarMagia(personagem)
        setJaTemMagia(prev => new Set(prev).add(personagem.id))
      } else if (tipo === 'arma') {
        await adicionarArma(personagem)
      } else {
        await adicionarItemViaApi(personagem.id)
      }
      toast.success(`${nome} ${tipo === 'magia' ? 'adicionada' : 'adicionado'} a ${personagem.nome}!`)
      setAberto(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar')
    } finally {
      setAdicionando(null)
    }
  }

  const labelTipo = tipo === 'magia' ? 'Ensinar magia a' : tipo === 'item' ? 'Adicionar ao inventário de' : 'Adicionar a'

  const conteudoLista = (
    <>
      <div className="px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">{labelTipo}</p>
      </div>

      {tipo === 'magia' && (
        <label className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] text-xs font-crimson text-[var(--text2)] flex-shrink-0 cursor-pointer">
          <input type="checkbox" checked={preparada} onChange={e => setPreparada(e.target.checked)} className="w-3.5 h-3.5 accent-[var(--accent)]" />
          Marcar como preparada
        </label>
      )}

      {tipo === 'item' && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
          <span className="text-xs font-cinzel text-[var(--text2)]">Quantidade</span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setQuantidade(q => Math.max(1, q - 1))}
              className="w-7 h-7 rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--surface2)] flex items-center justify-center text-sm font-bold"
            >−</button>
            <input
              type="number"
              inputMode="numeric"
              value={quantidade}
              onChange={e => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
              onFocus={e => e.target.select()}
              className="w-10 text-center input-dd text-sm py-1"
            />
            <button
              type="button"
              onClick={() => setQuantidade(q => q + 1)}
              className="w-7 h-7 rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--surface2)] flex items-center justify-center text-sm font-bold"
            >+</button>
          </div>
        </div>
      )}

      {!campanhaId ? (
        <div className="p-3 text-center text-[var(--border)] text-xs font-crimson">Selecione uma campanha</div>
      ) : carregando ? (
        <div className="p-3 text-center text-[var(--text3)] text-xs">Carregando...</div>
      ) : personagens.length === 0 ? (
        <div className="p-3 text-center text-[var(--border)] text-xs font-crimson">
          {ehJogador ? 'Você não tem um personagem ativo nesta campanha' : 'Nenhum personagem jogador ativo'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {personagens.map(p => {
            const jaTem = tipo === 'magia' && jaTemMagia.has(p.id)
            return (
              <button
                key={p.id}
                onClick={() => tratarClique(p)}
                disabled={adicionando === p.id}
                className="w-full text-left px-3 py-2.5 hover:bg-[var(--surface)] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text)] text-sm font-crimson">{p.nome}</div>
                  <div className="text-[var(--text3)] text-[10px]">{p.classe} Nv{p.nivel}</div>
                </div>
                {jaTem && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--green2)] font-cinzel flex-shrink-0">
                    <Check className="w-3 h-3" /> remover
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] rounded text-xs font-cinzel hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        {labelTipo} personagem
        <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <>
          {/* Mobile: folha inferior */}
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setAberto(false)} />
          <div className="fixed inset-x-0 bottom-0 above-bottomnav z-50 md:hidden flex flex-col
                          bg-[var(--bg2)] border-t border-[var(--border)] rounded-t-xl shadow-2xl max-h-[70vh]">
            {conteudoLista}
          </div>

          {/* Desktop: dropdown ancorado no botão, inalterado */}
          <div className="hidden md:flex absolute right-0 top-full mt-1 z-50 w-64 max-h-80 flex-col
                          bg-[var(--bg2)] border border-[var(--border)] rounded shadow-xl">
            {conteudoLista}
          </div>
        </>
      )}
    </div>
  )
}
