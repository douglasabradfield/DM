'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      router.push('/batalha')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0a0e] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-10 h-10 text-[#d4a843]" />
          </div>
          <h1 className="font-cinzel text-2xl text-[#d4a843] font-bold">Dungeon Desk</h1>
          <p className="text-[#8870a8] mt-1 font-crimson">Sua mesa, seu mundo, sua aventura</p>
        </div>

        <PainelGrimorio ornamentado titulo="Entrar na Mesa">
          <form onSubmit={entrar} className="space-y-4">
            <div>
              <label className="block text-[#b8a8cc] text-sm mb-1 font-cinzel text-xs uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full input-dd"
                placeholder="dm@aventura.com"
                required
              />
            </div>
            <div>
              <label className="block text-[#b8a8cc] text-sm mb-1 font-cinzel text-xs uppercase tracking-wider">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full input-dd"
                placeholder="••••••••"
                required
              />
            </div>
            <BotaoRunico type="submit" variante="ouro" tamanho="lg" className="w-full" carregando={carregando}>
              ✦ Entrar
            </BotaoRunico>
          </form>

          <div className="mt-4 text-center">
            <p className="text-[#8870a8] text-sm font-crimson">
              Não tem conta?{' '}
              <Link href="/cadastro" className="text-[#d4a843] hover:text-[#f0c060] transition-colors">
                Criar conta gratuita
              </Link>
            </p>
          </div>
        </PainelGrimorio>
      </div>
    </div>
  )
}
