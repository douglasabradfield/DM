'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'

export function ModalIniciarSessao({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (titulo?: string) => void
  onCancelar: () => void
}) {
  const [titulo, setTitulo] = useState('')

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70"
      onClick={onCancelar}
    >
      <div
        className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-cinzel text-[var(--gold)] text-lg font-bold mb-1">▶️ Iniciar Sessão</h3>
        <p className="text-[var(--text3)] text-sm mb-4 font-crimson">
          Título opcional — se deixar em branco, usa &quot;Sessão N&quot;
        </p>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Ex: A Torre do Necromante"
          className="input-dd w-full mb-4"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && onConfirmar(titulo.trim() || undefined)}
        />
        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-2 border border-[var(--border)] rounded-lg text-[var(--text2)] hover:bg-[var(--surface)] text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(titulo.trim() || undefined)}
            className="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white rounded-lg font-cinzel font-bold text-sm"
          >
            ▶️ Iniciar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
