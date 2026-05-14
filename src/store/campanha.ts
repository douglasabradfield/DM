import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Campanha, Sessao } from '@/types/database'

interface EstadoCampanha {
  campanhaAtiva: Campanha | null
  sessaoAtiva: Sessao | null
  campanhas: Campanha[]

  setCampanhaAtiva: (campanha: Campanha | null) => void
  setSessaoAtiva: (sessao: Sessao | null) => void
  setCampanhas: (campanhas: Campanha[]) => void
}

export const useCampanha = create<EstadoCampanha>()(
  persist(
    (set) => ({
      campanhaAtiva: null,
      sessaoAtiva: null,
      campanhas: [],

      setCampanhaAtiva: (campanha) => set({ campanhaAtiva: campanha }),
      setSessaoAtiva: (sessao) => set({ sessaoAtiva: sessao }),
      setCampanhas: (campanhas) => set({ campanhas }),
    }),
    { name: 'dungeon-desk-campanha' }
  )
)
