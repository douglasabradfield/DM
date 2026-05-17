'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PROMPTS_RAPIDOS } from '@/lib/claude/prompts'
import { useBatalha } from '@/store/batalha'
import { useCampanha } from '@/store/campanha'
import { createClient } from '@/lib/supabase/client'
import { LIMITES_IA } from '@/lib/ia/limites'
import { Bot, Send, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

interface Mensagem {
  id: string
  papel: 'user' | 'assistant'
  conteudo: string
  timestamp: Date
}

export default function IAPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [contexto, setContexto] = useState<'geral' | 'regras' | 'monstros' | 'aventura' | 'magias'>('geral')
  const [usoMes, setUsoMes] = useState(0)
  const [plano, setPlano] = useState<string>('free')
  const endRef = useRef<HTMLDivElement>(null)
  const { combatentes } = useBatalha()
  const { campanhaAtiva } = useCampanha()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const carregarUso = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const agora = new Date()
    const [{ data: usoArr }, { data: profile }] = await Promise.all([
      supabase.from('uso_ia').select('total_mensagens')
        .eq('user_id', user.id)
        .eq('mes', agora.getMonth() + 1)
        .eq('ano', agora.getFullYear())
        .limit(1),
      supabase.from('profiles').select('plano').eq('id', user.id).single(),
    ])

    setUsoMes(usoArr?.[0]?.total_mensagens ?? 0)
    setPlano(profile?.plano ?? 'free')
  }, [])

  useEffect(() => { carregarUso() }, [carregarUso])

  const limite = LIMITES_IA[plano] ?? 0
  const pctUso = limite === Infinity ? 0 : Math.min((usoMes / limite) * 100, 100)

  async function enviar(pergunta?: string) {
    const texto = pergunta ?? input.trim()
    if (!texto || carregando) return

    const novaMensagem: Mensagem = {
      id: Date.now().toString(),
      papel: 'user',
      conteudo: texto,
      timestamp: new Date(),
    }

    setMensagens(prev => [...prev, novaMensagem])
    setInput('')
    setCarregando(true)

    try {
      const grupoPJs = combatentes
        .filter(c => c.tipo === 'jogador')
        .map(c => `${c.nome}: CA ${c.ca}, PV ${c.pv_atual}/${c.pv_maximo}`)
        .join(', ')

      const historico = mensagens.map(m => ({ role: m.papel, content: m.conteudo }))

      const res = await fetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: texto,
          contexto,
          grupoPJs,
          historico,
          campanhaId: campanhaAtiva?.id ?? null,
          campanhaNome: campanhaAtiva?.nome ?? null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro na resposta da IA')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Sem stream')

      let resposta = ''
      const novaResposta: Mensagem = {
        id: (Date.now() + 1).toString(),
        papel: 'assistant',
        conteudo: '',
        timestamp: new Date(),
      }
      setMensagens(prev => [...prev, novaResposta])

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        resposta += decoder.decode(value)
        setMensagens(prev => prev.map(m =>
          m.id === novaResposta.id ? { ...m, conteudo: resposta } : m
        ))
      }

      setUsoMes(prev => prev + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar assistente'
      toast.error(msg)
      setMensagens(prev => prev.slice(0, -1))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar de contexto */}
      <div className="w-56 border-r border-[var(--border)] flex flex-col">
        <div className="p-3 border-b border-[var(--border)]">
          <p className="font-cinzel text-[var(--gold)] text-xs uppercase tracking-wider mb-2">Contexto</p>
          <div className="space-y-1">
            {[
              { id: 'geral', label: 'Geral' },
              { id: 'regras', label: 'Regras D&D 5e' },
              { id: 'monstros', label: 'Monstros' },
              { id: 'aventura', label: 'Aventura Atual' },
              { id: 'magias', label: 'Magias' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setContexto(id as typeof contexto)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs font-crimson transition-colors ${
                  contexto === id ? 'bg-[var(--surface)] text-[var(--gold)] border border-[#d4a843]/30' : 'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--bg3)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          <p className="font-cinzel text-[var(--gold)] text-xs uppercase tracking-wider mb-2">Atalhos</p>
          <div className="space-y-1">
            {PROMPTS_RAPIDOS.map(({ label, prompt }) => (
              <button
                key={label}
                onClick={() => enviar(prompt)}
                disabled={carregando}
                className="w-full text-left px-2 py-1.5 rounded text-xs font-crimson text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--bg3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Uso do mês */}
        <div className="p-3 border-t border-[var(--border)]">
          <p className="font-cinzel text-[var(--text3)] text-[10px] uppercase tracking-wider mb-1">Uso este mês</p>
          <p className="text-xs font-cinzel text-[var(--text2)] mb-1">
            {usoMes} / {limite === Infinity ? '∞' : limite} mensagens
          </p>
          {limite !== Infinity && (
            <div className="w-full h-1.5 bg-[var(--bg3)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pctUso}%`,
                  backgroundColor: pctUso >= 90 ? '#e74c3c' : pctUso >= 70 ? '#f39c12' : '#27ae60',
                }}
              />
            </div>
          )}
          {plano === 'free' && (
            <p className="text-[var(--red2)] text-[9px] mt-1 font-crimson">Plano gratuito sem acesso à IA</p>
          )}
        </div>

        {combatentes.filter(c => c.tipo === 'jogador').length > 0 && (
          <div className="p-3 border-t border-[var(--border)]">
            <p className="font-cinzel text-[var(--text3)] text-[10px] uppercase tracking-wider mb-1">Grupo Atual</p>
            {combatentes.filter(c => c.tipo === 'jogador').map(c => (
              <div key={c.id} className="text-xs font-crimson text-[var(--text2)] py-0.5">
                {c.nome} (PV {c.pv_atual}/{c.pv_maximo})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#1abc9c]" />
            <span className="font-cinzel text-[#1abc9c] text-sm">Assistente DM</span>
            {carregando && <span className="text-[var(--text3)] text-xs animate-pulse">pensando...</span>}
          </div>
          <button onClick={() => setMensagens([])} className="text-[var(--text3)] hover:text-[var(--text2)] transition-colors" title="Limpar conversa">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Bot className="w-12 h-12 text-[var(--border)] mx-auto mb-3" />
                <p className="font-cinzel text-[var(--border)] text-lg mb-2">Assistente DM</p>
                <p className="text-[var(--border)] text-sm font-crimson max-w-sm">
                  Seu companheiro para regras, NPCs, encontros e qualquer dúvida sobre D&D 5e.
                </p>
              </div>
            </div>
          ) : (
            mensagens.map(m => (
              <div key={m.id} className={`flex ${m.papel === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  m.papel === 'user'
                    ? 'bg-[var(--surface)] border border-[var(--border)] text-[#e8dff0]'
                    : 'bg-[var(--bg3)] border border-[#1abc9c]/20 text-[var(--text2)]'
                }`}>
                  {m.papel === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1">
                      <Bot className="w-3 h-3 text-[#1abc9c]" />
                      <span className="font-cinzel text-[#1abc9c] text-[10px]">DM Assistant</span>
                    </div>
                  )}
                  <div className="font-crimson text-sm whitespace-pre-wrap leading-relaxed">
                    {m.conteudo}
                    {m.papel === 'assistant' && m.conteudo === '' && (
                      <span className="inline-block w-1 h-4 bg-[#1abc9c] animate-pulse ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder="Pergunte sobre regras, peça ajuda com NPCs, encontros... (Enter para enviar)"
              rows={2}
              className="flex-1 input-dd resize-none text-sm"
              disabled={plano === 'free'}
            />
            <BotaoRunico
              variante="primario"
              onClick={() => enviar()}
              disabled={!input.trim() || carregando || plano === 'free'}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </BotaoRunico>
          </div>
          {plano === 'free' && (
            <p className="text-[var(--red2)] text-xs text-center mt-1 font-crimson">
              Faça upgrade para acessar o Assistente IA
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
