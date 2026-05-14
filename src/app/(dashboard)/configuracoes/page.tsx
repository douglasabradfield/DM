'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLANOS, formatarPreco } from '@/lib/stripe/produtos'
import type { Profile } from '@/types/database'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { Check, Crown } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data as Profile)
        setNome(data.nome ?? '')
      }
      setCarregando(false)
    }
    carregar()
  }, [])

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ nome }).eq('id', user.id)
      toast.success('Perfil atualizado!')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function assinar(priceId: string) {
    try {
      const res = await fetch('/api/stripe/criar-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      toast.error('Erro ao iniciar checkout')
    }
  }

  const planoAtual = profile?.plano ?? 'free'

  if (carregando) return <div className="p-4 text-[#8870a8]">Carregando...</div>

  return (
    <div className="p-4 max-w-4xl space-y-6">
      <h2 className="font-cinzel text-[#d4a843] text-xl font-bold">Configurações</h2>

      {/* Perfil */}
      <PainelGrimorio titulo="Perfil do DM" ornamentado>
        <form onSubmit={salvarPerfil} className="space-y-3 max-w-sm">
          <div>
            <label className="text-[#8870a8] text-xs font-cinzel uppercase">Nome do DM</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full input-dd mt-1" />
          </div>
          <div>
            <label className="text-[#8870a8] text-xs font-cinzel uppercase">Email</label>
            <input type="text" value={profile?.email ?? ''} disabled className="w-full input-dd mt-1 opacity-50" />
          </div>
          <BotaoRunico type="submit" variante="ouro" tamanho="sm" carregando={salvando}>
            Salvar Perfil
          </BotaoRunico>
        </form>
      </PainelGrimorio>

      <DivisorOrnamentado texto="Planos" />

      {/* Planos */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {PLANOS.map(plano => {
          const atual = planoAtual === plano.id
          return (
            <div
              key={plano.id}
              className={`relative bg-[#150f18] border rounded-lg p-4 transition-all ${
                plano.destaque ? 'border-[#d4a843]' : atual ? 'border-[#9b59b6]' : 'border-[#4a3060]'
              }`}
            >
              {plano.destaque && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#d4a843] text-[#0d0a0e] text-[10px] font-cinzel font-bold rounded">
                  POPULAR
                </div>
              )}
              {atual && (
                <div className="absolute -top-2 right-3 flex items-center gap-1 px-2 py-0.5 bg-[#9b59b6] text-white text-[10px] font-cinzel rounded">
                  <Crown className="w-2.5 h-2.5" /> Seu plano
                </div>
              )}

              <h3 className="font-cinzel text-[#e8dff0] font-bold mb-1">{plano.nome}</h3>
              <div className="mb-2">
                <span className="font-cinzel text-xl font-bold" style={{ color: `var(--${plano.cor})` }}>
                  {formatarPreco(plano.preco)}
                </span>
                <span className="text-[#8870a8] text-xs">{plano.periodo}</span>
              </div>
              <p className="text-[#8870a8] text-xs font-crimson mb-3">{plano.descricao}</p>

              <ul className="space-y-1 mb-4">
                {plano.recursos.map(r => (
                  <li key={r} className="flex items-start gap-1.5 text-xs text-[#b8a8cc] font-crimson">
                    <Check className="w-3 h-3 text-[#27ae60] flex-shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>

              {!atual && plano.preco > 0 && (
                <BotaoRunico
                  variante={plano.destaque ? 'ouro' : 'secundario'}
                  tamanho="sm"
                  className="w-full"
                  onClick={() => assinar(plano.stripe_price_id ?? '')}
                >
                  Assinar
                </BotaoRunico>
              )}
              {atual && (
                <div className="text-center text-xs text-[#9b59b6] font-cinzel">✦ Plano Ativo ✦</div>
              )}
              {!atual && plano.preco === 0 && planoAtual !== 'free' && (
                <div className="text-center text-xs text-[#4a3060] font-crimson">Plano gratuito</div>
              )}
            </div>
          )
        })}
      </div>

      <DivisorOrnamentado />

      {/* Zona de perigo */}
      <PainelGrimorio titulo="Zona de Perigo" compacto>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#e8dff0] text-sm font-crimson">Excluir conta permanentemente</p>
            <p className="text-[#8870a8] text-xs">Esta ação não pode ser desfeita</p>
          </div>
          <BotaoRunico variante="perigo" tamanho="sm" onClick={() => toast.error('Contate o suporte para excluir sua conta')}>
            Excluir Conta
          </BotaoRunico>
        </div>
      </PainelGrimorio>
    </div>
  )
}
