'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface BotaoCopiarPersonagemProps {
  personagemId: string
  personagemNome: string
}

export function BotaoCopiarPersonagem({ personagemId, personagemNome }: BotaoCopiarPersonagemProps) {
  const [copiando, setCopiando] = useState(false)
  const router = useRouter()

  async function copiar() {
    if (!confirm(`Copiar "${personagemNome}" para sua campanha ativa?`)) return
    setCopiando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Não autenticado'); return }

      // Garantir que existe uma campanha
      let { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).limit(1)
      let campanhaId = campanhas?.[0]?.id
      if (!campanhaId) {
        const { data: nova } = await supabase.from('campanhas').insert({ dm_id: user.id, nome: 'Minha Campanha' }).select().single()
        campanhaId = nova?.id
      }
      if (!campanhaId) { toast.error('Erro ao localizar campanha'); return }

      // Buscar personagem original
      const { data: original } = await supabase.from('personagens').select('*').eq('id', personagemId).single()
      if (!original) { toast.error('Personagem não encontrado'); return }

      // Criar cópia sem id, campanha_id, criado_em, atualizado_em
      const { id: _id, campanha_id: _cid, criado_em: _ce, atualizado_em: _ae, ...resto } = original
      const { data: copia, error } = await supabase.from('personagens').insert({
        ...resto,
        campanha_id: campanhaId,
        nome: `${original.nome} (cópia)`,
        ativo: true,
      }).select().single()

      if (error) throw error
      toast.success(`"${original.nome}" copiado para sua campanha!`)
      router.push(`/personagens/${copia.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao copiar personagem')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <button
      onClick={copiar}
      disabled={copiando}
      className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] rounded text-xs font-cinzel hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors disabled:opacity-50"
    >
      <Copy className="w-3.5 h-3.5" />
      {copiando ? 'Copiando...' : 'Copiar para minha campanha'}
    </button>
  )
}
