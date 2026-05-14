'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ResultadoDado {
  expressao: string
  resultado: number[]
  total: number
  modificador: number
  critico?: boolean
  falha?: boolean
}

const DADOS = [4, 6, 8, 10, 12, 20, 100]

function rolarDado(lados: number): number {
  return Math.floor(Math.random() * lados) + 1
}

export function DadosVirtuais() {
  const [historico, setHistorico] = useState<ResultadoDado[]>([])
  const [expressaoCustom, setExpressaoCustom] = useState('')
  const [animando, setAnimando] = useState<number | null>(null)
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoDado | null>(null)

  const rolar = useCallback((lados: number, quantidade = 1, mod = 0) => {
    setAnimando(lados)
    setTimeout(() => setAnimando(null), 500)

    const resultados = Array.from({ length: quantidade }, () => rolarDado(lados))
    const soma = resultados.reduce((a, b) => a + b, 0) + mod
    const entrada: ResultadoDado = {
      expressao: `${quantidade}d${lados}${mod !== 0 ? (mod > 0 ? `+${mod}` : mod) : ''}`,
      resultado: resultados,
      total: soma,
      modificador: mod,
      critico: lados === 20 && resultados[0] === 20,
      falha: lados === 20 && resultados[0] === 1,
    }
    setUltimoResultado(entrada)
    setHistorico(prev => [entrada, ...prev].slice(0, 10))
  }, [])

  function rolarCustom() {
    const match = expressaoCustom.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
    if (!match) return
    const qtd = parseInt(match[1])
    const lados = parseInt(match[2])
    const mod = match[3] ? (match[3] === '+' ? parseInt(match[4]) : -parseInt(match[4])) : 0
    rolar(lados, qtd, mod)
  }

  const iconesDado: Record<number, string> = {
    4: '▲', 6: '⬡', 8: '◆', 10: '⬟', 12: '⬠', 20: '⬡', 100: '%'
  }

  return (
    <div className="space-y-3">
      {/* Resultado principal */}
      {ultimoResultado && (
        <div className={cn(
          'text-center p-4 rounded border',
          ultimoResultado.critico ? 'border-[#d4a843] bg-[#d4a843]/10' :
          ultimoResultado.falha ? 'border-[#e74c3c] bg-[#e74c3c]/10' :
          'border-[#4a3060] bg-[#1e1525]'
        )}>
          {ultimoResultado.critico && <p className="text-[#d4a843] font-cinzel text-xs mb-1 animate-pulse">✦ ACERTO CRÍTICO! ✦</p>}
          {ultimoResultado.falha && <p className="text-[#e74c3c] font-cinzel text-xs mb-1">✦ FALHA CRÍTICA ✦</p>}
          <div className={cn(
            'text-5xl font-cinzel font-bold',
            ultimoResultado.critico ? 'text-[#d4a843]' :
            ultimoResultado.falha ? 'text-[#e74c3c]' :
            'text-[#e8dff0]'
          )}>
            {ultimoResultado.total}
          </div>
          <p className="text-[#8870a8] text-xs mt-1 font-crimson">
            {ultimoResultado.expressao}: [{ultimoResultado.resultado.join(', ')}]
            {ultimoResultado.modificador !== 0 && ` ${ultimoResultado.modificador > 0 ? '+' : ''}${ultimoResultado.modificador}`}
          </p>
        </div>
      )}

      {/* Dados */}
      <div className="grid grid-cols-7 gap-1">
        {DADOS.map(lados => (
          <button
            key={lados}
            onClick={() => rolar(lados)}
            className={cn(
              'aspect-square flex flex-col items-center justify-center rounded border transition-all font-cinzel',
              'bg-[#261a2e] border-[#4a3060] text-[#b8a8cc] hover:border-[#d4a843] hover:text-[#d4a843] hover:bg-[#2f2040]',
              animando === lados && 'animate-dice-roll border-[#d4a843] text-[#d4a843]'
            )}
          >
            <span className="text-xs">{iconesDado[lados]}</span>
            <span className="text-[9px] mt-0.5">d{lados}</span>
          </button>
        ))}
      </div>

      {/* Expressão customizada */}
      <div className="flex gap-2">
        <input
          type="text"
          value={expressaoCustom}
          onChange={e => setExpressaoCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && rolarCustom()}
          placeholder="2d6+3, 1d20, 4d4-1..."
          className="flex-1 input-dd text-sm"
        />
        <button
          onClick={rolarCustom}
          className="px-3 py-1 bg-[#9b59b6] border border-[#c39bd3] text-white rounded text-sm font-cinzel hover:bg-[#8e44ad] transition-colors"
        >
          🎲
        </button>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div>
          <p className="font-cinzel text-[#8870a8] text-[10px] uppercase tracking-wider mb-1">Histórico</p>
          <div className="space-y-0.5">
            {historico.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-0.5 border-b border-[#1e1525]">
                <span className="text-[#8870a8] font-crimson">{h.expressao}</span>
                <span className={cn(
                  'font-cinzel font-bold',
                  h.critico ? 'text-[#d4a843]' : h.falha ? 'text-[#e74c3c]' : 'text-[#e8dff0]'
                )}>{h.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
