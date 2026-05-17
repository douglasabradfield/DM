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

        const { data: comoDm } = await supabase
          .from('campanhas')
          .select('*')
          .eq('dm_id', user.id)
          .order('criado_em', { ascending: false })

        const { data: membros } = await supabase
          .from('campaign_members')
          .select('papel, campanhas(*)')
          .eq('user_id', user.id)

        const papelPorCampanha: Record<string, 'dm' | 'jogador'> = {}
        const campanhasMembro: Campanha[] = []

        for (const c of comoDm ?? []) {
          papelPorCampanha[c.id] = 'dm'
        }

        for (const m of membros ?? []) {
          const camp = m.campanhas as unknown as Campanha
          if (camp && !papelPorCampanha[camp.id]) {
            papelPorCampanha[camp.id] = m.papel as 'dm' | 'jogador'
            campanhasMembro.push(camp)
          }
        }

        const todas = [...(comoDm as Campanha[] ?? []), ...campanhasMembro]
        set({ campanhas: todas, papelPorCampanha })

        const { campanhaAtiva } = get()
        if (!campanhaAtiva && todas.length > 0) {
          const primeira = todas.find(c => c.ativa) ?? todas[0]
          set({ campanhaAtiva: primeira })
        }
      },
    }),
    { name: 'dungeon-desk-campanha' }
  )
)
