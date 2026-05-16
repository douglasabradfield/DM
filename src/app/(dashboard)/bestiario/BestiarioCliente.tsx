'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Monster } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { useBatalha } from '@/store/batalha'
import { calcularModificadorAtributo, formatarModificador, cn } from '@/lib/utils'
import { Search, Swords } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const CRS = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '23', '24', '30']

type MonsterStub = Pick<Monster, 'id' | 'slug' | 'name_pt' | 'name_en' | 'type_pt' | 'challenge_rating' | 'armor_class' | 'hit_points'>

export function BestiarioCliente() {
  const [lista, setLista] = useState<MonsterStub[]>([])
  const [selecionado, setSelecionado] = useState<Monster | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [busca, setBusca] = useState('')
  const [filtroCR, setFiltroCR] = useState('')
  const { adicionarCombatente } = useBatalha()
  const router = useRouter()

  useEffect(() => {
    // Lê slug da query string para pré-selecionar monstro (ex: vindo do ModalMonstro da batalha)
    const params = new URLSearchParams(window.location.search)
    const slugParam = params.get('q')
    if (slugParam) setBusca(slugParam)
  }, [])

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('monsters')
        .select('id, slug, name_pt, name_en, type_pt, challenge_rating, armor_class, hit_points')
        .order('name_pt')
      setLista((data ?? []) as MonsterStub[])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionarMonstro(stub: MonsterStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('monsters').select('*').eq('id', stub.id).single()
    setSelecionado(data as Monster)
    setCarregandoDetalhe(false)
    setVisao('detalhe')
  }

  const filtrados = useMemo(() => lista.filter(m => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!m.name_pt.toLowerCase().includes(q) && !m.name_en.toLowerCase().includes(q)) return false
    }
    if (filtroCR && m.challenge_rating !== filtroCR) return false
    return true
  }), [lista, busca, filtroCR])

  function adicionarNaBatalha(m: Monster) {
    adicionarCombatente({
      personagem_id: null,
      nome: m.name_pt,
      tipo: 'monstro',
      iniciativa: 0,
      ca: m.armor_class,
      pv_maximo: m.hit_points,
      pv_atual: m.hit_points,
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
        cr: m.challenge_rating,
        tipo: m.type_pt ?? '',
        habilidades: m.traits_rules_pt || m.traits_pt || '',
        acoes: m.actions_rules_pt || m.actions_pt || '',
        forca: m.str_score,
        destreza: m.dex_score,
        constituicao: m.con_score,
        inteligencia: m.int_score,
        sabedoria: m.wis_score,
        carisma: m.cha_score,
        xp: m.xp ?? undefined,
        slug: m.slug,
      },
      ordem: 999,
    })
    toast.success(`${m.name_pt} adicionado à batalha!`)
  }

  const atrs = selecionado ? [
    { label: 'FOR', val: selecionado.str_score },
    { label: 'DES', val: selecionado.dex_score },
    { label: 'CON', val: selecionado.con_score },
    { label: 'INT', val: selecionado.int_score },
    { label: 'SAB', val: selecionado.wis_score },
    { label: 'CAR', val: selecionado.cha_score },
  ] : []

  return (
    <div className="flex h-full overflow-hidden">
      {/* Lista */}
      <div className={cn(
        "flex flex-col border-r border-[var(--bg3)] overflow-y-auto",
        "w-full md:w-80",
        visao === 'detalhe' ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3 border-b border-[var(--border)]">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar monstro (PT ou EN)..."
              className="w-full input-dd pl-7 text-sm"
            />
          </div>
          <select value={filtroCR} onChange={e => setFiltroCR(e.target.value)} className="w-full input-dd text-sm">
            <option value="">Todos os CRs</option>
            {CRS.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando bestiário...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-4 text-center text-[var(--border)] text-sm">Nenhum monstro encontrado</div>
          ) : (
            filtrados.map(m => (
              <button
                key={m.id}
                onClick={() => selecionarMonstro(m)}
                className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${
                  selecionado?.id === m.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">
                    {m.name_pt}
                  </span>
                  <span className="text-xs text-[var(--dd-text2)] truncate">
                    {m.type_pt} · CR {m.challenge_rating}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-[var(--border)] text-center">
          <p className="text-[var(--text3)] text-xs font-cinzel">{filtrados.length} de {lista.length} monstro(s)</p>
        </div>
      </div>

      {/* Detalhes */}
      <div className={cn(
        "overflow-y-auto p-4 md:p-6 bg-[var(--bg)]",
        "w-full md:flex-1",
        visao === 'lista' ? "hidden md:block" : "block"
      )}>
        <button
          onClick={() => setVisao('lista')}
          className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)]
                     hover:text-[var(--dd-text)] mb-4 transition-colors"
        >
          ← Voltar ao Bestiário
        </button>
        {carregandoDetalhe ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[var(--text3)] font-cinzel animate-pulse">Carregando detalhes...</p>
          </div>
        ) : !selecionado ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="font-cinzel text-[var(--border)] text-xl mb-2">Selecione um monstro</p>
              <p className="text-[var(--border)] text-sm font-crimson">Clique em um monstro da lista para ver seus detalhes</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold leading-tight">{selecionado.name_pt}</h2>
                <p className="text-sm text-[var(--dd-text2)] italic mt-0.5">{selecionado.name_en}</p>
                <p className="text-[var(--text2)] text-sm mt-1">
                  {[selecionado.size_pt, selecionado.type_pt, selecionado.alignment_pt].filter(Boolean).join(' · ')}
                </p>
                {selecionado.source_page_start && (
                  <p className="text-[var(--text3)] text-[10px] font-cinzel mt-0.5">SRD p.{selecionado.source_page_start}</p>
                )}
              </div>
              <button
                onClick={() => adicionarNaBatalha(selecionado)}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] border border-[var(--accent2)] text-[var(--bg)] rounded text-sm font-cinzel hover:opacity-90 transition-colors"
              >
                <Swords className="w-4 h-4" /> Adicionar à Batalha
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <PainelGrimorio compacto className="text-center">
                <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Classe de Armadura</div>
                <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.armor_class}</div>
              </PainelGrimorio>
              <PainelGrimorio compacto className="text-center">
                <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Pontos de Vida</div>
                <div className="text-[var(--green2)] text-xl font-cinzel font-bold">{selecionado.hit_points}</div>
              </PainelGrimorio>
              <PainelGrimorio compacto className="text-center">
                <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Deslocamento</div>
                <div className="text-[var(--text)] text-xs font-crimson mt-1 leading-tight">{selecionado.speed_pt ?? '—'}</div>
              </PainelGrimorio>
              <PainelGrimorio compacto className="text-center">
                <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Nível de Desafio</div>
                <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.challenge_rating}</div>
                {selecionado.xp != null && (
                  <div className="text-[var(--border)] text-[10px]">{selecionado.xp.toLocaleString('pt-BR')} XP</div>
                )}
              </PainelGrimorio>
            </div>

            <PainelGrimorio titulo="Atributos" compacto className="mb-3">
              <div className="grid grid-cols-6 gap-2 text-center">
                {atrs.map(({ label, val }) => {
                  const mod = calcularModificadorAtributo(val)
                  return (
                    <div key={label} className="bg-[var(--bg3)] rounded p-2">
                      <div className="text-[var(--text3)] text-[9px] font-cinzel">{label}</div>
                      <div className="text-[var(--text)] font-bold">{val}</div>
                      <div className="text-[var(--text2)] text-xs">{formatarModificador(mod)}</div>
                    </div>
                  )
                })}
              </div>
            </PainelGrimorio>

            {(selecionado.senses_pt || selecionado.languages_pt) && (
              <PainelGrimorio titulo="Sentidos & Idiomas" compacto className="mb-3">
                {selecionado.senses_pt && <p className="text-[var(--text2)] text-sm font-crimson">{selecionado.senses_pt}</p>}
                {selecionado.languages_pt && <p className="text-[var(--text2)] text-sm font-crimson mt-1">{selecionado.languages_pt}</p>}
              </PainelGrimorio>
            )}

            {(selecionado.traits_rules_pt || selecionado.traits_pt) && (
              <PainelGrimorio titulo="Habilidades Especiais" compacto className="mb-3">
                <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">
                  {selecionado.traits_rules_pt || selecionado.traits_pt}
                </p>
              </PainelGrimorio>
            )}

            {(selecionado.actions_rules_pt || selecionado.actions_pt) && (
              <PainelGrimorio titulo="Ações" compacto className="mb-3">
                <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">
                  {selecionado.actions_rules_pt || selecionado.actions_pt}
                </p>
              </PainelGrimorio>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
