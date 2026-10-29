'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ItemCompendioEscolhido } from './ModalCompendioItens'

type Categoria = 'armadura' | 'escudo' | 'arma' | 'outro'
type TipoArmadura = 'leve' | 'media' | 'pesada'

// max_des padrão por tipo de armadura (null = sem limite).
const MAX_DES_PADRAO: Record<TipoArmadura, number | null> = { leve: null, media: 2, pesada: 0 }

const CAMPO = 'input-dd w-full min-h-[44px]'
const ROTULO = 'text-[var(--text3)] text-[10px] font-cinzel uppercase block mb-1'

const inteiroOuNulo = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)))

// Cadastro de item próprio (homebrew). Só o nome é obrigatório; os campos de
// armadura/modificador aparecem conforme a categoria.
export function FormItemProprio({ onEscolher }: { onEscolher: (item: ItemCompendioEscolhido) => void }) {
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('outro')
  const [tipoArmadura, setTipoArmadura] = useState<TipoArmadura>('leve')
  const [acBase, setAcBase] = useState('')
  const [maxDes, setMaxDes] = useState('')
  const [reqFor, setReqFor] = useState('')
  const [desvFurt, setDesvFurt] = useState(false)
  const [bonusAc, setBonusAc] = useState('')
  const [descricao, setDescricao] = useState('')

  function mudarTipo(t: TipoArmadura) {
    setTipoArmadura(t)
    setMaxDes(MAX_DES_PADRAO[t] === null ? '' : String(MAX_DES_PADRAO[t]))
  }

  function confirmar() {
    if (!nome.trim()) return
    const bonus = inteiroOuNulo(bonusAc)
    const ehArmadura = categoria === 'armadura'
    // Escudo sem bônus informado vale +2 (padrão do SRD).
    const valorBonus = categoria === 'escudo' ? (bonus ?? 2) : bonus
    const modificadores = valorBonus && categoria !== 'armadura' && categoria !== 'arma'
      ? [{ alvo: 'ac', valor: valorBonus, tipo: 'soma' as const }]
      : []
    onEscolher({
      itemRef: '',
      nome: nome.trim(),
      tipoItem: categoria === 'outro' ? 'equipamento' : categoria === 'arma' ? 'arma' : 'armadura',
      raridade: null,
      descricaoItem: descricao.trim(),
      mecanica: {
        categoria,
        ...(ehArmadura ? {
          tipo_armadura: tipoArmadura,
          ac_base: inteiroOuNulo(acBase),
          max_des: inteiroOuNulo(maxDes),
          req_for: inteiroOuNulo(reqFor),
          desv_furtividade: desvFurt,
        } : {}),
        modificadores,
      },
    })
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <label>
        <span className={ROTULO}>Nome *</span>
        <input className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Escudo do Alvorecer" />
      </label>

      <label>
        <span className={ROTULO}>Categoria</span>
        <select className={CAMPO} value={categoria} onChange={e => setCategoria(e.target.value as Categoria)}>
          <option value="outro">Outro</option>
          <option value="armadura">Armadura</option>
          <option value="escudo">Escudo</option>
          <option value="arma">Arma</option>
        </select>
      </label>

      {categoria === 'armadura' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={ROTULO}>Tipo</span>
              <select className={CAMPO} value={tipoArmadura} onChange={e => mudarTipo(e.target.value as TipoArmadura)}>
                <option value="leve">Leve</option>
                <option value="media">Média</option>
                <option value="pesada">Pesada</option>
              </select>
            </label>
            <label>
              <span className={ROTULO}>CA base</span>
              <input className={CAMPO} type="number" inputMode="numeric" value={acBase} onChange={e => setAcBase(e.target.value)} placeholder="14" />
            </label>
            <label>
              <span className={ROTULO}>DES máx. (vazio = sem limite)</span>
              <input className={CAMPO} type="number" inputMode="numeric" value={maxDes} onChange={e => setMaxDes(e.target.value)} />
            </label>
            <label>
              <span className={ROTULO}>FOR mínima</span>
              <input className={CAMPO} type="number" inputMode="numeric" value={reqFor} onChange={e => setReqFor(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={desvFurt} onChange={e => setDesvFurt(e.target.checked)} className="w-5 h-5" />
            <span className="text-[var(--text2)] text-sm font-crimson">Desvantagem em Furtividade</span>
          </label>
        </>
      )}

      {(categoria === 'escudo' || categoria === 'outro') && (
        <label>
          <span className={ROTULO}>{categoria === 'escudo' ? 'Bônus de CA (padrão +2)' : 'Bônus de CA (opcional)'}</span>
          <input className={CAMPO} type="number" inputMode="numeric" value={bonusAc} onChange={e => setBonusAc(e.target.value)} placeholder={categoria === 'escudo' ? '2' : '1'} />
        </label>
      )}

      <label>
        <span className={ROTULO}>Descrição</span>
        <textarea className={cn(CAMPO, 'resize-none')} rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} />
      </label>

      <button
        type="button"
        onClick={confirmar}
        disabled={!nome.trim()}
        className="min-h-[48px] rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold disabled:opacity-40"
      >
        Adicionar à mochila
      </button>
    </div>
  )
}
