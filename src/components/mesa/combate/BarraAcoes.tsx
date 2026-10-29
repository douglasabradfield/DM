import { cn } from '@/lib/utils'
import type { ArmaEmpunhada, Combatente } from '@/types/batalha'
import { ataquesDoCombatente } from '../helpers'
import { SlotArma } from './SlotArma'
import { useRecursosPersonagem } from '@/components/personagem/RecursosClasse'
import { ehCanalizarDivindade, type TipoRecursoTurno } from '@/lib/mesa/recursos-turno'

// Rodapé fixo — alcance do polegar. Fase 2 reserva o espaço e valida a
// ergonomia: Ataque, Magia e Item central desabilitam fora do turno; Reação
// fica sempre ativa (dentro ou fora do turno) até ser usada na rodada.
// Armas empunhadas continuam sendo a única escrita direta.
export function BarraAcoes({
  combatente, ehMeuTurno, onDefinirArma, onAtacarComArma, onAbrirAtaque, onAbrirMagia, onAbrirItem, onAbrirReacao,
  onUsarRecurso, enviandoRecurso,
}: {
  combatente: Combatente
  ehMeuTurno: boolean
  onDefinirArma: (lado: 'esquerda' | 'direita', arma: ArmaEmpunhada | null) => void
  onAtacarComArma: (arma: ArmaEmpunhada) => void
  onAbrirAtaque: () => void
  onAbrirMagia: () => void
  onAbrirItem: () => void
  onAbrirReacao: () => void
  onUsarRecurso: (recurso: TipoRecursoTurno) => void
  enviandoRecurso: boolean
}) {
  const ataquesDisponiveis = ataquesDoCombatente(combatente)
  // Recursos vêm da ficha (mesmo hook e canal Realtime da RecursosLeitura).
  const { recursos } = useRecursosPersonagem(combatente.personagem_id)
  const canalizar = recursos.find(r => ehCanalizarDivindade(r.recurso_id) && r.total > 0)
  const usosCanalizar = canalizar ? canalizar.total - canalizar.usados : 0
  // Inspiração: só aparece para quem tem o campo na ficha (combatente com ficha).
  const temInspiracao = (combatente.inspiracao ?? 0) > 0
  const reacaoDisponivel = !combatente.reacao_usada
  // Magia e Item são conceitos de ficha (magias_personagem / inventário) —
  // não existem para monstros/NPCs sem personagem_id vinculado.
  const temFicha = !!combatente.personagem_id

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-2 py-1.5 space-y-1">
      <div className="flex items-stretch gap-1.5">
        <SlotArma
          arma={combatente.arma_esquerda}
          ataquesDisponiveis={ataquesDisponiveis}
          podeAgir={ehMeuTurno}
          onEscolher={a => onDefinirArma('esquerda', a)}
          onLimpar={() => onDefinirArma('esquerda', null)}
          onAtacar={onAtacarComArma}
        />

        <div className="flex-1 grid grid-cols-3 gap-1.5">
          <button
            onClick={onAbrirAtaque}
            disabled={!ehMeuTurno}
            aria-label="Atacar"
            title={ehMeuTurno ? 'Atacar' : 'Aguarde sua vez'}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] transition-opacity',
              !ehMeuTurno && 'opacity-40 cursor-not-allowed'
            )}
          >
            <span className="text-base leading-none">⚔️</span>
            Ataque
          </button>
          <button
            onClick={onAbrirMagia}
            disabled={!ehMeuTurno || !temFicha}
            aria-label="Conjurar magia"
            title={!temFicha ? 'Sem ficha vinculada' : ehMeuTurno ? 'Conjurar magia' : 'Aguarde sua vez'}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] transition-opacity',
              (!ehMeuTurno || !temFicha) && 'opacity-40 cursor-not-allowed'
            )}
          >
            <span className="text-base leading-none">✨</span>
            Magia
          </button>
          <button
            onClick={onAbrirItem}
            disabled={!ehMeuTurno || !temFicha}
            aria-label="Usar item"
            title={!temFicha ? 'Sem ficha vinculada' : ehMeuTurno ? 'Usar item' : 'Aguarde sua vez'}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] transition-opacity',
              (!ehMeuTurno || !temFicha) && 'opacity-40 cursor-not-allowed'
            )}
          >
            <span className="text-base leading-none">🎒</span>
            Item
          </button>
        </div>

        <SlotArma
          arma={combatente.arma_direita}
          ataquesDisponiveis={ataquesDisponiveis}
          podeAgir={ehMeuTurno}
          onEscolher={a => onDefinirArma('direita', a)}
          onLimpar={() => onDefinirArma('direita', null)}
          onAtacar={onAtacarComArma}
        />
      </div>

      {(canalizar || combatente.personagem_id) && (
        <div className="flex gap-1.5">
          {canalizar && (
            <button
              onClick={() => onUsarRecurso('canalizar_divindade')}
              disabled={!ehMeuTurno || usosCanalizar <= 0 || enviandoRecurso}
              aria-label={`Canalizar Divindade, ${usosCanalizar} de ${canalizar.total} usos`}
              title={!ehMeuTurno ? 'Aguarde sua vez' : usosCanalizar <= 0 ? 'Sem usos — espere um descanso' : 'Canalizar Divindade'}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
                'text-[var(--text2)] font-cinzel text-[11px] min-h-[48px] transition-opacity active:scale-[0.98]',
                (!ehMeuTurno || usosCanalizar <= 0 || enviandoRecurso) && 'opacity-40 cursor-not-allowed'
              )}
            >
              <span className="text-base leading-none">🙏</span>
              Canalizar {usosCanalizar}/{canalizar.total}
            </button>
          )}
          {combatente.personagem_id && (
            <button
              onClick={() => onUsarRecurso('inspiracao_heroica')}
              disabled={!temInspiracao || enviandoRecurso}
              aria-label="Usar inspiração heroica"
              title={temInspiracao ? 'Inspiração heroica — disponível dentro ou fora do turno' : 'Sem inspiração heroica'}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
                'text-[var(--text2)] font-cinzel text-[11px] min-h-[48px] transition-opacity active:scale-[0.98]',
                (!temInspiracao || enviandoRecurso) && 'opacity-40 cursor-not-allowed'
              )}
            >
              <span className="text-base leading-none">⭐</span>
              Inspiração
            </button>
          )}
        </div>
      )}

      <button
        onClick={onAbrirReacao}
        disabled={!reacaoDisponivel}
        title={reacaoDisponivel ? 'Reação — disponível dentro ou fora do turno' : 'Reação já usada nesta rodada'}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 rounded-lg border font-cinzel text-xs py-1 min-h-[30px]',
          reacaoDisponivel
            ? 'border-[var(--accent2)]/50 bg-[var(--surface)] text-[var(--accent2)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text3)] opacity-50 cursor-not-allowed'
        )}
      >
        <span className="text-sm leading-none">⚡</span> {reacaoDisponivel ? 'Reação' : 'Reação usada'}
      </button>
    </div>
  )
}
