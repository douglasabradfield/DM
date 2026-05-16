import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClient } from '@/lib/supabase/client'
import type { Campanha, Sessao } from '@/types/database'

interface EstadoCampanha {
  campanhaAtiva: Campanha | null
  sessaoAtiva: Sessao | null
  campanhas: Campanha[]

  setCampanhaAtiva: (campanha: Campanha | null) => void
  setSessaoAtiva: (sessao: Sessao | null) => void
  setCampanhas: (campanhas: Campanha[]) => void
  carregarCampanhas: () => Promise<void>
}

export const useCampanha = create<EstadoCampanha>()(
  persist(
    (set, get) => ({
      campanhaAtiva: null,
      sessaoAtiva: null,
      campanhas: [],

      setCampanhaAtiva: (campanha) => set({ campanhaAtiva: campanha }),
      setSessaoAtiva: (sessao) => set({ sessaoAtiva: sessao }),
      setCampanhas: (campanhas) => set({ campanhas }),

      carregarCampanhas: async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('campanhas')
          .select('*')
          .eq('dm_id', user.id)
          .order('criado_em', { ascending: false })
        if (data) {
          set({ campanhas: data as Campanha[] })
          const { campanhaAtiva } = get()
          if (!campanhaAtiva && data.length > 0) {
            const primeira = (data as Campanha[]).find(c => c.ativa) ?? data[0] as Campanha
            set({ campanhaAtiva: primeira })
          }
        }
      },
    }),
    { name: 'dungeon-desk-campanha' }
  )
)
