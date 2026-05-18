'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'

export function usePlanoEfetivo() {
  const { campanhaAtiva } = useCampanha()
  const [planoEfetivo, setPlanoEfetivo] = useState('free')

  useEffect(() => {
    async function verificar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPlanoEfetivo('free'); return }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .single()

      const planoProprio = perfil?.plano ?? 'free'

      if (!campanhaAtiva?.id) { setPlanoEfetivo(planoProprio); return }

      // DM usa sempre o plano próprio
      if (campanhaAtiva.dm_id === user.id) { setPlanoEfetivo(planoProprio); return }

      // Jogador convidado herda o plano_efetivo da campanha
      const { data: membro } = await supabase
        .from('campanha_membros')
        .select('plano_efetivo, status')
        .eq('campanha_id', campanhaAtiva.id)
        .eq('user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()

      setPlanoEfetivo(membro?.plano_efetivo ?? planoProprio)
    }
    verificar()
  }, [campanhaAtiva?.id])

  return planoEfetivo
}
