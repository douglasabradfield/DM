'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCondicao } from '@/lib/dados-dnd/condicoes'
import type { Combatente, TipoCondicao } from '@/types/batalha'
import type { InfoPersonagem } from '../tipos'
import { Avatar } from '../ui/Avatar'
import { ModalCondicao } from '../ui/ModalCondicao'

// Popup de combatente — substitui as antigas listas de Aliados/Inimigos.
// Fase 2: só leitura. Fase 3 reaproveita este mesmo popup como seletor de alvo.
export function PopupCombatente({
  combatente: c, info, ehDM, selecionandoAlvo, alvoJaSelecionado, onSelecionarAlvo, onFechar,
}: {
  combatente: Combatente
  info: InfoPersonagem | undefined
  ehDM: boolean
  selecionandoAlvo?: boolean
  alvoJaSelecionado?: boolean
  onSelecionarAlvo?: () => void
  onFechar: () => void
}) {
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const estaMorto = c.morto || c.pv_atual <= 0
  // Jogador nunca vê PV, CA nem estado de saúde de monstros/NPCs — só o DM e os PJs da mesa.
  const mostrarSaude = ehDM || c.tipo === 'jogador'

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={48} />
          <div className="min-w-0 flex-1">
            <p className="font-cinzel text-[var(--gold)] font-bold text-base truncate">{c.nome}{estaMorto ? ' 💀' : ''}</p>
            {c.ausente && <p className="text-[var(--text3)] text-xs font-crimson">Ausente</p>}
          </div>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mostrarSaude && (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[var(--text2)] text-sm font-cinzel">PV {c.pv_atual}/{c.pv_maximo}</span>
            <span className="text-[var(--text2)] text-sm font-cinzel">CA {c.ca}</span>
          </div>
        )}

        {c.condicoes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {c.condicoes.map(cond => (
              <button
                key={cond}
                onClick={() => setCondicaoAberta(cond)}
                className="px-2.5 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-xs font-crimson flex items-center gap-1 min-h-[36px]"
              >
                <span>{getCondicao(cond)?.icone}</span>{cond}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text3)] text-xs font-crimson italic">Sem condições ativas</p>
        )}

        {selecionandoAlvo && (
          <button
            onClick={onSelecionarAlvo}
            className={cn(
              'w-full mt-3 py-2.5 rounded-lg font-cinzel text-sm font-bold min-h-[44px] border transition-colors',
              alvoJaSelecionado
                ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]'
            )}
          >
            {alvoJaSelecionado ? '✓ Alvo selecionado — toque para remover' : '🎯 Selecionar como alvo'}
          </button>
        )}

        {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
      </div>
    </div>,
    document.body
  )
}
