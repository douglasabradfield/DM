import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClient } from '@/lib/supabase/client'
import type { Campanha, Sessao } from '@/types/database'

interface EstadoCampanha {
  campanhaAtiva: Campanha | null
  sessaoAtiva: Sessao | null
  campanhas: Campanha[]
  papelPorCampanha: Record<string, 'dm' | 'jogador'>

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
      papelPorCampanha: {},

      setCampanhaAtiva: (campanha) => set({ campanhaAtiva: campanha }),
      setSessaoAtiva: (sessao) => set({ sessaoAtiva: sessao }),
      setCampanhas: (campanhas) => set({ campanhas }),

      carregarCampanhas: async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // RLS filtra automaticamente: retorna campanhas onde é DM + onde foi adicionado como membro
        const { data: todas } = await supabase
          .from('campanhas')
          .select('*')
          .eq('status', 'ativa')
          .order('criado_em', { ascending: false })

        const papelPorCampanha: Record<string, 'dm' | 'jogador'> = {}
        for (const c of todas ?? []) {
          papelPorCampanha[c.id] = c.dm_id === user.id ? 'dm' : 'jogador'
        }

        set({ campanhas: todas ?? [], papelPorCampanha })

        const { campanhaAtiva } = get()
        if (!campanhaAtiva && (todas ?? []).length > 0) {
          const primeira = (todas ?? []).find(c => c.ativa) ?? todas![0]
          set({ campanhaAtiva: primeira })
        }
      },
    }),
    { name: 'dungeon-desk-campanha' }
  )
)
