'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
  autenticado: boolean
}

export function AceitarConvite({ token, autenticado }: Props) {
  const [aceitando, setAceitando] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  if (!autenticado) {
    const returnUrl = encodeURIComponent(`/convite?token=${token}`)
    return (
      <div className="space-y-4">
        <p className="text-[var(--text3)] font-crimson text-sm">Faça login para aceitar o convite.</p>
        <a
          href={`/login?redirect=${returnUrl}`}
          className="inline-block px-8 py-3 bg-[var(--accent)] text-white rounded font-cinzel text-sm hover:opacity-90 transition-opacity"
        >
          Fazer Login
        </a>
        <p className="text-[var(--text3)] text-xs font-crimson">
          Não tem conta?{' '}
          <a href={`/cadastro?redirect=${returnUrl}`} className="text-[var(--accent)] hover:underline">
            Criar conta
          </a>
        </p>
      </div>
    )
  }

  async function aceitar() {
    setAceitando(true)
    setErro('')
    try {
      const res = await fetch('/api/convites/aceitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.erro)
      router.push('/personagens')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao aceitar convite')
      setAceitando(false)
    }
  }

  return (
    <div className="space-y-4">
      {erro && (
        <p className="text-[var(--red2)] text-sm font-crimson bg-[var(--red2)]/10 border border-[var(--red2)]/30 rounded px-3 py-2">
          {erro}
        </p>
      )}
      <button
        onClick={aceitar}
        disabled={aceitando}
        className="px-8 py-3 bg-[var(--accent)] text-white rounded font-cinzel font-bold text-sm
                   hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
      >
        {aceitando ? 'Aceitando...' : 'Aceitar Convite'}
      </button>
      <p className="text-[var(--text3)] text-xs font-crimson">
        Você entrará como jogador na campanha.
      </p>
    </div>
  )
}
