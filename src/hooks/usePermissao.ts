'use client'

import { useCampanha } from '@/store/campanha'

export function usePermissao() {
  const { campanhaAtiva, papelPorCampanha } = useCampanha()

  const ehDM = campanhaAtiva
    ? papelPorCampanha[campanhaAtiva.id] === 'dm'
    : true // sem campanha, assume DM para não bloquear

  const ehJogador = campanhaAtiva
    ? papelPorCampanha[campanhaAtiva.id] === 'jogador'
    : false

  const podeEditar = (userId: string, donoId: string) => ehDM || userId === donoId

  return { ehDM, ehJogador, podeEditar }
}
