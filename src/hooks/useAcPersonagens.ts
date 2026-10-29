'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { chaveDeIds, nomeCanalUnico } from '@/lib/realtime/canal'
import { calcularAC, type FichaParaAC, type ItemMecanico, type ResultadoAC } from '@/lib/dados-dnd/ca'

export const COLUNAS_ITEM_MECANICO =
  'personagem_id, nome, categoria, tipo_armadura, ac_base, max_des, req_for, desv_furtividade, modificadores'

export interface AcPersonagem {
  ficha: FichaParaAC
  itens: ItemMecanico[]
  resultado: ResultadoAC
}

type Supabase = ReturnType<typeof createClient>

// Duas queries para N personagens (nunca uma por linha): fichas + itens
// equipados, ambos com in(...). O AC não é gravado em lugar nenhum — é
// derivado aqui, a cada leitura.
export async function carregarAcPersonagens(supabase: Supabase, ids: string[]): Promise<Record<string, AcPersonagem>> {
  if (ids.length === 0) return {}
  const [fichas, itens] = await Promise.all([
    supabase.from('personagens')
      .select('id, forca, destreza, constituicao, sabedoria, classe, ac_manual')
      .in('id', ids),
    supabase.from('inventario_itens')
      .select(COLUNAS_ITEM_MECANICO)
      .in('personagem_id', ids)
      .eq('equipado', true),
  ])

  const itensPorPersonagem: Record<string, ItemMecanico[]> = {}
  for (const row of (itens.data ?? []) as (ItemMecanico & { personagem_id: string })[]) {
    ;(itensPorPersonagem[row.personagem_id] ??= []).push(row)
  }

  const resultado: Record<string, AcPersonagem> = {}
  for (const f of (fichas.data ?? []) as (FichaParaAC & { id: string })[]) {
    const equipados = itensPorPersonagem[f.id] ?? []
    resultado[f.id] = { ficha: f, itens: equipados, resultado: calcularAC(f, equipados) }
  }
  return resultado
}

// AC (e detalhe) de vários personagens de uma vez, mantido fresco por
// Realtime em personagens e inventario_itens.
export function useAcPersonagens(ids: string[]) {
  const chave = useMemo(() => chaveDeIds(ids), [ids])
  const instancia = useId()
  const [dados, setDados] = useState<Record<string, AcPersonagem>>({})

  const recarregar = useCallback(async () => {
    const lista = chave ? chave.split(',') : []
    setDados(await carregarAcPersonagens(createClient(), lista))
  }, [chave])

  useEffect(() => {
    if (!chave) return
    const lista = chave.split(',')
    let ativo = true
    const supabase = createClient()
    const atualizar = () => { if (ativo) void recarregar() }
    atualizar()

    const filtroIds = `in.(${lista.join(',')})`
    // Realtime é bônus: se falhar, o AC segue correto por leitura normal.
    let canal: ReturnType<typeof supabase.channel> | null = null
    try {
      canal = supabase
        .channel(nomeCanalUnico('ac-personagens', chave, instancia))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_itens', filter: `personagem_id=${filtroIds}` }, atualizar)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'personagens', filter: `id=${filtroIds}` }, atualizar)
        .subscribe()
    } catch (e) {
      console.warn('Realtime do AC indisponível:', e)
    }
    return () => {
      ativo = false
      if (canal) void supabase.removeChannel(canal)
    }
  }, [chave, instancia, recarregar])

  return dados
}
