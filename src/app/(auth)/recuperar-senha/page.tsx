'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    try {
      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`
      })
    } catch {
      // Ignorado propositalmente — nunca revela se o e-mail existe
    } finally {
      // Sempre mostra a mesma mensagem, exista o e-mail ou não
      setEnviado(true)
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

        <PainelGrimorio ornamentado titulo="Recuperar Senha">
          {enviado ? (
            <div className="text-center space-y-4">
              <p className="text-[#b8a8cc] font-crimson">
                Se houver uma conta com esse e-mail, você receberá as instruções em instantes.
              </p>
              <Link href="/login" className="text-[#d4a843] hover:text-[#f0c060] transition-colors text-sm">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={enviar} className="space-y-4">
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
                <BotaoRunico type="submit" variante="ouro" tamanho="lg" className="w-full" carregando={carregando}>
                  ✦ Enviar Instruções
                </BotaoRunico>
              </form>

              <div className="mt-4 text-center">
                <p className="text-[#8870a8] text-sm font-crimson">
                  Lembrou a senha?{' '}
                  <Link href="/login" className="text-[#d4a843] hover:text-[#f0c060] transition-colors">
                    Entrar
                  </Link>
                </p>
              </div>
            </>
          )}
        </PainelGrimorio>
      </div>
    </div>
  )
}
