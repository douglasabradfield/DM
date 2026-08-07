'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { Swords, X } from 'lucide-react'

const CHAVE_DISPENSADO = 'dd-banner-batalha-dispensada'

export function BannerBatalhaAtiva() {
  const pathname = usePathname()
  const { campanhaAtiva } = useCampanha()
  const [batalhaAtivaId, setBatalhaAtivaId] = useState<string | null>(null)
  const [dispensadoId, setDispensadoId] = useState<string | null>(null)

  useEffect(() => {
    setDispensadoId(localStorage.getItem(CHAVE_DISPENSADO))
  }, [])

  useEffect(() => {
    if (!campanhaAtiva?.id) { setBatalhaAtivaId(null); return }

    let cancelado = false

    async function verificar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelado) return

      const { data: batalha } = await supabase
        .from('batalhas')
        .select('id')
        .eq('campanha_id', campanhaAtiva!.id)
        .eq('status', 'ativa')
        .maybeSingle()

      if (cancelado) return
      if (!batalha) { setBatalhaAtivaId(null); return }

      const { data: meusPersonagens } = await supabase
        .from('personagens')
        .select('id')
        .eq('campanha_id', campanhaAtiva!.id)
        .eq('user_id', user.id)

      if (cancelado) return

      const ids = (meusPersonagens ?? []).map(p => p.id)
      const filtro = ids.length > 0
        ? `controlado_por.eq.${user.id},personagem_id.in.(${ids.join(',')})`
        : `controlado_por.eq.${user.id}`

      const { data: combatente } = await supabase
        .from('batalha_combatentes')
        .select('id')
        .eq('batalha_id', batalha.id)
        .or(filtro)
        .limit(1)
        .maybeSingle()

      if (cancelado) return
      setBatalhaAtivaId(combatente ? batalha.id : null)
    }

    verificar()
    const intervalo = setInterval(verificar, 20000)
    return () => { cancelado = true; clearInterval(intervalo) }
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
