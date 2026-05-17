'use client'

import { useState } from 'react'
import { useBatalha } from '@/store/batalha'
import { createClient } from '@/lib/supabase/client'
import type { Monster } from '@/types/dnd'
import { Search } from 'lucide-react'

export function SidebarMonstros() {
  const { adicionarCombatente } = useBatalha()
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Monster[]>([])
  const [carregando, setCarregando] = useState(false)

  async function buscarMonstros(termo: string) {
    if (termo.length < 2) { setResultados([]); return }
    setCarregando(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('monsters')
        .select('id, slug, name_pt, type_pt, challenge_rating, xp, armor_class, hit_points, str_score, dex_score, con_score, int_score, wis_score, cha_score, traits_pt, traits_rules_pt, actions_pt, actions_rules_pt')
        .ilike('name_pt', `%${termo}%`)
        .limit(10)
      setResultados((data ?? []) as Monster[])
    } finally {
      setCarregando(false)
    }
  }

  function adicionarMonstro(m: Monster, quantidade = 1) {
    for (let i = 0; i < quantidade; i++) {
      const pvBase = m.hit_points ?? 10
      const pv = quantidade > 1
        ? Math.max(1, pvBase + Math.floor(Math.random() * 5) - 2)
        : pvBase

      adicionarCombatente({
        personagem_id: null,
        nome: quantidade > 1 ? `${m.name_pt} ${i + 1}` : m.name_pt,
        tipo: 'monstro',
        iniciativa: Math.floor(Math.random() * 20) + 1,
        ca: m.armor_class ?? 10,
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
          cr: m.challenge_rating ?? '?',
          tipo: m.type_pt ?? '',
          habilidades: m.traits_rules_pt || m.traits_pt || '',
          acoes: m.actions_rules_pt || m.actions_pt || '',
          forca: m.str_score ?? 10,
          destreza: m.dex_score ?? 10,
          constituicao: m.con_score ?? 10,
          inteligencia: m.int_score ?? 10,
          sabedoria: m.wis_score ?? 10,
          carisma: m.cha_score ?? 10,
          xp: m.xp ?? undefined,
          slug: m.slug,
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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8870a8]" />
          <input
            type="text"
            value={busca}
            onChange={e => { setBusca(e.target.value); buscarMonstros(e.target.value) }}
            placeholder="Buscar monstro..."
            className="w-full input-dd pl-9 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {carregando && <p className="text-[#8870a8] text-xs text-center p-3">Buscando...</p>}
        {resultados.map(m => (
          <div key={m.id} className="px-3 py-2 border-b border-[#1e1525] hover:bg-[#1e1525] transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#e8dff0] text-xs font-semibold">{m.name_pt}</p>
                <p className="text-[#8870a8] text-[10px]">{m.type_pt} · CR {m.challenge_rating} · PV {m.hit_points} · CA {m.armor_class}</p>
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
