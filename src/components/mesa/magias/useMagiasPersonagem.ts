'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { TipoDano } from '@/types/dnd'
import type { LinhaMagia, MagiaExibida } from '../tipos'

// Carregamento e preparo das magias de um personagem — fonte única para
// ModalMagias, ModalPrepararMagias e a aba Magias do celular. Mesma tabela
// que a Ficha edita (magias_personagem.preparada), escrita direta (não é
// estado de jogo/PV, é gerenciamento de ficha).
export function useMagiasPersonagem(personagemId: string) {
  const [carregando, setCarregando] = useState(true)
  const [magias, setMagias] = useState<MagiaExibida[]>([])

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    createClient()
      .from('magias_personagem')
      .select(`
        id, preparada, nivel,
        spell:spells!spell_id(name_pt, casting_time_pt, range_pt, duration_pt, damage_dice, damage_type_pt, heal_dice, concentration, save_ability, save_effect)
      `)
      .eq('personagem_id', personagemId)
      .order('nivel')
      .then(({ data }) => {
        if (cancelado) return
        const linhas = (data ?? []) as unknown as LinhaMagia[]
        setMagias(linhas.map(m => ({
          id: m.id,
          nome: m.spell?.name_pt ?? '(sem nome)',
          nivel: m.nivel,
          preparada: m.preparada,
          danoDice: m.spell?.damage_dice ?? null,
          tipoDano: (m.spell?.damage_type_pt as TipoDano | undefined) ?? null,
          curaDice: m.spell?.heal_dice ?? null,
          concentracao: m.spell?.concentration ?? false,
          saveAbility: m.spell?.save_ability ?? null,
          tempoConjuracao: m.spell?.casting_time_pt ?? null,
          alcance: m.spell?.range_pt ?? null,
          duracao: m.spell?.duration_pt ?? null,
        })))
        setCarregando(false)
      })
    return () => { cancelado = true }
  }, [personagemId])

  const alternarPreparada = useCallback(async (m: MagiaExibida) => {
    const novoValor = !m.preparada
    setMagias(prev => prev.map(x => x.id === m.id ? { ...x, preparada: novoValor } : x))
    const { error } = await createClient().from('magias_personagem').update({ preparada: novoValor }).eq('id', m.id)
    if (error) {
      toast.error('Erro ao atualizar magia preparada')
      setMagias(prev => prev.map(x => x.id === m.id ? { ...x, preparada: m.preparada } : x))
    }
  }, [])

  return { carregando, magias, alternarPreparada }
}
