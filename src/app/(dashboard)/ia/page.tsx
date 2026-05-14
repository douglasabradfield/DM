'use client'

import { useState, useRef, useEffect } from 'react'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PROMPTS_RAPIDOS } from '@/lib/claude/prompts'
import { useBatalha } from '@/store/batalha'
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
  const endRef = useRef<HTMLDivElement>(null)
  const { combatentes } = useBatalha()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

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
        }),
      })

      if (!res.ok) throw new Error('Erro na resposta da IA')

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
        const chunk = decoder.decode(value)
        resposta += chunk
        setMensagens(prev => prev.map(m =>
          m.id === novaResposta.id ? { ...m, conteudo: resposta } : m
        ))
      }
    } catch {
      toast.error('Erro ao consultar assistente')
      setMensagens(prev => prev.slice(0, -1))
    } finally {
      setCarregando(false)
    }
  }

  function limpar() {
    setMensagens([])
  }

  return (
    <div className="flex h-full">
      {/* Sidebar de contexto */}
      <div className="w-56 border-r border-[#4a3060] flex flex-col">
        <div className="p-3 border-b border-[#4a3060]">
          <p className="font-cinzel text-[#d4a843] text-xs uppercase tracking-wider mb-2">Contexto</p>
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
                  contexto === id ? 'bg-[#261a2e] text-[#d4a843] border border-[#d4a843]/30' : 'text-[#8870a8] hover:text-[#b8a8cc] hover:bg-[#1e1525]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          <p className="font-cinzel text-[#d4a843] text-xs uppercase tracking-wider mb-2">Atalhos</p>
          <div className="space-y-1">
            {PROMPTS_RAPIDOS.map(({ label, prompt }) => (
              <button
                key={label}
                onClick={() => enviar(prompt)}
                disabled={carregando}
                className="w-full text-left px-2 py-1.5 rounded text-xs font-crimson text-[#8870a8] hover:text-[#b8a8cc] hover:bg-[#1e1525] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {combatentes.filter(c => c.tipo === 'jogador').length > 0 && (
          <div className="p-3 border-t border-[#4a3060]">
            <p className="font-cinzel text-[#8870a8] text-[10px] uppercase tracking-wider mb-1">Grupo Atual</p>
            {combatentes.filter(c => c.tipo === 'jogador').map(c => (
              <div key={c.id} className="text-xs font-crimson text-[#b8a8cc] py-0.5">
                {c.nome} (PV {c.pv_atual}/{c.pv_maximo})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-2 border-b border-[#4a3060] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#1abc9c]" />
            <span className="font-cinzel text-[#1abc9c] text-sm">Assistente DM</span>
            {carregando && <span className="text-[#8870a8] text-xs animate-pulse">pensando...</span>}
          </div>
          <button onClick={limpar} className="text-[#8870a8] hover:text-[#b8a8cc] transition-colors" title="Limpar conversa">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Bot className="w-12 h-12 text-[#4a3060] mx-auto mb-3" />
                <p className="font-cinzel text-[#4a3060] text-lg mb-2">Assistente DM</p>
                <p className="text-[#4a3060] text-sm font-crimson max-w-sm">
                  Seu companheiro para regras, NPCs, encontros e qualquer dúvida sobre D&D 5e.
                  Respondo sempre em português.
                </p>
              </div>
            </div>
          ) : (
            mensagens.map(m => (
              <div key={m.id} className={`flex ${m.papel === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  m.papel === 'user'
                    ? 'bg-[#261a2e] border border-[#4a3060] text-[#e8dff0]'
                    : 'bg-[#1e1525] border border-[#1abc9c]/20 text-[#b8a8cc]'
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

        {/* Input */}
        <div className="p-3 border-t border-[#4a3060]">
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
            />
            <BotaoRunico
              variante="primario"
              onClick={() => enviar()}
              disabled={!input.trim() || carregando}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </BotaoRunico>
          </div>
        </div>
      </div>
    </div>
  )
}
