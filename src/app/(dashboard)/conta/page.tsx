'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLANOS, formatarPreco } from '@/lib/stripe/produtos'
import type { Profile } from '@/types/database'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { Check, Crown, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ContaPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [carregando, setCarregando] = useState(true)

  // Perfil
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  // Senha
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [alterandoSenha, setAlterandoSenha] = useState(false)

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        const p = data as Profile
        setProfile(p)
        setNome(p.nome ?? '')
        setUsername(p.username ?? '')
        setTelefone(p.telefone ?? '')
      }
      setCarregando(false)
    }
    carregar()
  }, [])

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setSalvandoPerfil(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('profiles').update({
        nome: nome.trim() || null,
        username: username.trim() || null,
        telefone: telefone.trim() || null,
      }).eq('id', user.id)
      if (error) throw error
      toast.success('Perfil atualizado!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvandoPerfil(false)
    }
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (novaSenha !== confirmarSenha) { toast.error('Senhas não coincidem'); return }
    if (novaSenha.length < 6) { toast.error('Senha deve ter pelo menos 6 caracteres'); return }
    setAlterandoSenha(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      setNovaSenha('')
      setConfirmarSenha('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha')
    } finally {
      setAlterandoSenha(false)
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
    } catch { toast.error('Erro ao iniciar checkout') }
  }

  if (carregando) return <div className="p-4 text-[var(--text3)] text-sm font-crimson animate-pulse">Carregando...</div>

  const planoAtual = profile?.plano ?? 'free'

  return (
    <div className="p-4 max-w-3xl space-y-6">
      <h2 className="font-cinzel text-[var(--gold)] text-xl font-bold">Minha Conta</h2>

      {/* Perfil */}
      <PainelGrimorio titulo="Perfil" ornamentado>
        <form onSubmit={salvarPerfil} className="space-y-3 max-w-sm">
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full input-dd" placeholder="Seu nome" />
          </div>
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Usuário</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                className="w-full input-dd pl-7"
                placeholder="seu_usuario"
                maxLength={30}
              />
            </div>
            <p className="text-[var(--text3)] text-[10px] mt-1">Apenas letras, números e _</p>
          </div>
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Telefone</label>
            <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full input-dd" placeholder="+55 11 99999-9999" />
          </div>
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Email</label>
            <input type="email" value={profile?.email ?? ''} disabled className="w-full input-dd opacity-50" />
          </div>
          <BotaoRunico type="submit" variante="ouro" tamanho="sm" carregando={salvandoPerfil}>
            Salvar Perfil
          </BotaoRunico>
        </form>
      </PainelGrimorio>

      {/* Segurança */}
      <PainelGrimorio titulo="Segurança" ornamentado>
        <form onSubmit={alterarSenha} className="space-y-3 max-w-sm">
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Nova Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                className="w-full input-dd pr-9"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text)]"
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Confirmar Nova Senha</label>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)}
              className="w-full input-dd"
              placeholder="Repita a senha"
            />
            {novaSenha && confirmarSenha && novaSenha !== confirmarSenha && (
              <p className="text-[var(--red2)] text-[10px] mt-1">Senhas não coincidem</p>
            )}
          </div>
          <BotaoRunico
            type="submit"
            variante="secundario"
            tamanho="sm"
            carregando={alterandoSenha}
            disabled={!novaSenha || novaSenha !== confirmarSenha}
          >
            Alterar Senha
          </BotaoRunico>
        </form>
      </PainelGrimorio>

      <DivisorOrnamentado texto="Plano" />

      {/* Planos */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {PLANOS.map(plano => {
          const atual = planoAtual === plano.id
          return (
            <div
              key={plano.id}
              className={`relative bg-[var(--bg2)] border rounded-lg p-4 transition-all ${
                plano.destaque ? 'border-[var(--gold)]' : atual ? 'border-[var(--accent)]' : 'border-[var(--border)]'
              }`}
            >
              {plano.destaque && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[var(--gold)] text-[var(--bg)] text-[10px] font-cinzel font-bold rounded">
                  POPULAR
                </div>
              )}
              {atual && (
                <div className="absolute -top-2 right-3 flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)] text-white text-[10px] font-cinzel rounded">
                  <Crown className="w-2.5 h-2.5" /> Seu plano
                </div>
              )}
              <h3 className="font-cinzel text-[var(--text)] font-bold mb-1 text-sm">{plano.nome}</h3>
              <div className="mb-2">
                <span className="font-cinzel text-lg font-bold" style={{ color: `var(--${plano.cor})` }}>
                  {formatarPreco(plano.preco)}
                </span>
                <span className="text-[var(--text3)] text-xs">{plano.periodo}</span>
              </div>
              <p className="text-[var(--text3)] text-xs font-crimson mb-3">{plano.descricao}</p>
              <ul className="space-y-1 mb-4">
                {plano.recursos.map(r => (
                  <li key={r} className="flex items-start gap-1.5 text-xs text-[var(--text2)] font-crimson">
                    <Check className="w-3 h-3 text-[var(--green2)] flex-shrink-0 mt-0.5" />
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
                <div className="text-center text-xs text-[var(--accent)] font-cinzel">✦ Plano Ativo ✦</div>
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
            <p className="text-[var(--text)] text-sm font-crimson">Excluir conta permanentemente</p>
            <p className="text-[var(--text3)] text-xs">Esta ação não pode ser desfeita</p>
          </div>
          <BotaoRunico variante="perigo" tamanho="sm" onClick={() => toast.error('Contate o suporte para excluir sua conta')}>
            Excluir Conta
          </BotaoRunico>
        </div>
      </PainelGrimorio>
    </div>
  )
}
