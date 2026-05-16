import { createClient } from '@/lib/supabase/server'
import type { Personagem } from '@/types/dnd'
import { FichaPersonagem } from '@/components/personagem/FichaPersonagem'
import { BotaoCopiarPersonagem } from '@/components/personagem/BotaoCopiarPersonagem'
import { notFound } from 'next/navigation'

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('personagens').select('*').eq('id', id).single()
  if (!data) notFound()

  return (
    <div className="p-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto mb-3 flex justify-end">
        <BotaoCopiarPersonagem personagemId={id} personagemNome={data.nome} />
      </div>
      <FichaPersonagem personagem={data as Personagem} />
    </div>
  )
}
