'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import toast from 'react-hot-toast'
import {
  MSG_USERNAME_EM_USO, USERNAME_MAX, USERNAME_MIN,
  erroUsernameEmUso, normalizarUsername, validarUsername,
} from '@/lib/username'

/**
 * Bloqueia o app para contas antigas sem username: ele é o nome usado para
 * adicionar a pessoa a uma campanha.
 */
export function ExigirUsername({ userId }: { userId: string }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const erro = validarUsername(username)
    if (erro) { toast.error(erro); return }
    setSalvando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('profiles').update({ username }).eq('id', userId)
      if (error) {
        if (erroUsernameEmUso(error)) { toast.error(MSG_USERNAME_EM_USO); return }
        throw error
      }
      toast.success('Nome de usuário definido!')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm">
        <PainelGrimorio ornamentado titulo="Defina seu nome de usuário">
          <form onSubmit={salvar} className="space-y-3">
            <p className="text-[var(--text2)] text-sm font-crimson">
              Para continuar, escolha um nome de usuário. É com ele que os mestres adicionam você às campanhas.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(normalizarUsername(e.target.value))}
                className="w-full input-dd pl-7"
                placeholder="seu_usuario"
                required
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                autoFocus
              />
            </div>
            <p className="text-[var(--text3)] text-[10px]">Apenas letras minúsculas, números e _ (sem espaços)</p>
            <BotaoRunico type="submit" variante="ouro" tamanho="sm" carregando={salvando}>
              Salvar
            </BotaoRunico>
          </form>
        </PainelGrimorio>
      </div>
    </div>
  )
}
