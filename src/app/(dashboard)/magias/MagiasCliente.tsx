'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Spell } from '@/types/dnd'
import type { TipoDano } from '@/types/dnd'
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

const ESCOLAS = ['Abjuração', 'Adivinhação', 'Conjuração', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação']
const CLASSES = ['Bardo', 'Clérigo', 'Druida', 'Feiticeiro', 'Guardião', 'Mago', 'Paladino', 'Bruxo', 'Artífice']

// ─── Modal admin: Criar/Editar Magia (padrão do ModalAdminEditarMonstro) ────

// Escolas — mapeia a seleção única em PT para o par PT/EN gravado no banco
// (school_en é NOT NULL em spells), igual à derivação de classes_en abaixo.
const ESCOLAS_MAP: { pt: string; en: string }[] = [
  { pt: 'Abjuração', en: 'Abjuration' },
  { pt: 'Adivinhação', en: 'Divination' },
  { pt: 'Conjuração', en: 'Conjuration' },
  { pt: 'Encantamento', en: 'Enchantment' },
  { pt: 'Evocação', en: 'Evocation' },
  { pt: 'Ilusão', en: 'Illusion' },
  { pt: 'Necromancia', en: 'Necromancy' },
  { pt: 'Transmutação', en: 'Transmutation' },
]
function schoolEnPara(pt: string): string {
  return ESCOLAS_MAP.find(e => e.pt === pt)?.en ?? pt
}

// Classes conjuradoras — as 9 completas + as 2 subclasses parciais que já
// existem em espacos-magia.ts (CLASSE_CONJURADORA_MAP: Cavaleiro Arcano,
// Trapaceiro Arcano). "Patrulheiro" é o nome usado no resto do app (criação
// de personagem, espacos-magia.ts) — não "Guardião", que só aparece no
// filtro desta tela e não é a forma usada nos dados reais.
const CLASSES_CONJURADORAS: { pt: string; en: string }[] = [
  { pt: 'Bardo', en: 'Bard' },
  { pt: 'Bruxo', en: 'Warlock' },
  { pt: 'Clérigo', en: 'Cleric' },
  { pt: 'Druida', en: 'Druid' },
  { pt: 'Feiticeiro', en: 'Sorcerer' },
  { pt: 'Mago', en: 'Wizard' },
  { pt: 'Paladino', en: 'Paladin' },
  { pt: 'Patrulheiro', en: 'Ranger' },
  { pt: 'Artífice', en: 'Artificer' },
  { pt: 'Cavaleiro Arcano', en: 'Eldritch Knight' },
  { pt: 'Trapaceiro Arcano', en: 'Arcane Trickster' },
]

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

// Divide o classes_pt/classes_en existente em: classes reconhecidas (viram
// checkbox marcado) e o restante (texto que a tela não modela, mas que não
// pode ser apagado ao editar — preservado e reanexado ao salvar).
function parseClasses(existentePt?: string | null, existenteEn?: string | null) {
  const tokensPt = (existentePt ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const tokensEn = (existenteEn ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const conhecidosPt = new Set(CLASSES_CONJURADORAS.map(c => normalizar(c.pt)))
  const conhecidosEn = new Set(CLASSES_CONJURADORAS.map(c => normalizar(c.en)))
  const selecionadas = CLASSES_CONJURADORAS.filter(c => tokensPt.some(t => normalizar(t) === normalizar(c.pt))).map(c => c.pt)
  const leftoverPt = tokensPt.filter(t => !conhecidosPt.has(normalizar(t)))
  const leftoverEn = tokensEn.filter(t => !conhecidosEn.has(normalizar(t)))
  return { selecionadas, leftoverPt, leftoverEn }
}

// Tipo de dano — damage_type_pt grava o slug de TipoDano (ex: "fogo"), não o
// rótulo exibido, porque a batalha (MesaCliente) usa esse valor direto como
// TipoDano sem tradução (ver aplicarResistencias). damage_type_en é só
// informativo e vem deste mapa fixo (mesma correspondência que o bestiário
// já usa para monster_damage_modifiers).
const DANO_EN_MAP: Record<TipoDano, string> = {
  acido: 'acid', contundente: 'bludgeoning', cortante: 'slashing', eletrico: 'lightning',
  fogo: 'fire', forca: 'force', frio: 'cold', necrotico: 'necrotic', perfurante: 'piercing',
  psiquico: 'psychic', radiante: 'radiant', trovejante: 'thunder', veneno: 'poison',
}

const SAVE_ABILITY_OPCOES_MAGIA = [
  { value: '', label: '— Nenhuma —' },
  { value: 'for', label: 'Força' },
  { value: 'des', label: 'Destreza' },
  { value: 'con', label: 'Constituição' },
  { value: 'int', label: 'Inteligência' },
  { value: 'sab', label: 'Sabedoria' },
  { value: 'car', label: 'Carisma' },
]

const AOE_TIPOS_OPCOES = [
  { value: '', label: '— Nenhuma —' },
  { value: 'sphere', label: 'Esfera' },
  { value: 'cone', label: 'Cone' },
  { value: 'cube', label: 'Cubo' },
  { value: 'line', label: 'Linha' },
  { value: 'cylinder', label: 'Cilindro' },
  { value: 'radius', label: 'Raio ao redor de si' },
]

// D&D 5e PT-BR: 1,5 m por 5 pés (arredondamento do livro do jogador, não a
// conversão real de 0,3048 m/pé) — mesmo helper usado em BestiarioCliente.
function pesParaMetros(ft: number): number {
  return Math.round(ft * 0.3 * 10) / 10
}
function metrosParaPes(m: number): number {
  return Math.round(m / 0.3)
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

const MAGIA_VAZIA = {
  name_pt: '', name_en: '',
  level: 0,
  school_pt: 'Abjuração',
  casting_time_pt: '1 ação', casting_time_en: '',
  range_pt: '9 metros', range_en: '',
  components_pt: 'V, S', components_en: '',
  duration_pt: 'Instantânea', duration_en: '',
  concentration: false, ritual: false,
  description_pt: '', description_en: '',
  upcast_dice: '',
  damage_dice: '', damage_type_pt: '',
  damage2_dice: '', damage2_type_pt: '',
  heal_dice: '',
  save_ability: '', save_effect: '',
  attack_type: '', roller: '',
  conditions_applied_pt: '',
  aoe_type: '',
}

type MagiaForm = typeof MAGIA_VAZIA

const SECOES_MAGIA = [
  { id: 'basico', label: 'Básico' },
  { id: 'classes', label: 'Classes' },
  { id: 'descricao', label: 'Descrição' },
  { id: 'mecanica', label: 'Mecânica' },
] as const

type SecaoMagia = typeof SECOES_MAGIA[number]['id']

const CAMPOS_OBRIGATORIOS_MAGIA: { chave: keyof MagiaForm; secao: SecaoMagia; rotulo: string }[] = [
  { chave: 'name_pt', secao: 'basico', rotulo: 'Nome PT' },
  { chave: 'name_en', secao: 'basico', rotulo: 'Nome EN' },
  { chave: 'description_pt', secao: 'descricao', rotulo: 'Descrição PT' },
]

function validarObrigatoriosMagia(b: MagiaForm) {
  return CAMPOS_OBRIGATORIOS_MAGIA.filter(c => !String(b[c.chave]).trim())
}

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

type SpellStub = Pick<Spell, 'id' | 'slug' | 'name_pt' | 'name_en' | 'level' | 'school_pt' | 'casting_time_pt' | 'classes_pt' | 'concentration' | 'ritual' | 'criado_por'>

function ModalAdminEditarMagia({ modo, magia, criadoPor, campanhaId, onClose, onSaved }: {
  modo: 'criar' | 'editar'
  magia?: Spell
  criadoPor?: string
  campanhaId?: string | null
  onClose: () => void
  onSaved: (m: Spell) => void
}) {
  const lbl = "text-[var(--text3)] text-[9px] font-cinzel uppercase"
  const inp = "w-full input-dd text-sm mt-0.5"

  const dadosIniciais: MagiaForm = modo === 'editar' && magia ? {
    name_pt: magia.name_pt, name_en: magia.name_en,
    level: magia.level,
    school_pt: magia.school_pt ?? 'Abjuração',
    casting_time_pt: magia.casting_time_pt ?? '', casting_time_en: magia.casting_time_en ?? '',
    range_pt: magia.range_pt ?? '', range_en: magia.range_en ?? '',
    components_pt: magia.components_pt ?? '', components_en: magia.components_en ?? '',
    duration_pt: magia.duration_pt ?? '', duration_en: magia.duration_en ?? '',
    concentration: magia.concentration, ritual: magia.ritual,
    description_pt: magia.description_pt ?? '', description_en: magia.description_en ?? '',
    upcast_dice: magia.upcast_dice ?? '',
    damage_dice: magia.damage_dice ?? '', damage_type_pt: magia.damage_type_pt ?? '',
    damage2_dice: magia.damage2_dice ?? '', damage2_type_pt: magia.damage2_type_pt ?? '',
    heal_dice: magia.heal_dice ?? '',
    save_ability: magia.save_ability ?? '', save_effect: magia.save_effect ?? '',
    attack_type: magia.attack_type ?? '', roller: magia.roller ?? '',
    conditions_applied_pt: magia.conditions_applied_pt ?? '',
    aoe_type: magia.aoe_type ?? '',
  } : MAGIA_VAZIA

  const [secao, setSecao] = useState<SecaoMagia>('basico')
  const [salvando, setSalvando] = useState(false)
  const [visivelJogadores, setVisivelJogadores] = useState(magia?.visivel_jogadores ?? true)
  const [sufixoSlug] = useState(() => gerarSufixoAleatorio())
  const [camposInvalidos, setCamposInvalidos] = useState<Set<string>>(new Set())
  const [basico, setBasico] = useState<MagiaForm>(dadosIniciais)

  useEffect(() => { setCamposInvalidos(new Set()) }, [basico])

  const slugGerado = `${gerarSlugBase(basico.name_en) || 'magia'}-${sufixoSlug}`
  const campoInvalido = (chave: string) => cn(inp, camposInvalidos.has(chave) && 'border-[var(--red2)]')

  const classesIniciais = useState(() => parseClasses(magia?.classes_pt, magia?.classes_en))[0]
  const [classesSelecionadas, setClassesSelecionadas] = useState<string[]>(classesIniciais.selecionadas)

  const [aoeFt, setAoeFt] = useState<number | null>(magia?.aoe_size_ft ?? null)
  const [aoeTexto, setAoeTexto] = useState<string | undefined>(undefined)
  function valorAoe(): string {
    if (aoeTexto !== undefined) return aoeTexto
    return aoeFt != null ? formatarMetros(aoeFt) : ''
  }
  function confirmarAoe() {
    if (aoeTexto === undefined) return
    const metros = parseMetros(aoeTexto)
    setAoeFt(metros !== null ? metrosParaPes(metros) : null)
    setAoeTexto(undefined)
  }
  function aoeFtFinal(): number | null {
    if (aoeTexto !== undefined) {
      const metros = parseMetros(aoeTexto)
      return metros !== null ? metrosParaPes(metros) : null
    }
    return aoeFt
  }

  async function salvar() {
    const faltando = validarObrigatoriosMagia(basico)
    if (faltando.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${faltando.map(f => f.rotulo).join(', ')}`)
      setSecao(faltando[0].secao)
      setCamposInvalidos(new Set(faltando.map(f => f.chave)))
      return
    }

    setSalvando(true)
    const supabase = createClient()

    const classesPtFinal = [...classesSelecionadas, ...classesIniciais.leftoverPt].join(', ')
    const classesEnFinal = [
      ...classesSelecionadas.map(pt => CLASSES_CONJURADORAS.find(c => c.pt === pt)?.en ?? pt),
      ...classesIniciais.leftoverEn,
    ].join(', ')

    const payload: Record<string, unknown> = {
      name_pt: basico.name_pt.trim(),
      name_en: basico.name_en.trim(),
      level: Number(basico.level),
      school_pt: basico.school_pt,
      school_en: schoolEnPara(basico.school_pt),
      casting_time_pt: basico.casting_time_pt.trim() || '1 ação',
      casting_time_en: basico.casting_time_en.trim() || basico.casting_time_pt.trim() || '1 action',
      range_pt: basico.range_pt.trim() || '9 metros',
      range_en: basico.range_en.trim() || basico.range_pt.trim() || '30 feet',
      components_pt: basico.components_pt.trim() || 'V, S',
      components_en: basico.components_en.trim() || basico.components_pt.trim() || 'V, S',
      duration_pt: basico.duration_pt.trim() || 'Instantânea',
      duration_en: basico.duration_en.trim() || basico.duration_pt.trim() || 'Instantaneous',
      concentration: basico.concentration,
      ritual: basico.ritual,
      description_pt: basico.description_pt.trim(),
      description_en: basico.description_en.trim() || basico.description_pt.trim(),
      classes_pt: classesPtFinal,
      classes_en: classesEnFinal,
      upcast_dice: basico.upcast_dice.trim() || null,
      damage_dice: basico.damage_dice.trim() || null,
      damage_type_pt: basico.damage_type_pt || null,
      damage_type_en: basico.damage_type_pt ? (DANO_EN_MAP[basico.damage_type_pt as TipoDano] ?? null) : null,
      damage2_dice: basico.damage2_dice.trim() || null,
      damage2_type_pt: basico.damage2_type_pt || null,
      damage2_type_en: basico.damage2_type_pt ? (DANO_EN_MAP[basico.damage2_type_pt as TipoDano] ?? null) : null,
      heal_dice: basico.heal_dice.trim() || null,
      save_ability: basico.save_ability || null,
      save_effect: basico.save_effect.trim() || null,
      attack_type: basico.attack_type.trim() || null,
      roller: basico.roller.trim() || null,
      conditions_applied_pt: basico.conditions_applied_pt.trim() || null,
      aoe_type: basico.aoe_type || null,
      aoe_size_ft: aoeFtFinal(),
    }

    if (modo === 'editar') {
      const mid = magia!.id
      const { data, error } = await supabase.from('spells').update({
        ...payload,
        ...(magia!.criado_por ? { visivel_jogadores: visivelJogadores } : {}),
      }).eq('id', mid).select('*').single()
      if (error) { toast.error(error.message); setSalvando(false); return }
      toast.success('Magia atualizada!')
      onSaved(data as Spell)
    } else {
      const dadosCriacao = {
        ...payload,
        slug: slugGerado,
        criado_por: criadoPor,
        campanha_id: campanhaId,
        visivel_jogadores: visivelJogadores,
      }
      const { data, error } = await supabase.from('spells').insert(dadosCriacao).select('*').single()
      if (error || !data) { toast.error(error?.message ?? 'Erro ao criar magia'); setSalvando(false); return }
      toast.success('Magia criada!')
      onSaved(data as Spell)
    }

    setSalvando(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="font-cinzel text-[var(--accent2)] font-bold">
            {modo === 'criar' ? '✨ Criar Magia' : `✏️ Editar — ${magia?.name_pt}`}
          </h2>
          <button onClick={onClose} className="text-[var(--border)] hover:text-[var(--red2)]"><X className="w-4 h-4" /></button>
        </div>

        {/* Formulário denso demais para telas pequenas — no mobile só o aviso. */}
        <div className="flex md:hidden flex-col items-center justify-center flex-1 p-8 text-center">
          <p className="font-cinzel text-[var(--accent2)] text-base mb-1">🖥️ Melhor no computador</p>
          <p className="text-[var(--text3)] text-sm font-crimson max-w-xs">
            {modo === 'criar' ? 'Criar' : 'Editar'} magia usa um formulário grande, feito para telas maiores.
            Abra no notebook ou tablet para usar.
          </p>
        </div>

        <div className="hidden md:contents">
          <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex overflow-x-auto flex-shrink-0">
            {SECOES_MAGIA.map(s => (
              <button
                key={s.id}
                onClick={() => setSecao(s.id)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-cinzel border-b-2 transition-colors whitespace-nowrap",
                  secao === s.id ? 'border-[var(--accent2)] text-[var(--accent2)]' : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'
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
                {(modo === 'criar' || magia?.criado_por) && (
                  <div className="flex items-center gap-4 p-3 rounded border border-[var(--accent2)]/30 bg-[var(--accent2)]/5">
                    <div className="flex-1">
                      <label className={lbl}>Slug (gerado automaticamente)</label>
                      <p className="text-[var(--text2)] text-sm font-mono mt-0.5">{modo === 'criar' ? slugGerado : magia?.slug}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={visivelJogadores}
                        onChange={e => setVisivelJogadores(e.target.checked)}
                        className="accent-[var(--accent2)]"
                      />
                      <span className="font-cinzel text-sm text-[var(--text2)]">Visível para jogadores</span>
                    </label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Nome PT <span className="text-[var(--red2)]">*</span></label><input className={campoInvalido('name_pt')} value={basico.name_pt} onChange={e => setBasico(b => ({ ...b, name_pt: e.target.value }))} /></div>
                  <div><label className={lbl}>Nome EN <span className="text-[var(--red2)]">*</span></label><input className={campoInvalido('name_en')} value={basico.name_en} onChange={e => setBasico(b => ({ ...b, name_en: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Nível</label>
                    <select className={inp} value={basico.level} onChange={e => setBasico(b => ({ ...b, level: parseInt(e.target.value) }))}>
                      <option value={0}>Truque</option>
                      {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}º Nível</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Escola</label>
                    <select className={inp} value={basico.school_pt} onChange={e => setBasico(b => ({ ...b, school_pt: e.target.value }))}>
                      {ESCOLAS_MAP.map(e => <option key={e.pt} value={e.pt}>{e.pt}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Tempo de Conjuração (PT)</label><input className={inp} value={basico.casting_time_pt} onChange={e => setBasico(b => ({ ...b, casting_time_pt: e.target.value }))} /></div>
                  <div><label className={lbl}>Tempo de Conjuração (EN)</label><input className={inp} value={basico.casting_time_en} onChange={e => setBasico(b => ({ ...b, casting_time_en: e.target.value }))} placeholder="(opcional — espelha o PT)" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Alcance (PT)</label><input className={inp} value={basico.range_pt} onChange={e => setBasico(b => ({ ...b, range_pt: e.target.value }))} /></div>
                  <div><label className={lbl}>Alcance (EN)</label><input className={inp} value={basico.range_en} onChange={e => setBasico(b => ({ ...b, range_en: e.target.value }))} placeholder="(opcional — espelha o PT)" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Componentes (PT)</label><input className={inp} value={basico.components_pt} onChange={e => setBasico(b => ({ ...b, components_pt: e.target.value }))} /></div>
                  <div><label className={lbl}>Componentes (EN)</label><input className={inp} value={basico.components_en} onChange={e => setBasico(b => ({ ...b, components_en: e.target.value }))} placeholder="(opcional — espelha o PT)" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Duração (PT)</label><input className={inp} value={basico.duration_pt} onChange={e => setBasico(b => ({ ...b, duration_pt: e.target.value }))} /></div>
                  <div><label className={lbl}>Duração (EN)</label><input className={inp} value={basico.duration_en} onChange={e => setBasico(b => ({ ...b, duration_en: e.target.value }))} placeholder="(opcional — espelha o PT)" /></div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={basico.concentration} onChange={e => setBasico(b => ({ ...b, concentration: e.target.checked }))} className="accent-[var(--accent2)]" />
                    <span className="font-cinzel text-sm text-[var(--text2)]">Concentração</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={basico.ritual} onChange={e => setBasico(b => ({ ...b, ritual: e.target.checked }))} className="accent-[var(--accent2)]" />
                    <span className="font-cinzel text-sm text-[var(--text2)]">Ritual</span>
                  </label>
                </div>
              </>
            )}

            {/* ── CLASSES ── */}
            {secao === 'classes' && (
              <div>
                <p className="text-[var(--text3)] text-xs font-cinzel mb-3">Selecione as classes que podem conjurar esta magia.</p>
                <div className="grid grid-cols-2 gap-2">
                  {CLASSES_CONJURADORAS.map(c => (
                    <label key={c.pt} className="flex items-center gap-2 cursor-pointer p-2 rounded border border-transparent hover:border-[var(--border)]">
                      <input
                        type="checkbox"
                        checked={classesSelecionadas.includes(c.pt)}
                        onChange={e => setClassesSelecionadas(prev => e.target.checked ? [...prev, c.pt] : prev.filter(x => x !== c.pt))}
                        className="accent-[var(--accent2)]"
                      />
                      <span className="text-sm text-[var(--text2)] font-crimson">{c.pt}</span>
                    </label>
                  ))}
                </div>
                {classesIniciais.leftoverPt.length > 0 && (
                  <p className="text-[var(--text3)] text-xs font-crimson mt-3">
                    Também gravado (fora da lista acima, preservado do dado original): {classesIniciais.leftoverPt.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* ── DESCRIÇÃO ── */}
            {secao === 'descricao' && (
              <>
                <div>
                  <label className={lbl}>Descrição PT <span className="text-[var(--red2)]">*</span></label>
                  <textarea rows={8} className={cn(campoInvalido('description_pt'), 'resize-none')} value={basico.description_pt} onChange={e => setBasico(b => ({ ...b, description_pt: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Descrição EN</label>
                  <textarea rows={6} className={cn(inp, 'resize-none')} value={basico.description_en} onChange={e => setBasico(b => ({ ...b, description_en: e.target.value }))} placeholder="(opcional — espelha o PT)" />
                </div>
                <div>
                  <label className={lbl}>Em Nível Superior (upcast)</label>
                  <textarea rows={3} className={cn(inp, 'resize-none')} value={basico.upcast_dice} onChange={e => setBasico(b => ({ ...b, upcast_dice: e.target.value }))} />
                </div>
              </>
            )}

            {/* ── MECÂNICA ── */}
            {secao === 'mecanica' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Dado de Dano</label><input className={inp} value={basico.damage_dice} onChange={e => setBasico(b => ({ ...b, damage_dice: e.target.value }))} placeholder="8d6" /></div>
                  <div>
                    <label className={lbl}>Tipo de Dano</label>
                    <select className={inp} value={basico.damage_type_pt} onChange={e => setBasico(b => ({ ...b, damage_type_pt: e.target.value }))}>
                      <option value="">— Nenhum —</option>
                      {TIPOS_DANO.map(t => <option key={t.id} value={t.id}>{t.icone} {t.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Dado de Dano 2</label><input className={inp} value={basico.damage2_dice} onChange={e => setBasico(b => ({ ...b, damage2_dice: e.target.value }))} /></div>
                  <div>
                    <label className={lbl}>Tipo de Dano 2</label>
                    <select className={inp} value={basico.damage2_type_pt} onChange={e => setBasico(b => ({ ...b, damage2_type_pt: e.target.value }))}>
                      <option value="">— Nenhum —</option>
                      {TIPOS_DANO.map(t => <option key={t.id} value={t.id}>{t.icone} {t.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className={lbl}>Dado de Cura</label><input className={inp} value={basico.heal_dice} onChange={e => setBasico(b => ({ ...b, heal_dice: e.target.value }))} placeholder="2d8+3" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Atributo de Resistência</label>
                    <select className={inp} value={basico.save_ability} onChange={e => setBasico(b => ({ ...b, save_ability: e.target.value }))}>
                      {SAVE_ABILITY_OPCOES_MAGIA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Efeito da Resistência</label><input className={inp} value={basico.save_effect} onChange={e => setBasico(b => ({ ...b, save_effect: e.target.value }))} placeholder="Metade do dano no sucesso" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Tipo de Ataque</label><input className={inp} value={basico.attack_type} onChange={e => setBasico(b => ({ ...b, attack_type: e.target.value }))} placeholder="ranged_spell" /></div>
                  <div><label className={lbl}>Roller</label><input className={inp} value={basico.roller} onChange={e => setBasico(b => ({ ...b, roller: e.target.value }))} /></div>
                </div>
                <div><label className={lbl}>Condições Aplicadas</label><input className={inp} value={basico.conditions_applied_pt} onChange={e => setBasico(b => ({ ...b, conditions_applied_pt: e.target.value }))} placeholder="Amedrontado" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Área de Efeito</label>
                    <select className={inp} value={basico.aoe_type} onChange={e => setBasico(b => ({ ...b, aoe_type: e.target.value }))}>
                      {AOE_TIPOS_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Tamanho da Área (m)</label>
                    <input
                      className={inp}
                      inputMode="decimal"
                      placeholder="6"
                      value={valorAoe()}
                      onChange={e => setAoeTexto(e.target.value)}
                      onBlur={confirmarAoe}
                    />
                  </div>
                </div>
              </>
            )}

          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors">Cancelar</button>
            <button
              onClick={salvar}
              disabled={salvando || !basico.name_pt.trim()}
              className="px-4 py-1.5 text-xs font-cinzel text-[var(--accent2)] bg-[var(--surface)] border border-[var(--accent2)]/50 rounded hover:bg-[var(--accent2)]/10 transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : modo === 'criar' ? '✨ Criar Magia' : '💾 Salvar Tudo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MagiasCliente() {
  const [userPlano, setUserPlano] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [lista, setLista] = useState<SpellStub[]>([])
  const [selecionada, setSelecionada] = useState<Spell | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [busca, setBusca] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<number | ''>('')
  const [filtroEscola, setFiltroEscola] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [modalMagiaAberto, setModalMagiaAberto] = useState<'criar' | 'editar' | null>(null)
  const [nomesAutores, setNomesAutores] = useState<Record<string, string>>({})
  const { ehDM } = usePermissao()
  const { campanhaAtiva, papelPorCampanha } = useCampanha()

  const dmDaCampanhaAtiva = !!campanhaAtiva && papelPorCampanha[campanhaAtiva.id] === 'dm'
  const podeCriarMagia = isAdmin || dmDaCampanhaAtiva

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

  useEffect(() => {
    if (!userPlano || !getPlano(userPlano).limites.magias_itens) return
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      let query = supabase
        .from('spells')
        .select('id, slug, name_pt, name_en, level, school_pt, casting_time_pt, classes_pt, concentration, ritual, criado_por')
        .order('level')
        .order('name_pt')
      if (!campanhaAtiva?.id) {
        query = query.is('criado_por', null)
      } else if (ehDM) {
        query = query.or(`criado_por.is.null,campanha_id.eq.${campanhaAtiva.id}`)
      } else {
        query = query.or(`criado_por.is.null,and(campanha_id.eq.${campanhaAtiva.id},visivel_jogadores.eq.true)`)
      }
      const { data } = await query
      setLista((data ?? []) as SpellStub[])
      setCarregando(false)
    }
    carregar()
  }, [userPlano, campanhaAtiva?.id, ehDM])

  useEffect(() => {
    const idsAutores = Array.from(new Set(lista.map(m => m.criado_por).filter((id): id is string => !!id)))
    if (idsAutores.length === 0) { setNomesAutores({}); return }
    const supabase = createClient()
    supabase.from('profiles').select('id, nome, username').in('id', idsAutores).then(({ data }) => {
      const mapa: Record<string, string> = {}
      for (const p of data ?? []) {
        mapa[p.id as string] = (p.nome as string | null) ?? (p.username as string | null) ?? 'Mestre'
      }
      setNomesAutores(mapa)
    })
  }, [lista])

  async function selecionarMagia(stub: SpellStub) {
    if (selecionada?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase.from('spells').select('*').eq('id', stub.id).single()
    setSelecionada(data as Spell)
    setCarregandoDetalhe(false)
    setVisao('detalhe')
  }

  function magiaSalva(m: Spell) {
    setSelecionada(m)
    const stub: SpellStub = {
      id: m.id, slug: m.slug, name_pt: m.name_pt, name_en: m.name_en,
      level: m.level, school_pt: m.school_pt, casting_time_pt: m.casting_time_pt,
      classes_pt: m.classes_pt, concentration: m.concentration, ritual: m.ritual,
      criado_por: m.criado_por ?? null,
    }
    setLista(prev => {
      const existe = prev.some(p => p.id === m.id)
      const proxima = existe ? prev.map(p => p.id === m.id ? stub : p) : [...prev, stub]
      return proxima.sort((a, b) => a.level - b.level || a.name_pt.localeCompare(b.name_pt, 'pt-BR'))
    })
  }

  async function tornarPadrao(m: Spell) {
    if (!confirm(`Tornar "${m.name_pt}" uma magia padrão? Ela deixará de ser exclusiva desta campanha e passará a aparecer para todas as campanhas.`)) return
    const faltando: string[] = []
    if (!m.name_en?.trim()) faltando.push('Nome EN')
    if (!m.school_pt?.trim()) faltando.push('Escola')
    if (!m.classes_pt?.trim()) faltando.push('Classes')
    if (!m.description_pt?.trim()) faltando.push('Descrição')
    if (faltando.length > 0) {
      toast.error(`Preencha antes de tornar padrão: ${faltando.join(', ')}`)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase.from('spells').update({ criado_por: null, campanha_id: null }).eq('id', m.id).select('*').single()
    if (error) { toast.error(error.message); return }
    toast.success(`"${m.name_pt}" agora é uma magia padrão!`)
    magiaSalva(data as Spell)
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

  const filtrosMagia = (
    <>
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
    </>
  )

  if (userPlano === null) return null

  const plano = getPlano(userPlano)

  if (!plano.limites.magias_itens) {
    return <BloqueioPlano recurso="Magias" planoNecessario="Herói" />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
          <div className="flex flex-col md:flex-row h-full gap-0 md:gap-4">
            <div className={cn(
              "flex flex-col gap-4 w-full md:w-72 overflow-y-auto border-r border-[var(--border)]",
              visao === 'detalhe' ? "hidden md:flex" : "flex"
            )}>
              <div className="p-3 border-b border-[var(--border)] space-y-2">
                {podeCriarMagia && (
                  <button
                    onClick={() => setModalMagiaAberto('criar')}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Criar Magia
                  </button>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
                    <input
                      type="text"
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar magia (PT ou EN)..."
                      className="w-full input-dd pl-9 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setFiltrosAbertos(true)}
                    className="md:hidden flex-shrink-0 w-9 h-9 rounded border border-[var(--border)] flex items-center justify-center text-[var(--text2)] hover:border-[var(--border2)] transition-colors"
                    title="Filtros"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <div className="hidden md:block space-y-2">{filtrosMagia}</div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {carregando ? (
                  <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando magias...</div>
                ) : filtradas.length === 0 ? (
                  <div className="p-4 text-center text-[var(--border)] text-sm">Nenhuma magia encontrada</div>
                ) : (
                  filtradas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => selecionarMagia(m)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                        selecionada?.id === m.id ? 'bg-[var(--surface)] border-[var(--gold)]/40' : 'border-[var(--border)]/50 hover:border-[var(--border2)] hover:bg-[var(--bg3)]'
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">
                            {m.name_pt}
                          </span>
                          {m.criado_por && (
                            <span
                              className="text-[var(--gold)] text-[9px] flex-shrink-0"
                              title={`Criado por ${nomesAutores[m.criado_por] ?? 'Mestre'}`}
                            >
                              ✦
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--dd-text2)] truncate">
                          {m.school_pt} · Nível {m.level}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Filtros — folha inferior no mobile */}
              {filtrosAbertos && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setFiltrosAbertos(false)} />
                  <div className="fixed inset-x-0 bottom-0 above-bottomnav z-50 md:hidden bg-[var(--bg2)] border-t border-[var(--border)] rounded-t-xl shadow-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-cinzel text-xs text-[var(--text3)] uppercase tracking-wider">Filtros</span>
                      <button onClick={() => setFiltrosAbertos(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">{filtrosMagia}</div>
                    <button
                      onClick={() => setFiltrosAbertos(false)}
                      className="w-full py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded font-cinzel text-sm transition-opacity"
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}

              <div className="p-2 border-t border-[var(--border)] text-center">
                <p className="text-[var(--text3)] text-xs font-cinzel">{filtradas.length} de {lista.length} magia(s)</p>
              </div>
            </div>

            <div className={cn(
              "flex-1 overflow-y-auto p-4",
              visao === 'lista' ? "hidden md:block" : "block"
            )}>
              <button
                onClick={() => setVisao('lista')}
                className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)] hover:text-[var(--dd-text)] mb-4 transition-colors"
              >
                ← Voltar às Magias
              </button>
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
                  <div className="mb-4 flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h2 className="font-cinzel text-[var(--accent2)] text-2xl font-bold">{selecionada.name_pt}</h2>
                        {selecionada.criado_por && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] rounded font-cinzel">
                            ✦ Criado por {nomesAutores[selecionada.criado_por] ?? 'Mestre'}
                          </span>
                        )}
                      </div>
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
                    <div className="flex items-center gap-2">
                      {isAdmin && selecionada.criado_por && (
                        <button
                          onClick={() => tornarPadrao(selecionada)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] rounded text-sm font-cinzel hover:bg-[var(--gold)]/20 transition-colors"
                          title="Tornar esta magia padrão para todas as campanhas"
                        >
                          <Star className="w-3.5 h-3.5" /> Tornar padrão
                        </button>
                      )}
                      {(isAdmin || (!!userId && selecionada.criado_por === userId)) && (
                        <button
                          onClick={() => setModalMagiaAberto('editar')}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text2)] rounded text-sm font-cinzel hover:bg-[var(--surface)] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                      )}
                      <BotaoReportar
                        itemSlug={selecionada.slug}
                        itemNome={selecionada.name_pt}
                        itemTipo="magia"
                        pagina="/magias"
                      />
                      <BotaoAdicionarPersonagem
                        tipo="magia"
                        nome={selecionada.name_pt}
                        dadosExtras={{ spell_id: selecionada.id, nivel: selecionada.level, escola: selecionada.school_pt }}
                      />
                    </div>
                  </div>

                  <PainelGrimorio compacto className="mb-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-crimson">
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
      </div>

      {modalMagiaAberto === 'editar' && selecionada && (
        <ModalAdminEditarMagia
          modo="editar"
          magia={selecionada}
          onClose={() => setModalMagiaAberto(null)}
          onSaved={magiaSalva}
        />
      )}
      {modalMagiaAberto === 'criar' && userId && (
        <ModalAdminEditarMagia
          modo="criar"
          criadoPor={userId}
          campanhaId={campanhaAtiva?.id ?? null}
          onClose={() => setModalMagiaAberto(null)}
          onSaved={(m) => { magiaSalva(m); setVisao('detalhe') }}
        />
      )}
    </div>
  )
}
