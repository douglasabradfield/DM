'use client'

import { useAcDoCombatente } from '@/components/batalha/AcCombatentesContext'
import { useMemo, useState } from 'react'
import { getCondicao } from '@/lib/dados-dnd/condicoes'
import { vantagemDerivada } from '@/lib/batalha/vantagem-por-condicao'
import { BarraVida } from '@/components/batalha/BarraVida'
import { BotaoEspacosMagia, resumoEspacos } from '@/components/batalha/EspacosMagia'
import { RecursosLeitura } from '@/components/personagem/RecursosClasse'
import type { Combatente, TipoCondicao } from '@/types/batalha'
import type { InfoPersonagem } from '../tipos'
import { Avatar } from '../ui/Avatar'
import { ModalCondicao } from '../ui/ModalCondicao'

// Cartão central — único elemento que pode encolher. Quando o conteúdo não
// cabe (telas pequenas), o cartão rola por dentro; a barra de ações fica fixa.
export function CartaoPersonagem({
  combatente: c, info, opcoesSelecao, mostrarSeletorSempre, rotuloSeletor, selecionadoId, onSelecionar, onEncerrarEfeito,
}: {
  combatente: Combatente
  info: InfoPersonagem | undefined
  opcoesSelecao: Combatente[]
  mostrarSeletorSempre?: boolean
  rotuloSeletor?: string
  selecionadoId: string | null
  onSelecionar: (id: string) => void
  onEncerrarEfeito?: (nome: string) => void
}) {
  const ac = useAcDoCombatente(c)
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const estaMorto = c.morto || c.pv_atual <= 0
  const subtitulo = [info?.classe, info?.nivel ? `Nv${info.nivel}` : null].filter(Boolean).join(' · ')
  const derivada = useMemo(() => vantagemDerivada(c.condicoes), [c.condicoes])

  return (
    <div className="h-full flex flex-col gap-1.5 min-h-0 overflow-y-auto rounded-xl bg-[var(--bg2)] border border-[var(--gold)]/40 shadow-lg p-3 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {(mostrarSeletorSempre ? opcoesSelecao.length > 0 : opcoesSelecao.length > 1) && (
        <div className="flex-shrink-0">
          {rotuloSeletor && <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase mb-0.5">{rotuloSeletor}</p>}
          <select
            value={selecionadoId ?? ''}
            onChange={e => onSelecionar(e.target.value)}
            className="input-dd w-full text-xs py-1"
          >
            {opcoesSelecao.map(mc => <option key={mc.id} value={mc.id}>{mc.nome}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={44} />
        <div className="min-w-0 flex-1">
          <h2 className="font-cinzel text-[var(--gold)] text-sm font-bold truncate leading-tight">{c.nome}{estaMorto ? ' 💀' : ''}</h2>
          {subtitulo && <p className="text-[var(--text3)] text-[10px] font-crimson leading-tight">{subtitulo}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-cinzel font-bold text-[var(--text)] leading-none">
            {c.pv_atual}<span className="text-[var(--text3)] text-xs">/{c.pv_maximo}</span>
          </p>
          {c.pv_temporarios > 0 && <p className="text-[var(--accent2)] text-[10px] font-cinzel leading-tight">+{c.pv_temporarios} temp</p>}
        </div>
      </div>

      <BarraVida atual={c.pv_atual} maximo={c.pv_maximo} temporarios={c.pv_temporarios} className="flex-shrink-0" />

      <div className="flex items-center gap-3 flex-shrink-0 text-xs font-cinzel text-[var(--text2)]">
        <span>CA <b className="text-[var(--text)]">{ac}</b></span>
        <span>Desloc. <b className="text-[var(--text)]">{info?.deslocamento ? `${info.deslocamento}m` : '—'}</b></span>
      </div>

      {c.condicoes.length > 0 && (
        <div className="flex flex-wrap gap-1 flex-shrink-0">
          {c.condicoes.map(cond => (
            <button
              key={cond}
              onClick={() => setCondicaoAberta(cond)}
              className="px-2 py-1 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-[10px] font-crimson flex items-center gap-1"
            >
              <span>{getCondicao(cond)?.icone}</span>{cond}
            </button>
          ))}
        </div>
      )}

      {derivada.motivos.length > 0 && (
        <div className="flex-shrink-0 space-y-0.5 overflow-hidden">
          {derivada.motivos.map((m, i) => (
            <p key={i} className="text-[var(--gold)] text-[10px] font-crimson leading-tight truncate">⚠️ {m}</p>
          ))}
        </div>
      )}

      {/* Resumo "4/17 espaços" com painel — só leitura aqui, como antes. */}
      {resumoEspacos(c.espacos_magia) && (
        <div className="flex-shrink-0">
          <BotaoEspacosMagia combatente={c} somenteLeitura grande />
        </div>
      )}

      {/* Recursos de classe — só leitura, vindos da ficha vinculada. */}
      {c.personagem_id && (
        <div className="flex-shrink-0">
          <RecursosLeitura personagemId={c.personagem_id} />
        </div>
      )}

      {/* Lembrete, não automação — o app não tem grid posicional para saber
          quem entrou no raio. O conjurador (ou o DM operando por ele)
          encerra manualmente quando o efeito acabar. */}
      {c.efeitos_ativos.length > 0 && (
        <div className="flex flex-wrap gap-1 flex-shrink-0">
          {c.efeitos_ativos.map(ef => (
            <button
              key={ef.nome}
              onClick={() => onEncerrarEfeito?.(ef.nome)}
              disabled={!onEncerrarEfeito}
              title={onEncerrarEfeito ? 'Toque para encerrar o efeito' : undefined}
              className="px-2 py-1 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/50 text-[var(--gold)] text-[10px] font-crimson flex items-center gap-1"
            >
              ✨ {ef.nome} · R{ef.rodada_inicio}
            </button>
          ))}
        </div>
      )}

      {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
    </div>
  )
}
