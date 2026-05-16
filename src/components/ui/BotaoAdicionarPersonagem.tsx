'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Ataque, ItemInventario } from '@/types/dnd'

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
  const [aberto, setAberto] = useState(false)
  const [personagens, setPersonagens] = useState<PersonagemOpcao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [adicionando, setAdicionando] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    carregarPersonagens()
  }, [aberto])

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  async function carregarPersonagens() {
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      if (!campanhas?.[0]) return
      const { data } = await supabase
        .from('personagens')
        .select('id, nome, classe, nivel')
        .eq('campanha_id', campanhas[0].id)
        .eq('ativo', true)
        .eq('tipo_personagem', 'jogador')
        .order('nome')
      setPersonagens((data ?? []) as PersonagemOpcao[])
    } finally {
      setCarregando(false)
    }
  }

  async function adicionar(personagem: PersonagemOpcao) {
    setAdicionando(personagem.id)
    try {
      const supabase = createClient()

      if (tipo === 'magia' && dadosExtras?.magia_id) {
        const jaExiste = await supabase
          .from('magias_personagem')
          .select('id')
          .eq('personagem_id', personagem.id)
          .eq('magia_id', dadosExtras.magia_id as string)
          .maybeSingle()

        if (jaExiste.data) {
          toast.error(`${personagem.nome} já conhece ${nome}`)
          return
        }

        const { error } = await supabase.from('magias_personagem').insert({
          personagem_id: personagem.id,
          magia_id: dadosExtras.magia_id as string,
          nome,
          nivel: (dadosExtras.nivel as number) ?? 0,
          preparada: false,
          classe_conjuradora: personagem.classe ?? '',
        })
        if (error) throw error
      } else if (tipo === 'arma') {
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
      } else {
        const { data: p } = await supabase.from('personagens').select('inventario').eq('id', personagem.id).single()
        const inventario = ((p?.inventario ?? []) as ItemInventario[])
        const itemId = (dadosExtras?.item_id as string) ?? null
        const idxExistente = itemId ? inventario.findIndex(i => i.id === itemId) : -1
        let novoInventario: ItemInventario[]
        if (idxExistente >= 0) {
          novoInventario = inventario.map((item, i) =>
            i === idxExistente ? { ...item, quantidade: item.quantidade + 1 } : item
          )
        } else {
          const novoItem: ItemInventario = {
            id: itemId ?? crypto.randomUUID(),
            nome,
            tipo: (dadosExtras?.tipo as string) ?? null,
            raridade: (dadosExtras?.raridade as string) ?? null,
            quantidade: 1,
            descricao: (dadosExtras?.descricao as string) ?? null,
          }
          novoInventario = [...inventario, novoItem]
        }
        const { error } = await supabase.from('personagens').update({ inventario: novoInventario }).eq('id', personagem.id)
        if (error) throw error
      }

      toast.success(`${nome} adicionado a ${personagem.nome}!`)
      setAberto(false)
    } catch {
      toast.error('Erro ao adicionar')
    } finally {
      setAdicionando(null)
    }
  }

  const labelTipo = tipo === 'magia' ? 'Ensinar magia a' : 'Adicionar a'

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
        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-[var(--bg2)] border border-[var(--border)] rounded shadow-xl">
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">{labelTipo}</p>
          </div>
          {carregando ? (
            <div className="p-3 text-center text-[var(--text3)] text-xs">Carregando...</div>
          ) : personagens.length === 0 ? (
            <div className="p-3 text-center text-[var(--border)] text-xs font-crimson">Nenhum personagem jogador</div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {personagens.map(p => (
                <button
                  key={p.id}
                  onClick={() => adicionar(p)}
                  disabled={adicionando === p.id}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                >
                  <div className="text-[var(--text)] text-sm font-crimson">{p.nome}</div>
                  <div className="text-[var(--text3)] text-[10px]">{p.classe} Nv{p.nivel}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
