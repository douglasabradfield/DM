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
        set({ campanhas: [], campanhaAtiva: null, papelPorCampanha: {} })

        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: perfil } = await supabase
          .from('profiles')
          .select('plano')
          .eq('id', user.id)
          .single()
        const planoProprio = perfil?.plano ?? 'free'

        const { data: todas } = await supabase
          .from('campanhas')
          .select('*')
          .eq('status', 'ativa')
          .order('criado_em', { ascending: false })

        const { data: membros } = await supabase
          .from('campanha_membros')
          .select('campanha_id, plano_efetivo, papel')
          .eq('user_id', user.id)
          .eq('status', 'ativo')

        const idsMembro = membros?.map(m => m.campanha_id) || []

        const campanhasFiltradas = (todas || []).filter(c =>
          c.dm_id === user.id || idsMembro.includes(c.id)
        )

        const papelPorCampanha: Record<string, 'dm' | 'jogador'> = {}
        const campanhasComPapel = campanhasFiltradas.map(c => {
          const papel: 'dm' | 'jogador' = c.dm_id === user.id ? 'dm' : 'jogador'
          papelPorCampanha[c.id] = papel
          const plano_efetivo = c.dm_id === user.id
            ? planoProprio
            : membros?.find(m => m.campanha_id === c.id)?.plano_efetivo || 'free'
          return { ...c, papel, plano_efetivo }
        })

        set({ campanhas: campanhasComPapel, papelPorCampanha })

        const { campanhaAtiva } = get()
        if (!campanhaAtiva && campanhasComPapel.length > 0) {
          const primeira = campanhasComPapel.find(c => c.ativa) ?? campanhasComPapel[0]
          set({ campanhaAtiva: primeira })
        }
      },
    }),
    { name: 'dungeon-desk-campanha', partialize: () => ({}) }
  )
)
