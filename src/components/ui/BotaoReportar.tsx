'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props {
  itemSlug: string
  itemNome: string
  itemTipo: 'monstro' | 'magia' | 'item'
  pagina: string
}

export function BotaoReportar({ itemSlug, itemNome, itemTipo, pagina }: Props) {
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<'problema' | 'sugestao'>('problema')
  const [descricao, setDescricao] = useState('')
  const [sugestao, setSugestao] = useState('')
  const [enviando, setEnviando] = useState(false)

  function fechar() {
    setAberto(false)
    setDescricao('')
    setSugestao('')
    setTipo('problema')
  }

  async function enviar() {
    if (!descricao.trim()) {
      toast.error('Descreva o problema encontrado')
      return
    }
    setEnviando(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('feedbacks').insert({
      user_id: user?.id ?? null,
      pagina,
      tipo,
      descricao: descricao.trim(),
      sugestao_correcao: sugestao.trim() || null,
      item_referencia: itemSlug,
      item_tipo: itemTipo,
      status: 'pendente',
    })

    if (error) {
      toast.error('Erro ao enviar. Tente novamente.')
      setEnviando(false)
      return
    }

    await fetch('/api/feedback/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemNome, itemTipo, tipo, descricao, sugestao, userEmail: user?.email }),
    }).catch(() => {})

    toast.success('Obrigado! Vamos verificar em breve.')
    fechar()
    setEnviando(false)
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title="Reportar problema neste item"
        className="text-[var(--text3)] hover:text-[var(--red2)] transition-colors text-xs
                   flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--surface2)]"
      >
        ⚑ Reportar
      </button>

      {aberto && createPortal(
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70"
          onClick={fechar}
        >
          <div
            className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-cinzel text-[var(--gold)] font-bold">⚑ Reportar Problema</h3>
              <button onClick={fechar} className="text-[var(--text3)] hover:text-[var(--red2)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[var(--text3)] text-sm mb-4">{itemNome} · {itemTipo}</p>

            <div className="flex gap-2 mb-4">
              {(['problema', 'sugestao'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-cinzel border transition-all ${
                    tipo === t
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--surface)] text-[var(--text2)] border-[var(--border)]'
                  }`}
                >
                  {t === 'problema' ? '🐛 Dado incorreto' : '💡 Sugerir melhoria'}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">
                {tipo === 'problema' ? 'Qual é o erro?' : 'Qual a sugestão?'}
              </label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={3}
                placeholder={tipo === 'problema'
                  ? 'Ex: O CA do Goblin está como 12, mas deveria ser 15'
                  : 'Ex: Seria útil mostrar a velocidade de natação separado'}
                className="input-dd w-full resize-none text-sm"
                autoFocus
              />
            </div>

            {tipo === 'problema' && (
              <div className="mb-4">
                <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">
                  Qual seria o valor correto? (opcional)
                </label>
                <input
                  type="text"
                  value={sugestao}
                  onChange={e => setSugestao(e.target.value)}
                  placeholder="Ex: CA 15 (Armadura de couro + escudo)"
                  className="input-dd w-full text-sm"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={fechar}
                className="flex-1 py-2 border border-[var(--border)] rounded-lg
                           text-[var(--text2)] text-sm hover:bg-[var(--surface)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={enviando || !descricao.trim()}
                className="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent2)]
                           text-white rounded-lg font-cinzel text-sm disabled:opacity-50 transition-colors"
              >
                {enviando ? 'Enviando...' : '✓ Enviar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
