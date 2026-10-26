'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import type { Spell } from '@/types/dnd'
import type { MagiaPreparavel } from '../tipos'

// 📖 Preparar magias — fora de combate, antes da sessão. Mesma tabela que a
// Ficha edita (magias_personagem.preparada), escrita direta (não é estado
// de jogo/PV, é gerenciamento de ficha — mesmo padrão de adicionar/remover
// magia na Ficha). Truques (nível 0) não têm preparação em D&D 5e — não
// entram na lista.
export function ModalPrepararMagias({
  personagemId, personagemNome, onFechar,
}: {
  personagemId: string
  personagemNome: string
  onFechar: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [magias, setMagias] = useState<MagiaPreparavel[]>([])

  const carregar = useCallback(() => {
    createClient()
      .from('magias_personagem')
      .select('id, preparada, nivel, spell:spells!spell_id(name_pt)')
      .eq('personagem_id', personagemId)
      .gt('nivel', 0)
      .order('nivel')
      .then(({ data }) => {
        type Linha = { id: string; preparada: boolean; nivel: number; spell: Pick<Spell, 'name_pt'> | null }
        const linhas = (data ?? []) as unknown as Linha[]
        setMagias(linhas.map(m => ({ id: m.id, nome: m.spell?.name_pt ?? '(sem nome)', nivel: m.nivel, preparada: m.preparada })))
        setCarregando(false)
      })
  }, [personagemId])

  useEffect(() => { carregar() }, [carregar])

  async function toggle(m: MagiaPreparavel) {
    const novoValor = !m.preparada
    setMagias(prev => prev.map(x => x.id === m.id ? { ...x, preparada: novoValor } : x))
    const { error } = await createClient().from('magias_personagem').update({ preparada: novoValor }).eq('id', m.id)
    if (error) {
      toast.error('Erro ao atualizar magia preparada')
      setMagias(prev => prev.map(x => x.id === m.id ? { ...x, preparada: m.preparada } : x))
    }
  }

  const totalPreparadas = magias.filter(m => m.preparada).length

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">📖 Preparar — {personagemNome}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!carregando && magias.length > 0 && (
          <p className="text-[var(--text3)] text-[11px] font-crimson mb-2">{totalPreparadas} preparada(s)</p>
        )}

        {carregando ? (
          <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Carregando...</p>
        ) : magias.length === 0 ? (
          <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Nenhuma magia de nível 1+ na ficha</p>
        ) : (
          <div className="space-y-1">
            {magias.map(m => (
              <label
                key={m.id}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]"
              >
                <input
                  type="checkbox"
                  checked={m.preparada}
                  onChange={() => toggle(m)}
                  className="w-4 h-4 accent-[var(--gold)] flex-shrink-0"
                />
                <span className="text-[var(--text)] text-sm font-crimson truncate flex-1">{m.nome}</span>
                <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">N{m.nivel}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
