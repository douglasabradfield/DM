import { cn } from '@/lib/utils'
import type { Combatente } from '@/types/batalha'
import type { InfoPersonagem } from '../tipos'
import { Avatar } from '../ui/Avatar'

// Barra de participantes — NUNCA em ordem de iniciativa/ordem de turno (a
// mesa sorteia por cartas a cada rodada; vazar a ordem deixaria os
// jogadores planejarem sabendo quem vem depois). O segredo é a ORDEM, não a
// EXISTÊNCIA dos inimigos — eles estão fisicamente na mesa, todo mundo os
// vê. Por isso: fora do modo de seleção de alvo, o jogador só vê os PJs
// (não precisa saber quem mais o DM colocou na cena ainda); ao entrar em
// modo de alvo, os inimigos aparecem, sempre em ordem ALFABÉTICA dentro de
// cada grupo — nunca pela ordem de turno. O único indício de sequência
// permitido é o anel de quem age AGORA (isso já é público via StatusRodada).
// Tocar um avatar abre o popup de detalhes; alvos já escolhidos ganham um
// destaque próprio para não precisar reabrir o popup para conferir.
export function BarraParticipantes({
  aliados, inimigos, turnoCombatenteId, ativa, infoPersonagens, meuCombatenteIds, alvosSelecionadosIds, onTocar,
}: {
  aliados: Combatente[]
  inimigos: Combatente[]
  turnoCombatenteId: string | null
  ativa: boolean
  infoPersonagens: Record<string, InfoPersonagem>
  meuCombatenteIds: Set<string>
  alvosSelecionadosIds: Set<string>
  onTocar: (id: string) => void
}) {
  function avatarDe(c: Combatente, ehInimigo: boolean) {
    const info = c.personagem_id ? infoPersonagens[c.personagem_id] : undefined
    const estaAtivo = ativa && c.id === turnoCombatenteId
    const estaMorto = c.morto || c.pv_atual <= 0
    const ehMeu = meuCombatenteIds.has(c.id)
    const selecionado = alvosSelecionadosIds.has(c.id)
    const anel = selecionado
      ? '0 0 0 3px var(--gold)'
      : estaAtivo
        ? '0 0 0 2px var(--gold)'
        : ehMeu
          ? '0 0 0 2px var(--accent2)'
          : ehInimigo
            ? '0 0 0 1px var(--red2)'
            : '0 0 0 1px var(--border)'
    return (
      <button
        key={c.id}
        onClick={() => onTocar(c.id)}
        className={cn('flex-shrink-0 flex flex-col items-center gap-0.5 w-14', (estaMorto || c.ausente) && 'opacity-40')}
      >
        <div className="rounded-full p-0.5" style={{ boxShadow: anel }}>
          <div className="relative">
            <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={44} />
            {c.condicoes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--red2)] border border-[var(--bg2)]" />
            )}
            {selecionado && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--gold)] border border-[var(--bg2)] flex items-center justify-center text-[9px] leading-none">
                🎯
              </span>
            )}
          </div>
        </div>
        <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{c.nome}</span>
      </button>
    )
  }

  return (
    <div className="flex-shrink-0 flex items-stretch gap-2 overflow-x-auto px-3 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
      {aliados.map(c => avatarDe(c, false))}
      {inimigos.length > 0 && (
        <>
          <div className="w-px bg-[var(--border)] flex-shrink-0 my-1" />
          {inimigos.map(c => avatarDe(c, true))}
        </>
      )}
    </div>
  )
}
