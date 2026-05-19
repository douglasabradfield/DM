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

        const papelPorCampanha: Record<string, 'dm' | 'jogador'> = {}

        // Campanhas onde é DM
        const { data: comoDm } = await supabase
          .from('campanhas')
          .select('*')
          .eq('dm_id', user.id)
          .order('criado_em', { ascending: false })

        for (const c of comoDm ?? []) {
          papelPorCampanha[c.id] = 'dm'
        }

        // Campanhas via tabela legada campaign_members
        const { data: membrosLegado } = await supabase
          .from('campaign_members')
          .select('papel, campanhas(*)')
          .eq('user_id', user.id)

        const campanhasLegado: Campanha[] = []
        for (const m of membrosLegado ?? []) {
          const camp = m.campanhas as unknown as Campanha
          if (camp && !papelPorCampanha[camp.id]) {
            papelPorCampanha[camp.id] = m.papel as 'dm' | 'jogador'
            campanhasLegado.push(camp)
          }
        }

        // Campanhas via tabela nova campanha_membros (status ativo)
        const { data: membrosNovos } = await supabase
          .from('campanha_membros')
          .select('campanha_id, plano_efetivo, papel')
          .eq('user_id', user.id)
          .eq('status', 'ativo')

        const idsMembrosNovos = (membrosNovos ?? [])
          .map(m => m.campanha_id)
          .filter(id => !papelPorCampanha[id])

        const campanhasNovas: Campanha[] = []
        if (idsMembrosNovos.length > 0) {
          const { data: campanhasData } = await supabase
            .from('campanhas')
            .select('*')
            .in('id', idsMembrosNovos)

          for (const camp of campanhasData ?? []) {
            if (!papelPorCampanha[camp.id]) {
              const membro = membrosNovos?.find(m => m.campanha_id === camp.id)
              papelPorCampanha[camp.id] = (membro?.papel as 'dm' | 'jogador') ?? 'jogador'
              campanhasNovas.push(camp)
            }
          }
        }

        const todas = [
          ...(comoDm as Campanha[] ?? []),
          ...campanhasLegado,
          ...campanhasNovas,
        ]

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
