'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MagicItem, EquipmentWeapon, EquipmentArmor, EquipmentGear } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoAdicionarPersonagem } from '@/components/ui/BotaoAdicionarPersonagem'
import { BotaoReportar } from '@/components/ui/BotaoReportar'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type AbaId = 'magicos' | 'armas' | 'armaduras' | 'equipamentos'

const RARIDADE_PT: Record<string, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  very_rare: 'Muito Raro',
  legendary: 'Lendário',
}

const COR_RARIDADE: Record<string, string> = {
  common:    'text-[#adb5bd] border-[#adb5bd]',
  uncommon:  'text-[var(--green2)] border-[var(--green2)]',
  rare:      'text-[#3498db] border-[#3498db]',
  very_rare: 'text-[var(--accent)] border-[var(--accent)]',
  legendary: 'text-[var(--gold)] border-[var(--gold)]',
}

function lbParaKg(lb: number): string {
  return (lb * 0.453592).toFixed(1).replace('.', ',') + ' kg'
}

const CAT_ARMA_PT: Record<string, string> = {
  'Simple Melee':   'Corpo a corpo simples',
  'Simple Ranged':  'À distância simples',
  'Martial Melee':  'Corpo a corpo marcial',
  'Martial Ranged': 'À distância marcial',
}

function formatarCusto(cp: number | null): string {
  if (cp == null) return '—'
  if (cp >= 1000) return `${cp / 1000} po`
  if (cp >= 100) return `${cp / 100} pp`
  if (cp >= 10) return `${cp / 10} pe`
  return `${cp} pc`
}

// ─── Aba Itens Mágicos ───────────────────────────────────────────────────────

type MagicItemStub = Pick<MagicItem, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category' | 'rarity' | 'requires_attunement'>

function AbaMagicos() {
  const [lista, setLista] = useState<MagicItemStub[]>([])
  const [selecionado, setSelecionado] = useState<MagicItem | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroRaridade, setFiltroRaridade] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('magic_items')
        .select('id, slug, name_pt, name_en, category, rarity, requires_attunement')
        .order('rarity')
        .order('name_pt')
      setLista((data ?? []) as MagicItemStub[])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionar(stub: MagicItemStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('magic_items').select('*').eq('id', stub.id).single()
    setSelecionado(data as MagicItem)
    setCarregandoDetalhe(false)
  }

  const filtrados = useMemo(() => lista.filter(m => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!m.name_pt.toLowerCase().includes(q) && !m.name_en.toLowerCase().includes(q)) return false
    }
    if (filtroRaridade && m.rarity !== filtroRaridade) return false
    return true
  }), [lista, busca, filtroRaridade])

  return (
    <ListaDetalhe
      carregando={carregando}
      carregandoDetalhe={carregandoDetalhe}
      total={lista.length}
      filtrados={filtrados.length}
      filtros={
        <>
          <select value={filtroRaridade} onChange={e => setFiltroRaridade(e.target.value)} className="w-full input-dd text-xs">
            <option value="">Todas as raridades</option>
            {Object.entries(RARIDADE_PT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </>
      }
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar item mágico..."
      itens={filtrados.map(m => ({
        id: m.id,
        principal: m.name_pt,
        secundario: `${RARIDADE_PT[m.rarity ?? ''] ?? m.rarity ?? ''} · ${m.category ?? ''}`,
        badge: m.rarity ? (
          <span className={`text-[10px] px-1 border rounded font-cinzel ${COR_RARIDADE[m.rarity] ?? ''}`}>
            {RARIDADE_PT[m.rarity]}
          </span>
        ) : null,
        ativo: selecionado?.id === m.id,
        onClick: () => selecionar(m),
      }))}
      detalhe={
        !selecionado ? null : (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold">{selecionado.name_pt}</h2>
                <p className="text-[var(--border)] text-sm italic">{selecionado.name_en}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {selecionado.rarity && (
                    <span className={`text-sm px-2 py-0.5 border rounded font-cinzel ${COR_RARIDADE[selecionado.rarity] ?? ''}`}>
                      {RARIDADE_PT[selecionado.rarity] ?? selecionado.rarity}
                    </span>
                  )}
                  {selecionado.category && <span className="text-[var(--text3)] text-sm">· {selecionado.category}</span>}
                  {selecionado.requires_attunement && (
                    <span className="text-[var(--gold)] text-xs">(requer sintonização{selecionado.attunement_notes_pt ? `: ${selecionado.attunement_notes_pt}` : ''})</span>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  {selecionado.is_consumable && <span className="text-[10px] px-1.5 py-0.5 border border-[var(--text3)] text-[var(--text3)] rounded font-cinzel">Consumível</span>}
                  {selecionado.has_charges && selecionado.charges_max && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">{selecionado.charges_max} cargas</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BotaoReportar
                  itemSlug={selecionado.slug}
                  itemNome={selecionado.name_pt}
                  itemTipo="item"
                  pagina="/itens"
                />
                <BotaoAdicionarPersonagem
                  tipo="item"
                  nome={selecionado.name_pt}
                  dadosExtras={{
                    item_id: selecionado.id,
                    tipo: 'magico',
                    raridade: selecionado.rarity ?? null,
                    descricao: selecionado.description_pt ?? null,
                  }}
                />
              </div>
            </div>
            {selecionado.description_pt && (
              <PainelGrimorio titulo="Descrição" compacto className="mb-3">
                <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.description_pt}</p>
              </PainelGrimorio>
            )}
            {selecionado.mechanics_pt && (
              <PainelGrimorio titulo="Mecânicas" compacto className="mb-3">
                <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.mechanics_pt}</p>
              </PainelGrimorio>
            )}
          </div>
        )
      }
      placeholderDetalhe="Selecione um item para ver detalhes"
    />
  )
}

// ─── Aba Armas ───────────────────────────────────────────────────────────────

type WeaponStub = Pick<EquipmentWeapon, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category_en' | 'category_pt' | 'damage_dice' | 'damage_type_pt'>

function AbaArmas() {
  const [lista, setLista] = useState<WeaponStub[]>([])
  const [selecionado, setSelecionado] = useState<EquipmentWeapon | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('equipment_weapons')
        .select('id, slug, name_pt, name_en, category_en, category_pt, damage_dice, damage_type_pt')
        .order('category_en')
        .order('name_pt')
      setLista((data ?? []) as WeaponStub[])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionar(stub: WeaponStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('equipment_weapons').select('*').eq('id', stub.id).single()
    setSelecionado(data as EquipmentWeapon)
    setCarregandoDetalhe(false)
  }

  const filtrados = useMemo(() => lista.filter(w => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!w.name_pt.toLowerCase().includes(q) && !w.name_en.toLowerCase().includes(q)) return false
    }
    if (filtroCategoria && w.category_en !== filtroCategoria) return false
    return true
  }), [lista, busca, filtroCategoria])

  const categorias = ['Simple Melee', 'Simple Ranged', 'Martial Melee', 'Martial Ranged']

  return (
    <ListaDetalhe
      carregando={carregando}
      carregandoDetalhe={carregandoDetalhe}
      total={lista.length}
      filtrados={filtrados.length}
      filtros={
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="w-full input-dd text-xs">
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{CAT_ARMA_PT[c] ?? c}</option>)}
        </select>
      }
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar arma..."
      itens={filtrados.map(w => ({
        id: w.id,
        principal: w.name_pt,
        secundario: `${CAT_ARMA_PT[w.category_en ?? ''] ?? w.category_pt ?? ''} · ${w.damage_dice ?? ''} ${w.damage_type_pt ?? ''}`,
        badge: null,
        ativo: selecionado?.id === w.id,
        onClick: () => selecionar(w),
      }))}
      detalhe={
        !selecionado ? null : (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-cinzel text-[var(--red2)] text-2xl font-bold">{selecionado.name_pt}</h2>
                <p className="text-[var(--border)] text-sm italic">{selecionado.name_en}</p>
                <p className="text-[var(--text2)] text-sm mt-1">{CAT_ARMA_PT[selecionado.category_en ?? ''] ?? selecionado.category_pt}</p>
              </div>
              <div className="flex items-center gap-2">
                <BotaoReportar
                  itemSlug={selecionado.slug}
                  itemNome={selecionado.name_pt}
                  itemTipo="item"
                  pagina="/itens"
                />
                <BotaoAdicionarPersonagem
                  tipo="arma"
                  nome={selecionado.name_pt}
                  dadosExtras={{ arma_nome: selecionado.name_pt, dano: selecionado.damage_dice, tipo_dano: selecionado.damage_type_pt }}
                />
              </div>
            </div>
            <PainelGrimorio compacto className="mb-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Dano</span><span className="text-[var(--red2)] font-bold font-cinzel">{selecionado.damage_dice ?? '—'}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Tipo</span><span className="text-[var(--text)]">{selecionado.damage_type_pt ?? '—'}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Peso</span><span className="text-[var(--text)]">{selecionado.weight_lb != null ? lbParaKg(selecionado.weight_lb) : '—'}</span></div>
              </div>
              <div className="mt-2">
                <span className="text-[var(--text3)] font-cinzel text-xs block">Custo</span>
                <span className="text-[var(--text)]">{formatarCusto(selecionado.cost_cp)}</span>
              </div>
            </PainelGrimorio>
            {selecionado.properties_pt && (
              <PainelGrimorio titulo="Propriedades" compacto className="mb-3">
                <p className="text-[var(--text2)] font-crimson">{selecionado.properties_pt}</p>
              </PainelGrimorio>
            )}
            {selecionado.mastery_pt && (
              <PainelGrimorio titulo="Maestria" compacto>
                <p className="text-[var(--text2)] font-crimson">{selecionado.mastery_pt}</p>
              </PainelGrimorio>
            )}
          </div>
        )
      }
      placeholderDetalhe="Selecione uma arma para ver detalhes"
    />
  )
}

// ─── Aba Armaduras ───────────────────────────────────────────────────────────

type ArmorStub = Pick<EquipmentArmor, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category_pt' | 'base_ac_formula_pt'>

function AbaArmaduras() {
  const [lista, setLista] = useState<ArmorStub[]>([])
  const [selecionado, setSelecionado] = useState<EquipmentArmor | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('equipment_armor')
        .select('id, slug, name_pt, name_en, category_pt, base_ac_formula_pt')
        .order('name_pt')
      setLista((data ?? []) as ArmorStub[])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionar(stub: ArmorStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('equipment_armor').select('*').eq('id', stub.id).single()
    setSelecionado(data as EquipmentArmor)
    setCarregandoDetalhe(false)
  }

  const filtrados = useMemo(() => lista.filter(a => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return a.name_pt.toLowerCase().includes(q) || a.name_en.toLowerCase().includes(q)
  }), [lista, busca])

  return (
    <ListaDetalhe
      carregando={carregando}
      carregandoDetalhe={carregandoDetalhe}
      total={lista.length}
      filtrados={filtrados.length}
      filtros={null}
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar armadura..."
      itens={filtrados.map(a => ({
        id: a.id,
        principal: a.name_pt,
        secundario: `${a.category_pt ?? ''} · CA ${a.base_ac_formula_pt ?? '—'}`,
        badge: null,
        ativo: selecionado?.id === a.id,
        onClick: () => selecionar(a),
      }))}
      detalhe={
        !selecionado ? null : (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-cinzel text-[var(--accent2)] text-2xl font-bold">{selecionado.name_pt}</h2>
                <p className="text-[var(--border)] text-sm italic">{selecionado.name_en}</p>
                <p className="text-[var(--text2)] text-sm mt-1">{selecionado.category_pt}</p>
              </div>
              <div className="flex items-center gap-2">
                <BotaoReportar
                  itemSlug={selecionado.slug}
                  itemNome={selecionado.name_pt}
                  itemTipo="item"
                  pagina="/itens"
                />
                <BotaoAdicionarPersonagem
                  tipo="item"
                  nome={selecionado.name_pt}
                  dadosExtras={{ item_id: selecionado.id, tipo: 'armadura', descricao: null }}
                />
              </div>
            </div>
            <PainelGrimorio compacto className="mb-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Classe de Armadura</span><span className="text-[var(--gold)] font-bold font-cinzel text-lg">{selecionado.base_ac_formula_pt ?? '—'}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Peso</span><span className="text-[var(--text)]">{selecionado.weight_lb != null ? lbParaKg(selecionado.weight_lb) : '—'}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Custo</span><span className="text-[var(--text)]">{formatarCusto(selecionado.cost_cp)}</span></div>
                {selecionado.strength_requirement && (
                  <div><span className="text-[var(--text3)] font-cinzel text-xs block">FOR mínima</span><span className="text-[var(--text)]">{selecionado.strength_requirement}</span></div>
                )}
              </div>
              {selecionado.stealth_disadvantage && (
                <p className="text-[var(--red2)] text-xs mt-2 font-crimson">⚠️ Desvantagem em Furtividade</p>
              )}
            </PainelGrimorio>
          </div>
        )
      }
      placeholderDetalhe="Selecione uma armadura para ver detalhes"
    />
  )
}

// ─── Aba Equipamentos ────────────────────────────────────────────────────────

type GearStub = Pick<EquipmentGear, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category_pt'>

function AbaEquipamentos() {
  const [lista, setLista] = useState<GearStub[]>([])
  const [selecionado, setSelecionado] = useState<EquipmentGear | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('equipment_gear')
        .select('id, slug, name_pt, name_en, category_pt')
        .order('category_pt')
        .order('name_pt')
      setLista((data ?? []) as GearStub[])
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionar(stub: GearStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('equipment_gear').select('*').eq('id', stub.id).single()
    setSelecionado(data as EquipmentGear)
    setCarregandoDetalhe(false)
  }

  const filtrados = useMemo(() => lista.filter(g => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return g.name_pt.toLowerCase().includes(q) || g.name_en.toLowerCase().includes(q)
  }), [lista, busca])

  return (
    <ListaDetalhe
      carregando={carregando}
      carregandoDetalhe={carregandoDetalhe}
      total={lista.length}
      filtrados={filtrados.length}
      filtros={null}
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar equipamento..."
      itens={filtrados.map(g => ({
        id: g.id,
        principal: g.name_pt,
        secundario: g.category_pt ?? '',
        badge: null,
        ativo: selecionado?.id === g.id,
        onClick: () => selecionar(g),
      }))}
      detalhe={
        !selecionado ? null : (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-cinzel text-[var(--text)] text-2xl font-bold">{selecionado.name_pt}</h2>
                <p className="text-[var(--border)] text-sm italic">{selecionado.name_en}</p>
                <p className="text-[var(--text2)] text-sm mt-1">{selecionado.category_pt}</p>
              </div>
              <div className="flex items-center gap-2">
                <BotaoReportar
                  itemSlug={selecionado.slug}
                  itemNome={selecionado.name_pt}
                  itemTipo="item"
                  pagina="/itens"
                />
                <BotaoAdicionarPersonagem
                  tipo="item"
                  nome={selecionado.name_pt}
                  dadosExtras={{ item_id: selecionado.id, tipo: 'equipamento', descricao: selecionado.description_pt ?? null }}
                />
              </div>
            </div>
            <PainelGrimorio compacto className="mb-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Custo</span><span className="text-[var(--gold)] font-cinzel">{selecionado.cost_gp != null ? `${selecionado.cost_gp} po` : '—'}</span></div>
                <div><span className="text-[var(--text3)] font-cinzel text-xs block">Peso</span><span className="text-[var(--text)]">{selecionado.weight_lb != null ? lbParaKg(selecionado.weight_lb) : '—'}</span></div>
              </div>
            </PainelGrimorio>
            {selecionado.description_pt && (
              <PainelGrimorio titulo="Descrição" compacto>
                <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.description_pt}</p>
              </PainelGrimorio>
            )}
          </div>
        )
      }
      placeholderDetalhe="Selecione um equipamento para ver detalhes"
    />
  )
}

// ─── Layout compartilhado Lista/Detalhe ──────────────────────────────────────

interface ItemLista {
  id: string
  principal: string
  secundario: string
  badge: React.ReactNode
  ativo: boolean
  onClick: () => void
}

function ListaDetalhe({
  carregando, carregandoDetalhe, total, filtrados: nFiltrados, filtros,
  busca, onBusca, placeholder, itens, detalhe, placeholderDetalhe,
}: {
  carregando: boolean
  carregandoDetalhe: boolean
  total: number
  filtrados: number
  filtros: React.ReactNode
  busca: string
  onBusca: (v: string) => void
  placeholder: string
  itens: ItemLista[]
  detalhe: React.ReactNode
  placeholderDetalhe: string
}) {
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')

  return (
    <div className="flex h-full overflow-hidden">
      {/* Lista */}
      <div className={cn(
        "flex flex-col w-full md:w-72 border-r border-[var(--border)] overflow-y-auto flex-shrink-0",
        visao === 'detalhe' ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3 border-b border-[var(--border)] space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
            <input type="text" value={busca} onChange={e => onBusca(e.target.value)} placeholder={placeholder} className="w-full input-dd pl-9 text-sm" />
          </div>
          {filtros}
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="p-4 text-center text-[var(--border)] text-sm">Nenhum resultado</div>
          ) : (
            itens.map(item => (
              <button
                key={item.id}
                onClick={() => { item.onClick(); setVisao('detalhe') }}
                className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${item.ativo ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'}`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">
                    {item.principal}
                  </span>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-[var(--dd-text2)] truncate">{item.secundario}</span>
                    {item.badge && <span className="flex-shrink-0">{item.badge}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-[var(--border)] text-center">
          <p className="text-[var(--text3)] text-xs font-cinzel">{nFiltrados} de {total}</p>
        </div>
      </div>

      {/* Detalhe */}
      <div className={cn(
        "flex-1 overflow-y-auto p-4",
        visao === 'lista' ? "hidden md:block" : "block"
      )}>
        <button
          onClick={() => setVisao('lista')}
          className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)]
                     hover:text-[var(--dd-text)] mb-4 transition-colors"
        >
          ← Voltar aos Itens
        </button>
        {carregandoDetalhe ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[var(--text3)] font-cinzel animate-pulse">Carregando detalhes...</p>
          </div>
        ) : !detalhe ? (
          <div className="h-full flex items-center justify-center">
            <p className="font-cinzel text-[var(--border)]">{placeholderDetalhe}</p>
          </div>
        ) : detalhe}
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'magicos',      label: '✨ Itens Mágicos' },
  { id: 'armas',        label: '⚔️ Armas' },
  { id: 'armaduras',    label: '🛡️ Armaduras' },
  { id: 'equipamentos', label: '🎒 Equipamentos' },
]

export function ItensCliente() {
  const [aba, setAba] = useState<AbaId>('magicos')

  return (
    <div className="flex flex-col h-full">
      {/* Abas */}
      <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex">
        {ABAS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`px-4 py-2 text-xs font-cinzel border-b-2 transition-colors ${
              aba === id
                ? 'border-[var(--gold)] text-[var(--gold)]'
                : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {aba === 'magicos'      && <AbaMagicos />}
        {aba === 'armas'        && <AbaArmas />}
        {aba === 'armaduras'    && <AbaArmaduras />}
        {aba === 'equipamentos' && <AbaEquipamentos />}
      </div>
    </div>
  )
}
