'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { MessageSquare, X, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type TipoFeedback = 'bug' | 'sugestao' | 'elogio' | 'outro'

const TIPOS: { id: TipoFeedback; emoji: string; label: string; placeholder: string }[] = [
  { id: 'bug', emoji: '🐛', label: 'Bug', placeholder: 'Descreva o que aconteceu e como reproduzir o problema...' },
  { id: 'sugestao', emoji: '💡', label: 'Sugestão', placeholder: 'Qual funcionalidade ou melhoria você gostaria de ver?' },
  { id: 'elogio', emoji: '⭐', label: 'Elogio', placeholder: 'O que você está gostando no Dungeon Desk?' },
  { id: 'outro', emoji: '💬', label: 'Outro', placeholder: 'O que você quer nos dizer?' },
]

const TIPO_EMOJI: Record<string, string> = {
  problema: '🐛', sugestao: '💡', elogio: '⭐', outro: '💬', bug: '🐛',
}

interface MeuFeedback {
  id: string
  tipo: string
  descricao: string
  status: string
  resposta: string | null
  respondido_em: string | null
  criado_em: string
}

export default function FeedbackPage() {
  const [tipo, setTipo] = useState<TipoFeedback>('sugestao')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [meusFeedbacks, setMeusFeedbacks] = useState<MeuFeedback[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tipoAtual = TIPOS.find(t => t.id === tipo)!

  useEffect(() => {
    buscarMeusFeedbacks()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  async function buscarMeusFeedbacks() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('feedbacks')
      .select('id, tipo, descricao, status, resposta, respondido_em, criado_em')
      .eq('user_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(10)
    setMeusFeedbacks((data ?? []) as MeuFeedback[])
  }

  async function enviar() {
    if (!descricao.trim()) {
      toast.error('Por favor, escreva sua mensagem')
      return
    }
    setEnviando(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('feedbacks').insert({
        user_id: user?.id ?? null,
        pagina: '/feedback',
        tipo: tipo === 'bug' ? 'problema' : tipo === 'elogio' ? 'elogio' : tipo === 'sugestao' ? 'sugestao' : 'outro',
        descricao: descricao.trim(),
        item_tipo: 'pagina',
        status: 'pendente',
      })

      if (error) throw error

      await fetch('/api/feedback/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemNome: 'Feedback Geral',
          itemTipo: 'pagina',
          tipo,
          descricao,
          userEmail: user?.email,
        }),
      }).catch(() => {})

      setDescricao('')
      setTipo('sugestao')
      setEnviado(true)
      buscarMeusFeedbacks()

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setEnviado(false), 5000)
    } catch {
      toast.error('Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 md:p-6 pb-20">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <MessageSquare className="w-6 h-6 text-[var(--accent2)]" />
          <h1 className="font-cinzel text-[var(--gold)] text-2xl font-bold">Feedback & Sugestões</h1>
        </div>
        <p className="text-[var(--text3)] font-crimson">
          Sua opinião melhora o app para todos. Cada mensagem é lida com atenção.
        </p>
      </div>

      {/* Confirmação inline */}
      {enviado && (
        <div className="mb-4 p-3 bg-[var(--green)]/10 border border-[var(--green)]/30 rounded-lg flex items-start gap-2.5">
          <CheckCircle className="w-4 h-4 text-[var(--green2)] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[var(--green2)] font-cinzel text-sm font-bold">Feedback recebido!</p>
            <p className="text-[var(--text2)] font-crimson text-xs mt-0.5 leading-relaxed">
              Obrigado pela sua contribuição. Analisamos todos os feedbacks e entramos em contato quando necessário.
            </p>
          </div>
          <button
            onClick={() => { setEnviado(false); if (timerRef.current) clearTimeout(timerRef.current) }}
            className="text-[var(--text3)] hover:text-[var(--text2)] flex-shrink-0 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tipo */}
      <div className="mb-5">
        <label className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wide block mb-2">
          Tipo de mensagem
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS.map(t => (
            <button
              key={t.id}
              onClick={() => setTipo(t.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 px-2 rounded-lg border text-sm font-cinzel transition-all',
                tipo === t.id
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent2)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text3)] hover:border-[var(--border2)]'
              )}
            >
              <span className="text-xl">{t.emoji}</span>
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mensagem */}
      <div className="mb-5">
        <label className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wide block mb-2">
          {tipoAtual.emoji} {tipoAtual.label}
        </label>
        <textarea
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          rows={6}
          placeholder={tipoAtual.placeholder}
          className="input-dd w-full resize-none font-crimson"
          autoFocus
        />
        <p className="text-[var(--text3)] text-xs mt-1 text-right">{descricao.length} caracteres</p>
      </div>

      <button
        onClick={enviar}
        disabled={enviando || !descricao.trim()}
        className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white rounded-lg
                   font-cinzel font-bold disabled:opacity-50 transition-colors"
      >
        {enviando ? 'Enviando...' : '✓ Enviar Feedback'}
      </button>

      <p className="text-[var(--text3)] text-xs font-crimson text-center mt-4">
        Para reportar dados incorretos em monstros, magias ou itens, use o botão ⚑ Reportar nas páginas do Bestiário, Magias e Itens.
      </p>

      {/* Minhas mensagens */}
      {meusFeedbacks.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <h2 className="font-cinzel text-[var(--text3)] text-sm uppercase tracking-wide">Minhas mensagens</h2>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <div className="space-y-3">
            {meusFeedbacks.map(fb => (
              <div key={fb.id} className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-3">
                {/* Cabeçalho */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{TIPO_EMOJI[fb.tipo] ?? '💬'}</span>
                  <span className="text-[var(--text3)] text-xs font-crimson capitalize">{fb.tipo}</span>
                  <span className="ml-auto text-[var(--text3)] text-[10px] font-crimson">
                    {format(new Date(fb.criado_em), "d 'de' MMM yyyy", { locale: ptBR })}
                  </span>
                </div>

                {/* Texto original */}
                <p className="text-[var(--text2)] font-crimson text-sm leading-relaxed line-clamp-3">{fb.descricao}</p>

                {/* Resposta do admin ou badge "Em análise" */}
                {fb.resposta ? (
                  <div className="mt-2.5 bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle className="w-3 h-3 text-[var(--accent2)]" />
                      <span className="text-[var(--accent2)] text-[10px] font-cinzel uppercase tracking-wide">
                        Resposta da equipe
                      </span>
                      {fb.respondido_em && (
                        <span className="ml-auto text-[var(--text3)] text-[9px] font-crimson">
                          {format(new Date(fb.respondido_em), "d 'de' MMM, HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text)] font-crimson text-sm leading-relaxed">{fb.resposta}</p>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[var(--text3)]" />
                    <span className="text-[var(--text3)] text-[10px] font-cinzel">Em análise</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
