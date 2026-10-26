'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { limiteMagiasPreparadas } from '@/lib/dados-dnd/espacos-magia'
import type { EspacosMagiaBatalha } from '@/types/batalha'
import type { Personagem } from '@/types/dnd'
import type { ConjuracaoEscolhida, MagiaExibida } from '../tipos'
import { EspacosMagiaSessao } from '../sessao/EspacosMagiaSessao'
import { useMagiasPersonagem } from './useMagiasPersonagem'
import { PassoConjuracao } from './PassoConjuracao'

type Filtro = 'preparadas' | 'todas'

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Aba Magias do celular (abaixo de md). Preparar/desfazer o preparo funciona
// sempre; "Conjurar" só fica ativo com `podeConjurar` e usa o mesmo caminho
// do modal (onConjurar), depois do mesmo passo de nível do espaço.
export function AbaMagias({
  personagem, espacosMagia, podeConjurar, podeEditarEspacos,
  onConjurar, onUsarEspaco, onRecuperarEspaco,
}: {
  personagem: Pick<Personagem, 'id' | 'classe' | 'nivel' | 'inteligencia' | 'sabedoria' | 'carisma'>
  espacosMagia: EspacosMagiaBatalha
  podeConjurar: boolean
  podeEditarEspacos: boolean
  onConjurar: (escolha: ConjuracaoEscolhida) => void
  onUsarEspaco: (nivel: number) => void
  onRecuperarEspaco: (nivel: number) => void
}) {
  const { carregando, magias, alternarPreparada } = useMagiasPersonagem(personagem.id)
  const [filtro, setFiltro] = useState<Filtro>('preparadas')
  const [busca, setBusca] = useState('')
  const [conjurando, setConjurando] = useState<MagiaExibida | null>(null)

  const limite = limiteMagiasPreparadas(personagem.classe, personagem.nivel, personagem)
  const totalPreparadas = magias.filter(m => m.nivel > 0 && m.preparada).length

  const grupos = useMemo(() => {
    const termo = semAcento(busca.trim())
    const visiveis = magias.filter(m =>
      (filtro === 'todas' || m.nivel === 0 || m.preparada) &&
      (!termo || semAcento(m.nome).includes(termo))
    )
    const porNivel = new Map<number, MagiaExibida[]>()
    for (const m of visiveis) porNivel.set(m.nivel, [...(porNivel.get(m.nivel) ?? []), m])
    return [...porNivel.entries()].sort(([a], [b]) => a - b)
  }, [magias, filtro, busca])

  const slots = { ...espacosMagia } as Record<string, { total: number; usados: number }>

  if (conjurando) {
    return (
      <div className="pb-6">
        <PassoConjuracao
          magia={conjurando}
          espacosMagia={espacosMagia}
          onConfirmar={escolha => { setConjurando(null); onConjurar(escolha) }}
          onVoltar={() => setConjurando(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-6 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-cinzel text-[var(--gold)] font-bold text-lg">Magias</h2>
        {limite !== null && (
          <span className="px-2.5 py-1 rounded-full border border-[var(--gold)] text-[var(--gold)] text-xs font-cinzel">
            Preparadas {totalPreparadas} de {limite}
          </span>
        )}
      </div>

      <EspacosMagiaSessao
        slotsMagia={slots}
        podeEditar={podeEditarEspacos}
        onUsar={onUsarEspaco}
        onRecuperar={onRecuperarEspaco}
      />

      <div className="flex rounded-lg border border-[var(--border)] overflow-hidden" role="tablist">
        {(['preparadas', 'todas'] as const).map(f => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filtro === f}
            onClick={() => setFiltro(f)}
            className={cn(
              'flex-1 min-h-[44px] font-cinzel text-sm',
              filtro === f ? 'bg-[var(--gold)] text-[var(--bg)] font-bold' : 'bg-[var(--surface)] text-[var(--text2)]'
            )}
          >
            {f === 'preparadas' ? 'Preparadas' : 'Todas'}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
        <input
          type="search"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar magia"
          className="w-full input-dd pl-9 text-sm min-h-[44px]"
        />
      </div>

      {carregando ? (
        <p className="text-[var(--text3)] text-sm font-crimson text-center py-4">Carregando...</p>
      ) : grupos.length === 0 ? (
        <p className="text-[var(--text3)] text-sm font-crimson text-center py-4">
          {magias.length === 0 ? 'Nenhuma magia na ficha' : 'Nenhuma magia encontrada'}
        </p>
      ) : (
        grupos.map(([nivel, lista]) => (
          <section key={nivel} className="flex flex-col gap-1.5">
            <h3 className="text-[var(--text3)] text-[11px] font-cinzel uppercase tracking-wide">
              {nivel === 0 ? 'Truques' : `${nivel}º nível`}
            </h3>
            {lista.map(m => {
              const truque = m.nivel === 0
              const podeUsar = truque || m.preparada
              const detalhe = [m.tempoConjuracao, [m.alcance, m.duracao].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-center gap-2 px-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] min-h-[56px]',
                    !podeUsar && 'opacity-50'
                  )}
                >
                  {truque ? (
                    <span className="w-11 flex-shrink-0" aria-hidden />
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={m.preparada}
                      aria-label={`Preparar ${m.nome}`}
                      onClick={() => alternarPreparada(m)}
                      className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                    >
                      <span className={cn(
                        'relative w-9 h-5 rounded-full border transition-colors',
                        m.preparada ? 'bg-[var(--gold)] border-[var(--gold)]' : 'bg-transparent border-[var(--border)]'
                      )}>
                        <span className={cn(
                          'absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all',
                          m.preparada ? 'left-[18px] bg-[var(--bg)]' : 'left-0.5 bg-[var(--text3)]'
                        )} />
                      </span>
                    </button>
                  )}
                  <div className="flex-1 min-w-0 py-2">
                    <p className="text-[var(--text)] text-sm font-crimson font-bold truncate">{m.nome}</p>
                    {detalhe && <p className="text-[var(--text3)] text-xs font-crimson truncate">{detalhe}</p>}
                  </div>
                  {podeUsar && (
                    <button
                      type="button"
                      disabled={!podeConjurar}
                      onClick={() => setConjurando(m)}
                      className="px-3 min-h-[44px] min-w-[44px] rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-xs font-bold flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Conjurar
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        ))
      )}

      <p className="text-[var(--text3)] text-xs font-crimson italic text-center">
        O preparo vale a qualquer hora, inclusive no meio da batalha.
      </p>
    </div>
  )
}
