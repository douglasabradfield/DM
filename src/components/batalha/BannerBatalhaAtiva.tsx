'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { Swords, X } from 'lucide-react'

const CHAVE_DISPENSADO = 'dd-banner-batalha-dispensada'

interface LinhaBatalha {
  id: string
  status: string
}

export function BannerBatalhaAtiva() {
  const pathname = usePathname()
  const { campanhaAtiva } = useCampanha()
  const [batalhaAtivaId, setBatalhaAtivaId] = useState<string | null>(null)
  const [dispensadoId, setDispensadoId] = useState<string | null>(null)

  useEffect(() => {
    setDispensadoId(localStorage.getItem(CHAVE_DISPENSADO))
  }, [])

  // Canal separado do canal por batalha_id usado pelo store: aqui o filtro é
  // campanha_id, porque o cliente ainda não sabe o batalha_id até detectar
  // que existe uma batalha ativa. Assinatura e limpeza são locais a este
  // efeito — não interfere no canal `batalha:${batalhaId}` do useBatalha.
  useEffect(() => {
    if (!campanhaAtiva?.id) { setBatalhaAtivaId(null); return }

    const campanhaId = campanhaAtiva.id
    const supabase = createClient()
    let cancelado = false
    let ultimoStatusConhecido: string | null = null

    async function usuarioControlaBatalha(batalhaId: string): Promise<boolean> {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { data: meusPersonagens } = await supabase
        .from('personagens')
        .select('id')
        .eq('campanha_id', campanhaId)
        .eq('user_id', user.id)

      const ids = (meusPersonagens ?? []).map(p => p.id)
      const filtro = ids.length > 0
        ? `controlado_por.eq.${user.id},personagem_id.in.(${ids.join(',')})`
        : `controlado_por.eq.${user.id}`

      const { data: combatente } = await supabase
        .from('batalha_combatentes')
        .select('id')
        .eq('batalha_id', batalhaId)
        .or(filtro)
        .limit(1)
        .maybeSingle()

      return !!combatente
    }

    // Só reconsulta batalha_combatentes quando o status realmente TRANSITA
    // para 'ativa' — updates de turno/rodada/revelação chegam como UPDATE
    // na mesma linha com status inalterado e são ignorados aqui.
    async function tratarLinha(linha: LinhaBatalha | null | undefined) {
      if (!linha?.id) return
      const statusAnterior = ultimoStatusConhecido
      ultimoStatusConhecido = linha.status

      if (linha.status !== 'ativa') {
        if (!cancelado) setBatalhaAtivaId(atual => (atual === linha.id ? null : atual))
        return
      }

      if (statusAnterior === 'ativa') return

      const controla = await usuarioControlaBatalha(linha.id)
      if (cancelado) return
      if (controla) setBatalhaAtivaId(linha.id)
    }

    async function verificarInicial() {
      const { data: batalha } = await supabase
        .from('batalhas')
        .select('id, status')
        .eq('campanha_id', campanhaId)
        .neq('status', 'encerrada')
        .maybeSingle()

      if (cancelado) return
      await tratarLinha(batalha)
    }

    verificarInicial()

    const canal = supabase
      .channel(`banner-batalha:${campanhaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'batalhas', filter: `campanha_id=eq.${campanhaId}` },
        (payload: RealtimePostgresChangesPayload<LinhaBatalha>) => tratarLinha(payload.new as LinhaBatalha)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'batalhas', filter: `campanha_id=eq.${campanhaId}` },
        (payload: RealtimePostgresChangesPayload<LinhaBatalha>) => tratarLinha(payload.new as LinhaBatalha)
      )
      .subscribe()

    return () => {
      cancelado = true
      supabase.removeChannel(canal)
    }
  }, [campanhaAtiva?.id])

  if (!batalhaAtivaId) return null
  if (pathname === '/mesa') return null
  if (dispensadoId === batalhaAtivaId) return null

  function dispensar() {
    if (!batalhaAtivaId) return
    localStorage.setItem(CHAVE_DISPENSADO, batalhaAtivaId)
    setDispensadoId(batalhaAtivaId)
  }

  return (
    <div className="fixed left-0 right-0 bottom-14 md:bottom-0 z-40 bg-[var(--gold)] text-[var(--bg)] px-3 py-2 flex items-center justify-center gap-3 shadow-lg">
      <Swords className="w-4 h-4 flex-shrink-0" />
      <span className="font-cinzel text-sm font-semibold">Batalha em andamento</span>
      <Link
        href="/mesa"
        className="px-3 py-1.5 rounded bg-[var(--bg)] text-[var(--gold)] text-xs font-cinzel font-bold hover:opacity-90 transition-opacity min-h-[36px] flex items-center"
      >
        Entrar
      </Link>
      <button onClick={dispensar} className="p-1.5 hover:opacity-70 transition-opacity" title="Dispensar">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
