'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Item, Arma } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { Search } from 'lucide-react'

type Aba = 'itens' | 'armas'

const COR_RARIDADE: Record<string, string> = {
  'Comum': '#adb5bd', 'Incomum': '#27ae60', 'Raro': '#3498db',
  'Muito Raro': '#9b59b6', 'Lendário': '#d4a843', 'Artefato': '#e74c3c',
}

export default function ItensPage() {
  const [aba, setAba] = useState<Aba>('itens')
  const [itens, setItens] = useState<Item[]>([])
  const [armas, setArmas] = useState<Arma[]>([])
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<Item | Arma | null>(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    try {
      const supabase = createClient()
      if (aba === 'itens') {
        let query = supabase.from('itens').select('*').limit(100)
        if (busca) query = query.ilike('nome', `%${busca}%`)
        const { data } = await query.order('nome')
        setItens((data ?? []) as Item[])
      } else {
        let query = supabase.from('armas').select('*').limit(100)
        if (busca) query = query.ilike('nome', `%${busca}%`)
        const { data } = await query.order('nome')
        setArmas((data ?? []) as Arma[])
      }
    } finally {
      setCarregando(false)
    }
  }, [aba, busca])

  useEffect(() => { buscar() }, [buscar])

  const lista = aba === 'itens' ? itens : armas

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="w-72 border-r border-[#4a3060] flex flex-col">
        <div className="p-3 border-b border-[#4a3060] space-y-2">
          <div className="flex gap-1">
            {(['itens', 'armas'] as Aba[]).map(a => (
              <button
                key={a}
                onClick={() => { setAba(a); setSelecionado(null) }}
                className={`flex-1 py-1 text-xs font-cinzel rounded border transition-colors capitalize ${
                  aba === a ? 'bg-[#261a2e] border-[#d4a843] text-[#d4a843]' : 'border-[#4a3060] text-[#8870a8]'
                }`}
              >
                {a === 'itens' ? 'Itens Mágicos' : 'Armas'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8870a8]" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="w-full input-dd pl-7 text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="p-4 text-center text-[#8870a8] text-sm">Carregando...</div>
          ) : lista.length === 0 ? (
            <div className="p-4 text-center text-[#4a3060] text-sm">Nenhum resultado</div>
          ) : (
            lista.map(item => {
              const itemCompleto = item as Item & Arma
              return (
                <button
                  key={item.id}
                  onClick={() => setSelecionado(item)}
                  className={`w-full text-left px-3 py-2 border-b border-[#1e1525] transition-colors ${selecionado && 'id' in selecionado && selecionado.id === item.id ? 'bg-[#261a2e]' : 'hover:bg-[#1e1525]'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#e8dff0] text-sm font-crimson">{item.nome}</span>
                    {aba === 'itens' && itemCompleto.raridade && (
                      <span className="text-[10px]" style={{ color: COR_RARIDADE[itemCompleto.raridade] ?? '#8870a8' }}>
                        {itemCompleto.raridade}
                      </span>
                    )}
                  </div>
                  <p className="text-[#8870a8] text-[10px]">
                    {aba === 'itens' ? itemCompleto.tipo : `${itemCompleto.categoria} · ${itemCompleto.dano} ${itemCompleto.tipo_dano}`}
                  </p>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Detalhes */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selecionado ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-cinzel text-[#4a3060]">Selecione um item para ver detalhes</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            {aba === 'itens' ? (() => {
              const item = selecionado as Item
              return (
                <>
                  <div className="mb-4">
                    <h2 className="font-cinzel text-[#d4a843] text-2xl font-bold">{item.nome}</h2>
                    {item.nome_original && <p className="text-[#4a3060] text-sm italic">{item.nome_original}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {item.raridade && <span className="text-sm" style={{ color: COR_RARIDADE[item.raridade] }}>{item.raridade}</span>}
                      {item.tipo && <span className="text-[#8870a8] text-sm">· {item.tipo}</span>}
                      {item.requer_sintonizacao && <span className="text-[#f39c12] text-xs">(requer sintonização)</span>}
                    </div>
                  </div>
                  <PainelGrimorio compacto className="mb-3">
                    <div className="flex gap-4 text-sm">
                      {item.valor && <span><span className="text-[#8870a8] font-cinzel text-xs">Valor: </span><span className="text-[#e8dff0]">{item.valor}</span></span>}
                      {item.peso && <span><span className="text-[#8870a8] font-cinzel text-xs">Peso: </span><span className="text-[#e8dff0]">{item.peso}</span></span>}
                    </div>
                  </PainelGrimorio>
                  {item.descricao && (
                    <PainelGrimorio titulo="Descrição" compacto>
                      <p className="text-[#b8a8cc] font-crimson whitespace-pre-wrap leading-relaxed">{item.descricao}</p>
                    </PainelGrimorio>
                  )}
                </>
              )
            })() : (() => {
              const arma = selecionado as Arma
              return (
                <>
                  <div className="mb-4">
                    <h2 className="font-cinzel text-[#e74c3c] text-2xl font-bold">{arma.nome}</h2>
                    {arma.nome_original && <p className="text-[#4a3060] text-sm italic">{arma.nome_original}</p>}
                    <p className="text-[#b8a8cc] text-sm mt-1">{arma.categoria}</p>
                  </div>
                  <PainelGrimorio compacto className="mb-3">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-[#8870a8] font-cinzel text-xs block">Dano</span><span className="text-[#e74c3c] font-bold font-cinzel">{arma.dano}</span></div>
                      <div><span className="text-[#8870a8] font-cinzel text-xs block">Tipo</span><span className="text-[#e8dff0]">{arma.tipo_dano}</span></div>
                      <div><span className="text-[#8870a8] font-cinzel text-xs block">Peso</span><span className="text-[#e8dff0]">{arma.peso ?? '—'}</span></div>
                    </div>
                  </PainelGrimorio>
                  {arma.propriedades && arma.propriedades.length > 0 && (
                    <PainelGrimorio titulo="Propriedades" compacto>
                      <div className="flex flex-wrap gap-1">
                        {arma.propriedades.map(p => (
                          <span key={p} className="px-2 py-0.5 bg-[#261a2e] border border-[#4a3060] text-[#b8a8cc] text-xs rounded">{p}</span>
                        ))}
                      </div>
                    </PainelGrimorio>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
