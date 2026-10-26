'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EspacosMagiaBatalha } from '@/types/batalha'
import type { TipoDano } from '@/types/dnd'
import type { ConjuracaoEscolhida, LinhaMagia, MagiaExibida } from '../tipos'
import { classificarMagia, niveisDisponiveisParaMagia, selecionarMagiasExibidas } from '../helpers'

// ✨ Magia — lista com degradação graciosa (Fase 2). Ao escolher uma magia
// de nível > 0, abre o passo de nível de conjuração (permite conjurar em
// nível superior); o espaço em si só é consumido pela API, nunca aqui.
export function ModalMagias({
  personagemId, personagemNome, espacosMagia, onConjurar, onFechar,
}: {
  personagemId: string
  personagemNome: string
  espacosMagia: EspacosMagiaBatalha
  onConjurar: (escolha: ConjuracaoEscolhida) => void
  onFechar: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [magias, setMagias] = useState<MagiaExibida[]>([])
  const [magiaEscolhida, setMagiaEscolhida] = useState<MagiaExibida | null>(null)
  const [nivelEscolhido, setNivelEscolhido] = useState<number>(0)
  const [efeitoAtivo, setEfeitoAtivo] = useState(false)

  useEffect(() => {
    let cancelado = false
    createClient()
      .from('magias_personagem')
      .select(`
        id, preparada, nivel,
        spell:spells!spell_id(name_pt, damage_dice, damage_type_pt, heal_dice, concentration, save_ability, save_effect)
      `)
      .eq('personagem_id', personagemId)
      .order('nivel')
      .then(({ data }) => {
        if (cancelado) return
        const linhas = (data ?? []) as unknown as LinhaMagia[]
        setMagias(linhas.map(m => ({
          id: m.id,
          nome: m.spell?.name_pt ?? '(sem nome)',
          nivel: m.nivel,
          preparada: m.preparada,
          danoDice: m.spell?.damage_dice ?? null,
          tipoDano: (m.spell?.damage_type_pt as TipoDano | undefined) ?? null,
          curaDice: m.spell?.heal_dice ?? null,
          concentracao: m.spell?.concentration ?? false,
          saveAbility: m.spell?.save_ability ?? null,
        })))
        setCarregando(false)
      })
    return () => { cancelado = true }
  }, [personagemId])

  const { magias: exibidas, aviso } = selecionarMagiasExibidas(magias)

  function escolherMagia(m: MagiaExibida) {
    setMagiaEscolhida(m)
    setNivelEscolhido(niveisDisponiveisParaMagia(m.nivel, espacosMagia)[0]?.nivel ?? m.nivel)
    setEfeitoAtivo(false)
  }

  const niveisDisponiveis = magiaEscolhida && magiaEscolhida.nivel > 0
    ? niveisDisponiveisParaMagia(magiaEscolhida.nivel, espacosMagia)
    : []
  const semNivelDisponivel = !!magiaEscolhida && magiaEscolhida.nivel > 0 && niveisDisponiveis.length === 0

  function confirmar() {
    if (!magiaEscolhida || semNivelDisponivel) return
    onConjurar({
      magia: magiaEscolhida,
      nivelConjurado: magiaEscolhida.nivel > 0 ? nivelEscolhido : null,
      efeitoAtivo,
    })
  }

  const { efeito } = magiaEscolhida ? classificarMagia(magiaEscolhida) : { efeito: 'nenhum' as const }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {!magiaEscolhida ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">✨ Magias — {personagemNome}</h3>
              <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {carregando ? (
              <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Carregando...</p>
            ) : magias.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-[var(--text3)] text-xs font-crimson">Nenhuma magia na ficha</p>
                <Link href={`/personagens/${personagemId}`} className="text-[var(--accent2)] text-xs font-cinzel hover:underline">
                  Ver ficha do personagem →
                </Link>
              </div>
            ) : (
              <>
                {aviso && <p className="text-[var(--gold)] text-[11px] font-crimson italic mb-2">⚠️ {aviso}</p>}
                <div className="space-y-1">
                  {exibidas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => escolherMagia(m)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
                    >
                      <span className="text-[var(--text)] text-sm font-crimson truncate">{m.nome}</span>
                      <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0 ml-2">{m.nivel === 0 ? 'Truque' : `N${m.nivel}`}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setMagiaEscolhida(null)} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">
                ←
              </button>
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate flex-1">{magiaEscolhida.nome}</h3>
              <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[var(--text3)] text-xs font-crimson mb-3">
              {efeito === 'dano' && `Causa dano${magiaEscolhida.tipoDano ? ` (${magiaEscolhida.tipoDano})` : ''}`}
              {efeito === 'cura' && 'Causa cura'}
              {efeito === 'nenhum' && 'Utilitária — registra no log, sem valor'}
              {magiaEscolhida.saveAbility && ` · Salvaguarda: ${magiaEscolhida.saveAbility}`}
            </p>

            {magiaEscolhida.nivel > 0 && (
              <div className="mb-3">
                <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Nível de conjuração</p>
                {niveisDisponiveis.length === 0 ? (
                  <p className="text-[var(--red2)] text-xs font-crimson">
                    Sem espaços de magia disponíveis para conjurar esta magia
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {niveisDisponiveis.map(({ nivel: n, disponivel, total }) => (
                      <button
                        key={n}
                        onClick={() => setNivelEscolhido(n)}
                        className={cn(
                          'px-3 py-2 rounded-lg border text-xs font-cinzel min-h-[40px]',
                          nivelEscolhido === n
                            ? 'bg-[var(--gold)] border-[var(--gold)] text-[var(--bg)] font-bold'
                            : 'border-[var(--border)] text-[var(--text2)]'
                        )}
                      >
                        N{n} ({disponivel}/{total})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {magiaEscolhida.concentracao && (
              <label className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={efeitoAtivo}
                  onChange={e => setEfeitoAtivo(e.target.checked)}
                  className="w-4 h-4 accent-[var(--gold)]"
                />
                <span className="text-[var(--text2)] text-xs font-crimson">🔮 Manter como efeito ativo (concentração)</span>
              </label>
            )}

            <button
              onClick={confirmar}
              disabled={semNivelDisponivel}
              className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {efeito === 'nenhum' ? 'Registrar' : 'Continuar'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
