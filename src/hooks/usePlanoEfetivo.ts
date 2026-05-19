'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'

export function usePlanoEfetivo() {
  const { campanhaAtiva, papelPorCampanha } = useCampanha()
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
      const planoProprio = perfil?.plano || 'free'

      if (!campanhaAtiva) {
        setPlanoEfetivo(planoProprio)
        return
      }

      const papel = papelPorCampanha[campanhaAtiva.id]

      if (papel === 'dm' || !papel) {
        setPlanoEfetivo(planoProprio)
        return
      }

      // Jogador: usar plano_efetivo da campanha (calculado no store)
      const planoEfetivoCampanha = (campanhaAtiva as { plano_efetivo?: string }).plano_efetivo
      if (planoEfetivoCampanha) {
        setPlanoEfetivo(planoEfetivoCampanha)
        return
      }

      // Fallback: buscar plano do DM da campanha
      const { data: dmPerfil } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', campanhaAtiva.dm_id)
        .single()

      setPlanoEfetivo(dmPerfil?.plano || planoProprio)
    }
    verificar()
  }, [campanhaAtiva?.id, papelPorCampanha])

  return planoEfetivo
}
