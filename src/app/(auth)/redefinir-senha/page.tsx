'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const SENHA_MIN = 8

type Status = 'verificando' | 'pronto' | 'invalido'

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaConteudo />
    </Suspense>
  )
}

function RedefinirSenhaConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>('verificando')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    async function verificarLink() {
      const code = searchParams.get('code')
      const erroUrl = searchParams.get('error_description') || searchParams.get('error')

      if (erroUrl || !code) {
        setStatus('invalido')
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      setStatus(error ? 'invalido' : 'pronto')
    }
    verificarLink()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function redefinir(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < SENHA_MIN) {
      toast.error(`A senha deve ter pelo menos ${SENHA_MIN} caracteres`)
      return
    }
    if (senha !== confirmacao) {
      toast.error('As senhas não coincidem')
      return
    }
    setCarregando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      toast.success('Senha redefinida com sucesso!')
      router.push('/batalha')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao redefinir senha')
    } finally {
      setCarregando(false)
    }
  }

  const senhasDivergem = confirmacao.length > 0 && senha !== confirmacao

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

        <PainelGrimorio ornamentado titulo="Redefinir Senha">
          {status === 'verificando' && (
            <p className="text-[#b8a8cc] text-center font-crimson">Verificando link...</p>
          )}

          {status === 'invalido' && (
            <div className="text-center space-y-4">
              <p className="text-[#b8a8cc] font-crimson">
                Este link é inválido ou expirou. Solicite um novo para redefinir sua senha.
              </p>
              <Link
                href="/recuperar-senha"
                className="inline-block text-[#d4a843] hover:text-[#f0c060] transition-colors text-sm"
              >
                Pedir novo link
              </Link>
            </div>
          )}

          {status === 'pronto' && (
            <form onSubmit={redefinir} className="space-y-4">
              <div>
                <label className="block text-[#b8a8cc] text-sm mb-1 font-cinzel text-xs uppercase tracking-wider">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full input-dd"
                  placeholder={`Mínimo ${SENHA_MIN} caracteres`}
                  required
                  minLength={SENHA_MIN}
                />
              </div>
              <div>
                <label className="block text-[#b8a8cc] text-sm mb-1 font-cinzel text-xs uppercase tracking-wider">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  value={confirmacao}
                  onChange={e => setConfirmacao(e.target.value)}
                  className="w-full input-dd"
                  placeholder="Repita a senha"
                  required
                  minLength={SENHA_MIN}
                />
                {senhasDivergem && (
                  <p className="text-red-400 text-xs mt-1">As senhas não coincidem</p>
                )}
              </div>
              <BotaoRunico type="submit" variante="ouro" tamanho="lg" className="w-full" carregando={carregando}>
                ✦ Redefinir Senha
              </BotaoRunico>
            </form>
          )}
        </PainelGrimorio>
      </div>
    </div>
  )
}
