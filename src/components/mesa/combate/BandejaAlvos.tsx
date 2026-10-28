'use client'

import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Combatente } from '@/types/batalha'
import type { AcaoPendente, AlvoSelecionado, InfoPersonagem } from '../tipos'
import { ordenarPorNome } from '../helpers'
import { Avatar } from '../ui/Avatar'

// Folha inferior de seleção de alvo — fixed, fora do fluxo da tela principal
// (não pode empurrar layout / criar scroll vertical). Aparece enquanto há uma
// ação pendente que precisa de alvo. Grupos em ordem ALFABÉTICA (nunca a ordem
// de iniciativa) e sem PV/CA/estado de saúde: só avatar e nome. Complementa a
// seleção por toque nos avatares da BarraParticipantes.
export function BandejaAlvos({
  acao, alvos, combatentes, infoPersonagens, ehDM, enviando, onAlternarAlvo, onConfirmar, onCancelar,
}: {
  acao: AcaoPendente
  alvos: AlvoSelecionado[]
  combatentes: Combatente[]
  infoPersonagens: Record<string, InfoPersonagem>
  ehDM: boolean
  enviando: boolean
  onAlternarAlvo: (id: string, nome: string) => void
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const selecionados = useMemo(() => new Set(alvos.map(a => a.id)), [alvos])

  const { inimigos, mesa } = useMemo(() => {
    const visiveis = ehDM ? combatentes : combatentes.filter(c => !c.morto && !c.ausente)
    return {
      inimigos: ordenarPorNome(visiveis.filter(c => c.tipo !== 'jogador')),
      mesa: ordenarPorNome(visiveis.filter(c => c.tipo === 'jogador')),
    }
  }, [combatentes, ehDM])

  function grupo(titulo: string, lista: Combatente[]) {
    if (lista.length === 0) return null
    return (
      <div>
        <p className="px-1 pb-1 text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wide">{titulo}</p>
        <ul className="space-y-1">
          {lista.map(c => {
            const marcado = selecionados.has(c.id)
            const info = c.personagem_id ? infoPersonagens[c.personagem_id] : undefined
            return (
              <li key={c.id}>
                <button
                  onClick={() => onAlternarAlvo(c.id, c.nome)}
                  aria-pressed={marcado}
                  className={cn(
                    'w-full min-h-[44px] flex items-center gap-2.5 px-2 py-1 rounded-lg border text-left transition-colors',
                    marcado
                      ? 'border-[var(--gold)] bg-[var(--gold)]/15'
                      : 'border-[var(--border)] bg-[var(--surface)]',
                    (c.morto || c.ausente) && 'opacity-50'
                  )}
                >
                  <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={32} />
                  <span className={cn('flex-1 min-w-0 truncate font-crimson text-sm', marcado ? 'text-[var(--gold)]' : 'text-[var(--text)]')}>
                    {c.nome}
                  </span>
                  {marcado && <Check className="w-4 h-4 flex-shrink-0 text-[var(--gold)]" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return createPortal(
    <div className="fixed left-0 right-0 bottom-0 z-[9997] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md md:max-w-[28rem] max-h-[60vh] flex flex-col bg-[var(--bg3)] border border-[var(--gold)]/60 rounded-t-xl shadow-2xl">
        <div className="flex-shrink-0 px-3 pt-3 pb-2">
          <p className="text-[var(--gold)] text-xs font-cinzel font-bold truncate">{acao.nomeAcao}</p>
          <p className="text-[var(--text3)] text-[11px] font-crimson">Escolha os alvos</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 space-y-3 pb-2">
          {grupo('Inimigos', inimigos)}
          {grupo('Mesa', mesa)}
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-2 border-t border-[var(--border)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onCancelar}
            className="flex-1 px-2.5 py-2 rounded-lg border border-[var(--border)] text-[var(--text3)] text-xs font-cinzel min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={alvos.length === 0 || enviando}
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--gold)] text-[var(--bg)] text-xs font-cinzel font-bold min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar ({alvos.length})
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
