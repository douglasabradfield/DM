import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Campanha, Sessao } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface FogImagem {
  ativo: boolean
  colunas: number
  linhas: number
  reveladas: Set<number>
}

interface EstadoCampanha {
  campanhaAtiva: Campanha | null
  sessaoAtiva: Sessao | null
  // Distingue "ainda não carregou" de "carregou e não há sessão" — sem
  // isso, sessaoAtiva null é ambíguo e telas guardadas por !sessaoAtiva
  // (ex: MesaCliente) mostram "nenhuma sessão" por um instante mesmo
  // quando existe uma, só porque o fetch ainda não voltou.
  sessaoCarregando: boolean
  campanhas: Campanha[]
  papelPorCampanha: Record<string, 'dm' | 'jogador'>
  // Fog of war por imagem (mapa) da campanha ativa — chave é imagem_id.
  fogPorImagem: Record<string, FogImagem>

  setCampanhaAtiva: (campanha: Campanha | null) => void
  setSessaoAtiva: (sessao: Sessao | null) => void
  setCampanhas: (campanhas: Campanha[]) => void
  carregarCampanhas: () => Promise<void>

  // Sessão — ambiente da mesa, independente de batalha (pode conter 0..N)
  iniciarSessao: (titulo?: string) => Promise<Sessao>
  encerrarSessao: () => Promise<void>
  // Chamado uma única vez, centralizado em Sidebar.tsx (montado por todo o
  // layout do dashboard) sempre que campanhaAtiva muda — não em cada tela
  // que lê sessaoAtiva. Ver comentário em Sidebar.tsx.
  carregarSessaoAtiva: (campanhaId: string) => Promise<void>

  // Mesmo padrão de carregarSessaoAtiva: chamado uma vez pela Sidebar sempre
  // que campanhaAtiva muda, não por cada tela que lê fogPorImagem — foi
  // exatamente esse o bug da sessão na Fase 3.5 (carga presa numa tela só).
  carregarFog: (campanhaId: string) => Promise<void>
  assinarFog: (campanhaId: string) => void
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

// Canal Realtime do fog of war — mesmo padrão de canalSessaoAtual acima.
let canalFogAtual: RealtimeChannel | null = null
let canalFogCampanhaId: string | null = null

interface LinhaFog {
  id: string
  imagem_id: string
  campanha_id: string
  ativo: boolean
  colunas: number
  linhas: number
  reveladas: number[]
}

function assinarRealtimeFog(campanhaId: string, set: (fn: (s: EstadoCampanha) => Partial<EstadoCampanha>) => void) {
  if (canalFogAtual && canalFogCampanhaId === campanhaId) return
  if (canalFogAtual) {
    createClient().removeChannel(canalFogAtual)
    canalFogAtual = null
    canalFogCampanhaId = null
  }

  const supabase = createClient()
  const channel = supabase
    .channel(`mapa_fog:${campanhaId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mapa_fog', filter: `campanha_id=eq.${campanhaId}` },
      (payload: RealtimePostgresChangesPayload<LinhaFog>) => {
        if (payload.eventType === 'DELETE') {
          const antiga = payload.old as Partial<LinhaFog> | undefined
          if (!antiga?.imagem_id) return
          set(s => {
            const resto = { ...s.fogPorImagem }
            delete resto[antiga.imagem_id as string]
            return { fogPorImagem: resto }
          })
          return
        }
        const linha = payload.new as LinhaFog | undefined
        if (!linha?.imagem_id) return
        set(s => ({
          fogPorImagem: {
            ...s.fogPorImagem,
            [linha.imagem_id]: {
              ativo: linha.ativo,
              colunas: linha.colunas,
              linhas: linha.linhas,
              reveladas: new Set(linha.reveladas ?? []),
            },
          },
        }))
      }
    )
    .subscribe()

  canalFogAtual = channel
  canalFogCampanhaId = campanhaId
}

export const useCampanha = create<EstadoCampanha>()(
  persist(
    (set, get) => ({
      campanhaAtiva: null,
      sessaoAtiva: null,
      sessaoCarregando: true,
      campanhas: [],
      papelPorCampanha: {},
      fogPorImagem: {},

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

        set({ sessaoAtiva: sessao as Sessao, sessaoCarregando: false })
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
        set({ sessaoAtiva: null, sessaoCarregando: false })
      },

      carregarSessaoAtiva: async (campanhaId) => {
        set({ sessaoCarregando: true })
        const supabase = createClient()
        const { data: sessao } = await supabase
          .from('sessoes')
          .select('*')
          .eq('campanha_id', campanhaId)
          .neq('status', 'encerrada')
          .maybeSingle()

        set({ sessaoAtiva: (sessao as Sessao) ?? null, sessaoCarregando: false })
        assinarRealtimeSessao(campanhaId, set)
      },

      carregarFog: async (campanhaId) => {
        const supabase = createClient()
        const { data } = await supabase
          .from('mapa_fog')
          .select('imagem_id, ativo, colunas, linhas, reveladas')
          .eq('campanha_id', campanhaId)

        const fogPorImagem: Record<string, FogImagem> = {}
        for (const linha of data ?? []) {
          fogPorImagem[linha.imagem_id] = {
            ativo: linha.ativo,
            colunas: linha.colunas,
            linhas: linha.linhas,
            reveladas: new Set(linha.reveladas ?? []),
          }
        }
        set({ fogPorImagem })
        assinarRealtimeFog(campanhaId, set)
      },

      assinarFog: (campanhaId) => assinarRealtimeFog(campanhaId, set),

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
