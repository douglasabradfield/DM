'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Personagem } from '@/types/dnd'
import type { ItemDistribuidoPayload } from '../tipos'
import { MOEDAS } from '../constantes'
import { chamarAcaoInventario } from '../api'
import { Avatar } from '../ui/Avatar'

// DM only — cria itens/credita moedas do zero para um ou mais personagens
// de uma vez (loot pós-batalha, presente da história etc.). Não parte do
// inventário de ninguém, por isso não usa o gesto de "toque no avatar
// confirma" do Dar — aqui há uma lista de destinatários a compor antes de
// aplicar tudo junto.
export function ModalDistribuirTesouro({
  sessaoId, campanhaId, personagens, onFechar,
}: {
  sessaoId: string
  campanhaId: string
  personagens: Personagem[]
  onFechar: () => void
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [itens, setItens] = useState<ItemDistribuidoPayload[]>([])
  const [abaCompendio, setAbaCompendio] = useState<'magicos' | 'armas' | 'armaduras' | 'gear'>('gear')
  const [buscaItem, setBuscaItem] = useState('')
  const [resultadosItem, setResultadosItem] = useState<Record<string, unknown>[]>([])
  const [buscandoItem, setBuscandoItem] = useState(false)
  const [nomeAvulso, setNomeAvulso] = useState('')
  const [valores, setValores] = useState<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', string>>({ pl: '', po: '', pe: '', pp: '', pc: '' })
  const [dividirIgualmente, setDividirIgualmente] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const buscarItens = useCallback(async (termo: string, aba: string) => {
    if (!termo.trim()) { setResultadosItem([]); return }
    setBuscandoItem(true)
    try {
      const tabelas: Record<string, { tabela: string; campos: string }> = {
        magicos:   { tabela: 'magic_items',      campos: 'slug,name_pt,name_en,category,rarity,description_pt' },
        armas:     { tabela: 'equipment_weapons', campos: 'slug,name_pt,name_en,damage_dice,damage_type_pt,properties_pt' },
        armaduras: { tabela: 'equipment_armor',   campos: 'slug,name_pt,name_en,base_ac_formula_pt,category_pt' },
        gear:      { tabela: 'equipment_gear',    campos: 'slug,name_pt,name_en,category_pt,description_pt' },
      }
      const { tabela, campos } = tabelas[aba] ?? tabelas.gear
      // Modal só abre para o DM (ver render em MesaCliente), então itens
      // custom da campanha sempre aparecem, independente de visivel_jogadores.
      const { data } = await createClient()
        .from(tabela)
        .select(campos)
        .or(`name_pt.ilike.%${termo}%,name_en.ilike.%${termo}%`)
        .or(`criado_por.is.null,campanha_id.eq.${campanhaId}`)
        .limit(10)
      setResultadosItem((data ?? []) as unknown as Record<string, unknown>[])
    } finally {
      setBuscandoItem(false)
    }
  }, [campanhaId])

  useEffect(() => {
    const t = setTimeout(() => buscarItens(buscaItem, abaCompendio), 300)
    return () => clearTimeout(t)
  }, [buscaItem, abaCompendio, buscarItens])

  function alternarDestinatario(id: string) {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  function adicionarDoCompendio(item: Record<string, unknown>) {
    const namePt = item.name_pt as string
    let tipo = 'equipamento'
    let raridade: string | null = null
    let descricao = ''
    if (abaCompendio === 'magicos') { tipo = 'magico'; raridade = (item.rarity as string) ?? null; descricao = (item.description_pt as string) || '' }
    else if (abaCompendio === 'armas') { tipo = 'arma'; descricao = `${item.damage_dice} ${item.damage_type_pt}` }
    else if (abaCompendio === 'armaduras') { tipo = 'armadura'; descricao = (item.base_ac_formula_pt as string) || '' }
    else { descricao = (item.description_pt as string) || '' }

    setItens(prev => [...prev, { nome: namePt, tipo, raridade, descricao, quantidade: 1, itemRef: item.slug as string }])
    setBuscaItem('')
    setResultadosItem([])
  }

  function adicionarAvulso() {
    if (!nomeAvulso.trim()) return
    setItens(prev => [...prev, { nome: nomeAvulso.trim(), quantidade: 1 }])
    setNomeAvulso('')
  }

  function removerItemDaLista(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  const moedasBase = useMemo(() => {
    const m: Partial<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number>> = {}
    for (const [k, v] of Object.entries(valores)) {
      const n = parseInt(v) || 0
      if (n > 0) m[k as 'pl' | 'po' | 'pe' | 'pp' | 'pc'] = n
    }
    return m
  }, [valores])

  const podeAplicar = selecionados.size > 0 && (itens.length > 0 || Object.keys(moedasBase).length > 0)

  async function aplicar() {
    if (!podeAplicar || enviando) return
    setEnviando(true)
    const nDestinatarios = selecionados.size
    const moedasPorPessoa = dividirIgualmente
      ? Object.fromEntries(Object.entries(moedasBase).map(([m, v]) => [m, Math.floor((v ?? 0) / nDestinatarios)]))
      : moedasBase
    const resultado = await chamarAcaoInventario({
      sessaoId, tipo: 'distribuir', paraPersonagemIds: Array.from(selecionados), itens, moedas: moedasPorPessoa,
    })
    setEnviando(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao distribuir tesouro'); return }
    toast.success(resultado.descricao ?? 'Tesouro distribuído!')
    onFechar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-sm p-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">🎁 Distribuir Tesouro</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Quem recebe</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {personagens.map(p => {
            const ativo = selecionados.has(p.id)
            return (
              <button key={p.id} onClick={() => alternarDestinatario(p.id)} className="flex flex-col items-center gap-0.5 w-14">
                <div className="rounded-full p-0.5" style={{ boxShadow: ativo ? '0 0 0 2px var(--gold)' : '0 0 0 1px var(--border)' }}>
                  <Avatar nome={p.nome} imagemUrl={p.imagem_url} tamanho={40} />
                </div>
                <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{p.nome}</span>
              </button>
            )
          })}
        </div>

        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Itens</p>
        <div className="flex gap-1 mb-2">
          {(['gear', 'armas', 'armaduras', 'magicos'] as const).map(aba => (
            <button
              key={aba}
              onClick={() => setAbaCompendio(aba)}
              className={cn(
                'flex-1 py-1 rounded text-[10px] font-cinzel border',
                abaCompendio === aba ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text3)]'
              )}
            >
              {{ gear: 'Equip.', armas: 'Armas', armaduras: 'Armad.', magicos: 'Mágicos' }[aba]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={buscaItem}
          onChange={e => setBuscaItem(e.target.value)}
          placeholder="Buscar no compêndio..."
          className="input-dd w-full text-xs py-1.5 mb-1"
        />
        {buscandoItem && <p className="text-[var(--text3)] text-[10px] font-crimson py-1">Buscando...</p>}
        {resultadosItem.length > 0 && (
          <div className="space-y-0.5 mb-2 max-h-32 overflow-y-auto">
            {resultadosItem.map((item, i) => (
              <button
                key={i}
                onClick={() => adicionarDoCompendio(item)}
                className="w-full text-left px-2 py-1 rounded bg-[var(--bg3)] hover:bg-[var(--surface)] text-[var(--text)] text-xs font-crimson truncate"
              >
                + {item.name_pt as string}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            value={nomeAvulso}
            onChange={e => setNomeAvulso(e.target.value)}
            placeholder="Ou digite um item avulso..."
            className="input-dd flex-1 text-xs py-1.5"
          />
          <button onClick={adicionarAvulso} disabled={!nomeAvulso.trim()} className="px-3 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-xs font-cinzel disabled:opacity-40">
            + Add
          </button>
        </div>
        {itens.length > 0 && (
          <div className="space-y-1 mb-3">
            {itens.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-[var(--bg3)] rounded">
                <span className="text-[var(--text)] text-xs font-crimson flex-1 truncate">{item.nome}</span>
                <button onClick={() => removerItemDaLista(i)} className="text-[var(--border)] hover:text-[var(--red2)]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Moedas (por destinatário)</p>
        <div className="grid grid-cols-5 gap-1 mb-2">
          {MOEDAS.map(m => (
            <div key={m.id}>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase block text-center">{m.id.toUpperCase()}</label>
              <input
                type="number"
                inputMode="numeric"
                value={valores[m.id]}
                onChange={e => setValores(prev => ({ ...prev, [m.id]: e.target.value }))}
                placeholder="0"
                className="input-dd w-full text-center text-sm py-1.5"
              />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-1.5 mb-3">
          <input type="checkbox" checked={dividirIgualmente} onChange={e => setDividirIgualmente(e.target.checked)} className="w-3.5 h-3.5 accent-[var(--accent)]" />
          <span className="text-[var(--text2)] text-xs font-crimson">Dividir moedas igualmente entre os escolhidos (em vez de dar o valor cheio a cada um)</span>
        </label>

        <button
          onClick={aplicar}
          disabled={!podeAplicar || enviando}
          className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40"
        >
          {enviando ? 'Distribuindo...' : `Distribuir para ${selecionados.size || 0}`}
        </button>
      </div>
    </div>,
    document.body
  )
}
