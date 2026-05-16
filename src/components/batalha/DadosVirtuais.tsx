'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useBatalha } from '@/store/batalha'

interface ResultadoDado {
  expressao: string
  resultado: number[]
  total: number
  modificador: number
  critico?: boolean
  falha?: boolean
  modo?: 'normal' | 'vantagem' | 'desvantagem'
  dado2?: number
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

  const combatenteAtivo = useBatalha(s => {
    const ordenados = [...s.combatentes].sort((a, b) => a.ordem - b.ordem)
    const ativos = ordenados.filter(c => !c.ausente && !c.morto)
    return ativos[s.turnoAtual] ?? null
  })

  const rolar = useCallback((lados: number, quantidade = 1, mod = 0) => {
    setAnimando(lados)
    setTimeout(() => setAnimando(null), 500)

    // d20 com vantagem/desvantagem
    if (lados === 20 && quantidade === 1 && combatenteAtivo?.vantagem) {
      const d1 = rolarDado(20)
      const d2 = rolarDado(20)
      const modo = combatenteAtivo.vantagem as 'vantagem' | 'desvantagem'
      const total = modo === 'vantagem' ? Math.max(d1, d2) : Math.min(d1, d2)
      const entrada: ResultadoDado = {
        expressao: `d20 ${modo === 'vantagem' ? '▲' : '▼'}`,
        resultado: [d1, d2],
        total,
        modificador: 0,
        critico: total === 20,
        falha: total === 1,
        modo,
        dado2: d2,
      }
      setUltimoResultado(entrada)
      setHistorico(prev => [entrada, ...prev].slice(0, 10))
      return
    }

    const resultados = Array.from({ length: quantidade }, () => rolarDado(lados))
    const soma = resultados.reduce((a, b) => a + b, 0) + mod
    const entrada: ResultadoDado = {
      expressao: `${quantidade}d${lados}${mod !== 0 ? (mod > 0 ? `+${mod}` : mod) : ''}`,
      resultado: resultados,
      total: soma,
      modificador: mod,
      critico: lados === 20 && resultados[0] === 20,
      falha: lados === 20 && resultados[0] === 1,
      modo: 'normal',
    }
    setUltimoResultado(entrada)
    setHistorico(prev => [entrada, ...prev].slice(0, 10))
  }, [combatenteAtivo])

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

  const vantagem = combatenteAtivo?.vantagem

  return (
    <div className="space-y-3">
      {/* Indicador de vantagem ativa */}
      {vantagem && (
        <div className={cn(
          'text-center py-1.5 px-3 rounded text-xs font-cinzel font-bold border',
          vantagem === 'vantagem'
            ? 'bg-[#27ae60]/20 border-[#27ae60] text-[#27ae60]'
            : 'bg-[#e74c3c]/20 border-[#e74c3c] text-[#e74c3c]'
        )}>
          {vantagem === 'vantagem' ? '▲ VANTAGEM ATIVA — d20 rola 2 dados' : '▼ DESVANTAGEM ATIVA — d20 rola 2 dados'}
          {combatenteAtivo && <span className="text-[8px] ml-1 opacity-70">({combatenteAtivo.nome})</span>}
        </div>
      )}

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

          {/* Mostrar dois dados quando vantagem/desvantagem */}
          {ultimoResultado.modo && ultimoResultado.modo !== 'normal' && ultimoResultado.dado2 !== undefined && (
            <div className="text-sm text-[#8870a8] mb-2">
              <span className={ultimoResultado.resultado[0] === ultimoResultado.total ? 'text-[#27ae60] font-bold' : 'opacity-40'}>
                {ultimoResultado.resultado[0]}
              </span>
              <span className="mx-2 text-[#4a3060]">/</span>
              <span className={ultimoResultado.dado2 === ultimoResultado.total ? 'text-[#27ae60] font-bold' : 'opacity-40'}>
                {ultimoResultado.dado2}
              </span>
            </div>
          )}

          <div className={cn(
            'text-5xl font-cinzel font-bold',
            ultimoResultado.critico ? 'text-[#d4a843]' :
            ultimoResultado.falha ? 'text-[#e74c3c]' :
            ultimoResultado.modo === 'vantagem' ? 'text-[#27ae60]' :
            ultimoResultado.modo === 'desvantagem' ? 'text-[#e74c3c]' :
            'text-[#e8dff0]'
          )}>
            {ultimoResultado.total}
          </div>

          {ultimoResultado.modo && ultimoResultado.modo !== 'normal' && (
            <div className={cn(
              'text-xs font-cinzel mt-1',
              ultimoResultado.modo === 'vantagem' ? 'text-[#27ae60]' : 'text-[#e74c3c]'
            )}>
              {ultimoResultado.modo === 'vantagem' ? '▲ VANTAGEM' : '▼ DESVANTAGEM'}
            </div>
          )}

          {ultimoResultado.modo === 'normal' && (
            <p className="text-[#8870a8] text-xs mt-1 font-crimson">
              {ultimoResultado.expressao}: [{ultimoResultado.resultado.join(', ')}]
              {ultimoResultado.modificador !== 0 && ` ${ultimoResultado.modificador > 0 ? '+' : ''}${ultimoResultado.modificador}`}
            </p>
          )}
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
              animando === lados && 'animate-dice-roll border-[#d4a843] text-[#d4a843]',
              lados === 20 && vantagem === 'vantagem' && 'border-[#27ae60] text-[#27ae60]',
              lados === 20 && vantagem === 'desvantagem' && 'border-[#e74c3c] text-[#e74c3c]',
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
                  h.critico ? 'text-[#d4a843]' :
                  h.falha ? 'text-[#e74c3c]' :
                  h.modo === 'vantagem' ? 'text-[#27ae60]' :
                  h.modo === 'desvantagem' ? 'text-[#e74c3c]' :
                  'text-[#e8dff0]'
                )}>{h.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
