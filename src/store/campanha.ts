import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Campanha, Sessao } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface EstadoCampanha {
  campanhaAtiva: Campanha | null
  sessaoAtiva: Sessao | null
  campanhas: Campanha[]
  papelPorCampanha: Record<string, 'dm' | 'jogador'>

  setCampanhaAtiva: (campanha: Campanha | null) => void
  setSessaoAtiva: (sessao: Sessao | null) => void
  setCampanhas: (campanhas: Campanha[]) => void
  carregarCampanhas: () => Promise<void>

  // Sessão — ambiente da mesa, independente de batalha (pode conter 0..N)
  iniciarSessao: (titulo?: string) => Promise<Sessao>
  encerrarSessao: () => Promise<void>
  carregarSessaoAtiva: (campanhaId: string) => Promise<void>
}

// Canal Realtime da sessão — vive fora do state reativo, mesmo padrão do
// canalAtual/canalBatalhaId em store/batalha.ts.
let canalSessaoAtual: RealtimeChannel | null = null
let canalSessaoCampanhaId: string | null = null

interface LinhaSessao {
  id: string
  campanha_id: string
  status: string
}

function assinarRealtimeSessao(campanhaId: string, set: (fn: (s: EstadoCampanha) => Partial<EstadoCampanha>) => void) {
  if (canalSessaoAtual && canalSessaoCampanhaId === campanhaId) return
  if (canalSessaoAtual) {
    createClient().removeChannel(canalSessaoAtual)
    canalSessaoAtual = null
    canalSessaoCampanhaId = null
  }

  const supabase = createClient()
  const channel = supabase
    .channel(`sessao:${campanhaId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessoes', filter: `campanha_id=eq.${campanhaId}` },
      (payload: RealtimePostgresChangesPayload<LinhaSessao>) => {
        const linha = payload.new as LinhaSessao | undefined
        if (!linha?.id) return
        if (linha.status === 'encerrada') {
          set(s => (s.sessaoAtiva?.id === linha.id ? { sessaoAtiva: null } : {}))
        } else {
          set(() => ({ sessaoAtiva: linha as unknown as Sessao }))
        }
      }
    )
    .subscribe()

  canalSessaoAtual = channel
  canalSessaoCampanhaId = campanhaId
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

      iniciarSessao: async (titulo) => {
        const campanhaId = get().campanhaAtiva?.id
        if (!campanhaId) throw new Error('Nenhuma campanha selecionada')

        const supabase = createClient()
        const { data: ultima } = await supabase
          .from('sessoes')
          .select('numero')
          .eq('campanha_id', campanhaId)
          .not('numero', 'is', null)
          .order('numero', { ascending: false })
          .limit(1)
          .maybeSingle()
        const proximoNumero = (ultima?.numero ?? 0) + 1

        const { data: sessao, error } = await supabase
          .from('sessoes')
          .insert({
            campanha_id: campanhaId,
            numero: proximoNumero,
            titulo: titulo?.trim() || `Sessão ${proximoNumero}`,
            status: 'ativa',
            iniciada_em: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) throw error

        set({ sessaoAtiva: sessao as Sessao })
        assinarRealtimeSessao(campanhaId, set)
        return sessao as Sessao
      },

      encerrarSessao: async () => {
        const sessaoId = get().sessaoAtiva?.id
        if (!sessaoId) return

        const supabase = createClient()
        const { error } = await supabase
          .from('sessoes')
          .update({ status: 'encerrada', concluida_em: new Date().toISOString() })
          .eq('id', sessaoId)

        if (error) throw error
        set({ sessaoAtiva: null })
      },

      carregarSessaoAtiva: async (campanhaId) => {
        const supabase = createClient()
        const { data: sessao } = await supabase
          .from('sessoes')
          .select('*')
          .eq('campanha_id', campanhaId)
          .neq('status', 'encerrada')
          .maybeSingle()

        set({ sessaoAtiva: (sessao as Sessao) ?? null })
        assinarRealtimeSessao(campanhaId, set)
      },

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
