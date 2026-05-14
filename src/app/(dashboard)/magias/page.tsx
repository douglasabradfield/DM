'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Magia } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { Search } from 'lucide-react'

const ESCOLAS = ['Abjuração', 'Adivinhação', 'Conjuração', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação']

const COR_ESCOLA: Record<string, string> = {
  'Abjuração': '#3498db', 'Adivinhação': '#e9c46a', 'Conjuração': '#9b59b6',
  'Encantamento': '#e91e63', 'Evocação': '#e74c3c', 'Ilusão': '#1abc9c',
  'Necromancia': '#6d2b8f', 'Transmutação': '#27ae60',
}

export default function MagiasPage() {
  const [magias, setMagias] = useState<Magia[]>([])
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<number | ''>('')
  const [filtroEscola, setFiltroEscola] = useState('')
  const [selecionada, setSelecionada] = useState<Magia | null>(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    try {
      const supabase = createClient()
      let query = supabase.from('magias').select('*').limit(100)
      if (busca) query = query.ilike('nome', `%${busca}%`)
      if (filtroNivel !== '') query = query.eq('nivel', filtroNivel)
      if (filtroEscola) query = query.ilike('escola', `%${filtroEscola}%`)
      const { data } = await query.order('nivel').order('nome')
      setMagias((data ?? []) as Magia[])
    } finally {
      setCarregando(false)
    }
  }, [busca, filtroNivel, filtroEscola])

  useEffect(() => { buscar() }, [buscar])

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="w-72 border-r border-[#4a3060] flex flex-col">
        <div className="p-3 border-b border-[#4a3060] space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8870a8]" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar magia..." className="w-full input-dd pl-7 text-sm" />
          </div>
          <div className="flex gap-1">
            <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value === '' ? '' : parseInt(e.target.value))} className="flex-1 input-dd text-sm">
              <option value="">Nível</option>
              {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'Truque' : `Nível ${i}`}</option>)}
            </select>
            <select value={filtroEscola} onChange={e => setFiltroEscola(e.target.value)} className="flex-1 input-dd text-sm">
              <option value="">Escola</option>
              {ESCOLAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="p-4 text-center text-[#8870a8] text-sm">Carregando...</div>
          ) : magias.length === 0 ? (
            <div className="p-4 text-center text-[#4a3060] text-sm">Nenhuma magia encontrada</div>
          ) : (
            magias.map(m => (
              <button
                key={m.id}
                onClick={() => setSelecionada(m)}
                className={`w-full text-left px-3 py-2 border-b border-[#1e1525] transition-colors ${selecionada?.id === m.id ? 'bg-[#261a2e]' : 'hover:bg-[#1e1525]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#e8dff0] text-sm font-crimson">{m.nome}</span>
                  <span className="text-[10px] font-cinzel" style={{ color: COR_ESCOLA[m.escola ?? ''] ?? '#8870a8' }}>
                    {m.nivel === 0 ? 'Truque' : `Nv${m.nivel}`}
                  </span>
                </div>
                <p className="text-[#8870a8] text-[10px]">{m.escola} · {m.tempo_conjuracao}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalhes */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selecionada ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-cinzel text-[#4a3060]">Selecione uma magia para ver detalhes</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="mb-4">
              <h2 className="font-cinzel text-[#c39bd3] text-2xl font-bold">{selecionada.nome}</h2>
              {selecionada.nome_original && <p className="text-[#4a3060] text-sm italic">{selecionada.nome_original}</p>}
              <p className="text-[#b8a8cc] text-sm mt-1">
                {selecionada.nivel === 0 ? 'Truque de ' : `Magia de ${selecionada.nivel}º nível de `}
                <span style={{ color: COR_ESCOLA[selecionada.escola ?? ''] }}>{selecionada.escola}</span>
              </p>
            </div>

            <PainelGrimorio compacto className="mb-3">
              <div className="grid grid-cols-2 gap-2 text-sm font-crimson">
                <div><span className="text-[#8870a8] font-cinzel text-xs">Tempo: </span><span className="text-[#e8dff0]">{selecionada.tempo_conjuracao}</span></div>
                <div><span className="text-[#8870a8] font-cinzel text-xs">Alcance: </span><span className="text-[#e8dff0]">{selecionada.alcance}</span></div>
                <div><span className="text-[#8870a8] font-cinzel text-xs">Componentes: </span><span className="text-[#e8dff0]">{selecionada.componentes}</span></div>
                <div><span className="text-[#8870a8] font-cinzel text-xs">Duração: </span><span className="text-[#e8dff0]">{selecionada.duracao}</span></div>
              </div>
            </PainelGrimorio>

            <PainelGrimorio titulo="Descrição" compacto className="mb-3">
              <p className="text-[#b8a8cc] font-crimson whitespace-pre-wrap leading-relaxed">{selecionada.descricao}</p>
            </PainelGrimorio>

            {selecionada.em_nivel_superior && (
              <PainelGrimorio titulo="Em Nível Superior" compacto className="mb-3">
                <p className="text-[#b8a8cc] font-crimson">{selecionada.em_nivel_superior}</p>
              </PainelGrimorio>
            )}

            {selecionada.classes && selecionada.classes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selecionada.classes.map(c => (
                  <span key={c} className="px-2 py-0.5 bg-[#261a2e] border border-[#4a3060] text-[#b8a8cc] text-xs rounded font-crimson">{c}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
