'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Monster, MonsterDetailed, MonsterAction } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { useBatalha } from '@/store/batalha'
import { calcularModificadorAtributo, formatarModificador, cn } from '@/lib/utils'
import { Search, Swords, Plus, X, Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { BotaoReportar } from '@/components/ui/BotaoReportar'
import { getPlano } from '@/lib/planos'

const CRS = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '23', '24', '30']

type MonsterStub = Pick<Monster, 'id' | 'slug' | 'name_pt' | 'name_en' | 'type_pt' | 'challenge_rating' | 'armor_class' | 'hit_points'>

interface MonstroPersonalizado {
  id: string
  nome: string
  dados: {
    tipo: string
    cr: string
    ca: number
    pv: number
    forca: number
    destreza: number
    constituicao: number
    inteligencia: number
    sabedoria: number
    carisma: number
    habilidades: string
    acoes: string
    descricao: string
  }
}

const FORM_INICIAL = {
  nome: '', tipo: 'Humanóide', cr: '1',
  ca: 12, pv: 10,
  forca: 10, destreza: 10, constituicao: 10,
  inteligencia: 10, sabedoria: 10, carisma: 10,
  habilidades: '', acoes: '', descricao: '',
}

function AbaPersonalizadoBestiario({ userId }: { userId: string }) {
  const [lista, setLista] = useState<MonstroPersonalizado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<MonstroPersonalizado | null>(null)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const { adicionarCombatente } = useBatalha()

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('conteudo_personalizado')
        .select('id, nome, dados')
        .eq('user_id', userId)
        .eq('tipo', 'monstro')
        .order('nome')
      setLista((data ?? []) as MonstroPersonalizado[])
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
        tipo: 'monstro',
        nome: form.nome.trim(),
        dados: {
          tipo: form.tipo, cr: form.cr, ca: form.ca, pv: form.pv,
          forca: form.forca, destreza: form.destreza, constituicao: form.constituicao,
          inteligencia: form.inteligencia, sabedoria: form.sabedoria, carisma: form.carisma,
          habilidades: form.habilidades, acoes: form.acoes, descricao: form.descricao,
        },
        publico: false,
      }).select('id, nome, dados').single()
      if (error) throw error
      setLista(l => [...l, data as MonstroPersonalizado].sort((a, b) => a.nome.localeCompare(b.nome)))
      setModalAberto(false)
      setForm(FORM_INICIAL)
      toast.success(`Monstro "${form.nome.trim()}" criado!`)
    } catch {
      toast.error('Erro ao salvar monstro')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o monstro "${nome}"?`)) return
    const supabase = createClient()
    await supabase.from('conteudo_personalizado').delete().eq('id', id)
    setLista(l => l.filter(m => m.id !== id))
    if (selecionado?.id === id) { setSelecionado(null); setVisao('lista') }
    toast.success('Monstro excluído')
  }

  function adicionarNaBatalha(m: MonstroPersonalizado) {
    adicionarCombatente({
      personagem_id: null,
      nome: m.nome,
      tipo: 'monstro',
      iniciativa: 0,
      ca: m.dados.ca || 10,
      pv_maximo: m.dados.pv || 1,
      pv_atual: m.dados.pv || 1,
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
        cr: m.dados.cr,
        tipo: m.dados.tipo,
        habilidades: m.dados.habilidades,
        acoes: m.dados.acoes,
        forca: m.dados.forca,
        destreza: m.dados.destreza,
        constituicao: m.dados.constituicao,
        inteligencia: m.dados.inteligencia,
        sabedoria: m.dados.sabedoria,
        carisma: m.dados.carisma,
        xp: undefined,
        slug: m.id,
      },
      ordem: 999,
    })
    toast.success(`${m.nome} adicionado à batalha!`)
  }

  const atrs = selecionado ? [
    { label: 'FOR', val: selecionado.dados.forca },
    { label: 'DES', val: selecionado.dados.destreza },
    { label: 'CON', val: selecionado.dados.constituicao },
    { label: 'INT', val: selecionado.dados.inteligencia },
    { label: 'SAB', val: selecionado.dados.sabedoria },
    { label: 'CAR', val: selecionado.dados.carisma },
  ] : []

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <div className={cn(
          "flex flex-col border-r border-[var(--bg3)] overflow-y-auto w-full md:w-80",
          visao === 'detalhe' ? "hidden md:flex" : "flex"
        )}>
          <div className="p-3 border-b border-[var(--border)]">
            <button
              onClick={() => setModalAberto(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 text-[var(--accent2)] rounded text-sm font-cinzel hover:bg-[var(--accent2)]/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Criar Novo Monstro
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="p-4 text-center text-[var(--text3)] text-sm animate-pulse">Carregando...</div>
            ) : lista.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[var(--border)] text-sm font-cinzel mb-1">Nenhum monstro personalizado</p>
                <p className="text-[var(--text3)] text-xs font-crimson">Crie seus próprios monstros homebrew</p>
              </div>
            ) : (
              lista.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelecionado(m); setVisao('detalhe') }}
                  className={`w-full text-left px-3 py-2 border-b border-[var(--bg3)] transition-colors ${selecionado?.id === m.id ? 'bg-[var(--surface)]' : 'hover:bg-[var(--bg3)]'}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">{m.nome}</span>
                    <span className="text-xs text-[var(--dd-text2)] truncate">{m.dados.tipo} · CR {m.dados.cr}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="p-2 border-t border-[var(--border)] text-center">
            <p className="text-[var(--text3)] text-xs font-cinzel">{lista.length} monstro(s) personalizado(s)</p>
          </div>
        </div>

        <div className={cn(
          "overflow-y-auto p-4 md:p-6 bg-[var(--bg)] w-full md:flex-1",
          visao === 'lista' ? "hidden md:block" : "block"
        )}>
          <button onClick={() => setVisao('lista')} className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)] hover:text-[var(--dd-text)] mb-4 transition-colors">
            ← Voltar ao Bestiário
          </button>
          {!selecionado ? (
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
                  <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold leading-tight">{selecionado.nome}</h2>
                  <p className="text-[var(--text2)] text-sm mt-1">{selecionado.dados.tipo} · CR {selecionado.dados.cr}</p>
                  <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">✨ Personalizado</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => excluir(selecionado.id, selecionado.nome)}
                    className="p-2 text-[var(--red2)] hover:bg-[var(--red2)]/10 rounded transition-colors"
                    title="Excluir monstro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => adicionarNaBatalha(selecionado)}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] border border-[var(--accent2)] text-[var(--bg)] rounded text-sm font-cinzel hover:opacity-90 transition-colors"
                  >
                    <Swords className="w-4 h-4" /> Adicionar à Batalha
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <PainelGrimorio compacto className="text-center">
                  <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Classe de Armadura</div>
                  <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.dados.ca}</div>
                </PainelGrimorio>
                <PainelGrimorio compacto className="text-center">
                  <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Pontos de Vida</div>
                  <div className="text-[var(--green2)] text-xl font-cinzel font-bold">{selecionado.dados.pv}</div>
                </PainelGrimorio>
                <PainelGrimorio compacto className="text-center">
                  <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Nível de Desafio</div>
                  <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{selecionado.dados.cr}</div>
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

              {selecionado.dados.habilidades && (
                <PainelGrimorio titulo="Habilidades Especiais" compacto className="mb-3">
                  <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.habilidades}</p>
                </PainelGrimorio>
              )}
              {selecionado.dados.acoes && (
                <PainelGrimorio titulo="Ações" compacto className="mb-3">
                  <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.acoes}</p>
                </PainelGrimorio>
              )}
              {selecionado.dados.descricao && (
                <PainelGrimorio titulo="Descrição" compacto>
                  <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">{selecionado.dados.descricao}</p>
                </PainelGrimorio>
              )}
            </div>
          )}
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="font-cinzel text-[var(--gold)] font-bold">✨ Novo Monstro</h2>
              <button onClick={() => setModalAberto(false)} className="text-[var(--border)] hover:text-[var(--red2)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nome *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Goblin das Sombras..." className="w-full input-dd mt-1" autoFocus />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Tipo</label>
                  <input type="text" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="w-full input-dd mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">CR</label>
                  <input type="text" value={form.cr} onChange={e => setForm(f => ({ ...f, cr: e.target.value }))} className="w-full input-dd mt-1 text-sm" placeholder="1" />
                </div>
                <div></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Classe de Armadura</label>
                  <input type="number" min={0} max={30} value={form.ca} onChange={e => setForm(f => ({ ...f, ca: parseInt(e.target.value) || 0 }))} className="w-full input-dd mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Pontos de Vida</label>
                  <input type="number" min={1} value={form.pv} onChange={e => setForm(f => ({ ...f, pv: parseInt(e.target.value) || 1 }))} className="w-full input-dd mt-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Atributos</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([
                    { key: 'forca',        label: 'FOR' },
                    { key: 'destreza',     label: 'DES' },
                    { key: 'constituicao', label: 'CON' },
                    { key: 'inteligencia', label: 'INT' },
                    { key: 'sabedoria',    label: 'SAB' },
                    { key: 'carisma',      label: 'CAR' },
                  ] as const).map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[var(--text3)] text-[9px] font-cinzel">{label}</label>
                      <input
                        type="number" min={1} max={30}
                        value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 10 }))}
                        className="w-full input-dd mt-0.5 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Habilidades Especiais</label>
                <textarea value={form.habilidades} onChange={e => setForm(f => ({ ...f, habilidades: e.target.value }))} rows={3} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Visão no Escuro. Este monstro..." />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Ações</label>
                <textarea value={form.acoes} onChange={e => setForm(f => ({ ...f, acoes: e.target.value }))} rows={3} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Mordida. Ataque corpo a corpo..." />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} className="w-full input-dd mt-1 text-sm resize-none" placeholder="Lore e aparência do monstro..." />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setModalAberto(false)} className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors">Cancelar</button>
                <button
                  onClick={salvar}
                  disabled={!form.nome.trim() || salvando}
                  className="px-3 py-1.5 text-xs font-cinzel text-[var(--gold)] bg-[var(--surface)] border border-[#d4a843]/50 rounded hover:bg-[#d4a843]/10 transition-colors disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Criar Monstro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Helpers para exibição estruturada ────────────────────────────────────

function ftParaM(ft: number): number {
  return Math.round(ft / 3.28)
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  action: 'Ações',
  bonus_action: 'Ações Bônus',
  reaction: 'Reações',
  legendary_action: 'Ações Lendárias',
  trait: 'Traços',
}

const DAMAGE_MOD_COR: Record<string, string> = {
  vulnerability: 'text-[var(--red2)] bg-[var(--red2)]/10 border-[var(--red2)]/30',
  resistance: 'text-[var(--accent2)] bg-[var(--accent)]/10 border-[var(--accent)]/30',
  immunity: 'text-[var(--text3)] bg-[var(--bg3)] border-[var(--border)]',
}

const ABILITY_LABELS: Record<string, string> = {
  STR: 'FOR', DEX: 'DES', CON: 'CON', INT: 'INT', WIS: 'SAB', CHA: 'CAR',
  str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR',
}

function AcaoMonstroItem({ acao }: { acao: MonsterAction }) {
  const temAtaque = acao.attack_bonus !== null && acao.attack_bonus !== undefined && acao.attack_type
  const alcance = acao.reach_ft
    ? `${ftParaM(acao.reach_ft)}m`
    : acao.range_normal_ft
      ? `${ftParaM(acao.range_normal_ft)}/${ftParaM(acao.range_long_ft ?? acao.range_normal_ft * 4)}m`
      : null

  return (
    <div className="mb-2.5">
      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
        <span className="font-crimson font-bold text-[var(--text)] text-sm">{acao.name_pt}.</span>
        {acao.recharge && (
          <span className="text-[9px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">
            Recarga {acao.recharge}
          </span>
        )}
        {acao.legendary_cost != null && acao.legendary_cost > 1 && (
          <span className="text-[9px] px-1.5 py-0.5 border border-[var(--gold)] text-[var(--gold)] rounded font-cinzel">
            Custa {acao.legendary_cost} ações
          </span>
        )}
      </div>
      {temAtaque && (
        <p className="text-[var(--text2)] text-sm font-crimson leading-relaxed">
          <em>Ataque {acao.attack_type}: </em>
          {(acao.attack_bonus ?? 0) >= 0 ? '+' : ''}{acao.attack_bonus} para atingir
          {alcance && `, alcance ${alcance}`}
          {acao.target_pt && `, ${acao.target_pt}`}.
          {acao.damage_dice && ` Acerto: ${acao.damage_dice}${acao.damage_type_pt ? ` de dano ${acao.damage_type_pt}` : ''}`}
          {acao.damage2_dice && ` + ${acao.damage2_dice}${acao.damage2_type_pt ? ` de dano ${acao.damage2_type_pt}` : ''}`}
          {acao.damage_dice ? '.' : ''}
        </p>
      )}
      {acao.save_ability && acao.save_dc && (
        <p className="text-[var(--text2)] text-sm font-crimson italic">
          Resistência de {acao.save_ability} CD {acao.save_dc}
          {acao.save_effect_pt ? `: ${acao.save_effect_pt}.` : '.'}
        </p>
      )}
      {acao.condition_applied_pt && (
        <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded text-[var(--accent2)] font-cinzel">
          Condição: {acao.condition_applied_pt}
        </span>
      )}
      {acao.description_pt && (
        <p className="text-[var(--text2)] text-sm font-crimson leading-relaxed mt-0.5">{acao.description_pt}</p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────

const CONDICOES_D5E_PT = [
  'Amedrontado', 'Agarrado', 'Atordoado', 'Caído', 'Cego',
  'Enfeitiçado', 'Envenenado', 'Exausto', 'Incapacitado',
  'Invisível', 'Paralisado', 'Petrificado', 'Surdo', 'Inconsciente',
]

const TIPOS_DANO_OPCOES = [
  'Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Fogo',
  'Força', 'Frio', 'Necrótico', 'Perfurante', 'Psíquico',
  'Radiante', 'Trovejante', 'Veneno',
]

const ACTION_TYPE_OPCOES = [
  { value: 'action', label: 'Ação' },
  { value: 'bonus_action', label: 'Ação Bônus' },
  { value: 'reaction', label: 'Reação' },
  { value: 'legendary_action', label: 'Ação Lendária' },
  { value: 'trait', label: 'Traço' },
  { value: 'multiattack', label: 'Multiattaque' },
]

const SAVE_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
const SAVE_LABELS: Record<string, string> = { STR: 'FOR', DEX: 'DES', CON: 'CON', INT: 'INT', WIS: 'SAB', CHA: 'CAR' }

const SECOES_ADMIN = [
  { id: 'basico', label: 'Básico' },
  { id: 'saves', label: 'Saves' },
  { id: 'pericias', label: 'Perícias' },
  { id: 'resistencias', label: 'Resistências' },
  { id: 'condicoes', label: 'Condições' },
  { id: 'acoes', label: 'Ações' },
  { id: 'legado', label: 'Legado' },
] as const

type SecaoAdmin = typeof SECOES_ADMIN[number]['id']

function ModalAdminEditarMonstro({ monstro, onClose, onSaved }: {
  monstro: MonsterDetailed
  onClose: () => void
  onSaved: (m: MonsterDetailed) => void
}) {
  const lbl = "text-[var(--text3)] text-[9px] font-cinzel uppercase"
  const inp = "w-full input-dd text-sm mt-0.5"

  const scoreMap = {
    STR: monstro.str_score, DEX: monstro.dex_score, CON: monstro.con_score,
    INT: monstro.int_score, WIS: monstro.wis_score, CHA: monstro.cha_score,
  }

  const [secao, setSecao] = useState<SecaoAdmin>('basico')
  const [salvando, setSalvando] = useState(false)

  const [basico, setBasico] = useState({
    name_pt: monstro.name_pt,
    name_en: monstro.name_en,
    size_pt: monstro.size_pt ?? '',
    type_pt: monstro.type_pt ?? '',
    alignment_pt: monstro.alignment_pt ?? '',
    armor_class: monstro.armor_class,
    hit_points: monstro.hit_points,
    hit_dice: monstro.hit_dice ?? '',
    speed_pt: monstro.speed_pt ?? '',
    str_score: monstro.str_score,
    dex_score: monstro.dex_score,
    con_score: monstro.con_score,
    int_score: monstro.int_score,
    wis_score: monstro.wis_score,
    cha_score: monstro.cha_score,
    challenge_rating: monstro.challenge_rating,
    xp: monstro.xp ?? 0,
    proficiency_bonus: monstro.proficiency_bonus ?? 2,
    passive_perception: monstro.passive_perception ?? 10,
    darkvision_ft: monstro.darkvision_ft ?? 0,
    blindsight_ft: monstro.blindsight_ft ?? 0,
    tremorsense_ft: monstro.tremorsense_ft ?? 0,
    truesight_ft: monstro.truesight_ft ?? 0,
    senses_pt: monstro.senses_pt ?? '',
    languages_pt: monstro.languages_pt ?? '',
  })

  const [savesForm, setSavesForm] = useState<Record<string, { ativo: boolean; bonus: number }>>(() => {
    const saveMap = new Map(monstro.monster_saves?.map(s => [s.ability.toUpperCase(), s.bonus]) ?? [])
    return Object.fromEntries(SAVE_KEYS.map(k => [k, {
      ativo: saveMap.has(k),
      bonus: saveMap.has(k) ? saveMap.get(k)! : Math.floor((scoreMap[k] - 10) / 2),
    }]))
  })

  const [skillsForm, setSkillsForm] = useState(() =>
    (monstro.monster_skills ?? []).map(s => ({ skill_pt: s.skill_pt, skill_en: s.skill_en ?? '', bonus: s.bonus }))
  )

  const [modifiersForm, setModifiersForm] = useState(() =>
    (monstro.monster_damage_modifiers ?? []).map(d => ({
      modifier_type: d.modifier_type,
      damage_type_pt: d.damage_type_pt,
      note_pt: d.note_pt ?? '',
    }))
  )

  const [condImmunities, setCondImmunities] = useState<string[]>(() =>
    (monstro.monster_condition_immunities ?? []).map(ci => ci.condition_pt)
  )

  const [acoesForm, setAcoesForm] = useState<MonsterAction[]>(() =>
    monstro.monster_actions ?? []
  )

  const [textoTracos, setTextoTracos] = useState(monstro.traits_rules_pt ?? '')
  const [textoAcoes, setTextoAcoes] = useState(monstro.actions_rules_pt ?? '')

  async function salvar() {
    setSalvando(true)
    const supabase = createClient()
    const mid = monstro.id

    const { error: e1 } = await supabase.from('monsters').update({
      ...basico,
      hit_dice: basico.hit_dice || null,
      speed_pt: basico.speed_pt || null,
      size_pt: basico.size_pt || null,
      type_pt: basico.type_pt || null,
      alignment_pt: basico.alignment_pt || null,
      senses_pt: basico.senses_pt || null,
      languages_pt: basico.languages_pt || null,
      traits_rules_pt: textoTracos || null,
      actions_rules_pt: textoAcoes || null,
    }).eq('id', mid)
    if (e1) { toast.error('Erro ao salvar dados básicos'); setSalvando(false); return }

    await supabase.from('monster_saves').delete().eq('monster_id', mid)
    const savesToInsert = Object.entries(savesForm)
      .filter(([, v]) => v.ativo)
      .map(([ability, v]) => ({ monster_id: Number(mid), ability, bonus: v.bonus }))
    if (savesToInsert.length > 0) await supabase.from('monster_saves').insert(savesToInsert)

    await supabase.from('monster_skills').delete().eq('monster_id', mid)
    if (skillsForm.length > 0) {
      await supabase.from('monster_skills').insert(
        skillsForm.filter(s => s.skill_pt).map(s => ({ ...s, monster_id: Number(mid) }))
      )
    }

    await supabase.from('monster_damage_modifiers').delete().eq('monster_id', mid)
    if (modifiersForm.length > 0) {
      await supabase.from('monster_damage_modifiers').insert(
        modifiersForm.filter(d => d.damage_type_pt).map(d => ({ ...d, note_pt: d.note_pt || null, monster_id: Number(mid) }))
      )
    }

    await supabase.from('monster_condition_immunities').delete().eq('monster_id', mid)
    if (condImmunities.length > 0) {
      await supabase.from('monster_condition_immunities').insert(
        condImmunities.map(c => ({ monster_id: Number(mid), condition_pt: c }))
      )
    }

    await supabase.from('monster_actions').delete().eq('monster_id', mid)
    if (acoesForm.length > 0) {
      const acoesParaInserir = acoesForm
        .filter(a => a.name_pt)
        .map(({ id: _id, monster_id: _mid, ...rest }) => ({ ...rest, monster_id: Number(mid) }))
      await supabase.from('monster_actions').insert(acoesParaInserir)
    }

    const { data } = await supabase.from('monsters').select(`
      *, monster_saves(*), monster_skills(*),
      monster_damage_modifiers(*), monster_condition_immunities(*), monster_actions(*)
    `).eq('id', mid).single()

    toast.success('Monstro atualizado!')
    onSaved(data as MonsterDetailed)
    setSalvando(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="font-cinzel text-[var(--gold)] font-bold">✏️ Editar — {monstro.name_pt}</h2>
          <button onClick={onClose} className="text-[var(--border)] hover:text-[var(--red2)]"><X className="w-4 h-4" /></button>
        </div>

        {/* Abas de seção */}
            <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex overflow-x-auto flex-shrink-0">
              {SECOES_ADMIN.map(s => (
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

            {/* Conteúdo da seção */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* ── BÁSICO ── */}
              {secao === 'basico' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Nome PT</label><input className={inp} value={basico.name_pt} onChange={e => setBasico(b => ({ ...b, name_pt: e.target.value }))} /></div>
                    <div><label className={lbl}>Nome EN</label><input className={inp} value={basico.name_en} onChange={e => setBasico(b => ({ ...b, name_en: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={lbl}>Tamanho</label><input className={inp} value={basico.size_pt} onChange={e => setBasico(b => ({ ...b, size_pt: e.target.value }))} /></div>
                    <div><label className={lbl}>Tipo</label><input className={inp} value={basico.type_pt} onChange={e => setBasico(b => ({ ...b, type_pt: e.target.value }))} /></div>
                    <div><label className={lbl}>Alinhamento</label><input className={inp} value={basico.alignment_pt} onChange={e => setBasico(b => ({ ...b, alignment_pt: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className={lbl}>CA</label><input type="number" className={inp} value={basico.armor_class} onChange={e => setBasico(b => ({ ...b, armor_class: +e.target.value }))} /></div>
                    <div><label className={lbl}>PV</label><input type="number" className={inp} value={basico.hit_points} onChange={e => setBasico(b => ({ ...b, hit_points: +e.target.value }))} /></div>
                    <div><label className={lbl}>Dado de Vida</label><input className={inp} value={basico.hit_dice} onChange={e => setBasico(b => ({ ...b, hit_dice: e.target.value }))} placeholder="4d8+4" /></div>
                    <div><label className={lbl}>Deslocamento</label><input className={inp} value={basico.speed_pt} onChange={e => setBasico(b => ({ ...b, speed_pt: e.target.value }))} placeholder="9m" /></div>
                  </div>
                  <div>
                    <label className={lbl}>Atributos</label>
                    <div className="grid grid-cols-6 gap-2 mt-1">
                      {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k, i) => {
                        const labels = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR']
                        const key = `${k}_score` as keyof typeof basico
                        return (
                          <div key={k} className="text-center">
                            <div className="text-[var(--text3)] text-[9px] font-cinzel mb-0.5">{labels[i]}</div>
                            <input type="number" min={1} max={30} className="w-full input-dd text-center text-sm" value={basico[key] as number} onChange={e => setBasico(b => ({ ...b, [key]: +e.target.value }))} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className={lbl}>ND</label><input className={inp} value={basico.challenge_rating} onChange={e => setBasico(b => ({ ...b, challenge_rating: e.target.value }))} /></div>
                    <div><label className={lbl}>XP</label><input type="number" className={inp} value={basico.xp} onChange={e => setBasico(b => ({ ...b, xp: +e.target.value }))} /></div>
                    <div><label className={lbl}>Bônus Prof.</label><input type="number" className={inp} value={basico.proficiency_bonus} onChange={e => setBasico(b => ({ ...b, proficiency_bonus: +e.target.value }))} /></div>
                    <div><label className={lbl}>Percepção Passiva</label><input type="number" className={inp} value={basico.passive_perception} onChange={e => setBasico(b => ({ ...b, passive_perception: +e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className={lbl}>Visão Escura (ft)</label><input type="number" className={inp} value={basico.darkvision_ft} onChange={e => setBasico(b => ({ ...b, darkvision_ft: +e.target.value }))} /></div>
                    <div><label className={lbl}>Visão Cega (ft)</label><input type="number" className={inp} value={basico.blindsight_ft} onChange={e => setBasico(b => ({ ...b, blindsight_ft: +e.target.value }))} /></div>
                    <div><label className={lbl}>Sentido Sísmico (ft)</label><input type="number" className={inp} value={basico.tremorsense_ft} onChange={e => setBasico(b => ({ ...b, tremorsense_ft: +e.target.value }))} /></div>
                    <div><label className={lbl}>Visão Verdadeira (ft)</label><input type="number" className={inp} value={basico.truesight_ft} onChange={e => setBasico(b => ({ ...b, truesight_ft: +e.target.value }))} /></div>
                  </div>
                  <div><label className={lbl}>Sentidos (texto)</label><input className={inp} value={basico.senses_pt} onChange={e => setBasico(b => ({ ...b, senses_pt: e.target.value }))} /></div>
                  <div><label className={lbl}>Idiomas</label><input className={inp} value={basico.languages_pt} onChange={e => setBasico(b => ({ ...b, languages_pt: e.target.value }))} /></div>
                </>
              )}

              {/* ── SAVES ── */}
              {secao === 'saves' && (
                <div>
                  <p className="text-[var(--text3)] text-xs font-cinzel mb-3">Marque os atributos com bônus de proficiência e informe o bônus total.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SAVE_KEYS.map(k => (
                      <div key={k} className={cn("flex items-center gap-3 p-3 rounded border", savesForm[k]?.ativo ? "border-[var(--accent2)]/40 bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--bg3)]")}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={savesForm[k]?.ativo ?? false}
                            onChange={e => setSavesForm(f => ({ ...f, [k]: { ...f[k], ativo: e.target.checked } }))}
                            className="accent-[var(--accent2)]"
                          />
                          <span className="font-cinzel text-sm text-[var(--text2)] w-8">{SAVE_LABELS[k]}</span>
                        </label>
                        <input
                          type="number"
                          value={savesForm[k]?.bonus ?? 0}
                          onChange={e => setSavesForm(f => ({ ...f, [k]: { ...f[k], bonus: +e.target.value } }))}
                          disabled={!savesForm[k]?.ativo}
                          className="w-20 input-dd text-sm disabled:opacity-40"
                        />
                        {savesForm[k]?.ativo && <span className="text-[var(--accent2)] text-xs font-cinzel">prof</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PERÍCIAS ── */}
              {secao === 'pericias' && (
                <div>
                  {skillsForm.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input className="flex-1 input-dd text-sm" placeholder="Perícia (PT)" value={s.skill_pt} onChange={e => setSkillsForm(f => f.map((x, j) => j === i ? { ...x, skill_pt: e.target.value } : x))} />
                      <input className="flex-1 input-dd text-sm" placeholder="Skill (EN)" value={s.skill_en} onChange={e => setSkillsForm(f => f.map((x, j) => j === i ? { ...x, skill_en: e.target.value } : x))} />
                      <input type="number" className="w-20 input-dd text-sm" placeholder="Bônus" value={s.bonus} onChange={e => setSkillsForm(f => f.map((x, j) => j === i ? { ...x, bonus: +e.target.value } : x))} />
                      <button onClick={() => setSkillsForm(f => f.filter((_, j) => j !== i))} className="text-[var(--red2)] hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => setSkillsForm(f => [...f, { skill_pt: '', skill_en: '', bonus: 0 }])} className="mt-2 flex items-center gap-1.5 text-xs font-cinzel text-[var(--accent2)] hover:opacity-70">
                    <Plus className="w-3 h-3" /> Adicionar Perícia
                  </button>
                </div>
              )}

              {/* ── RESISTÊNCIAS ── */}
              {secao === 'resistencias' && (
                <div>
                  {modifiersForm.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <select className="input-dd text-sm w-40" value={d.modifier_type} onChange={e => setModifiersForm(f => f.map((x, j) => j === i ? { ...x, modifier_type: e.target.value } : x))}>
                        <option value="resistance">Resistência</option>
                        <option value="immunity">Imunidade</option>
                        <option value="vulnerability">Vulnerabilidade</option>
                      </select>
                      <select className="input-dd text-sm flex-1" value={d.damage_type_pt} onChange={e => setModifiersForm(f => f.map((x, j) => j === i ? { ...x, damage_type_pt: e.target.value } : x))}>
                        <option value="">— Tipo de Dano —</option>
                        {TIPOS_DANO_OPCOES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input className="w-36 input-dd text-sm" placeholder="Nota (opcional)" value={d.note_pt} onChange={e => setModifiersForm(f => f.map((x, j) => j === i ? { ...x, note_pt: e.target.value } : x))} />
                      <button onClick={() => setModifiersForm(f => f.filter((_, j) => j !== i))} className="text-[var(--red2)] hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => setModifiersForm(f => [...f, { modifier_type: 'resistance', damage_type_pt: '', note_pt: '' }])} className="mt-2 flex items-center gap-1.5 text-xs font-cinzel text-[var(--accent2)] hover:opacity-70">
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>
              )}

              {/* ── CONDIÇÕES ── */}
              {secao === 'condicoes' && (
                <div>
                  <p className="text-[var(--text3)] text-xs font-cinzel mb-3">Selecione as condições às quais o monstro é imune.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CONDICOES_D5E_PT.map(c => (
                      <label key={c} className="flex items-center gap-2 cursor-pointer p-2 rounded border border-transparent hover:border-[var(--border)]">
                        <input
                          type="checkbox"
                          checked={condImmunities.includes(c)}
                          onChange={e => setCondImmunities(prev => e.target.checked ? [...prev, c] : prev.filter(x => x !== c))}
                          className="accent-[var(--accent2)]"
                        />
                        <span className="text-sm text-[var(--text2)] font-crimson">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ── AÇÕES ── */}
              {secao === 'acoes' && (
                <div>
                  {acoesForm.map((a, i) => (
                    <div key={i} className="mb-4 p-3 border border-[var(--border)] rounded-lg bg-[var(--bg)]">
                      <div className="flex items-center gap-2 mb-2">
                        <select className="input-dd text-sm w-44" value={a.action_type} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, action_type: e.target.value } : x))}>
                          {ACTION_TYPE_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button onClick={() => setAcoesForm(f => f.filter((_, j) => j !== i))} className="text-[var(--red2)] hover:opacity-70 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div><label className={lbl}>Nome PT</label><input className="w-full input-dd text-sm mt-0.5" value={a.name_pt} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, name_pt: e.target.value } : x))} /></div>
                        <div><label className={lbl}>Nome EN</label><input className="w-full input-dd text-sm mt-0.5" value={a.name_en ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, name_en: e.target.value } : x))} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div><label className={lbl}>Tipo Ataque</label><input className="w-full input-dd text-sm mt-0.5" value={a.attack_type ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, attack_type: e.target.value } : x))} placeholder="corpo a corpo" /></div>
                        <div><label className={lbl}>Bônus Ataque</label><input type="number" className="w-full input-dd text-sm mt-0.5" value={a.attack_bonus ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, attack_bonus: e.target.value !== '' ? +e.target.value : null } : x))} /></div>
                        <div><label className={lbl}>Alcance (ft)</label><input type="number" className="w-full input-dd text-sm mt-0.5" value={a.reach_ft ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, reach_ft: e.target.value !== '' ? +e.target.value : null } : x))} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div><label className={lbl}>Alcance Normal (ft)</label><input type="number" className="w-full input-dd text-sm mt-0.5" value={a.range_normal_ft ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, range_normal_ft: e.target.value !== '' ? +e.target.value : null } : x))} /></div>
                        <div><label className={lbl}>Alcance Longo (ft)</label><input type="number" className="w-full input-dd text-sm mt-0.5" value={a.range_long_ft ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, range_long_ft: e.target.value !== '' ? +e.target.value : null } : x))} /></div>
                        <div><label className={lbl}>Alvo PT</label><input className="w-full input-dd text-sm mt-0.5" value={a.target_pt ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, target_pt: e.target.value } : x))} /></div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div><label className={lbl}>Dano</label><input className="w-full input-dd text-sm mt-0.5" value={a.damage_dice ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, damage_dice: e.target.value } : x))} placeholder="2d6+4" /></div>
                        <div><label className={lbl}>Tipo Dano PT</label><input className="w-full input-dd text-sm mt-0.5" value={a.damage_type_pt ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, damage_type_pt: e.target.value } : x))} /></div>
                        <div><label className={lbl}>Dano 2</label><input className="w-full input-dd text-sm mt-0.5" value={a.damage2_dice ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, damage2_dice: e.target.value } : x))} /></div>
                        <div><label className={lbl}>Tipo Dano 2 PT</label><input className="w-full input-dd text-sm mt-0.5" value={a.damage2_type_pt ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, damage2_type_pt: e.target.value } : x))} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div><label className={lbl}>Atributo Resist.</label><input className="w-full input-dd text-sm mt-0.5" value={a.save_ability ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, save_ability: e.target.value } : x))} placeholder="DEX" /></div>
                        <div><label className={lbl}>CD Resist.</label><input type="number" className="w-full input-dd text-sm mt-0.5" value={a.save_dc ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, save_dc: e.target.value !== '' ? +e.target.value : null } : x))} /></div>
                        <div><label className={lbl}>Efeito Resist. PT</label><input className="w-full input-dd text-sm mt-0.5" value={a.save_effect_pt ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, save_effect_pt: e.target.value } : x))} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div><label className={lbl}>Recarga</label><input className="w-full input-dd text-sm mt-0.5" value={a.recharge ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, recharge: e.target.value } : x))} placeholder="5-6" /></div>
                        <div><label className={lbl}>Condição Aplicada</label><input className="w-full input-dd text-sm mt-0.5" value={a.condition_applied_pt ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, condition_applied_pt: e.target.value } : x))} /></div>
                        <div><label className={lbl}>Custo Lendário</label><input type="number" className="w-full input-dd text-sm mt-0.5" value={a.legendary_cost ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, legendary_cost: e.target.value !== '' ? +e.target.value : null } : x))} /></div>
                      </div>
                      <div><label className={lbl}>Descrição PT</label><textarea rows={2} className="w-full input-dd text-sm mt-0.5 resize-none" value={a.description_pt ?? ''} onChange={e => setAcoesForm(f => f.map((x, j) => j === i ? { ...x, description_pt: e.target.value } : x))} /></div>
                    </div>
                  ))}
                  <button
                    onClick={() => setAcoesForm(f => [...f, {
                      id: -(Date.now()), monster_id: 0, action_type: 'action', name_pt: '', description_pt: '',
                    } as MonsterAction])}
                    className="flex items-center gap-1.5 text-xs font-cinzel text-[var(--accent2)] hover:opacity-70"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Ação
                  </button>
                </div>
              )}

              {/* ── LEGADO ── */}
              {secao === 'legado' && (
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>Traços / Habilidades Especiais (texto)</label>
                    <textarea rows={7} className="w-full input-dd text-sm mt-0.5 resize-none" value={textoTracos} onChange={e => setTextoTracos(e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Ações (texto)</label>
                    <textarea rows={7} className="w-full input-dd text-sm mt-0.5 resize-none" value={textoAcoes} onChange={e => setTextoAcoes(e.target.value)} />
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)] flex-shrink-0">
              <button onClick={onClose} className="px-3 py-1.5 text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--border2)] transition-colors">Cancelar</button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="px-4 py-1.5 text-xs font-cinzel text-[var(--gold)] bg-[var(--surface)] border border-[var(--gold)]/50 rounded hover:bg-[var(--gold)]/10 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : '💾 Salvar Tudo'}
              </button>
            </div>
      </div>
    </div>
  )
}

export function BestiarioCliente() {
  const [lista, setLista] = useState<MonsterStub[]>([])
  const [monstrosComAcoes, setMonstrosComAcoes] = useState<Set<string>>(new Set())
  const [selecionado, setSelecionado] = useState<MonsterDetailed | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [visao, setVisao] = useState<'lista' | 'detalhe'>('lista')
  const [busca, setBusca] = useState('')
  const [filtroCR, setFiltroCR] = useState('')
  const [userPlano, setUserPlano] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [modalAdminAberto, setModalAdminAberto] = useState(false)
  const [aba, setAba] = useState<'oficial' | 'personalizado'>('oficial')
  const { adicionarCombatente } = useBatalha()
  const router = useRouter()

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
    const params = new URLSearchParams(window.location.search)
    const slugParam = params.get('q')
    const buscaParam = params.get('busca')
    if (slugParam) setBusca(slugParam)
    else if (buscaParam) setBusca(buscaParam)
  }, [])

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const supabase = createClient()
      const [monstersRes, actionsRes] = await Promise.all([
        supabase
          .from('monsters')
          .select('id, slug, name_pt, name_en, type_pt, challenge_rating, armor_class, hit_points')
          .order('name_pt'),
        supabase.from('monster_actions').select('monster_id'),
      ])
      setLista((monstersRes.data ?? []) as MonsterStub[])
      setMonstrosComAcoes(new Set((actionsRes.data ?? []).map(r => String(r.monster_id))))
      setCarregando(false)
    }
    carregar()
  }, [])

  async function selecionarMonstro(stub: MonsterStub) {
    if (selecionado?.id === stub.id) return
    setCarregandoDetalhe(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('monsters')
      .select(`
        *,
        monster_saves(*),
        monster_skills(*),
        monster_damage_modifiers(*),
        monster_condition_immunities(*),
        monster_actions(*)
      `)
      .eq('id', stub.id)
      .single()
    setSelecionado(data as MonsterDetailed)
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

  function adicionarNaBatalha(m: MonsterDetailed) {
    const ataquesEstruturados = m.monster_actions?.filter(
      a => ['action', 'multiattack', 'bonus_action'].includes(a.action_type)
    )
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
      ...(ataquesEstruturados?.length ? { ataques_estruturados: ataquesEstruturados } : {}),
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

  const plano = userPlano ? getPlano(userPlano) : null
  const mostrarPersonalizado = plano?.limites.conteudo_personalizado ?? false

  return (
    <div className="flex flex-col h-full">
      {mostrarPersonalizado && (
        <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex">
          <button
            onClick={() => setAba('oficial')}
            className={`px-4 py-2 text-xs font-cinzel border-b-2 transition-colors ${aba === 'oficial' ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'}`}
          >
            📖 Oficial
          </button>
          <button
            onClick={() => setAba('personalizado')}
            className={`px-4 py-2 text-xs font-cinzel border-b-2 transition-colors ${aba === 'personalizado' ? 'border-[var(--accent2)] text-[var(--accent2)]' : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'}`}
          >
            ✨ Personalizado
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {aba === 'personalizado' && userId ? (
          <AbaPersonalizadoBestiario userId={userId} />
        ) : (
          <div className="flex h-full overflow-hidden">
            <div className={cn(
              "flex flex-col border-r border-[var(--bg3)] overflow-y-auto",
              "w-full md:w-80",
              visao === 'detalhe' ? "hidden md:flex" : "flex"
            )}>
              <div className="p-3 border-b border-[var(--border)]">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
                  <input
                    type="text"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar monstro (PT ou EN)..."
                    className="w-full input-dd pl-9 text-sm"
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
                        <div className="flex items-center gap-1">
                          <span className="font-cinzel font-semibold text-sm text-[var(--dd-text)] leading-tight truncate">
                            {m.name_pt}
                          </span>
                          {monstrosComAcoes.has(String(m.id)) && (
                            <span className="text-[var(--green2)] text-[9px] flex-shrink-0" title="Dados completos">✓</span>
                          )}
                        </div>
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

            <div className={cn(
              "overflow-y-auto p-4 md:p-6 bg-[var(--bg)]",
              "w-full md:flex-1",
              visao === 'lista' ? "hidden md:block" : "block"
            )}>
              <button
                onClick={() => setVisao('lista')}
                className="md:hidden flex items-center gap-2 text-sm text-[var(--dd-text2)] hover:text-[var(--dd-text)] mb-4 transition-colors"
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
              ) : (() => {
                const m = selecionado
                const hasStructuredActions = (m.monster_actions?.length ?? 0) > 0
                const hasStructuredDamage = (m.monster_damage_modifiers?.length ?? 0) > 0
                const hasCondImmunities = (m.monster_condition_immunities?.length ?? 0) > 0

                // Senses
                const sentidosEstruturados: string[] = []
                if (m.darkvision_ft) sentidosEstruturados.push(`Visão no escuro ${ftParaM(m.darkvision_ft)}m`)
                if (m.blindsight_ft) sentidosEstruturados.push(`Visão cega ${ftParaM(m.blindsight_ft)}m`)
                if (m.tremorsense_ft) sentidosEstruturados.push(`Sentido sísmico ${ftParaM(m.tremorsense_ft)}m`)
                if (m.truesight_ft) sentidosEstruturados.push(`Visão verdadeira ${ftParaM(m.truesight_ft)}m`)
                const sentidosTexto = sentidosEstruturados.length > 0
                  ? sentidosEstruturados.join(', ')
                  : m.senses_pt

                // Saves — todos os 6 atributos, com destaque quando há bônus de proficiência
                const saveMap = new Map(m.monster_saves?.map(s => [s.ability.toUpperCase(), s.bonus]) ?? [])
                const SAVE_DEFS = [
                  { key: 'STR', label: 'FOR', score: m.str_score },
                  { key: 'DEX', label: 'DES', score: m.dex_score },
                  { key: 'CON', label: 'CON', score: m.con_score },
                  { key: 'INT', label: 'INT', score: m.int_score },
                  { key: 'WIS', label: 'SAB', score: m.wis_score },
                  { key: 'CHA', label: 'CAR', score: m.cha_score },
                ]
                const savesCompletos = SAVE_DEFS.map(a => {
                  const baseMod = Math.floor((a.score - 10) / 2)
                  const explicitoBonus = saveMap.get(a.key)
                  return { ...a, bonus: explicitoBonus ?? baseMod, temProf: explicitoBonus !== undefined }
                })

                // Skills
                const skillList = m.monster_skills
                  ?.slice().sort((a, b) => a.skill_pt.localeCompare(b.skill_pt, 'pt-BR'))
                  .map(s => `${s.skill_pt} ${s.bonus >= 0 ? '+' : ''}${s.bonus}`) ?? []

                // Damage modifiers
                const vulns = m.monster_damage_modifiers?.filter(d => d.modifier_type === 'vulnerability') ?? []
                const resists = m.monster_damage_modifiers?.filter(d => d.modifier_type === 'resistance') ?? []
                const immunes = m.monster_damage_modifiers?.filter(d => d.modifier_type === 'immunity') ?? []

                // Actions grouped
                const multiattacks = m.monster_actions?.filter(a => a.action_type === 'multiattack') ?? []
                const acoesGrupadas = ['action', 'bonus_action', 'reaction', 'legendary_action', 'trait']
                  .map(tipo => ({
                    tipo,
                    label: ACTION_TYPE_LABELS[tipo],
                    acoes: m.monster_actions?.filter(a => a.action_type === tipo) ?? [],
                  }))
                  .filter(g => g.acoes.length > 0)

                return (
                  <div className="max-w-3xl">
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h2 className="font-cinzel text-[var(--gold)] text-2xl font-bold leading-tight">{m.name_pt}</h2>
                          {hasStructuredActions && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-[var(--green)]/10 border border-[var(--green)]/30 text-[var(--green2)] rounded font-cinzel">
                              ✓ Dados completos
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--dd-text2)] italic">{m.name_en}</p>
                        <p className="text-[var(--text2)] text-sm mt-1">
                          {[m.size_pt, m.type_pt, m.alignment_pt].filter(Boolean).join(' · ')}
                        </p>
                        {m.source_page_start && (
                          <p className="text-[var(--text3)] text-[10px] font-cinzel mt-0.5">SRD p.{m.source_page_start}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isAdmin && (
                          <button
                            onClick={() => setModalAdminAberto(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg3)] border border-[var(--border2)] text-[var(--text2)] rounded text-sm font-cinzel hover:bg-[var(--surface)] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                        )}
                        <BotaoReportar itemSlug={m.slug} itemNome={m.name_pt} itemTipo="monstro" pagina="/bestiario" />
                        <button
                          onClick={() => adicionarNaBatalha(m)}
                          className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] border border-[var(--accent2)] text-[var(--bg)] rounded text-sm font-cinzel hover:opacity-90 transition-colors"
                        >
                          <Swords className="w-4 h-4" /> Adicionar à Batalha
                        </button>
                      </div>
                    </div>

                    {/* Stats de combate */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <PainelGrimorio compacto className="text-center">
                        <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">CA</div>
                        <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{m.armor_class}</div>
                      </PainelGrimorio>
                      <PainelGrimorio compacto className="text-center">
                        <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">PV</div>
                        <div className="text-[var(--green2)] text-lg font-cinzel font-bold">{m.hit_points}</div>
                        {m.hit_dice && <div className="text-[var(--text3)] text-[9px] mt-0.5">{m.hit_dice}</div>}
                      </PainelGrimorio>
                      <PainelGrimorio compacto className="text-center">
                        <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Deslocamento</div>
                        <div className="text-[var(--text)] text-xs font-crimson mt-1 leading-tight">{m.speed_pt ?? '—'}</div>
                      </PainelGrimorio>
                      <PainelGrimorio compacto className="text-center">
                        <div className="text-[var(--text3)] text-[10px] font-cinzel uppercase">ND</div>
                        <div className="text-[var(--gold)] text-xl font-cinzel font-bold">{m.challenge_rating}</div>
                        {m.xp != null && <div className="text-[var(--border)] text-[10px]">{m.xp.toLocaleString('pt-BR')} XP</div>}
                      </PainelGrimorio>
                    </div>

                    {/* Atributos + saves + skills */}
                    <PainelGrimorio titulo="Atributos" compacto className="mb-3">
                      {m.proficiency_bonus != null && (
                        <p className="text-[var(--text3)] text-xs font-cinzel mb-2">
                          Bônus de proficiência: <span className="text-[var(--text2)]">+{m.proficiency_bonus}</span>
                        </p>
                      )}
                      <div className="grid grid-cols-6 gap-2 text-center mb-2">
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
                      <div className="border-t border-[var(--border)] pt-2 mt-1">
                        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Testes de Resistência</p>
                        <div className="grid grid-cols-6 gap-1 text-center">
                          {savesCompletos.map(s => (
                            <div key={s.key} className={cn("rounded p-1.5", s.temProf ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20" : "bg-[var(--bg3)]")}>
                              <div className="text-[var(--text3)] text-[9px] font-cinzel">{s.label}</div>
                              <div className={cn("text-xs font-bold", s.temProf ? "text-[var(--accent2)]" : "text-[var(--text2)]")}>
                                {formatarModificador(s.bonus)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {skillList.length > 0 && (
                        <p className="text-xs font-crimson mt-1">
                          <span className="text-[var(--text3)] font-cinzel">Perícias: </span>
                          <span className="text-[var(--text2)]">{skillList.join(', ')}</span>
                        </p>
                      )}
                    </PainelGrimorio>

                    {/* Resistências / Imunidades / Vulnerabilidades */}
                    {hasStructuredDamage && (
                      <PainelGrimorio titulo="Resistências & Imunidades" compacto className="mb-3">
                        {vulns.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1">Vulnerabilidades</p>
                            <div className="flex flex-wrap gap-1">
                              {vulns.map((d, i) => (
                                <span key={i} className={`text-xs px-2 py-0.5 rounded border font-crimson ${DAMAGE_MOD_COR.vulnerability}`}>
                                  {d.damage_type_pt}{d.note_pt ? ` (${d.note_pt})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {resists.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1">Resistências</p>
                            <div className="flex flex-wrap gap-1">
                              {resists.map((d, i) => (
                                <span key={i} className={`text-xs px-2 py-0.5 rounded border font-crimson ${DAMAGE_MOD_COR.resistance}`}>
                                  {d.damage_type_pt}{d.note_pt ? ` (${d.note_pt})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {immunes.length > 0 && (
                          <div>
                            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1">Imunidades a Dano</p>
                            <div className="flex flex-wrap gap-1">
                              {immunes.map((d, i) => (
                                <span key={i} className={`text-xs px-2 py-0.5 rounded border font-crimson ${DAMAGE_MOD_COR.immunity}`}>
                                  {d.damage_type_pt}{d.note_pt ? ` (${d.note_pt})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </PainelGrimorio>
                    )}

                    {/* Imunidades a condições */}
                    {hasCondImmunities && (
                      <PainelGrimorio titulo="Imunidade a Condições" compacto className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {m.monster_condition_immunities!.map((ci, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text2)] font-crimson bg-[var(--bg3)]">
                              {ci.condition_pt}
                            </span>
                          ))}
                        </div>
                      </PainelGrimorio>
                    )}

                    {/* Sentidos & Idiomas */}
                    {(sentidosTexto || m.passive_perception != null || m.languages_pt) && (
                      <PainelGrimorio titulo="Sentidos & Idiomas" compacto className="mb-3">
                        {sentidosTexto && <p className="text-[var(--text2)] text-sm font-crimson">{sentidosTexto}</p>}
                        {m.passive_perception != null && (
                          <p className="text-[var(--text2)] text-sm font-crimson">Percepção passiva {m.passive_perception}</p>
                        )}
                        {m.languages_pt && <p className="text-[var(--text2)] text-sm font-crimson mt-1">{m.languages_pt}</p>}
                      </PainelGrimorio>
                    )}

                    {/* Traços especiais */}
                    {(m.traits_rules_pt || m.traits_pt) && (
                      <PainelGrimorio titulo="Habilidades Especiais" compacto className="mb-3">
                        <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">
                          {m.traits_rules_pt || m.traits_pt}
                        </p>
                      </PainelGrimorio>
                    )}

                    {/* Ações — estruturadas ou texto */}
                    {hasStructuredActions ? (
                      <PainelGrimorio titulo="Ações" compacto className="mb-3">
                        {multiattacks.map(a => (
                          <div key={a.id} className="mb-3">
                            <span className="font-crimson font-bold text-[var(--text)] text-sm">{a.name_pt}. </span>
                            {a.description_pt && (
                              <span className="text-[var(--text2)] text-sm font-crimson leading-relaxed">{a.description_pt}</span>
                            )}
                          </div>
                        ))}
                        {acoesGrupadas.map(({ tipo, label, acoes }) => (
                          <div key={tipo} className="mb-3">
                            {tipo !== 'action' && (
                              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider border-b border-[var(--border)] pb-1 mb-2">{label}</p>
                            )}
                            {acoes.map(a => <AcaoMonstroItem key={a.id} acao={a} />)}
                          </div>
                        ))}
                      </PainelGrimorio>
                    ) : (m.actions_rules_pt || m.actions_pt) ? (
                      <PainelGrimorio titulo="Ações" compacto className="mb-3">
                        <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap leading-relaxed">
                          {m.actions_rules_pt || m.actions_pt}
                        </p>
                      </PainelGrimorio>
                    ) : null}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {modalAdminAberto && selecionado && (
        <ModalAdminEditarMonstro
          monstro={selecionado}
          onClose={() => setModalAdminAberto(false)}
          onSaved={(m) => setSelecionado(m)}
        />
      )}
    </div>
  )
}
