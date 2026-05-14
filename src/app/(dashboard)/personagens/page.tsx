'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Personagem } from '@/types/dnd'
import { MiniCard } from '@/components/personagem/MiniCard'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PersonagensPage() {
  const [personagens, setPersonagens] = useState<Personagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [nomeNovo, setNomeNovo] = useState('')
  const [jogadorNovo, setJogadorNovo] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      if (!campanhas?.[0]) { setCarregando(false); return }

      const { data } = await supabase.from('personagens').select('*').eq('campanha_id', campanhas[0].id).eq('ativo', true)
      setPersonagens((data ?? []) as Personagem[])
    } finally {
      setCarregando(false)
    }
  }

  async function criarPersonagem(e: React.FormEvent) {
    e.preventDefault()
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      let campanhaId = campanhas?.[0]?.id

      if (!campanhaId) {
        const { data: nova } = await supabase.from('campanhas').insert({ dm_id: user.id, nome: 'Minha Campanha' }).select().single()
        campanhaId = nova?.id
      }

      const { error } = await supabase.from('personagens').insert({
        campanha_id: campanhaId,
        nome: nomeNovo,
        jogador_nome: jogadorNovo || 'Jogador',
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
      })
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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-cinzel text-[#d4a843] text-lg font-bold">Personagens</h2>
          <p className="text-[#8870a8] text-sm font-crimson">{personagens.length} personagens na campanha ativa</p>
        </div>
        <div className="flex gap-2">
          <BotaoRunico variante="secundario" tamanho="sm" onClick={carregar}>
            <RefreshCw className="w-3 h-3" />
          </BotaoRunico>
          <BotaoRunico variante="ouro" tamanho="sm" onClick={() => setCriando(true)}>
            <Plus className="w-3 h-3" /> Novo Personagem
          </BotaoRunico>
        </div>
      </div>

      {criando && (
        <PainelGrimorio titulo="Novo Personagem" ornamentado className="mb-4 max-w-md">
          <form onSubmit={criarPersonagem} className="space-y-3">
            <div>
              <label className="text-[#8870a8] text-xs font-cinzel uppercase">Nome do Personagem</label>
              <input type="text" value={nomeNovo} onChange={e => setNomeNovo(e.target.value)} className="w-full input-dd" placeholder="Gandalf" required />
            </div>
            <div>
              <label className="text-[#8870a8] text-xs font-cinzel uppercase">Nome do Jogador</label>
              <input type="text" value={jogadorNovo} onChange={e => setJogadorNovo(e.target.value)} className="w-full input-dd" placeholder="João" />
            </div>
            <div className="flex gap-2">
              <BotaoRunico type="submit" variante="ouro" tamanho="sm">Criar</BotaoRunico>
              <BotaoRunico type="button" variante="fantasma" tamanho="sm" onClick={() => setCriando(false)}>Cancelar</BotaoRunico>
            </div>
          </form>
        </PainelGrimorio>
      )}

      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 bg-[#150f18] border border-[#4a3060] rounded animate-pulse" />
          ))}
        </div>
      ) : personagens.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-cinzel text-[#4a3060] text-lg mb-2">Nenhum aventureiro</p>
          <p className="text-[#4a3060] text-sm font-crimson mb-4">Crie o primeiro personagem da campanha</p>
          <BotaoRunico variante="ouro" onClick={() => setCriando(true)}>
            <Plus className="w-4 h-4" /> Criar Personagem
          </BotaoRunico>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {personagens.map(p => <MiniCard key={p.id} personagem={p} />)}
        </div>
      )}
    </div>
  )
}
