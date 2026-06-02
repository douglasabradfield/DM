'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export interface FeedbackAdmin {
  id: string
  user_id: string | null
  pagina: string
  tipo: string
  descricao: string
  sugestao_correcao: string | null
  item_referencia: string | null
  item_tipo: string | null
  status: 'pendente' | 'analisando' | 'resolvido' | 'ignorado'
  resposta_admin: string | null
  resposta: string | null
  respondido_em: string | null
  respondido_por: string | null
  criado_em: string
  email?: string | null
}

const STATUS_COR: Record<string, string> = {
  pendente:   'text-[var(--gold)] bg-[var(--gold)]/10 border-[var(--gold)]/30',
  analisando: 'text-[var(--accent2)] bg-[var(--accent)]/10 border-[var(--accent)]/30',
  resolvido:  'text-[var(--green2)] bg-[var(--green)]/10 border-[var(--green)]/30',
  ignorado:   'text-[var(--text3)] bg-[var(--bg3)] border-[var(--border)]',
}

const TIPO_EMOJI: Record<string, string> = {
  problema: '🐛',
  sugestao: '💡',
  elogio: '⭐',
  outro: '💬',
  bug: '🐛',
}

const ITEM_TIPO_LABEL: Record<string, string> = {
  monstro: '🐉 Monstro',
  magia: '✨ Magia',
  item: '🎒 Item',
  pagina: '📄 Página',
  geral: '💬 Geral',
}

interface Props {
  feedbacks: FeedbackAdmin[]
}

export function PainelFeedbacks({ feedbacks: inicial }: Props) {
  const [feedbacks, setFeedbacks] = useState(inicial)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroItemTipo, setFiltroItemTipo] = useState('')
  const [respostando, setRespostando] = useState<string | null>(null)
  const [textoResposta, setTextoResposta] = useState('')
  const [atualizando, setAtualizando] = useState<string | null>(null)

  const filtrados = feedbacks.filter(f => {
    if (filtroStatus && f.status !== filtroStatus) return false
    if (filtroTipo && f.tipo !== filtroTipo) return false
    if (filtroItemTipo && f.item_tipo !== filtroItemTipo) return false
    return true
  })

  const pendentes = feedbacks.filter(f => f.status === 'pendente').length

  async function atualizarStatus(id: string, status: FeedbackAdmin['status'], resposta?: string) {
    setAtualizando(id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const updates: Record<string, unknown> = { status, resposta_admin: resposta ?? null }
    if (resposta !== undefined) {
      updates.resposta = resposta || null
      updates.respondido_em = resposta ? new Date().toISOString() : null
      updates.respondido_por = resposta ? (user?.id ?? null) : null
    }

    const { error } = await supabase.from('feedbacks').update(updates).eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar')
    } else {
      setFeedbacks(prev => prev.map(f =>
        f.id === id ? {
          ...f,
          status,
          resposta_admin: resposta ?? f.resposta_admin,
          resposta: resposta !== undefined ? (resposta || null) : f.resposta,
          respondido_em: resposta ? new Date().toISOString() : f.respondido_em,
          respondido_por: resposta ? (user?.id ?? null) : f.respondido_por,
        } : f
      ))
      toast.success('Status atualizado')
      if (respostando === id) {
        setRespostando(null)
        setTextoResposta('')
      }
    }
    setAtualizando(null)
  }

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-cinzel text-[var(--gold)] text-2xl font-bold">Feedbacks</h1>
          <p className="text-[var(--text3)] font-crimson text-sm">{feedbacks.length} total · {filtrados.length} exibindo</p>
        </div>
        {pendentes > 0 && (
          <span className="px-3 py-1 bg-[var(--red2)]/10 border border-[var(--red2)]/30 text-[var(--red2)] rounded-full text-sm font-cinzel font-bold">
            {pendentes} pendente{pendentes > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="input-dd text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="analisando">Analisando</option>
          <option value="resolvido">Resolvido</option>
          <option value="ignorado">Ignorado</option>
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="input-dd text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="problema">Problema</option>
          <option value="sugestao">Sugestão</option>
          <option value="elogio">Elogio</option>
          <option value="outro">Outro</option>
        </select>
        <select
          value={filtroItemTipo}
          onChange={e => setFiltroItemTipo(e.target.value)}
          className="input-dd text-sm"
        >
          <option value="">Todos os itens</option>
          <option value="monstro">Monstro</option>
          <option value="magia">Magia</option>
          <option value="item">Item</option>
          <option value="pagina">Página</option>
        </select>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-cinzel text-[var(--border)] text-lg">Nenhum feedback encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(f => (
            <div
              key={f.id}
              className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{TIPO_EMOJI[f.tipo] ?? '💬'}</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded border font-cinzel',
                    STATUS_COR[f.status] ?? STATUS_COR.pendente
                  )}>
                    {f.status}
                  </span>
                  {f.item_tipo && (
                    <span className="text-xs text-[var(--text3)] bg-[var(--bg3)] px-2 py-0.5 rounded border border-[var(--border)]">
                      {ITEM_TIPO_LABEL[f.item_tipo] ?? f.item_tipo}
                    </span>
                  )}
                  {f.item_referencia && (
                    <span className="text-xs text-[var(--accent2)] font-cinzel">{f.item_referencia}</span>
                  )}
                  {f.resposta ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-cinzel text-[var(--green2)] bg-[var(--green)]/10 border border-[var(--green)]/30">
                      ✓ Respondido
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-cinzel text-[var(--text3)] bg-[var(--bg3)] border border-[var(--border)]">
                      Pendente resposta
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[var(--text3)] text-xs">{new Date(f.criado_em).toLocaleDateString('pt-BR')}</p>
                  {f.email && <p className="text-[var(--text3)] text-xs truncate max-w-[140px]">{f.email}</p>}
                  {f.respondido_em && (
                    <p className="text-[var(--green2)] text-[10px]">
                      Resp. {new Date(f.respondido_em).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[var(--text)] font-crimson text-sm leading-relaxed mb-2">{f.descricao}</p>

              {f.sugestao_correcao && (
                <div className="bg-[var(--bg3)] rounded p-2 mb-2">
                  <p className="text-[var(--text3)] text-xs font-cinzel uppercase mb-0.5">Sugestão de correção</p>
                  <p className="text-[var(--text2)] font-crimson text-sm">{f.sugestao_correcao}</p>
                </div>
              )}

              {f.resposta && (
                <div className="bg-[var(--green)]/5 border border-[var(--green)]/20 rounded p-2 mb-2">
                  <p className="text-[var(--green2)] text-xs font-cinzel uppercase mb-0.5">✓ Resposta ao usuário</p>
                  <p className="text-[var(--text2)] font-crimson text-sm">{f.resposta}</p>
                </div>
              )}
              {f.resposta_admin && f.resposta_admin !== f.resposta && (
                <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded p-2 mb-2">
                  <p className="text-[var(--accent2)] text-xs font-cinzel uppercase mb-0.5">Nota interna</p>
                  <p className="text-[var(--text2)] font-crimson text-sm">{f.resposta_admin}</p>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-2 mt-3">
                {f.status !== 'resolvido' && (
                  <button
                    onClick={() => atualizarStatus(f.id, 'resolvido')}
                    disabled={atualizando === f.id}
                    className="px-3 py-1 text-xs font-cinzel bg-[var(--green)]/10 text-[var(--green2)] border border-[var(--green)]/30
                               rounded hover:bg-[var(--green)]/20 transition-colors disabled:opacity-50"
                  >
                    ✓ Resolvido
                  </button>
                )}
                {f.status !== 'analisando' && f.status !== 'resolvido' && (
                  <button
                    onClick={() => atualizarStatus(f.id, 'analisando')}
                    disabled={atualizando === f.id}
                    className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)]/10 text-[var(--accent2)] border border-[var(--accent)]/30
                               rounded hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
                  >
                    🔍 Analisando
                  </button>
                )}
                {f.status !== 'ignorado' && (
                  <button
                    onClick={() => atualizarStatus(f.id, 'ignorado')}
                    disabled={atualizando === f.id}
                    className="px-3 py-1 text-xs font-cinzel bg-[var(--bg3)] text-[var(--text3)] border border-[var(--border)]
                               rounded hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                  >
                    Ignorar
                  </button>
                )}
                <button
                  onClick={() => {
                    setRespostando(respostando === f.id ? null : f.id)
                    setTextoResposta(f.resposta_admin ?? '')
                  }}
                  className="px-3 py-1 text-xs font-cinzel bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30
                             rounded hover:bg-[var(--gold)]/20 transition-colors"
                >
                  ✏️ Resposta
                </button>
              </div>

              {respostando === f.id && (
                <div className="mt-3">
                  <textarea
                    value={textoResposta}
                    onChange={e => setTextoResposta(e.target.value)}
                    rows={2}
                    placeholder="Adicione uma resposta ou nota interna..."
                    className="input-dd w-full resize-none text-sm mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => atualizarStatus(f.id, f.status, textoResposta)}
                      disabled={atualizando === f.id}
                      className="px-3 py-1 text-xs font-cinzel bg-[var(--accent)] text-white rounded
                                 hover:bg-[var(--accent2)] transition-colors disabled:opacity-50"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => { setRespostando(null); setTextoResposta('') }}
                      className="px-3 py-1 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:bg-[var(--surface)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
