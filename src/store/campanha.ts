import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
        // Ler ID salvo ANTES de limpar o estado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const idSalvo = (get() as any).campanhaAtivaId as string | null

        set({ campanhas: [], campanhaAtiva: null, papelPorCampanha: {} })

        const resp = await fetch('/api/campanhas/minhas')
        if (!resp.ok) return
        const { campanhas } = await resp.json()

        const papelPorCampanha: Record<string, 'dm' | 'jogador'> = {}
        for (const c of campanhas) {
          papelPorCampanha[c.id] = c.papel
        }

        set({ campanhas, papelPorCampanha })

        if (idSalvo) {
          const campanhaSalva = campanhas.find((c: Campanha) => c.id === idSalvo)
          if (campanhaSalva) {
            set({ campanhaAtiva: campanhaSalva })
            return
          }
        }

        if (campanhas.length > 0) {
          set({ campanhaAtiva: campanhas[0] })
        }
      },
    }),
    {
      name: 'dungeon-desk-campanha',
      partialize: (state) => ({
        campanhaAtivaId: state.campanhaAtiva?.id || null,
      }),
    }
  )
)
