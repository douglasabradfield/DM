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
      const planoProprio = perfil?.plano || 'free'

      const plano = campanhaAtiva
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((campanhaAtiva as any).plano_efetivo || planoProprio)
        : planoProprio

      setPlanoEfetivo(plano)
    }
    verificar()
  }, [campanhaAtiva?.id, campanhaAtiva?.plano_efetivo])

  return planoEfetivo
}
