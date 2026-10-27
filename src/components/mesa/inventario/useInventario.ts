'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import type { ItemCompendioEscolhido } from '@/components/personagem/ModalCompendioItens'
import type { InventarioItemDb } from '@/types/dnd'
import type { AcaoInventarioParams, ContextoAcao, Destinatario } from '../tipos'
import { chamarAcaoInventario } from '../api'

// Lógica única do inventário na mesa: carregamento, Realtime e ações
// (usar, passar, equipar, descartar, acrescentar). Usada pelo ModalItem
// (combate/desktop) e pela aba Mochila do celular — nenhuma regra de usar ou
// passar item vive fora daqui.
export function useInventario({
  personagemId, contexto, nomeCanal = `modal-item-${personagemId}`,
}: {
  personagemId: string
  contexto: ContextoAcao
  nomeCanal?: string
}) {
  const [carregando, setCarregando] = useState(true)
  const [itens, setItens] = useState<InventarioItemDb[]>([])
  const [enviando, setEnviando] = useState(false)

  const carregarItens = useCallback(() => {
    createClient()
      .from('inventario_itens')
      .select('*')
      .eq('personagem_id', personagemId)
      .order('nome')
      .then(({ data }) => {
        setItens((data as InventarioItemDb[]) ?? [])
        setCarregando(false)
      })
  }, [personagemId])

  useEffect(() => { carregarItens() }, [carregarItens])

  // Realtime — reflete o que a API muda (inclusive itens recebidos por
  // transferência de outro jogador enquanto a lista está aberta).
  useEffect(() => {
    const supabase = createClient()
    const canal = supabase
      .channel(nomeCanal)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario_itens', filter: `personagem_id=eq.${personagemId}` },
        carregarItens
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [personagemId, nomeCanal, carregarItens])

  async function executar(payload: Omit<AcaoInventarioParams, 'sessaoId' | 'personagemId' | 'batalhaId' | 'combatenteId'>) {
    if (enviando) return false
    setEnviando(true)
    const resultado = await chamarAcaoInventario({
      ...('sessaoId' in contexto ? { sessaoId: contexto.sessaoId, personagemId } : { batalhaId: contexto.batalhaId, combatenteId: contexto.combatenteId }),
      ...payload,
    })
    setEnviando(false)
    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao registrar ação')
      return false
    }
    if (resultado.descricao) toast.success(resultado.descricao)
    return true
  }

  async function usar(item: InventarioItemDb, valorCura: number) {
    const ok = await executar({ tipo: 'usar_item', itemId: item.id, valorCura })
    if (ok) carregarItens()
    return ok
  }

  async function passar(item: InventarioItemDb, destino: Destinatario, quantidade = 1) {
    const ok = await executar({ tipo: 'transferir_item', itemId: item.id, quantidade, paraPersonagemId: destino.id })
    if (ok) carregarItens()
    return ok
  }

  async function equipar(item: InventarioItemDb, equipado: boolean) {
    return executar({ tipo: 'equipar_item', itemId: item.id, equipado })
  }

  async function descartar(item: InventarioItemDb) {
    if (!window.confirm(`Descartar ${item.quantidade}x ${item.nome}?`)) return false
    const ok = await executar({ tipo: 'descartar_item', itemId: item.id, quantidade: item.quantidade })
    if (ok) carregarItens()
    return ok
  }

  // Item achado no meio da sessão — o mestre cria no compêndio (aba Itens)
  // e o jogador põe na própria ficha daqui, sem sair da mesa.
  async function acrescentar(item: ItemCompendioEscolhido) {
    const ok = await executar({ tipo: 'adicionar_item', ...item, quantidade: 1 })
    if (ok) carregarItens()
    return ok
  }

  return { carregando, itens, enviando, usar, passar, equipar, descartar, acrescentar }
}
