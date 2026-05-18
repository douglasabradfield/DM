'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Props {
  token: string
  autenticado: boolean
  campanhaId: string
}

export function AceitarConviteEfetivo({ token, autenticado, campanhaId }: Props) {
  const router = useRouter()
  const [aceitando, setAceitando] = useState(false)

  async function aceitar() {
    setAceitando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Faça login primeiro'); return }

      const { error } = await supabase
        .from('campanha_membros')
        .update({
          user_id: user.id,
          status: 'ativo',
          aceito_em: new Date().toISOString(),
        })
        .eq('token_convite', token)

      if (error) { toast.error('Erro ao aceitar convite'); return }

      // Sincronizar com campaign_members para que o sistema de roles funcione
      await supabase.from('campaign_members').upsert(
        { campanha_id: campanhaId, user_id: user.id, papel: 'jogador' },
        { onConflict: 'campanha_id,user_id' }
      )

      toast.success('Bem-vindo à campanha! ⚔️')
      router.push('/personagens')
    } finally {
      setAceitando(false)
    }
  }

  if (!autenticado) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--text2)] font-crimson text-sm">
          Você precisa estar logado para entrar na campanha.
        </p>
        <Link
          href={`/login?redirect=/convite/${token}`}
          className="block w-full py-3 bg-[var(--accent)] text-white rounded-lg font-cinzel font-bold text-center hover:opacity-90 transition-opacity"
        >
          Fazer Login / Cadastro
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[var(--text2)] font-crimson text-sm">
        Clique para aceitar o convite e entrar na campanha.
      </p>
      <button
        onClick={aceitar}
        disabled={aceitando}
        className="w-full py-3 bg-[var(--accent)] text-white rounded-lg font-cinzel font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {aceitando ? 'Entrando...' : '⚔️ Entrar na Campanha'}
      </button>
    </div>
  )
}
