'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  linkToken: string
  autenticado: boolean
}

export function EntrarCampanha({ linkToken, autenticado }: Props) {
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  if (!autenticado) {
    const returnUrl = encodeURIComponent(`/entrar?c=${linkToken}`)
    return (
      <div className="space-y-4">
        <p className="text-[var(--text3)] font-crimson text-sm">Faça login para entrar na campanha.</p>
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

  async function entrar() {
    setEntrando(true)
    setErro('')
    try {
      const res = await fetch('/api/convites/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_token: linkToken }),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.erro)
      router.push('/personagens')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao entrar na campanha')
      setEntrando(false)
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
        onClick={entrar}
        disabled={entrando}
        className="px-8 py-3 bg-[var(--accent)] text-white rounded font-cinzel font-bold text-sm
                   hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
      >
        {entrando ? 'Entrando...' : 'Entrar na Campanha'}
      </button>
      <p className="text-[var(--text3)] text-xs font-crimson">
        Você entrará como jogador na campanha.
      </p>
    </div>
  )
}
