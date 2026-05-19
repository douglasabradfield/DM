'use client'

import { useState, useTransition } from 'react'
import type { UsuarioAdmin } from '@/app/(dashboard)/admin/page'
import { Crown, Shield, Users, Zap, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

const PLANOS = [
  { id: 'free',         nome: '🆓 Aventureiro', cor: 'text-[var(--text3)]',   bg: 'bg-[var(--bg3)]' },
  { id: 'heroi',        nome: 'Herói (legado)', cor: 'text-[var(--text2)]',   bg: 'bg-[var(--bg3)]' },
  { id: 'solo',         nome: '⚔️ Herói',       cor: 'text-[var(--accent2)]', bg: 'bg-[var(--accent)]/10' },
  { id: 'mesa_pro',     nome: '🧙 Mestre',      cor: 'text-[var(--gold)]',    bg: 'bg-[var(--gold)]/10' },
  { id: 'guild_master', nome: '🏰 Guilda',      cor: 'text-[var(--green2)]',  bg: 'bg-[var(--green)]/10' },
  { id: 'dm_supremo',   nome: '👑 DM Supremo',  cor: 'text-[var(--accent2)]', bg: 'bg-[var(--accent2)]/10' },
] as const

const STATUS_COR: Record<string, string> = {
  ativo:     'text-[var(--green2)] bg-[var(--green)]/10',
  trial:     'text-[var(--gold)] bg-[var(--gold)]/10',
  cancelado: 'text-[var(--red2)] bg-[var(--red2)]/10',
  pendente:  'text-[var(--text3)] bg-[var(--bg3)]',
}

interface PainelAdminProps {
  usuarios: UsuarioAdmin[]
  adminAtualId: string
}

export function PainelAdmin({ usuarios: inicial, adminAtualId }: PainelAdminProps) {
  const [usuarios, setUsuarios] = useState(inicial)
  const [busca, setBusca] = useState('')
  const [filtroPlan, setFiltroPlan] = useState('')
  const [, startTransition] = useTransition()

  const filtrados = usuarios.filter(u => {
    const q = busca.toLowerCase()
    if (q && !u.email.toLowerCase().includes(q) && !(u.nome ?? '').toLowerCase().includes(q) && !(u.username ?? '').toLowerCase().includes(q)) return false
    if (filtroPlan && u.plano !== filtroPlan) return false
    return true
  })

  // Metrics
  const totalUsuarios = usuarios.length
  const porPlano = PLANOS.map(p => ({
    ...p,
    count: usuarios.filter(u => u.plano === p.id).length,
  }))
  const comAssinaturaAtiva = usuarios.filter(u => u.assinatura_status === 'ativo').length

  async function alterarPlano(usuarioId: string, novoPlano: string) {
    const anterior = usuarios.find(u => u.id === usuarioId)?.plano
    startTransition(() => {
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, plano: novoPlano as UsuarioAdmin['plano'] } : u))
    })

    try {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}/plano`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: novoPlano }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.erro ?? 'Erro desconhecido')
      }
      toast.success(`Plano atualizado para ${PLANOS.find(p => p.id === novoPlano)?.nome}`)
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`)
      // Revert
      startTransition(() => {
        setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, plano: anterior! } : u))
      })
    }
  }

  async function alterarAdmin(usuarioId: string, novoValor: boolean) {
    if (usuarioId === adminAtualId && !novoValor) {
      toast.error('Você não pode remover sua própria permissão de admin')
      return
    }

    startTransition(() => {
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, is_admin: novoValor } : u))
    })

    try {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: novoValor }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.erro ?? 'Erro desconhecido')
      }
      toast.success(novoValor ? 'Admin concedido' : 'Admin removido')
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`)
      startTransition(() => {
        setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, is_admin: !novoValor } : u))
      })
    }
  }

  return (
    <div className="p-4 max-w-7xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-[var(--gold)]" />
        <div>
          <h1 className="font-cinzel text-[var(--gold)] text-xl font-bold">Painel Administrador</h1>
          <p className="text-[var(--text3)] text-xs font-crimson">Gerenciamento de usuários e planos</p>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-3 flex flex-col items-center justify-center col-span-1">
          <Users className="w-5 h-5 text-[var(--accent2)] mb-1" />
          <span className="font-cinzel text-[var(--gold)] text-2xl font-bold">{totalUsuarios}</span>
          <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider">Total</span>
        </div>

        {/* Por plano */}
        {porPlano.map(p => (
          <div key={p.id} className={`rounded-xl p-3 flex flex-col items-center justify-center border border-[var(--border)] ${p.bg}`}>
            <span className={`font-cinzel text-2xl font-bold ${p.cor}`}>{p.count}</span>
            <span className={`text-[10px] font-cinzel uppercase tracking-wider ${p.cor}`}>{p.nome}</span>
          </div>
        ))}

        {/* Com assinatura ativa */}
        <div className="bg-[var(--green)]/10 border border-[var(--green)]/30 rounded-xl p-3 flex flex-col items-center justify-center">
          <Zap className="w-5 h-5 text-[var(--green2)] mb-1" />
          <span className="font-cinzel text-[var(--green2)] text-2xl font-bold">{comAssinaturaAtiva}</span>
          <span className="text-[var(--green2)] text-[10px] font-cinzel uppercase tracking-wider">Ativos</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="input-dd w-full text-sm pl-3"
          />
        </div>
        <select
          value={filtroPlan}
          onChange={e => setFiltroPlan(e.target.value)}
          className="input-dd text-sm"
        >
          <option value="">Todos os planos</option>
          {PLANOS.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <span className="text-[var(--text3)] text-xs font-cinzel self-center">
          {filtrados.length} de {totalUsuarios} usuário(s)
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg3)] border-b border-[var(--border)]">
              <tr className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left">Nome</th>
                <th className="px-4 py-2.5 text-left">@Username</th>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-center">Plano</th>
                <th className="px-4 py-2.5 text-center">Assinatura</th>
                <th className="px-4 py-2.5 text-center">Admin</th>
                <th className="px-4 py-2.5 text-left">Cadastro</th>
                <th className="px-4 py-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bg3)]">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--border)] font-crimson">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : filtrados.map(u => (
                <LinhaUsuario
                  key={u.id}
                  usuario={u}
                  ehAdminAtual={u.id === adminAtualId}
                  onAlterarPlano={alterarPlano}
                  onAlterarAdmin={alterarAdmin}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function LinhaUsuario({
  usuario: u,
  ehAdminAtual,
  onAlterarPlano,
  onAlterarAdmin,
}: {
  usuario: UsuarioAdmin
  ehAdminAtual: boolean
  onAlterarPlano: (id: string, plano: string) => void
  onAlterarAdmin: (id: string, valor: boolean) => void
}) {
  const planoInfo = PLANOS.find(p => p.id === u.plano)

  return (
    <tr className="hover:bg-[var(--bg3)]/50 transition-colors">
      {/* Nome */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-crimson text-[var(--text)]">{u.nome ?? '—'}</span>
          {ehAdminAtual && (
            <span className="text-[8px] px-1 py-0.5 bg-[var(--gold)]/20 border border-[var(--gold)]/50 text-[var(--gold)] rounded font-cinzel">
              você
            </span>
          )}
        </div>
      </td>

      {/* Username */}
      <td className="px-4 py-2.5">
        {u.username
          ? <span className="text-[var(--accent)] text-sm font-cinzel">@{u.username}</span>
          : <span className="text-[var(--text3)] text-xs italic">sem username</span>
        }
      </td>

      {/* Email */}
      <td className="px-4 py-2.5">
        <span className="text-[var(--text2)] text-xs font-crimson">{u.email}</span>
      </td>

      {/* Plano badge */}
      <td className="px-4 py-2.5 text-center">
        <span className={`text-xs font-cinzel px-2 py-0.5 rounded-full ${planoInfo?.cor ?? 'text-[var(--text3)]'} ${planoInfo?.bg ?? 'bg-[var(--bg3)]'}`}>
          {planoInfo?.nome ?? u.plano}
        </span>
      </td>

      {/* Status assinatura */}
      <td className="px-4 py-2.5 text-center">
        {u.assinatura_status ? (
          <span className={`text-xs font-cinzel px-2 py-0.5 rounded-full capitalize ${STATUS_COR[u.assinatura_status] ?? 'text-[var(--text3)]'}`}>
            {u.assinatura_status}
          </span>
        ) : (
          <span className="text-[var(--border)] text-xs">—</span>
        )}
      </td>

      {/* Admin badge */}
      <td className="px-4 py-2.5 text-center">
        {u.is_admin ? (
          <span className="inline-flex items-center gap-1 text-xs font-cinzel text-[var(--gold)]">
            <Crown className="w-3 h-3" /> Admin
          </span>
        ) : (
          <span className="text-[var(--border)] text-xs">—</span>
        )}
      </td>

      {/* Cadastro */}
      <td className="px-4 py-2.5">
        <span className="text-[var(--text3)] text-xs">
          {new Date(u.criado_em).toLocaleDateString('pt-BR')}
        </span>
      </td>

      {/* Ações */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 justify-center">
          {/* Seletor de plano */}
          <div className="relative">
            <select
              value={u.plano}
              onChange={e => onAlterarPlano(u.id, e.target.value)}
              className="appearance-none input-dd text-xs py-0.5 pr-6 pl-2 cursor-pointer"
              title="Alterar plano"
            >
              {PLANOS.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text3)] pointer-events-none" />
          </div>

          {/* Toggle admin */}
          <button
            onClick={() => onAlterarAdmin(u.id, !u.is_admin)}
            disabled={ehAdminAtual && u.is_admin}
            title={
              ehAdminAtual && u.is_admin
                ? 'Não pode remover seu próprio acesso admin'
                : u.is_admin ? 'Remover admin' : 'Tornar admin'
            }
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${
              u.is_admin
                ? 'bg-[var(--gold)]'
                : 'bg-[var(--border)]'
            } ${ehAdminAtual && u.is_admin ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                u.is_admin ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </td>
    </tr>
  )
}
