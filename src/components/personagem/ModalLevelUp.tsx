'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  personagemNome: string
  novoNivel: number
  novaProf: number
  onFechar: () => void
}

export function ModalLevelUp({ personagemNome, novoNivel, novaProf, onFechar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particulas: Array<{
      x: number; y: number; vx: number; vy: number
      cor: string; tamanho: number; rotacao: number; vr: number
    }> = []

    const cores = ['#d4a843', '#9b59b6', '#27ae60', '#e74c3c', '#3498db', '#f0c060', '#c39bd3']

    for (let i = 0; i < 150; i++) {
      particulas.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        cor: cores[Math.floor(Math.random() * cores.length)],
        tamanho: Math.random() * 10 + 5,
        rotacao: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
      })
    }

    let frame: number
    function animar() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      particulas.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.rotacao += p.vr

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotacao)
        ctx.fillStyle = p.cor
        ctx.globalAlpha = Math.max(0, 1 - p.y / canvas!.height)
        ctx.fillRect(-p.tamanho / 2, -p.tamanho / 2, p.tamanho, p.tamanho * 0.6)
        ctx.restore()
      })

      if (particulas.some(p => p.y < canvas!.height + 20)) {
        frame = requestAnimationFrame(animar)
      }
    }

    frame = requestAnimationFrame(animar)
    return () => cancelAnimationFrame(frame)
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 9998 }}
      />
      <div
        className="fixed inset-0 bg-black/70"
        style={{ zIndex: 9997 }}
        onClick={onFechar}
      />
      <div
        className="relative bg-[var(--bg2)] border-2 border-[var(--gold)] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center"
        style={{ zIndex: 9999 }}
      >
        <div className="text-6xl mb-4 animate-bounce">⭐</div>

        <h2 className="font-cinzel text-[var(--gold2)] text-2xl font-bold mb-2">
          SUBIU DE NÍVEL!
        </h2>

        <p className="text-[var(--text2)] text-lg mb-4 font-crimson">
          <span className="text-[var(--accent2)] font-bold">{personagemNome}</span>
          {' '}agora é{' '}
          <span className="text-[var(--gold)] font-cinzel font-bold text-xl">
            Nível {novoNivel}
          </span>
          !
        </p>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-6">
          <p className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wider mb-1">
            Novo Bônus de Proficiência
          </p>
          <p className="text-[var(--gold)] text-3xl font-cinzel font-bold">+{novaProf}</p>
        </div>

        <p className="text-[var(--text3)] text-sm mb-6 font-crimson italic">
          Não esqueça de atualizar suas perícias, HP e habilidades de classe!
        </p>

        <button
          onClick={onFechar}
          className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white font-cinzel font-bold rounded-xl transition-all border border-[var(--accent2)] hover:border-[var(--gold)]"
        >
          🎉 INCRÍVEL!
        </button>
      </div>
    </div>,
    document.body
  )
}
