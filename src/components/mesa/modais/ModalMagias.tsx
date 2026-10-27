'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { EspacosMagiaBatalha } from '@/types/batalha'
import type { ConjuracaoEscolhida, MagiaExibida } from '../tipos'
import { selecionarMagiasExibidas } from '../helpers'
import { useMagiasPersonagem } from '../magias/useMagiasPersonagem'
import { PassoConjuracao } from '../magias/PassoConjuracao'

// ✨ Magia — lista com degradação graciosa (Fase 2). Ao escolher uma magia
// de nível > 0, abre o passo de nível de conjuração (permite conjurar em
// nível superior); o espaço em si só é consumido pela API, nunca aqui.
export function ModalMagias({
  personagemId, personagemNome, espacosMagia, onConjurar, onFechar,
}: {
  personagemId: string
  personagemNome: string
  espacosMagia: EspacosMagiaBatalha
  onConjurar: (escolha: ConjuracaoEscolhida) => void
  onFechar: () => void
}) {
  const { carregando, magias } = useMagiasPersonagem(personagemId)
  const [magiaEscolhida, setMagiaEscolhida] = useState<MagiaExibida | null>(null)

  const { magias: exibidas, aviso } = selecionarMagiasExibidas(magias)

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {!magiaEscolhida ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">✨ Magias — {personagemNome}</h3>
              <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {carregando ? (
              <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Carregando...</p>
            ) : magias.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-[var(--text3)] text-xs font-crimson">Nenhuma magia na ficha</p>
                <Link href={`/personagens/${personagemId}`} className="text-[var(--accent2)] text-xs font-cinzel hover:underline">
                  Ver ficha do personagem →
                </Link>
              </div>
            ) : (
              <>
                {aviso && <p className="text-[var(--gold)] text-[11px] font-crimson italic mb-2">⚠️ {aviso}</p>}
                <div className="space-y-1">
                  {exibidas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMagiaEscolhida(m)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
                    >
                      <span className="text-[var(--text)] text-sm font-crimson truncate">{m.nome}</span>
                      <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0 ml-2">{m.nivel === 0 ? 'Truque' : `N${m.nivel}`}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <PassoConjuracao
            magia={magiaEscolhida}
            espacosMagia={espacosMagia}
            onConfirmar={onConjurar}
            onVoltar={() => setMagiaEscolhida(null)}
            onFechar={onFechar}
          />
        )}
      </div>
    </div>,
    document.body
  )
}
