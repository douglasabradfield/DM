'use client'

import { useState } from 'react'
import { getCondicao, TODAS_CONDICOES } from '@/lib/dados-dnd/condicoes'
import { BarraVida } from '@/components/batalha/BarraVida'
import { RecursosLeitura } from '@/components/personagem/RecursosClasse'
import type { TipoCondicao } from '@/types/batalha'
import type { Personagem } from '@/types/dnd'
import { cn } from '@/lib/utils'
import { Avatar } from '../ui/Avatar'
import { ModalCondicao } from '../ui/ModalCondicao'
import { EspacosMagiaSessao } from './EspacosMagiaSessao'

export function CartaoPersonagemSessao({
  personagem, podeEditar, enviando,
  opcoesSelecao, mostrarSeletorSempre, rotuloSeletor, selecionadoId, onSelecionar,
  onAjustarPV, onDefinirPVTemp, onAdicionarCondicao, onRemoverCondicao, onUsarInspiracao,
  onUsarEspaco, onRecuperarEspaco,
}: {
  personagem: Personagem
  podeEditar: boolean
  enviando: boolean
  opcoesSelecao: Personagem[]
  mostrarSeletorSempre?: boolean
  rotuloSeletor?: string
  selecionadoId: string | null
  onSelecionar: (id: string) => void
  onAjustarPV: (delta: number) => void
  onDefinirPVTemp: (novoValor: number) => void
  onAdicionarCondicao: (c: TipoCondicao) => void
  onRemoverCondicao: (c: TipoCondicao) => void
  onUsarInspiracao: () => void
  onUsarEspaco: (nivel: number) => void
  onRecuperarEspaco: (nivel: number) => void
}) {
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const [escolhendoCondicao, setEscolhendoCondicao] = useState(false)
  const [valorPV, setValorPV] = useState('')
  const subtitulo = [personagem.classe, personagem.nivel ? `Nv${personagem.nivel}` : null].filter(Boolean).join(' · ')
  const condicoesAtuais = (personagem.condicoes ?? []) as TipoCondicao[]
  const valorPVNumerico = parseInt(valorPV) || 0

  // Temporário faz *set* absoluto (não soma) — coerente com a regra 5e de
  // PV temporário não empilhar (onDefinirPVTemp já é usado assim em outros
  // lugares da tela de sessão).
  function aplicarValorPV(acao: 'dano' | 'cura' | 'temp') {
    if (valorPVNumerico <= 0) return
    if (acao === 'dano') onAjustarPV(-valorPVNumerico)
    else if (acao === 'cura') onAjustarPV(valorPVNumerico)
    else onDefinirPVTemp(valorPVNumerico)
    setValorPV('')
  }

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden rounded-xl bg-[var(--bg2)] border border-[var(--gold)]/40 shadow-lg p-3">
      {(mostrarSeletorSempre ? opcoesSelecao.length > 0 : opcoesSelecao.length > 1) && (
        <div className="flex-shrink-0">
          {rotuloSeletor && <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase mb-0.5">{rotuloSeletor}</p>}
          <select
            value={selecionadoId ?? ''}
            onChange={e => onSelecionar(e.target.value)}
            className="input-dd w-full text-xs py-1"
          >
            {opcoesSelecao.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        <Avatar nome={personagem.nome} imagemUrl={personagem.imagem_url} tamanho={44} />
        <div className="min-w-0 flex-1">
          <h2 className="font-cinzel text-[var(--gold)] text-sm font-bold truncate leading-tight">{personagem.nome}</h2>
          {subtitulo && <p className="text-[var(--text3)] text-[10px] font-crimson leading-tight">{subtitulo}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-cinzel font-bold text-[var(--text)] leading-none">
            {personagem.pv_atual}<span className="text-[var(--text3)] text-xs">/{personagem.pv_maximo}</span>
          </p>
          {personagem.pv_temporarios > 0 && <p className="text-[var(--accent2)] text-[10px] font-cinzel leading-tight">+{personagem.pv_temporarios} temp</p>}
        </div>
      </div>

      <BarraVida atual={personagem.pv_atual} maximo={personagem.pv_maximo} temporarios={personagem.pv_temporarios} className="flex-shrink-0" />

      {podeEditar && (
        <div className="flex-shrink-0 space-y-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              value={valorPV}
              onChange={e => setValorPV(e.target.value)}
              placeholder="0"
              disabled={enviando}
              className="w-14 input-dd text-center text-sm py-1.5 disabled:opacity-40"
            />
            <button
              disabled={enviando || valorPVNumerico <= 0}
              onClick={() => aplicarValorPV('dano')}
              className="flex-1 py-1.5 rounded border border-[var(--red2)]/50 text-[var(--red2)] text-xs font-cinzel font-bold min-h-[30px] disabled:opacity-40"
            >
              💔 Dano
            </button>
            <button
              disabled={enviando || valorPVNumerico <= 0}
              onClick={() => aplicarValorPV('cura')}
              className="flex-1 py-1.5 rounded border border-[var(--green2)]/50 text-[var(--green2)] text-xs font-cinzel font-bold min-h-[30px] disabled:opacity-40"
            >
              💚 Cura
            </button>
            <button
              disabled={enviando || valorPVNumerico <= 0}
              onClick={() => aplicarValorPV('temp')}
              className="flex-1 py-1.5 rounded border border-[var(--accent2)]/50 text-[var(--accent2)] text-xs font-cinzel font-bold min-h-[30px] disabled:opacity-40"
            >
              🛡️ Temp
            </button>
          </div>
          <div className="flex items-center gap-1">
            {[-5, -1, 1, 5].map(delta => (
              <button
                key={delta}
                disabled={enviando}
                onClick={() => onAjustarPV(delta)}
                className={cn(
                  'flex-1 py-1 rounded border text-[10px] font-cinzel font-bold min-h-[24px] disabled:opacity-40',
                  delta < 0 ? 'border-[var(--red2)]/50 text-[var(--red2)]' : 'border-[var(--green2)]/50 text-[var(--green2)]'
                )}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
            {personagem.pv_temporarios > 0 && (
              <button
                disabled={enviando}
                onClick={() => onDefinirPVTemp(0)}
                title="Zerar PV temporários"
                className="flex-1 py-1 rounded border border-[var(--border)] text-[var(--text3)] text-[10px] font-cinzel min-h-[24px] disabled:opacity-40"
              >
                Zerar temp
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-shrink-0 text-xs font-cinzel text-[var(--text2)]">
        <span>CA <b className="text-[var(--text)]">{personagem.ca}</b></span>
        <span>Desloc. <b className="text-[var(--text)]">{personagem.deslocamento ? `${personagem.deslocamento}m` : '—'}</b></span>
        {typeof personagem.inspiracao === 'number' && personagem.inspiracao > 0 && (
          <button
            disabled={!podeEditar || enviando}
            onClick={onUsarInspiracao}
            className="ml-auto px-2 py-1 rounded border border-[var(--gold)]/50 text-[var(--gold)] text-[10px] font-cinzel disabled:opacity-40"
          >
            ⭐ Usar inspiração ({personagem.inspiracao})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 flex-shrink-0 items-center">
        {condicoesAtuais.map(cond => (
          <button
            key={cond}
            onClick={() => setCondicaoAberta(cond)}
            className="px-2 py-1 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-[10px] font-crimson flex items-center gap-1"
          >
            <span>{getCondicao(cond)?.icone}</span>{cond}
            {podeEditar && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); onRemoverCondicao(cond) }}
                className="ml-0.5 text-[var(--text3)] hover:text-[var(--red2)]"
              >
                ×
              </span>
            )}
          </button>
        ))}
        {podeEditar && (
          escolhendoCondicao ? (
            <select
              autoFocus
              value=""
              onChange={e => { if (e.target.value) onAdicionarCondicao(e.target.value as TipoCondicao); setEscolhendoCondicao(false) }}
              onBlur={() => setEscolhendoCondicao(false)}
              className="input-dd text-[10px] py-1"
            >
              <option value="">— Condição —</option>
              {TODAS_CONDICOES.filter(c => !condicoesAtuais.includes(c as TipoCondicao)).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEscolhendoCondicao(true)}
              className="px-2 py-1 rounded-full border border-dashed border-[var(--border)] text-[var(--text3)] text-[10px] font-crimson"
            >
              + Condição
            </button>
          )
        )}
      </div>

      {Object.values(personagem.slots_magia ?? {}).some(e => e.total > 0) && (
        <div className="flex-shrink-0">
          <EspacosMagiaSessao
            slotsMagia={personagem.slots_magia}
            podeEditar={podeEditar}
            onUsar={onUsarEspaco}
            onRecuperar={onRecuperarEspaco}
          />
        </div>
      )}

      {/* Recursos de classe — só leitura na mesa; edição fica na ficha. */}
      <div className="flex-shrink-0">
        <RecursosLeitura personagemId={personagem.id} />
      </div>

      {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
    </div>
  )
}
