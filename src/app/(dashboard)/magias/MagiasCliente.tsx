'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Spell } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoAdicionarPersonagem } from '@/components/ui/BotaoAdicionarPersonagem'
import { Search } from 'lucide-react'

const ESCOLAS = ['Abjuração', 'Adivinhação', 'Conjuração', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação']
const CLASSES = ['Bardo', 'Clérigo', 'Druida', 'Feiticeiro', 'Guardião', 'Mago', 'Paladino', 'Bruxo', 'Artífice']

const COR_ESCOLA: Record<string, string> = {
  'Abjuração': 'var(--accent2)',
  'Adivinhação': 'var(--gold)',
  'Conjuração': 'var(--accent)',
  'Encantamento': '#e91e63',
  'Evocação': 'var(--red2)',
  'Ilusão': 'var(--green2)',
  'Necromancia': '#6d2b8f',
  'Transmutação': 'var(--green2)',
}

type SpellStub = Pick<Spell, 'id' | 'slug' | 'name_pt' | 'name_en' | 'level' | 'school_pt' | 'casting_time_pt' | 'classes_pt' | 'concentration' | 'ritual'>

export function MagiasCliente() {
  const [lista, setLista] = useState<SpellStub[]>([])
  const [selecionada, setSelecionada] = useState<Spell | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<number | ''>('')
  const [filtroEscola, setFiltroEscola] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('spells')
        .select('id, slug, name_pt, name_en, level, school_pt, casting_time_pt, classes_pt, concentration, ritual')
        .order('level')
        .order('name_pt')
      setLista((data ?? []) as SpellStub[])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionarMagia(stub: SpellStub) {
    if (selecionada?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('spells').select('*').eq('id', stub.id).single()
    setSelecionada(data as Spell)
    setCarregandoDetalhe(false)
  }

  const filtradas = useMemo(() => lista.filter(m => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!m.name_pt.toLowerCase().includes(q) && !m.name_en.toLowerCase().includes(q)) return false
    }
    if (filtroNivel !== '' && m.level !== filtroNivel) return false
    if (filtroEscola && m.school_pt !== filtroEscola) return false
    if (filtroClasse && !m.classes_pt?.toLowerCase().includes(filtroClasse.toLowerCase())) return false
    return true
  }), [lista, busca, filtroNivel, filtroEscola, filtroClasse])

  const corEscola = (escola: string | null) => COR_ESCOLA[escola ?? ''] ?? 'var(--text3)'

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="w-72 border-r border-[var(--border)] flex flex-col">
        <div className="p-3 border-b border-[var(--border)] space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar magia (PT ou EN)..."
              className="w-full input-dd pl-7 text-sm"
            />
          </div>
          <div className="flex gap-1">
            <select
              value={filtroNivel}
              onChange={e => setFiltroNivel(e.target.value === '' ? '' : parseInt(e.target.value))}
              className="flex-1 input-dd text-xs"
            >
              <option value="">Nível</option>
              <option value={0}>Truque</option>
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}º Nível</option>
              ))}
            </select>
            <select
              value={filtroEscola}
              onChange={e => setFiltroEscola(e.target.value)}
              className="flex-1 input-dd text-xs"
            >
              <option value="">Escola</option>
              {ESCOLAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <select
            value={filtroClasse}
            onChange={e => setFiltroClasse(e.target.value)}
            className="w-full input-dd text-xs"
          >
            <option value="">Todas as classes</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando magias...</div>
          ) : filtradas.length === 0 ? (
            <div className="p-4 text-center text-[var(--border)] text-sm">Nenhuma magia encontrada</div>
          ) : (
            filtradas.map(m => (
              <button
                key={m.id}
                onClick={() => selecionarMagia(m)}
                className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${
                  selecionada?.id === m.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[var(--text)] text-sm font-crimson truncate flex-1">{m.name_pt}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {m.concentration && <span className="text-[var(--gold)] text-[9px] font-cinzel">C</span>}
                    {m.ritual && <span className="text-[var(--accent2)] text-[9px] font-cinzel">R</span>}
                    <span className="text-[10px] font-cinzel" style={{ color: corEscola(m.school_pt) }}>
                      {m.level === 0 ? 'Truque' : `Nv${m.level}`}
                    </span>
                  </div>
                </div>
                <p className="text-[var(--text3)] text-[10px]">{m.school_pt} · {m.casting_time_pt}</p>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-[var(--border)] text-center">
          <p className="text-[var(--text3)] text-xs font-cinzel">{filtradas.length} de {lista.length} magia(s)</p>
        </div>
      </div>

      {/* Detalhes */}
      <div className="flex-1 overflow-y-auto p-4">
        {carregandoDetalhe ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[var(--text3)] font-cinzel animate-pulse">Carregando detalhes...</p>
          </div>
        ) : !selecionada ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-cinzel text-[var(--border)]">Selecione uma magia para ver detalhes</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-cinzel text-[var(--accent2)] text-2xl font-bold">{selecionada.name_pt}</h2>
                <p className="text-[var(--border)] text-sm italic">{selecionada.name_en}</p>
                <p className="text-[var(--text2)] text-sm mt-1">
                  {selecionada.level === 0 ? 'Truque de ' : `Magia de ${selecionada.level}º nível de `}
                  <span style={{ color: corEscola(selecionada.school_pt) }}>{selecionada.school_pt}</span>
                </p>
                <div className="flex gap-2 mt-1">
                  {selecionada.concentration && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-[var(--gold)] text-[var(--gold)] rounded font-cinzel">Concentração</span>
                  )}
                  {selecionada.ritual && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">Ritual</span>
                  )}
                </div>
              </div>
              <BotaoAdicionarPersonagem
                tipo="magia"
                nome={selecionada.name_pt}
                dadosExtras={{ magia_id: selecionada.id, nivel: selecionada.level, escola: selecionada.school_pt }}
              />
            </div>

            <PainelGrimorio compacto className="mb-3">
              <div className="grid grid-cols-2 gap-2 text-sm font-crimson">
                <div><span className="text-[var(--text3)] font-cinzel text-xs">Tempo: </span><span className="text-[var(--text)]">{selecionada.casting_time_pt}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs">Alcance: </span><span className="text-[var(--text)]">{selecionada.range_pt}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs">Componentes: </span><span className="text-[var(--text)]">{selecionada.components_pt}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs">Duração: </span><span className="text-[var(--text)]">{selecionada.duration_pt}</span></div>
              </div>
            </PainelGrimorio>

            <PainelGrimorio titulo="Descrição" compacto className="mb-3">
              <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionada.description_pt}</p>
            </PainelGrimorio>

            {selecionada.classes_pt && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selecionada.classes_pt.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                  <span key={c} className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-xs rounded font-crimson">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
