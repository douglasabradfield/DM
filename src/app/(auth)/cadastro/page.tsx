'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CadastroPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (username.length < 3) {
      toast.error('O nome de usuário deve ter pelo menos 3 caracteres')
      return
    }
    setCarregando(true)
    try {
      const supabase = createClient()

      const { data: usernameExiste } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      if (usernameExiste) {
        toast.error('Este username já está em uso. Escolha outro.')
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } }
      })
      if (error) throw error

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email.toLowerCase().trim(),
          nome: nome.trim(),
          username: username.toLowerCase().trim(),
        })
      }

      toast.success('Conta criada! Verifique seu email.')
      router.push('/login')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar conta')
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
          <p className="text-[#8870a8] mt-1 font-crimson">Crie sua conta de Dungeon Master</p>
        </div>

        <PainelGrimorio ornamentado titulo="Criar Conta Gratuita">
          <form onSubmit={criar} className="space-y-4">
            <div>
              <label className="block text-[#b8a8cc] text-sm mb-1 font-cinzel text-xs uppercase tracking-wider">
                Nome do DM
              </label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full input-dd"
                placeholder="Mestre das Dungeons"
                required
              />
            </div>
            <div>
              <label className="block text-[#b8a8cc] text-sm mb-1 font-cinzel text-xs uppercase tracking-wider">
                Nome de Usuário
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8870a8]">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full input-dd pl-7"
                  placeholder="seu_usuario"
                  required
                  minLength={3}
                  maxLength={30}
                />
              </div>
              <p className="text-[#8870a8] text-[10px] mt-1">Apenas letras minúsculas, números e _ (sem espaços)</p>
            </div>
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
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <BotaoRunico type="submit" variante="ouro" tamanho="lg" className="w-full" carregando={carregando}>
              ✦ Criar Conta
            </BotaoRunico>
          </form>

          <div className="mt-4 text-center">
            <p className="text-[#8870a8] text-sm font-crimson">
              Já tem conta?{' '}
              <Link href="/login" className="text-[#d4a843] hover:text-[#f0c060] transition-colors">
                Entrar
              </Link>
            </p>
          </div>
        </PainelGrimorio>
      </div>
    </div>
  )
}
