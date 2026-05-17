'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { MessageSquare } from 'lucide-react'

type TipoFeedback = 'bug' | 'sugestao' | 'elogio' | 'outro'

const TIPOS: { id: TipoFeedback; emoji: string; label: string; placeholder: string }[] = [
  { id: 'bug', emoji: '🐛', label: 'Bug', placeholder: 'Descreva o que aconteceu e como reproduzir o problema...' },
  { id: 'sugestao', emoji: '💡', label: 'Sugestão', placeholder: 'Qual funcionalidade ou melhoria você gostaria de ver?' },
  { id: 'elogio', emoji: '⭐', label: 'Elogio', placeholder: 'O que você está gostando no Dungeon Desk?' },
  { id: 'outro', emoji: '💬', label: 'Outro', placeholder: 'O que você quer nos dizer?' },
]

export default function FeedbackPage() {
  const [tipo, setTipo] = useState<TipoFeedback>('sugestao')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const tipoAtual = TIPOS.find(t => t.id === tipo)!

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

      setEnviado(true)
    } catch {
      toast.error('Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="max-w-xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="font-cinzel text-[var(--gold)] text-xl font-bold mb-2">Obrigado pelo feedback!</h2>
          <p className="text-[var(--text2)] font-crimson mb-6">
            Sua mensagem foi recebida. Analisamos todos os feedbacks para melhorar o Dungeon Desk.
          </p>
          <button
            onClick={() => { setEnviado(false); setDescricao(''); setTipo('sugestao') }}
            className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded font-cinzel text-sm
                       text-[var(--text2)] hover:bg-[var(--bg3)] transition-colors"
          >
            Enviar outro feedback
          </button>
        </div>
      </div>
    )
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
    </div>
  )
}
