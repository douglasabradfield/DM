'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Search, X } from 'lucide-react'

type AbaCompendio = 'magicos' | 'armas' | 'armaduras' | 'gear'

// Já no formato do payload de adicionar_item da API árbitro (/api/mesa/acao).
export interface ItemCompendioEscolhido {
  itemRef: string
  nome: string
  tipoItem: string
  raridade: string | null
  descricaoItem: string
}

const TABELAS: Record<AbaCompendio, { tabela: string; campos: string }> = {
  magicos:   { tabela: 'magic_items',      campos: 'slug,name_pt,name_en,category,rarity,description_pt' },
  armas:     { tabela: 'equipment_weapons', campos: 'slug,name_pt,name_en,damage_dice,damage_type_pt,properties_pt,weight_lb,cost_cp' },
  armaduras: { tabela: 'equipment_armor',   campos: 'slug,name_pt,name_en,base_ac_formula_pt,stealth_disadvantage,strength_requirement,weight_lb,cost_cp,category_pt' },
  gear:      { tabela: 'equipment_gear',    campos: 'slug,name_pt,name_en,category_pt,cost_gp,weight_lb,description_pt' },
}

function paraItemEscolhido(item: Record<string, unknown>, aba: AbaCompendio): ItemCompendioEscolhido {
  const base = { itemRef: item.slug as string, nome: item.name_pt as string }
  if (aba === 'magicos') {
    return { ...base, tipoItem: 'magico', raridade: (item.rarity as string) ?? null, descricaoItem: (item.description_pt as string) || '' }
  }
  if (aba === 'armas') {
    return {
      ...base, tipoItem: 'arma', raridade: null,
      descricaoItem: `${item.damage_dice} ${item.damage_type_pt}${item.properties_pt ? ' · ' + item.properties_pt : ''}`,
    }
  }
  if (aba === 'armaduras') {
    return {
      ...base, tipoItem: 'armadura', raridade: null,
      descricaoItem: `${item.base_ac_formula_pt}${item.stealth_disadvantage ? ' · Desvantagem em Furtividade' : ''}${item.strength_requirement ? ` · Força mín. ${item.strength_requirement}` : ''}`,
    }
  }
  return { ...base, tipoItem: 'equipamento', raridade: null, descricaoItem: (item.description_pt as string) || '' }
}

// Busca no compêndio (SRD + itens custom da campanha) para pôr na ficha.
// Usado pela ficha (FichaPersonagem) e pelo inventário da mesa (ModalItem
// em MesaCliente) — quem chama decide o que fazer com o item escolhido.
export function ModalCompendioItens({ campanhaId, ehDM, onEscolher, onFechar }: {
  campanhaId: string
  ehDM: boolean
  onEscolher: (item: ItemCompendioEscolhido) => void
  onFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<AbaCompendio>('gear')
  const [itens, setItens] = useState<Record<string, unknown>[]>([])
  const [buscando, setBuscando] = useState(false)

  const buscar = useCallback(async (termo: string, abaAtual: AbaCompendio) => {
    if (!termo.trim()) { setItens([]); return }
    setBuscando(true)
    try {
      const { tabela, campos } = TABELAS[abaAtual]
      const supabase = createClient()
      // Itens custom só aparecem para quem está na campanha dona — e, para
      // quem não é DM, só se o mestre marcou visivel_jogadores.
      let query = supabase.from(tabela).select(campos).or(`name_pt.ilike.%${termo}%,name_en.ilike.%${termo}%`)
      query = ehDM
        ? query.or(`criado_por.is.null,campanha_id.eq.${campanhaId}`)
        : query.or(`criado_por.is.null,and(campanha_id.eq.${campanhaId},visivel_jogadores.eq.true)`)
      const { data } = await query.limit(10)
      setItens((data ?? []) as unknown as Record<string, unknown>[])
    } finally {
      setBuscando(false)
    }
  }, [campanhaId, ehDM])

  useEffect(() => {
    const t = setTimeout(() => buscar(busca, aba), 300)
    return () => clearTimeout(t)
  }, [busca, aba, buscar])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={onFechar}
    >
      <div
        className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
          <h3 className="font-cinzel text-[var(--gold)] font-bold">Adicionar do Compêndio</h3>
          <button onClick={onFechar} className="text-[var(--text3)] hover:text-[var(--text)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex border-b border-[var(--border)]">
          {([
            { id: 'gear',      label: '🎒 Geral' },
            { id: 'armas',     label: '⚔️ Armas' },
            { id: 'armaduras', label: '🛡️ Armadura' },
            { id: 'magicos',   label: '✨ Mágicos' },
          ] as const).map(a => (
            <button
              key={a.id}
              onClick={() => { setAba(a.id); setItens([]) }}
              className={`flex-1 py-2.5 text-xs font-cinzel transition-colors ${aba === a.id ? 'text-[var(--gold)] border-b-2 border-[var(--gold)]' : 'text-[var(--text3)]'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-b border-[var(--border)]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar item..."
              className="input-dd w-full pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {buscando && (
            <p className="text-[var(--text3)] text-sm text-center py-4 animate-pulse">Buscando...</p>
          )}
          {!buscando && busca && itens.length === 0 && (
            <p className="text-[var(--text3)] text-sm text-center py-4">Nenhum item encontrado</p>
          )}
          {!busca && (
            <p className="text-[var(--text3)] text-xs text-center py-4 italic">Digite para buscar...</p>
          )}
          {itens.map(item => (
            <button
              key={item.slug as string}
              onClick={() => onEscolher(paraItemEscolhido(item, aba))}
              className="w-full text-left p-3 mb-1 border border-[var(--border)] rounded-lg hover:border-[var(--gold)] hover:bg-[var(--surface)] transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-cinzel text-[var(--text)] text-sm font-bold">{item.name_pt as string}</p>
                  <p className="text-[var(--text3)] text-[10px] italic">{item.name_en as string}</p>
                  {aba === 'armas' && (
                    <p className="text-[var(--text3)] text-xs mt-0.5">
                      {item.damage_dice as string} {item.damage_type_pt as string}
                      {item.properties_pt ? ` · ${item.properties_pt as string}` : ''}
                    </p>
                  )}
                  {aba === 'armaduras' && (
                    <p className="text-[var(--text3)] text-xs mt-0.5">
                      {item.base_ac_formula_pt as string}
                      {item.stealth_disadvantage ? ' · ⚠️ Furtividade' : ''}
                    </p>
                  )}
                  {aba === 'magicos' && (
                    <p className={`text-xs mt-0.5 ${
                      item.rarity === 'legendary' ? 'text-orange-400' :
                      item.rarity === 'very_rare' ? 'text-purple-400' :
                      item.rarity === 'rare'      ? 'text-blue-400' :
                      item.rarity === 'uncommon'  ? 'text-green-400' : 'text-[var(--text3)]'
                    }`}>
                      {item.rarity === 'legendary' ? 'Lendário' : item.rarity === 'very_rare' ? 'Muito Raro' : item.rarity === 'rare' ? 'Raro' : item.rarity === 'uncommon' ? 'Incomum' : 'Comum'}
                    </p>
                  )}
                  {aba === 'gear' && !!item.description_pt && (
                    <p className="text-[var(--text3)] text-[10px] mt-0.5 line-clamp-1">{item.description_pt as string}</p>
                  )}
                </div>
                <span className="text-[var(--accent)] text-lg flex-shrink-0">+</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
