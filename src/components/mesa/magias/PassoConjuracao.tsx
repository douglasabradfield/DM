'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EspacosMagiaBatalha } from '@/types/batalha'
import type { ConjuracaoEscolhida, MagiaExibida } from '../tipos'
import { classificarMagia, niveisDisponiveisParaMagia } from '../helpers'

// Passo "nível de conjuração" — compartilhado pelo ModalMagias e pela aba
// Magias do celular. Permite conjurar em nível superior; o espaço em si só
// é consumido pela API, nunca aqui.
export function PassoConjuracao({
  magia, espacosMagia, onConfirmar, onVoltar, onFechar,
}: {
  magia: MagiaExibida
  espacosMagia: EspacosMagiaBatalha
  onConfirmar: (escolha: ConjuracaoEscolhida) => void
  onVoltar: () => void
  onFechar?: () => void
}) {
  const niveisDisponiveis = magia.nivel > 0 ? niveisDisponiveisParaMagia(magia.nivel, espacosMagia) : []
  const [nivelEscolhido, setNivelEscolhido] = useState<number>(niveisDisponiveis[0]?.nivel ?? magia.nivel)
  const [efeitoAtivo, setEfeitoAtivo] = useState(false)

  const semNivelDisponivel = magia.nivel > 0 && niveisDisponiveis.length === 0
  const { efeito } = classificarMagia(magia)

  function confirmar() {
    if (semNivelDisponivel) return
    onConfirmar({
      magia,
      nivelConjurado: magia.nivel > 0 ? nivelEscolhido : null,
      efeitoAtivo,
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onVoltar} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">
          ←
        </button>
        <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate flex-1">{magia.nome}</h3>
        {onFechar && (
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-[var(--text3)] text-xs font-crimson mb-3">
        {efeito === 'dano' && `Causa dano${magia.tipoDano ? ` (${magia.tipoDano})` : ''}`}
        {efeito === 'cura' && 'Causa cura'}
        {efeito === 'nenhum' && 'Utilitária — registra no log, sem valor'}
        {magia.saveAbility && ` · Salvaguarda: ${magia.saveAbility}`}
      </p>

      {magia.nivel > 0 && (
        <div className="mb-3">
          <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Nível de conjuração</p>
          {niveisDisponiveis.length === 0 ? (
            <p className="text-[var(--red2)] text-xs font-crimson">
              Sem espaços de magia disponíveis para conjurar esta magia
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {niveisDisponiveis.map(({ nivel: n, disponivel, total }) => (
                <button
                  key={n}
                  onClick={() => setNivelEscolhido(n)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-cinzel min-h-[40px]',
                    nivelEscolhido === n
                      ? 'bg-[var(--gold)] border-[var(--gold)] text-[var(--bg)] font-bold'
                      : 'border-[var(--border)] text-[var(--text2)]'
                  )}
                >
                  N{n} ({disponivel}/{total})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {magia.concentracao && (
        <label className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={efeitoAtivo}
            onChange={e => setEfeitoAtivo(e.target.checked)}
            className="w-4 h-4 accent-[var(--gold)]"
          />
          <span className="text-[var(--text2)] text-xs font-crimson">🔮 Manter como efeito ativo (concentração)</span>
        </label>
      )}

      <button
        onClick={confirmar}
        disabled={semNivelDisponivel}
        className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {efeito === 'nenhum' ? 'Registrar' : 'Continuar'}
      </button>
    </>
  )
}
