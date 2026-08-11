'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MagicItem, EquipmentWeapon, EquipmentArmor, EquipmentGear } from '@/types/dnd'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { BotaoAdicionarPersonagem } from '@/components/ui/BotaoAdicionarPersonagem'
import { BotaoReportar } from '@/components/ui/BotaoReportar'
import { BloqueioPlano } from '@/components/ui/BloqueioPlano'
import { Search, Plus, X, Trash2, SlidersHorizontal, Pencil, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPlano } from '@/lib/planos'
import { usePermissao } from '@/hooks/usePermissao'
import { useCampanha } from '@/store/campanha'
import toast from 'react-hot-toast'

type AbaId = 'magicos' | 'armas' | 'armaduras' | 'equipamentos'
type AbaTotal = AbaId | 'personalizado'

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

const CAT_ARMADURA_PT: Record<string, string> = {
  Light:  'Leve',
  Medium: 'Média',
  Heavy:  'Pesada',
  Shield: 'Escudo',
}

const CAT_GEAR_PT: string[] = [
  'Equipamento de Aventura', 'Foco', 'Montaria', 'Munição', 'Pacote', 'Veículo', 'Veículo ou Arreio',
]

// Custo — todas as tabelas de equipamento gravam em peças de cobre (cp),
// inclusive equipment_gear.cost_gp, cujo nome é enganoso: confirmado
// comparando com os preços reais do SRD (ex: Tocha=1, Corda=100 — batem
// exatamente com o preço em cobre, não em ouro). A tela chegou a exibir
// esse valor cru como se já fosse ouro (bug de 100x — "100 po" para uma
// corda de 1 po). formatarCusto abaixo assume sempre entrada em cp.
function formatarCusto(cp: number | null): string {
  if (cp == null) return '—'
  if (cp >= 1000) return `${(cp / 1000).toLocaleString('pt-BR')} pl`
  if (cp >= 100) return `${(cp / 100).toLocaleString('pt-BR')} po`
  if (cp >= 50) return `${(cp / 50).toLocaleString('pt-BR')} pe`
  if (cp >= 10) return `${(cp / 10).toLocaleString('pt-BR')} pp`
  return `${cp} pc`
}

function formatarGp(gp: number | null): string {
  if (gp == null) return '—'
  return `${gp.toLocaleString('pt-BR')} po`
}

// ─── Modal admin: Criar/Editar Item (padrão do ModalAdminEditarMonstro) ─────

type TipoItem = 'magico' | 'arma' | 'armadura' | 'equipamento'

const TIPOS_ITEM: { value: TipoItem; label: string; tabela: string }[] = [
  { value: 'magico',      label: 'Item Mágico', tabela: 'magic_items' },
  { value: 'arma',        label: 'Arma',        tabela: 'equipment_weapons' },
  { value: 'armadura',    label: 'Armadura',    tabela: 'equipment_armor' },
  { value: 'equipamento', label: 'Equipamento', tabela: 'equipment_gear' },
]

// Moeda — 5 denominações padrão de D&D 5e. Base de conversão em peças de
// cobre (mesma escala usada por todas as tabelas de equipamento acima).
const MOEDAS_ITEM: { id: 'pl' | 'po' | 'pe' | 'pp' | 'pc'; label: string }[] = [
  { id: 'pl', label: 'Platina (pl)' },
  { id: 'po', label: 'Ouro (po)' },
  { id: 'pe', label: 'Eletro (pe)' },
  { id: 'pp', label: 'Prata (pp)' },
  { id: 'pc', label: 'Cobre (pc)' },
]
const CP_POR_MOEDA: Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number> = { pl: 1000, po: 100, pe: 50, pp: 10, pc: 1 }

// Converte cp gravado -> {valor, moeda} para preencher o formulário de
// edição com a maior denominação "redonda" possível (ex: 100cp -> "1 po",
// não "100 pc").
function custoParaValorMoeda(cp: number | null | undefined): { valor: string; moeda: 'pl' | 'po' | 'pe' | 'pp' | 'pc' } {
  if (cp == null || cp === 0) return { valor: '', moeda: 'po' }
  for (const m of ['pl', 'po', 'pe', 'pp'] as const) {
    if (cp >= CP_POR_MOEDA[m] && cp % CP_POR_MOEDA[m] === 0) return { valor: String(cp / CP_POR_MOEDA[m]), moeda: m }
  }
  return { valor: String(cp), moeda: 'pc' }
}
function valorMoedaParaCp(valor: string, moeda: 'pl' | 'po' | 'pe' | 'pp' | 'pc'): number | null {
  const n = Number(valor.trim().replace(',', '.'))
  if (!valor.trim() || Number.isNaN(n) || n <= 0) return null
  return Math.round(n * CP_POR_MOEDA[moeda])
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

// Tipo de dano em equipment_weapons.damage_type_pt já vem gravado como
// texto de exibição (ex: "Cortante", "Perfurante"), não como slug de
// TipoDano (diferente de spells.damage_type_pt, que é lido como TipoDano
// puro em MesaCliente) — confirmado no banco. O select abaixo usa os
// nomes de TIPOS_DANO (dados-dnd/tipos-dano.ts) como opções fechadas,
// gravando o rótulo PT direto, e deriva o EN por este mapa fixo.
const DANO_EN_POR_ID: Record<string, string> = {
  acido: 'Acid', contundente: 'Bludgeoning', cortante: 'Slashing', eletrico: 'Lightning',
  fogo: 'Fire', forca: 'Force', frio: 'Cold', necrotico: 'Necrotic', perfurante: 'Piercing',
  psiquico: 'Psychic', radiante: 'Radiant', trovejante: 'Thunder', veneno: 'Poison',
}
function danoEnPara(nomePt: string): string {
  const t = TIPOS_DANO.find(x => normalizar(x.nome) === normalizar(nomePt))
  return t ? (DANO_EN_POR_ID[t.id] ?? nomePt) : nomePt
}

function gerarSlugBase(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
function gerarSufixoAleatorio(): string {
  return Math.random().toString(36).slice(2, 6)
}

// D&D 5e PT-BR: 1,5 m por 5 pés (arredondamento do livro do jogador, não a
// conversão real de 0,3048 m/pé) — mesmo helper usado em BestiarioCliente
// e MagiasCliente.
function metrosParaPes(m: number): number {
  return Math.round(m / 0.3)
}
function pesParaMetros(ft: number): number {
  return Math.round(ft * 0.3 * 10) / 10
}
function formatarMetros(ft: number): string {
  return pesParaMetros(ft).toLocaleString('pt-BR')
}
function parseMetros(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return null
  const n = Number(limpo)
  return Number.isNaN(n) ? null : n
}

// ─── Carregamento compartilhado: itens do compêndio com escopo de campanha ──
// SRD (criado_por null) sempre aparece; custom só para quem está na
// campanha dona, e só visível a jogadores se visivel_jogadores = true.

function useCompendioLista<T extends { criado_por?: string | null }>(
  tabela: string, campos: string, ordenarPor: string[], campanhaId: string | undefined, ehDM: boolean
) {
  const [lista, setLista] = useState<T[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      let query = supabase.from(tabela).select(campos)
      for (const campo of ordenarPor) query = query.order(campo)
      if (!campanhaId) query = query.is('criado_por', null)
      else if (ehDM) query = query.or(`criado_por.is.null,campanha_id.eq.${campanhaId}`)
      else query = query.or(`criado_por.is.null,and(campanha_id.eq.${campanhaId},visivel_jogadores.eq.true)`)
      const { data } = await query
      if (!cancelado) {
        setLista((data ?? []) as unknown as T[])
        setCarregando(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [tabela, campos, ordenarPor, campanhaId, ehDM])

  return { lista, setLista, carregando }
}

function useNomesAutores(lista: { criado_por?: string | null }[]) {
  const [nomes, setNomes] = useState<Record<string, string>>({})
  useEffect(() => {
    const ids = Array.from(new Set(lista.map(m => m.criado_por).filter((id): id is string => !!id)))
    if (ids.length === 0) { setNomes({}); return }
    const supabase = createClient()
    supabase.from('profiles').select('id, nome, username').in('id', ids).then(({ data }) => {
      const mapa: Record<string, string> = {}
      for (const p of data ?? []) mapa[p.id as string] = (p.nome as string | null) ?? (p.username as string | null) ?? 'Mestre'
      setNomes(mapa)
    })
  }, [lista])
  return nomes
}

interface ItemAbaProps {
  userId: string | null
  isAdmin: boolean
  podeCriarItem: boolean
  campanhaId: string | undefined
  ehDM: boolean
}

type ItemQualquer = MagicItem | EquipmentWeapon | EquipmentArmor | EquipmentGear

const ITEM_VAZIO = {
  name_pt: '', name_en: '',
  peso: '',
  valorTexto: '', valorMoeda: 'po' as 'pl' | 'po' | 'pe' | 'pp' | 'pc',
  description_pt: '', description_en: '',
  damage_dice: '', damage_type_pt: '', properties_pt: '', category_arma: 'Simple Melee',
  base_ac_formula_pt: '', category_armadura: 'Light', stealth_disadvantage: false, strength_requirement: '',
  rarity: 'common', requires_attunement: false, attunement_notes_pt: '', has_charges: false, charges_max: '',
  category_gear: CAT_GEAR_PT[0],
}
type ItemForm = typeof ITEM_VAZIO

const SECOES_ITEM_BASE = [{ id: 'basico', label: 'Básico' }] as const
const SECAO_POR_TIPO: Record<TipoItem, { id: string; label: string } | null> = {
  arma: { id: 'arma', label: 'Arma' },
  armadura: { id: 'armadura', label: 'Armadura' },
  magico: { id: 'magico', label: 'Item Mágico' },
  equipamento: null,
}

function ModalAdminEditarItem({ modo, tipoInicial, item, criadoPor, campanhaId, onClose, onSaved }: {
  modo: 'criar' | 'editar'
  tipoInicial: TipoItem
  item?: ItemQualquer
  criadoPor?: string
  campanhaId?: string | null
  onClose: () => void
  onSaved: (tipo: TipoItem, item: ItemQualquer) => void
}) {
  const lbl = "text-[var(--text3)] text-[9px] font-cinzel uppercase"
  const inp = "w-full input-dd text-sm mt-0.5"

  const [tipo, setTipo] = useState<TipoItem>(tipoInicial)

  function dadosIniciaisPara(t: TipoItem): ItemForm {
    if (modo !== 'editar' || !item) return { ...ITEM_VAZIO, valorMoeda: 'po' }
    if (t === 'magico') {
      const m = item as MagicItem
      const { valor, moeda } = custoParaValorMoeda(m.gp_value != null ? m.gp_value * 100 : null)
      return {
        ...ITEM_VAZIO,
        name_pt: m.name_pt, name_en: m.name_en,
        peso: m.weight_lb != null ? String(m.weight_lb) : '',
        valorTexto: valor, valorMoeda: moeda,
        description_pt: m.description_pt ?? '', description_en: '',
        rarity: m.rarity ?? 'common',
        requires_attunement: m.requires_attunement,
        attunement_notes_pt: m.attunement_notes_pt ?? '',
        has_charges: m.has_charges,
        charges_max: m.charges_max != null ? String(m.charges_max) : '',
      }
    }
    if (t === 'arma') {
      const a = item as EquipmentWeapon
      const { valor, moeda } = custoParaValorMoeda(a.cost_cp)
      return {
        ...ITEM_VAZIO,
        name_pt: a.name_pt, name_en: a.name_en,
        peso: a.weight_lb != null ? String(a.weight_lb) : '',
        valorTexto: valor, valorMoeda: moeda,
        description_pt: a.description_pt ?? '', description_en: a.description_en ?? '',
        damage_dice: a.damage_dice ?? '', damage_type_pt: a.damage_type_pt ?? '',
        properties_pt: a.properties_pt ?? '',
        category_arma: a.category_en ?? 'Simple Melee',
      }
    }
    if (t === 'armadura') {
      const ar = item as EquipmentArmor
      const { valor, moeda } = custoParaValorMoeda(ar.cost_cp)
      const catEn = Object.entries(CAT_ARMADURA_PT).find(([, pt]) => pt === ar.category_pt)?.[0] ?? 'Light'
      return {
        ...ITEM_VAZIO,
        name_pt: ar.name_pt, name_en: ar.name_en,
        peso: ar.weight_lb != null ? String(ar.weight_lb) : '',
        valorTexto: valor, valorMoeda: moeda,
        description_pt: ar.description_pt ?? '', description_en: ar.description_en ?? '',
        base_ac_formula_pt: ar.base_ac_formula_pt ?? '',
        category_armadura: catEn,
        stealth_disadvantage: ar.stealth_disadvantage,
        strength_requirement: ar.strength_requirement != null ? String(ar.strength_requirement) : '',
      }
    }
    const g = item as EquipmentGear
    const { valor, moeda } = custoParaValorMoeda(g.cost_gp)
    return {
      ...ITEM_VAZIO,
      name_pt: g.name_pt, name_en: g.name_en,
      peso: g.weight_lb != null ? String(g.weight_lb) : '',
      valorTexto: valor, valorMoeda: moeda,
      description_pt: g.description_pt ?? '', description_en: g.description_en ?? '',
      category_gear: g.category_pt ?? CAT_GEAR_PT[0],
    }
  }

  const [secao, setSecao] = useState<string>('basico')
  const [salvando, setSalvando] = useState(false)
  const [visivelJogadores, setVisivelJogadores] = useState(item?.visivel_jogadores ?? true)
  const [sufixoSlug] = useState(() => gerarSufixoAleatorio())
  const [camposInvalidos, setCamposInvalidos] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<ItemForm>(() => dadosIniciaisPara(tipoInicial))

  // Trocar o tipo em "criar" reseta os campos específicos do tipo anterior
  // (não faz sentido levar "propriedades de arma" para um item mágico).
  function trocarTipo(novoTipo: TipoItem) {
    setTipo(novoTipo)
    setForm(dadosIniciaisPara(novoTipo))
    setSecao('basico')
  }

  useEffect(() => { setCamposInvalidos(new Set()) }, [form.name_pt, form.name_en, form.description_pt])

  const slugGerado = `${gerarSlugBase(form.name_en) || 'item'}-${sufixoSlug}`
  const campoInvalido = (chave: string) => cn(inp, camposInvalidos.has(chave) && 'border-[var(--red2)]')

  // Alcance de arma (metros na UI, pés no banco) — buffer de texto para
  // não "pular" o valor enquanto o mestre digita um decimal.
  const [rangeFt, setRangeFt] = useState<number | null>(modo === 'editar' && item && tipoInicial === 'arma' ? (item as EquipmentWeapon).range_ft ?? null : null)
  const [rangeTexto, setRangeTexto] = useState<string | undefined>(undefined)
  function valorRange(): string {
    if (rangeTexto !== undefined) return rangeTexto
    return rangeFt != null ? formatarMetros(rangeFt) : ''
  }
  function confirmarRange() {
    if (rangeTexto === undefined) return
    const metros = parseMetros(rangeTexto)
    setRangeFt(metros !== null ? metrosParaPes(metros) : null)
    setRangeTexto(undefined)
  }
  function rangeFtFinal(): number | null {
    if (rangeTexto !== undefined) {
      const metros = parseMetros(rangeTexto)
      return metros !== null ? metrosParaPes(metros) : null
    }
    return rangeFt
  }

  const secoesModal = [...SECOES_ITEM_BASE, ...(SECAO_POR_TIPO[tipo] ? [SECAO_POR_TIPO[tipo]!] : [])]

  async function salvar() {
    const faltando: { chave: string; secao: string; rotulo: string }[] = []
    if (!form.name_pt.trim()) faltando.push({ chave: 'name_pt', secao: 'basico', rotulo: 'Nome PT' })
    if (!form.name_en.trim()) faltando.push({ chave: 'name_en', secao: 'basico', rotulo: 'Nome EN' })
    if (tipo === 'magico' && !form.description_pt.trim()) faltando.push({ chave: 'description_pt', secao: 'basico', rotulo: 'Descrição PT' })
    if (faltando.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${faltando.map(f => f.rotulo).join(', ')}`)
      setSecao(faltando[0].secao)
      setCamposInvalidos(new Set(faltando.map(f => f.chave)))
      return
    }

    setSalvando(true)
    const supabase = createClient()
    const tabela = TIPOS_ITEM.find(t => t.value === tipo)!.tabela
    const pesoLb = form.peso.trim() ? Math.round((Number(form.peso.replace(',', '.')) / 0.453592) * 100) / 100 : null
    const valorCp = valorMoedaParaCp(form.valorTexto, form.valorMoeda)

    let payload: Record<string, unknown> = {
      name_pt: form.name_pt.trim(),
      name_en: form.name_en.trim(),
    }

    if (tipo === 'magico') {
      payload = {
        ...payload,
        category: (modo === 'editar' && item ? (item as MagicItem).category : null) ?? 'wondrous_item',
        rarity: form.rarity,
        requires_attunement: form.requires_attunement,
        attunement_notes_pt: form.requires_attunement ? (form.attunement_notes_pt.trim() || null) : null,
        is_consumable: (modo === 'editar' && item ? (item as MagicItem).is_consumable : false) ?? false,
        is_cursed: (modo === 'editar' && item ? (item as MagicItem).is_cursed : false) ?? false,
        is_sentient: (modo === 'editar' && item ? (item as MagicItem).is_sentient : false) ?? false,
        has_charges: form.has_charges,
        charges_max: form.has_charges ? (form.charges_max.trim() ? Number(form.charges_max) : null) : null,
        weight_lb: pesoLb,
        gp_value: valorCp != null ? Math.round(valorCp) / 100 : null,
        description_pt: form.description_pt.trim(),
        description_en: form.description_en.trim() || form.description_pt.trim(),
      }
    } else if (tipo === 'arma') {
      const catPt = CAT_ARMA_PT[form.category_arma] ?? form.category_arma
      const grupo = form.category_arma.includes('Simple') ? { en: 'Simple', pt: 'Simples' } : { en: 'Martial', pt: 'Marcial' }
      payload = {
        ...payload,
        category_en: form.category_arma,
        category_pt: catPt,
        weapon_group_en: grupo.en,
        weapon_group_pt: grupo.pt,
        damage_dice: form.damage_dice.trim() || '1d4',
        damage_type_pt: form.damage_type_pt || 'Contundente',
        damage_type_en: danoEnPara(form.damage_type_pt || 'Contundente'),
        properties_pt: form.properties_pt.trim() || null,
        range_ft: rangeFtFinal(),
        weight_lb: pesoLb,
        cost_cp: valorCp,
        description_pt: form.description_pt.trim() || null,
        description_en: form.description_en.trim() || form.description_pt.trim() || null,
      }
    } else if (tipo === 'armadura') {
      payload = {
        ...payload,
        category_en: form.category_armadura,
        category_pt: CAT_ARMADURA_PT[form.category_armadura] ?? form.category_armadura,
        base_ac_formula_pt: form.base_ac_formula_pt.trim() || '10',
        base_ac_formula_en: form.base_ac_formula_pt.trim() || '10',
        strength_requirement: form.strength_requirement.trim() ? Number(form.strength_requirement) : null,
        stealth_disadvantage: form.stealth_disadvantage,
        weight_lb: pesoLb,
        cost_cp: valorCp,
        description_pt: form.description_pt.trim() || null,
        description_en: form.description_en.trim() || form.description_pt.trim() || null,
      }
    } else {
      payload = {
        ...payload,
        category_pt: form.category_gear,
        weight_lb: pesoLb,
        cost_gp: valorCp,
        description_pt: form.description_pt.trim() || null,
        description_en: form.description_en.trim() || form.description_pt.trim() || null,
      }
    }

    if (modo === 'editar') {
      const mid = item!.id
      const { data, error } = await supabase.from(tabela).update({
        ...payload,
        ...(item!.criado_por ? { visivel_jogadores: visivelJogadores } : {}),
      }).eq('id', mid).select('*').single()
      if (error) { toast.error(error.message); setSalvando(false); return }
      toast.success('Item atualizado!')
      onSaved(tipo, data as ItemQualquer)
    } else {
      const dadosCriacao = {
        ...payload,
        slug: slugGerado,
        criado_por: criadoPor,
        campanha_id: campanhaId,
        visivel_jogadores: visivelJogadores,
      }
      const { data, error } = await supabase.from(tabela).insert(dadosCriacao).select('*').single()
      if (error || !data) { toast.error(error?.message ?? 'Erro ao criar item'); setSalvando(false); return }
      toast.success('Item criado!')
      onSaved(tipo, data as ItemQualquer)
    }

    setSalvando(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="font-cinzel text-[var(--gold)] font-bold">
            {modo === 'criar' ? '✨ Criar Item' : `✏️ Editar — ${item?.name_pt}`}
          </h2>
          <button onClick={onClose} className="text-[var(--border)] hover:text-[var(--red2)]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex md:hidden flex-col items-center justify-center flex-1 p-8 text-center">
          <p className="font-cinzel text-[var(--gold)] text-base mb-1">🖥️ Melhor no computador</p>
          <p className="text-[var(--text3)] text-sm font-crimson max-w-xs">
            {modo === 'criar' ? 'Criar' : 'Editar'} item usa um formulário grande, feito para telas maiores.
            Abra no notebook ou tablet para usar.
          </p>
        </div>

        <div className="hidden md:contents">
          <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex overflow-x-auto flex-shrink-0">
            {secoesModal.map(s => (
              <button
                key={s.id}
                onClick={() => setSecao(s.id)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-cinzel border-b-2 transition-colors whitespace-nowrap",
                  secao === s.id ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* ── BÁSICO ── */}
            {secao === 'basico' && (
              <>
                {(modo === 'criar' || item?.criado_por) && (
                  <div className="flex items-center gap-4 p-3 rounded border border-[var(--gold)]/30 bg-[var(--gold)]/5">
                    <div className="flex-1">
                      <label className={lbl}>Slug (gerado automaticamente)</label>
                      <p className="text-[var(--text2)] text-sm font-mono mt-0.5">{modo === 'criar' ? slugGerado : item?.slug}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={visivelJogadores} onChange={e => setVisivelJogadores(e.target.checked)} className="accent-[var(--gold)]" />
                      <span className="font-cinzel text-sm text-[var(--text2)]">Visível para jogadores</span>
                    </label>
                  </div>
                )}

                <div>
                  <label className={lbl}>Tipo</label>
                  {modo === 'criar' ? (
                    <select className={inp} value={tipo} onChange={e => trocarTipo(e.target.value as TipoItem)}>
                      {TIPOS_ITEM.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  ) : (
                    <p className="text-[var(--text2)] text-sm mt-0.5">{TIPOS_ITEM.find(t => t.value === tipo)?.label}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Nome PT <span className="text-[var(--red2)]">*</span></label><input className={campoInvalido('name_pt')} value={form.name_pt} onChange={e => setForm(f => ({ ...f, name_pt: e.target.value }))} /></div>
                  <div><label className={lbl}>Nome EN <span className="text-[var(--red2)]">*</span></label><input className={campoInvalido('name_en')} value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} /></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Peso (kg)</label>
                    <input className={inp} inputMode="decimal" value={form.peso} onChange={e => setForm(f => ({ ...f, peso: e.target.value }))} placeholder="1,5" />
                  </div>
                  <div>
                    <label className={lbl}>Valor</label>
                    <div className="flex gap-1 mt-0.5">
                      <input className="flex-1 input-dd text-sm" inputMode="decimal" value={form.valorTexto} onChange={e => setForm(f => ({ ...f, valorTexto: e.target.value }))} placeholder="0" />
                      <select className="input-dd text-sm w-32" value={form.valorMoeda} onChange={e => setForm(f => ({ ...f, valorMoeda: e.target.value as ItemForm['valorMoeda'] }))}>
                        {MOEDAS_ITEM.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={lbl}>Descrição {tipo === 'magico' && <span className="text-[var(--red2)]">*</span>}</label>
                  <textarea rows={5} className={cn(campoInvalido('description_pt'), 'resize-none')} value={form.description_pt} onChange={e => setForm(f => ({ ...f, description_pt: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Descrição EN</label>
                  <textarea rows={3} className={cn(inp, 'resize-none')} value={form.description_en} onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} placeholder="(opcional — espelha o PT)" />
                </div>
              </>
            )}

            {/* ── ARMA ── */}
            {secao === 'arma' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Dado de Dano</label><input className={inp} value={form.damage_dice} onChange={e => setForm(f => ({ ...f, damage_dice: e.target.value }))} placeholder="1d8" /></div>
                  <div>
                    <label className={lbl}>Tipo de Dano</label>
                    <select className={inp} value={form.damage_type_pt} onChange={e => setForm(f => ({ ...f, damage_type_pt: e.target.value }))}>
                      <option value="">— Selecione —</option>
                      {form.damage_type_pt && !TIPOS_DANO.some(t => t.nome === form.damage_type_pt) && (
                        <option value={form.damage_type_pt}>{form.damage_type_pt} (original)</option>
                      )}
                      {TIPOS_DANO.map(t => <option key={t.id} value={t.nome}>{t.icone} {t.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Categoria</label>
                    <select className={inp} value={form.category_arma} onChange={e => setForm(f => ({ ...f, category_arma: e.target.value }))}>
                      {Object.entries(CAT_ARMA_PT).map(([en, pt]) => <option key={en} value={en}>{pt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Alcance (m)</label>
                    <input className={inp} inputMode="decimal" placeholder="1,5" value={valorRange()} onChange={e => setRangeTexto(e.target.value)} onBlur={confirmarRange} />
                  </div>
                </div>
                <div><label className={lbl}>Propriedades</label><input className={inp} value={form.properties_pt} onChange={e => setForm(f => ({ ...f, properties_pt: e.target.value }))} placeholder="Leve, Acuidade, Arremesso (18/36)" /></div>
              </>
            )}

            {/* ── ARMADURA ── */}
            {secao === 'armadura' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Classe de Armadura</label><input className={inp} value={form.base_ac_formula_pt} onChange={e => setForm(f => ({ ...f, base_ac_formula_pt: e.target.value }))} placeholder="16 ou 11 + Mod. Destreza" /></div>
                  <div>
                    <label className={lbl}>Categoria</label>
                    <select className={inp} value={form.category_armadura} onChange={e => setForm(f => ({ ...f, category_armadura: e.target.value }))}>
                      {Object.entries(CAT_ARMADURA_PT).map(([en, pt]) => <option key={en} value={en}>{pt}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Força Mínima</label><input type="number" className={inp} value={form.strength_requirement} onChange={e => setForm(f => ({ ...f, strength_requirement: e.target.value }))} /></div>
                  <label className="flex items-center gap-2 cursor-pointer mt-4">
                    <input type="checkbox" checked={form.stealth_disadvantage} onChange={e => setForm(f => ({ ...f, stealth_disadvantage: e.target.checked }))} className="accent-[var(--gold)]" />
                    <span className="font-cinzel text-sm text-[var(--text2)]">Desvantagem em Furtividade</span>
                  </label>
                </div>
              </>
            )}

            {/* ── ITEM MÁGICO ── */}
            {secao === 'magico' && (
              <>
                <div>
                  <label className={lbl}>Raridade</label>
                  <select className={inp} value={form.rarity} onChange={e => setForm(f => ({ ...f, rarity: e.target.value }))}>
                    {Object.entries(RARIDADE_PT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.requires_attunement} onChange={e => setForm(f => ({ ...f, requires_attunement: e.target.checked }))} className="accent-[var(--gold)]" />
                  <span className="font-cinzel text-sm text-[var(--text2)]">Requer Sintonização</span>
                </label>
                {form.requires_attunement && (
                  <div><label className={lbl}>Notas de Sintonização</label><input className={inp} value={form.attunement_notes_pt} onChange={e => setForm(f => ({ ...f, attunement_notes_pt: e.target.value }))} placeholder="por um conjurador" /></div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.has_charges} onChange={e => setForm(f => ({ ...f, has_charges: e.target.checked }))} className="accent-[var(--gold)]" />
                  <span className="font-cinzel text-sm text-[var(--text2)]">Possui Cargas</span>
                </label>
                {form.has_charges && (
                  <div className="w-40"><label className={lbl}>Cargas Máximas</label><input type="number" min={1} className={inp} value={form.charges_max} onChange={e => setForm(f => ({ ...f, charges_max: e.target.value }))} /></div>
                )}
              </>
            )}

          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors">Cancelar</button>
            <button
              onClick={salvar}
              disabled={salvando || !form.name_pt.trim()}
              className="px-4 py-1.5 text-xs font-cinzel text-[var(--gold)] bg-[var(--surface)] border border-[var(--gold)]/50 rounded hover:bg-[var(--gold)]/10 transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : modo === 'criar' ? '✨ Criar Item' : '💾 Salvar Tudo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Itens Mágicos ───────────────────────────────────────────────────────

type MagicItemStub = Pick<MagicItem, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category' | 'rarity' | 'requires_attunement' | 'criado_por'>

function AbaMagicos({ userId, isAdmin, podeCriarItem, campanhaId, ehDM }: ItemAbaProps) {
  const { lista, setLista, carregando } = useCompendioLista<MagicItemStub>(
    'magic_items', 'id, slug, name_pt, name_en, category, rarity, requires_attunement, criado_por',
    ['rarity', 'name_pt'], campanhaId, ehDM
  )
  const [selecionado, setSelecionado] = useState<MagicItem | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroRaridade, setFiltroRaridade] = useState('')
  const [modalAberto, setModalAberto] = useState<'criar' | 'editar' | null>(null)
  const nomesAutores = useNomesAutores(lista)

  async function selecionar(stub: MagicItemStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('magic_items').select('*').eq('id', stub.id).single()
    setSelecionado(data as MagicItem)
    setCarregandoDetalhe(false)
  }

  function itemSalvo(m: MagicItem) {
    setSelecionado(m)
    const stub: MagicItemStub = {
      id: m.id, slug: m.slug, name_pt: m.name_pt, name_en: m.name_en,
      category: m.category, rarity: m.rarity, requires_attunement: m.requires_attunement,
      criado_por: m.criado_por ?? null,
    }
    setLista(prev => {
      const existe = prev.some(p => p.id === m.id)
      return existe ? prev.map(p => p.id === m.id ? stub : p) : [...prev, stub]
    })
  }

  async function tornarPadrao(m: MagicItem) {
    if (!confirm(`Tornar "${m.name_pt}" um item padrão? Ele deixará de ser exclusivo desta campanha e passará a aparecer para todas as campanhas.`)) return
    const faltando: string[] = []
    if (!m.name_en?.trim()) faltando.push('Nome EN')
    if (!m.description_pt?.trim()) faltando.push('Descrição')
    if (faltando.length > 0) { toast.error(`Preencha antes de tornar padrão: ${faltando.join(', ')}`); return }
    const supabase = createClient()
    const { data, error } = await supabase.from('magic_items').update({ criado_por: null, campanha_id: null }).eq('id', m.id).select('*').single()
    if (error) { toast.error(error.message); return }
    toast.success(`"${m.name_pt}" agora é um item padrão!`)
    itemSalvo(data as MagicItem)
  }

  const filtrados = useMemo(() => lista.filter(m => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!m.name_pt.toLowerCase().includes(q) && !m.name_en.toLowerCase().includes(q)) return false
    }
    if (filtroRaridade && m.rarity !== filtroRaridade) return false
    return true
  }), [lista, busca, filtroRaridade])

  const podeEditar = !!selecionado && (isAdmin || (!!userId && selecionado.criado_por === userId))

  return (
    <>
      <ListaDetalhe
        carregando={carregando}
        carregandoDetalhe={carregandoDetalhe}
        total={lista.length}
        filtrados={filtrados.length}
        filtros={
          <>
            {podeCriarItem && (
              <button
                onClick={() => setModalAberto('criar')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
              >
                <Plus className="w-4 h-4" /> Criar Item
              </button>
            )}
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
          badge: (
            <span className="flex items-center gap-1">
              {m.criado_por && <span className="text-[var(--gold)] text-[9px]" title={`Criado por ${nomesAutores[m.criado_por] ?? 'Mestre'}`}>✦</span>}
              {m.rarity && (
                <span className={`text-[10px] px-1 border rounded font-cinzel ${COR_RARIDADE[m.rarity] ?? ''}`}>
                  {RARIDADE_PT[m.rarity]}
                </span>
              )}
            </span>
          ),
          ativo: selecionado?.id === m.id,
          onClick: () => selecionar(m),
        }))}
        detalhe={
          !selecionado ? null : (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold">{selecionado.name_pt}</h2>
                    {selecionado.criado_por && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] rounded font-cinzel">
                        ✦ Criado por {nomesAutores[selecionado.criado_por] ?? 'Mestre'}
                      </span>
                    )}
                  </div>
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
                    {selecionado.weight_lb != null && <span className="text-[var(--text3)] text-xs">{lbParaKg(selecionado.weight_lb)}</span>}
                    {selecionado.gp_value != null && <span className="text-[var(--gold)] text-xs font-cinzel">{formatarGp(selecionado.gp_value)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && selecionado.criado_por && (
                    <button
                      onClick={() => tornarPadrao(selecionado)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] rounded text-sm font-cinzel hover:bg-[var(--gold)]/20 transition-colors"
                      title="Tornar este item padrão para todas as campanhas"
                    >
                      <Star className="w-3.5 h-3.5" /> Tornar padrão
                    </button>
                  )}
                  {podeEditar && (
                    <button
                      onClick={() => setModalAberto('editar')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text2)] rounded text-sm font-cinzel hover:bg-[var(--surface)] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  )}
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
                      slug: selecionado.slug,
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

      {modalAberto === 'editar' && selecionado && (
        <ModalAdminEditarItem
          modo="editar" tipoInicial="magico" item={selecionado}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, m) => { itemSalvo(m as MagicItem); setModalAberto(null) }}
        />
      )}
      {modalAberto === 'criar' && userId && (
        <ModalAdminEditarItem
          modo="criar" tipoInicial="magico" criadoPor={userId} campanhaId={campanhaId ?? null}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, m) => { itemSalvo(m as MagicItem); setModalAberto(null) }}
        />
      )}
    </>
  )
}

// ─── Aba Armas ───────────────────────────────────────────────────────────────

type WeaponStub = Pick<EquipmentWeapon, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category_en' | 'category_pt' | 'damage_dice' | 'damage_type_pt' | 'criado_por'>

function AbaArmas({ userId, isAdmin, podeCriarItem, campanhaId, ehDM }: ItemAbaProps) {
  const { lista, setLista, carregando } = useCompendioLista<WeaponStub>(
    'equipment_weapons', 'id, slug, name_pt, name_en, category_en, category_pt, damage_dice, damage_type_pt, criado_por',
    ['category_en', 'name_pt'], campanhaId, ehDM
  )
  const [selecionado, setSelecionado] = useState<EquipmentWeapon | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [modalAberto, setModalAberto] = useState<'criar' | 'editar' | null>(null)
  const nomesAutores = useNomesAutores(lista)

  async function selecionar(stub: WeaponStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('equipment_weapons').select('*').eq('id', stub.id).single()
    setSelecionado(data as EquipmentWeapon)
    setCarregandoDetalhe(false)
  }

  function itemSalvo(w: EquipmentWeapon) {
    setSelecionado(w)
    const stub: WeaponStub = {
      id: w.id, slug: w.slug, name_pt: w.name_pt, name_en: w.name_en,
      category_en: w.category_en, category_pt: w.category_pt,
      damage_dice: w.damage_dice, damage_type_pt: w.damage_type_pt,
      criado_por: w.criado_por ?? null,
    }
    setLista(prev => {
      const existe = prev.some(p => p.id === w.id)
      return existe ? prev.map(p => p.id === w.id ? stub : p) : [...prev, stub]
    })
  }

  async function tornarPadrao(w: EquipmentWeapon) {
    if (!confirm(`Tornar "${w.name_pt}" uma arma padrão? Ela deixará de ser exclusiva desta campanha e passará a aparecer para todas as campanhas.`)) return
    if (!w.name_en?.trim()) { toast.error('Preencha antes de tornar padrão: Nome EN'); return }
    const supabase = createClient()
    const { data, error } = await supabase.from('equipment_weapons').update({ criado_por: null, campanha_id: null }).eq('id', w.id).select('*').single()
    if (error) { toast.error(error.message); return }
    toast.success(`"${w.name_pt}" agora é uma arma padrão!`)
    itemSalvo(data as EquipmentWeapon)
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
  const podeEditar = !!selecionado && (isAdmin || (!!userId && selecionado.criado_por === userId))

  return (
    <>
      <ListaDetalhe
        carregando={carregando}
        carregandoDetalhe={carregandoDetalhe}
        total={lista.length}
        filtrados={filtrados.length}
        filtros={
          <>
            {podeCriarItem && (
              <button
                onClick={() => setModalAberto('criar')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
              >
                <Plus className="w-4 h-4" /> Criar Item
              </button>
            )}
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="w-full input-dd text-xs">
              <option value="">Todas as categorias</option>
              {categorias.map(c => <option key={c} value={c}>{CAT_ARMA_PT[c] ?? c}</option>)}
            </select>
          </>
        }
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar arma..."
        itens={filtrados.map(w => ({
          id: w.id,
          principal: w.name_pt,
          secundario: `${CAT_ARMA_PT[w.category_en ?? ''] ?? w.category_pt ?? ''} · ${w.damage_dice ?? ''} ${w.damage_type_pt ?? ''}`,
          badge: w.criado_por ? <span className="text-[var(--gold)] text-[9px]" title={`Criado por ${nomesAutores[w.criado_por] ?? 'Mestre'}`}>✦</span> : null,
          ativo: selecionado?.id === w.id,
          onClick: () => selecionar(w),
        }))}
        detalhe={
          !selecionado ? null : (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h2 className="font-cinzel text-[var(--red2)] text-2xl font-bold">{selecionado.name_pt}</h2>
                    {selecionado.criado_por && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] rounded font-cinzel">
                        ✦ Criado por {nomesAutores[selecionado.criado_por] ?? 'Mestre'}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--border)] text-sm italic">{selecionado.name_en}</p>
                  <p className="text-[var(--text2)] text-sm mt-1">{CAT_ARMA_PT[selecionado.category_en ?? ''] ?? selecionado.category_pt}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && selecionado.criado_por && (
                    <button
                      onClick={() => tornarPadrao(selecionado)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] rounded text-sm font-cinzel hover:bg-[var(--gold)]/20 transition-colors"
                      title="Tornar esta arma padrão para todas as campanhas"
                    >
                      <Star className="w-3.5 h-3.5" /> Tornar padrão
                    </button>
                  )}
                  {podeEditar && (
                    <button
                      onClick={() => setModalAberto('editar')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text2)] rounded text-sm font-cinzel hover:bg-[var(--surface)] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  )}
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
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <span className="text-[var(--text3)] font-cinzel text-xs block">Custo</span>
                    <span className="text-[var(--text)]">{formatarCusto(selecionado.cost_cp)}</span>
                  </div>
                  {selecionado.range_ft != null && (
                    <div>
                      <span className="text-[var(--text3)] font-cinzel text-xs block">Alcance</span>
                      <span className="text-[var(--text)]">{formatarMetros(selecionado.range_ft)} m</span>
                    </div>
                  )}
                </div>
              </PainelGrimorio>
              {selecionado.properties_pt && (
                <PainelGrimorio titulo="Propriedades" compacto className="mb-3">
                  <p className="text-[var(--text2)] font-crimson">{selecionado.properties_pt}</p>
                </PainelGrimorio>
              )}
              {selecionado.description_pt && (
                <PainelGrimorio titulo="Descrição" compacto className="mb-3">
                  <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.description_pt}</p>
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

      {modalAberto === 'editar' && selecionado && (
        <ModalAdminEditarItem
          modo="editar" tipoInicial="arma" item={selecionado}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, w) => { itemSalvo(w as EquipmentWeapon); setModalAberto(null) }}
        />
      )}
      {modalAberto === 'criar' && userId && (
        <ModalAdminEditarItem
          modo="criar" tipoInicial="arma" criadoPor={userId} campanhaId={campanhaId ?? null}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, w) => { itemSalvo(w as EquipmentWeapon); setModalAberto(null) }}
        />
      )}
    </>
  )
}

// ─── Aba Armaduras ───────────────────────────────────────────────────────────

type ArmorStub = Pick<EquipmentArmor, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category_pt' | 'base_ac_formula_pt' | 'criado_por'>

function AbaArmaduras({ userId, isAdmin, podeCriarItem, campanhaId, ehDM }: ItemAbaProps) {
  const { lista, setLista, carregando } = useCompendioLista<ArmorStub>(
    'equipment_armor', 'id, slug, name_pt, name_en, category_pt, base_ac_formula_pt, criado_por',
    ['name_pt'], campanhaId, ehDM
  )
  const [selecionado, setSelecionado] = useState<EquipmentArmor | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState<'criar' | 'editar' | null>(null)
  const nomesAutores = useNomesAutores(lista)

  async function selecionar(stub: ArmorStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('equipment_armor').select('*').eq('id', stub.id).single()
    setSelecionado(data as EquipmentArmor)
    setCarregandoDetalhe(false)
  }

  function itemSalvo(a: EquipmentArmor) {
    setSelecionado(a)
    const stub: ArmorStub = {
      id: a.id, slug: a.slug, name_pt: a.name_pt, name_en: a.name_en,
      category_pt: a.category_pt, base_ac_formula_pt: a.base_ac_formula_pt,
      criado_por: a.criado_por ?? null,
    }
    setLista(prev => {
      const existe = prev.some(p => p.id === a.id)
      return existe ? prev.map(p => p.id === a.id ? stub : p) : [...prev, stub]
    })
  }

  async function tornarPadrao(a: EquipmentArmor) {
    if (!confirm(`Tornar "${a.name_pt}" uma armadura padrão? Ela deixará de ser exclusiva desta campanha e passará a aparecer para todas as campanhas.`)) return
    if (!a.name_en?.trim()) { toast.error('Preencha antes de tornar padrão: Nome EN'); return }
    const supabase = createClient()
    const { data, error } = await supabase.from('equipment_armor').update({ criado_por: null, campanha_id: null }).eq('id', a.id).select('*').single()
    if (error) { toast.error(error.message); return }
    toast.success(`"${a.name_pt}" agora é uma armadura padrão!`)
    itemSalvo(data as EquipmentArmor)
  }

  const filtrados = useMemo(() => lista.filter(a => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return a.name_pt.toLowerCase().includes(q) || a.name_en.toLowerCase().includes(q)
  }), [lista, busca])

  const podeEditar = !!selecionado && (isAdmin || (!!userId && selecionado.criado_por === userId))

  return (
    <>
      <ListaDetalhe
        carregando={carregando}
        carregandoDetalhe={carregandoDetalhe}
        total={lista.length}
        filtrados={filtrados.length}
        filtros={
          podeCriarItem ? (
            <button
              onClick={() => setModalAberto('criar')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Criar Item
            </button>
          ) : null
        }
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar armadura..."
        itens={filtrados.map(a => ({
          id: a.id,
          principal: a.name_pt,
          secundario: `${a.category_pt ?? ''} · CA ${a.base_ac_formula_pt ?? '—'}`,
          badge: a.criado_por ? <span className="text-[var(--gold)] text-[9px]" title={`Criado por ${nomesAutores[a.criado_por] ?? 'Mestre'}`}>✦</span> : null,
          ativo: selecionado?.id === a.id,
          onClick: () => selecionar(a),
        }))}
        detalhe={
          !selecionado ? null : (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h2 className="font-cinzel text-[var(--accent2)] text-2xl font-bold">{selecionado.name_pt}</h2>
                    {selecionado.criado_por && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] rounded font-cinzel">
                        ✦ Criado por {nomesAutores[selecionado.criado_por] ?? 'Mestre'}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--border)] text-sm italic">{selecionado.name_en}</p>
                  <p className="text-[var(--text2)] text-sm mt-1">{selecionado.category_pt}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && selecionado.criado_por && (
                    <button
                      onClick={() => tornarPadrao(selecionado)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] rounded text-sm font-cinzel hover:bg-[var(--gold)]/20 transition-colors"
                      title="Tornar esta armadura padrão para todas as campanhas"
                    >
                      <Star className="w-3.5 h-3.5" /> Tornar padrão
                    </button>
                  )}
                  {podeEditar && (
                    <button
                      onClick={() => setModalAberto('editar')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text2)] rounded text-sm font-cinzel hover:bg-[var(--surface)] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  )}
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
                      slug: selecionado.slug,
                      tipo: 'armadura',
                      descricao: [
                        selecionado.base_ac_formula_pt,
                        selecionado.stealth_disadvantage ? 'Desvantagem em Furtividade' : null,
                        selecionado.strength_requirement ? `Força mínima ${selecionado.strength_requirement}` : null,
                      ].filter(Boolean).join(' · ') || null,
                    }}
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
              {selecionado.description_pt && (
                <PainelGrimorio titulo="Descrição" compacto>
                  <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.description_pt}</p>
                </PainelGrimorio>
              )}
            </div>
          )
        }
        placeholderDetalhe="Selecione uma armadura para ver detalhes"
      />

      {modalAberto === 'editar' && selecionado && (
        <ModalAdminEditarItem
          modo="editar" tipoInicial="armadura" item={selecionado}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, a) => { itemSalvo(a as EquipmentArmor); setModalAberto(null) }}
        />
      )}
      {modalAberto === 'criar' && userId && (
        <ModalAdminEditarItem
          modo="criar" tipoInicial="armadura" criadoPor={userId} campanhaId={campanhaId ?? null}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, a) => { itemSalvo(a as EquipmentArmor); setModalAberto(null) }}
        />
      )}
    </>
  )
}

// ─── Aba Equipamentos ────────────────────────────────────────────────────────

type GearStub = Pick<EquipmentGear, 'id' | 'slug' | 'name_pt' | 'name_en' | 'category_pt' | 'criado_por'>

function AbaEquipamentos({ userId, isAdmin, podeCriarItem, campanhaId, ehDM }: ItemAbaProps) {
  const { lista, setLista, carregando } = useCompendioLista<GearStub>(
    'equipment_gear', 'id, slug, name_pt, name_en, category_pt, criado_por',
    ['category_pt', 'name_pt'], campanhaId, ehDM
  )
  const [selecionado, setSelecionado] = useState<EquipmentGear | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState<'criar' | 'editar' | null>(null)
  const nomesAutores = useNomesAutores(lista)

  async function selecionar(stub: GearStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('equipment_gear').select('*').eq('id', stub.id).single()
    setSelecionado(data as EquipmentGear)
    setCarregandoDetalhe(false)
  }

  function itemSalvo(g: EquipmentGear) {
    setSelecionado(g)
    const stub: GearStub = {
      id: g.id, slug: g.slug, name_pt: g.name_pt, name_en: g.name_en,
      category_pt: g.category_pt, criado_por: g.criado_por ?? null,
    }
    setLista(prev => {
      const existe = prev.some(p => p.id === g.id)
      return existe ? prev.map(p => p.id === g.id ? stub : p) : [...prev, stub]
    })
  }

  async function tornarPadrao(g: EquipmentGear) {
    if (!confirm(`Tornar "${g.name_pt}" um equipamento padrão? Ele deixará de ser exclusivo desta campanha e passará a aparecer para todas as campanhas.`)) return
    if (!g.name_en?.trim()) { toast.error('Preencha antes de tornar padrão: Nome EN'); return }
    const supabase = createClient()
    const { data, error } = await supabase.from('equipment_gear').update({ criado_por: null, campanha_id: null }).eq('id', g.id).select('*').single()
    if (error) { toast.error(error.message); return }
    toast.success(`"${g.name_pt}" agora é um equipamento padrão!`)
    itemSalvo(data as EquipmentGear)
  }

  const filtrados = useMemo(() => lista.filter(g => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return g.name_pt.toLowerCase().includes(q) || g.name_en.toLowerCase().includes(q)
  }), [lista, busca])

  const podeEditar = !!selecionado && (isAdmin || (!!userId && selecionado.criado_por === userId))

  return (
    <>
      <ListaDetalhe
        carregando={carregando}
        carregandoDetalhe={carregandoDetalhe}
        total={lista.length}
        filtrados={filtrados.length}
        filtros={
          podeCriarItem ? (
            <button
              onClick={() => setModalAberto('criar')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Criar Item
            </button>
          ) : null
        }
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar equipamento..."
        itens={filtrados.map(g => ({
          id: g.id,
          principal: g.name_pt,
          secundario: g.category_pt ?? '',
          badge: g.criado_por ? <span className="text-[var(--gold)] text-[9px]" title={`Criado por ${nomesAutores[g.criado_por] ?? 'Mestre'}`}>✦</span> : null,
          ativo: selecionado?.id === g.id,
          onClick: () => selecionar(g),
        }))}
        detalhe={
          !selecionado ? null : (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h2 className="font-cinzel text-[var(--text)] text-2xl font-bold">{selecionado.name_pt}</h2>
                    {selecionado.criado_por && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] rounded font-cinzel">
                        ✦ Criado por {nomesAutores[selecionado.criado_por] ?? 'Mestre'}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--border)] text-sm italic">{selecionado.name_en}</p>
                  <p className="text-[var(--text2)] text-sm mt-1">{selecionado.category_pt}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && selecionado.criado_por && (
                    <button
                      onClick={() => tornarPadrao(selecionado)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] rounded text-sm font-cinzel hover:bg-[var(--gold)]/20 transition-colors"
                      title="Tornar este equipamento padrão para todas as campanhas"
                    >
                      <Star className="w-3.5 h-3.5" /> Tornar padrão
                    </button>
                  )}
                  {podeEditar && (
                    <button
                      onClick={() => setModalAberto('editar')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text2)] rounded text-sm font-cinzel hover:bg-[var(--surface)] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  )}
                  <BotaoReportar
                    itemSlug={selecionado.slug}
                    itemNome={selecionado.name_pt}
                    itemTipo="item"
                    pagina="/itens"
                  />
                  <BotaoAdicionarPersonagem
                    tipo="item"
                    nome={selecionado.name_pt}
                    dadosExtras={{ slug: selecionado.slug, tipo: 'equipamento', descricao: selecionado.description_pt ?? null }}
                  />
                </div>
              </div>
              <PainelGrimorio compacto className="mb-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-[var(--text3)] font-cinzel text-xs block">Custo</span><span className="text-[var(--gold)] font-cinzel">{formatarCusto(selecionado.cost_gp)}</span></div>
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

      {modalAberto === 'editar' && selecionado && (
        <ModalAdminEditarItem
          modo="editar" tipoInicial="equipamento" item={selecionado}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, g) => { itemSalvo(g as EquipmentGear); setModalAberto(null) }}
        />
      )}
      {modalAberto === 'criar' && userId && (
        <ModalAdminEditarItem
          modo="criar" tipoInicial="equipamento" criadoPor={userId} campanhaId={campanhaId ?? null}
          onClose={() => setModalAberto(null)}
          onSaved={(_t, g) => { itemSalvo(g as EquipmentGear); setModalAberto(null) }}
        />
      )}
    </>
  )
}

// ─── Aba Personalizado ───────────────────────────────────────────────────────

interface ItemPersonalizado {
  id: string
  nome: string
  dados: {
    tipo_item: string
    raridade: string
    descricao: string
    propriedades: string
  }
}

function AbaPersonalizadoItens({ userId }: { userId: string }) {
  const [lista, setLista] = useState<ItemPersonalizado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<ItemPersonalizado | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    nome: '', tipo_item: 'Item Mágico', raridade: 'common', descricao: '', propriedades: '',
  })

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('conteudo_personalizado')
        .select('id, nome, dados')
        .eq('user_id', userId)
        .eq('tipo', 'item')
        .order('nome')
      setLista((data ?? []) as ItemPersonalizado[])
      setCarregando(false)
    }
    carregar()
  }, [userId])

  async function salvar() {
    if (!form.nome.trim()) return
    setSalvando(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('conteudo_personalizado').insert({
        user_id: userId,
        tipo: 'item',
        nome: form.nome.trim(),
        dados: { tipo_item: form.tipo_item, raridade: form.raridade, descricao: form.descricao, propriedades: form.propriedades },
        publico: false,
      }).select('id, nome, dados').single()
      if (error) throw error
      setLista(l => [...l, data as ItemPersonalizado].sort((a, b) => a.nome.localeCompare(b.nome)))
      setModalAberto(false)
      setForm({ nome: '', tipo_item: 'Item Mágico', raridade: 'common', descricao: '', propriedades: '' })
      toast.success(`Item "${form.nome.trim()}" criado!`)
    } catch {
      toast.error('Erro ao salvar item')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o item "${nome}"?`)) return
    const supabase = createClient()
    await supabase.from('conteudo_personalizado').delete().eq('id', id)
    setLista(l => l.filter(i => i.id !== id))
    if (selecionado?.id === id) setSelecionado(null)
    toast.success('Item excluído')
  }

  return (
    <>
      <ListaDetalhe
        carregando={carregando}
        carregandoDetalhe={false}
        total={lista.length}
        filtrados={lista.length}
        filtros={
          <button
            onClick={() => setModalAberto(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Criar Novo Item
          </button>
        }
        busca=""
        onBusca={() => {}}
        placeholder="Buscar item personalizado..."
        itens={lista.map(i => ({
          id: i.id,
          principal: i.nome,
          secundario: `${i.dados.tipo_item} · ${RARIDADE_PT[i.dados.raridade] ?? i.dados.raridade}`,
          badge: i.dados.raridade ? (
            <span className={`text-[10px] px-1 border rounded font-cinzel ${COR_RARIDADE[i.dados.raridade] ?? ''}`}>
              {RARIDADE_PT[i.dados.raridade] ?? i.dados.raridade}
            </span>
          ) : null,
          ativo: selecionado?.id === i.id,
          onClick: () => setSelecionado(i),
        }))}
        detalhe={
          !selecionado ? null : (
            <div className="max-w-2xl">
              <div className="mb-4 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold">{selecionado.nome}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[var(--text2)] text-sm">{selecionado.dados.tipo_item}</span>
                    {selecionado.dados.raridade && (
                      <span className={`text-sm px-2 py-0.5 border rounded font-cinzel ${COR_RARIDADE[selecionado.dados.raridade] ?? ''}`}>
                        {RARIDADE_PT[selecionado.dados.raridade] ?? selecionado.dados.raridade}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">✨ Personalizado</span>
                  </div>
                </div>
                <button
                  onClick={() => excluir(selecionado.id, selecionado.nome)}
                  className="p-2 text-[var(--red2)] hover:bg-[var(--red2)]/10 rounded transition-colors"
                  title="Excluir item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {selecionado.dados.descricao && (
                <PainelGrimorio titulo="Descrição" compacto className="mb-3">
                  <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.descricao}</p>
                </PainelGrimorio>
              )}
              {selecionado.dados.propriedades && (
                <PainelGrimorio titulo="Propriedades" compacto>
                  <p className="text-[var(--text2)] font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.propriedades}</p>
                </PainelGrimorio>
              )}
            </div>
          )
        }
        placeholderDetalhe="Selecione um item para ver detalhes"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="font-cinzel text-[var(--gold)] font-bold">✨ Novo Item</h2>
              <button onClick={() => setModalAberto(false)} className="text-[var(--border)] hover:text-[var(--red2)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nome do Item *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Espada dos Reis..." className="w-full input-dd mt-1" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Tipo de Item</label>
                  <input type="text" value={form.tipo_item} onChange={e => setForm(f => ({ ...f, tipo_item: e.target.value }))} className="w-full input-dd mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Raridade</label>
                  <select value={form.raridade} onChange={e => setForm(f => ({ ...f, raridade: e.target.value }))} className="w-full input-dd mt-1 text-sm">
                    {Object.entries(RARIDADE_PT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Descrição do item..." />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Propriedades / Mecânicas</label>
                <textarea value={form.propriedades} onChange={e => setForm(f => ({ ...f, propriedades: e.target.value }))} rows={3} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Efeitos mecânicos, bônus, habilidades..." />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setModalAberto(false)} className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors">Cancelar</button>
                <button
                  onClick={salvar}
                  disabled={!form.nome.trim() || salvando}
                  className="px-3 py-1.5 text-xs font-cinzel text-[var(--gold)] bg-[var(--surface)] border border-[#d4a843]/50 rounded hover:bg-[#d4a843]/10 transition-colors disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Criar Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Lista */}
      <div className={cn(
        "flex flex-col w-full md:w-72 border-r border-[var(--border)] overflow-y-auto flex-shrink-0",
        visao === 'detalhe' ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3 border-b border-[var(--border)] space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
              <input type="text" value={busca} onChange={e => onBusca(e.target.value)} placeholder={placeholder} className="w-full input-dd pl-9 text-sm" />
            </div>
            {filtros && (
              <button
                onClick={() => setFiltrosAbertos(true)}
                className="md:hidden flex-shrink-0 w-9 h-9 rounded border border-[var(--border)] flex items-center justify-center text-[var(--text2)] hover:border-[var(--border2)] transition-colors"
                title="Filtros"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
          {filtros && <div className="hidden md:block space-y-2">{filtros}</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {carregando ? (
            <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="p-4 text-center text-[var(--border)] text-sm">Nenhum resultado</div>
          ) : (
            itens.map(item => (
              <button
                key={item.id}
                onClick={() => { item.onClick(); setVisao('detalhe') }}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                  item.ativo ? 'bg-[var(--surface)] border-[var(--gold)]/40' : 'border-[var(--border)]/50 hover:border-[var(--border2)] hover:bg-[var(--bg3)]'
                )}
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

      {/* Filtros — folha inferior no mobile */}
      {filtrosAbertos && filtros && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setFiltrosAbertos(false)} />
          <div className="fixed inset-x-0 bottom-0 above-bottomnav z-50 md:hidden bg-[var(--bg2)] border-t border-[var(--border)] rounded-t-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-cinzel text-xs text-[var(--text3)] uppercase tracking-wider">Filtros</span>
              <button onClick={() => setFiltrosAbertos(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">{filtros}</div>
            <button
              onClick={() => setFiltrosAbertos(false)}
              className="w-full py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded font-cinzel text-sm transition-opacity"
            >
              Aplicar
            </button>
          </div>
        </>
      )}

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
  const [aba, setAba] = useState<AbaTotal>('magicos')
  const [userPlano, setUserPlano] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const { ehDM } = usePermissao()
  const { campanhaAtiva, papelPorCampanha } = useCampanha()

  const dmDaCampanhaAtiva = !!campanhaAtiva && papelPorCampanha[campanhaAtiva.id] === 'dm'
  const podeCriarItem = isAdmin || dmDaCampanhaAtiva
  const abaProps: ItemAbaProps = { userId, isAdmin, podeCriarItem, campanhaId: campanhaAtiva?.id, ehDM }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setUserPlano('free'); return }
      setUserId(user.id)
      supabase.from('profiles').select('plano, is_admin').eq('id', user.id).single()
        .then(({ data }) => {
          setUserPlano(data?.plano ?? 'free')
          setIsAdmin(data?.is_admin === true)
        })
    })
  }, [])

  if (userPlano === null) return null

  const plano = getPlano(userPlano)

  if (!plano.limites.magias_itens) {
    return <BloqueioPlano recurso="Itens" planoNecessario="Herói" />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex overflow-x-auto">
        {ABAS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`px-4 py-2 text-xs font-cinzel border-b-2 transition-colors whitespace-nowrap ${
              aba === id
                ? 'border-[var(--gold)] text-[var(--gold)]'
                : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'
            }`}
          >
            {label}
          </button>
        ))}
        {plano.limites.conteudo_personalizado && (
          <button
            onClick={() => setAba('personalizado')}
            className={`px-4 py-2 text-xs font-cinzel border-b-2 transition-colors whitespace-nowrap ${
              aba === 'personalizado'
                ? 'border-[var(--accent2)] text-[var(--accent2)]'
                : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'
            }`}
          >
            ✨ Personalizado
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {aba === 'personalizado' && userId ? (
          <AbaPersonalizadoItens userId={userId} />
        ) : (
          <>
            {aba === 'magicos'      && <AbaMagicos {...abaProps} />}
            {aba === 'armas'        && <AbaArmas {...abaProps} />}
            {aba === 'armaduras'    && <AbaArmaduras {...abaProps} />}
            {aba === 'equipamentos' && <AbaEquipamentos {...abaProps} />}
          </>
        )}
      </div>
    </div>
  )
}
