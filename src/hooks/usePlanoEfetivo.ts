'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'

export function usePlanoEfetivo() {
  const { campanhaAtiva } = useCampanha()
  const [planoEfetivo, setPlanoEfetivo] = useState('free')

  useEffect(() => {
    if (campanhaAtiva?.plano_efetivo) {
      setPlanoEfetivo(campanhaAtiva.plano_efetivo)
      return
    }

    async function verificar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPlanoEfetivo('free'); return }

      const { data: perfil } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', user.id)
        .single()

      setPlanoEfetivo(perfil?.plano ?? 'free')
    }
    verificar()
  }, [campanhaAtiva?.id, campanhaAtiva?.plano_efetivo])

  return planoEfetivo
}
