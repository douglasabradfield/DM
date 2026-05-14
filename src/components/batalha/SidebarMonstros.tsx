'use client'

import { useState } from 'react'
import { useBatalha } from '@/store/batalha'
import { createClient } from '@/lib/supabase/client'
import type { Monstro } from '@/types/dnd'
import { getEspacosMagia } from '@/lib/dados-dnd/espacos-magia'
import { Search } from 'lucide-react'

export function SidebarMonstros() {
  const { adicionarCombatente } = useBatalha()
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Monstro[]>([])
  const [carregando, setCarregando] = useState(false)

  async function buscarMonstros(termo: string) {
    if (termo.length < 2) { setResultados([]); return }
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('monstros')
        .select('*')
        .ilike('nome', `%${termo}%`)
        .limit(10)
      setResultados(data ?? [])
    } finally {
      setCarregando(false)
    }
  }

  function adicionarMonstro(m: Monstro, quantidade = 1) {
    for (let i = 0; i < quantidade; i++) {
      const pvBase = m.pv ?? 10
      const pv = quantidade > 1
        ? Math.max(1, pvBase + Math.floor(Math.random() * 5) - 2)
        : pvBase

      adicionarCombatente({
        personagem_id: null,
        nome: quantidade > 1 ? `${m.nome} ${i + 1}` : m.nome,
        tipo: 'monstro',
        iniciativa: Math.floor(Math.random() * 20) + 1,
        ca: m.ca ?? 10,
        pv_maximo: pv,
        pv_atual: pv,
        pv_temporarios: 0,
        ausente: false,
        morto: false,
        condicoes: [],
        resistencias: [],
        imunidades: [],
        vulnerabilidades: [],
        espacos_magia: {},
        notas: '',
        dados_monstro: {
          cr: m.cr ?? '?',
          tipo: m.tipo ?? '',
          habilidades: m.habilidades ?? '',
          acoes: m.acoes ?? '',
          forca: m.forca ?? 10,
          destreza: m.destreza ?? 10,
          constituicao: m.constituicao ?? 10,
          inteligencia: m.inteligencia ?? 10,
          sabedoria: m.sabedoria ?? 10,
          carisma: m.carisma ?? 10,
        },
        ordem: 999,
      })
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#4a3060]">
        <p className="font-cinzel text-[#d4a843] text-xs uppercase tracking-wider mb-2">Adicionar Monstro</p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8870a8]" />
          <input
            type="text"
            value={busca}
            onChange={e => { setBusca(e.target.value); buscarMonstros(e.target.value) }}
            placeholder="Buscar monstro..."
            className="w-full input-dd pl-6 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {carregando && <p className="text-[#8870a8] text-xs text-center p-3">Buscando...</p>}
        {resultados.map(m => (
          <div key={m.id} className="px-3 py-2 border-b border-[#1e1525] hover:bg-[#1e1525] transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#e8dff0] text-xs font-semibold">{m.nome}</p>
                <p className="text-[#8870a8] text-[10px]">{m.tipo} · CR {m.cr} · PV {m.pv} · CA {m.ca}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => adicionarMonstro(m, 1)}
                  className="text-[10px] px-1.5 py-0.5 bg-[#261a2e] border border-[#4a3060] text-[#d4a843] rounded hover:border-[#d4a843] transition-colors"
                >
                  +1
                </button>
                <button
                  onClick={() => adicionarMonstro(m, 3)}
                  className="text-[10px] px-1.5 py-0.5 bg-[#261a2e] border border-[#4a3060] text-[#d4a843] rounded hover:border-[#d4a843] transition-colors"
                >
                  +3
                </button>
              </div>
            </div>
          </div>
        ))}
        {busca.length >= 2 && resultados.length === 0 && !carregando && (
          <p className="text-[#4a3060] text-xs text-center p-3">Nenhum monstro encontrado</p>
        )}
        {busca.length === 0 && (
          <div className="p-3">
            <p className="text-[#4a3060] text-xs text-center">Digite para buscar no bestiário</p>
          </div>
        )}
      </div>
    </div>
  )
}
