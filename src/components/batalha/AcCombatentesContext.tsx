'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useBatalha } from '@/store/batalha'
import { useAcPersonagens } from '@/hooks/useAcPersonagens'
import { aplicarOverrideAc, type ResultadoAC } from '@/lib/dados-dnd/ca'
import type { Combatente } from '@/types/batalha'

const AcCombatentesContext = createContext<Record<string, ResultadoAC>>({})

// Carrega, em UMA leva (2 queries com in(...)), o AC de todos os combatentes
// ligados a uma ficha. Monstros e NPCs sem ficha seguem usando c.ca do store.
export function AcCombatentesProvider({ children }: { children: ReactNode }) {
  const combatentes = useBatalha(s => s.combatentes)
  const ids = useMemo(
    () => combatentes.map(c => c.personagem_id).filter((id): id is string => !!id),
    [combatentes]
  )
  const dados = useAcPersonagens(ids)
  const mapa = useMemo(
    () => Object.fromEntries(Object.entries(dados).map(([id, d]) => [id, d.resultado])),
    [dados]
  )
  return <AcCombatentesContext.Provider value={mapa}>{children}</AcCombatentesContext.Provider>
}

export interface AcBatalha {
  // CA exibida: ac_override ?? ac_manual ?? calculado (monstro: c.ca)
  efetivo: number
  // CA temporária ativa nesta batalha, ou null
  override: number | null
  // CA sem o override (o que a ficha daria): usada para o botão de limpar e o aviso
  base: number
}

// AC a exibir para um combatente. Com ficha: ac_override ?? ac_manual ?? calculado.
// Sem ficha (monstro/NPC): c.ca do store, editável direto.
export function useAcBatalha(c: Pick<Combatente, 'personagem_id' | 'ca' | 'ac_override'>): AcBatalha {
  const mapa = useContext(AcCombatentesContext)
  const r = c.personagem_id ? mapa[c.personagem_id] : undefined
  if (!r) return { efetivo: c.ca, override: null, base: c.ca }
  const comOverride = aplicarOverrideAc(r, c.ac_override)
  return { efetivo: comOverride.efetivo, override: comOverride.override, base: aplicarOverrideAc(r, null).efetivo }
}

export function useAcDoCombatente(c: Pick<Combatente, 'personagem_id' | 'ca' | 'ac_override'>): number {
  return useAcBatalha(c).efetivo
}
