'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useBatalha } from '@/store/batalha'
import { useCampanha } from '@/store/campanha'
import { usePermissao } from '@/hooks/usePermissao'
import { createClient } from '@/lib/supabase/client'
import { pvVisivelParaJogador, ESTADO_VAGO_INFO, type ModoRevelacao } from '@/lib/batalha/visibilidade-pv'
import { vantagemDerivada } from '@/lib/batalha/vantagem-por-condicao'
import { getCondicao } from '@/lib/dados-dnd/condicoes'
import { BarraVida } from '@/components/batalha/BarraVida'
import type { ArmaEmpunhada, Combatente, EntradaLog, TipoCondicao, EspacosMagiaBatalha } from '@/types/batalha'
import { cn } from '@/lib/utils'
import { Swords, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface InfoPersonagem {
  imagem_url: string | null
  classe: string | null
  nivel: number | null
  deslocamento: number | null
  user_id: string | null
}

interface AtaqueDisponivel {
  nome: string
  bonus: string
  dano: string
}

interface MagiaExibida {
  id: string
  nome: string
  nivel: number
  preparada: boolean
}

function ordenarPorNome(combatentes: Combatente[]): Combatente[] {
  return [...combatentes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function mensagemToast(entrada: EntradaLog): string | null {
  if (entrada.tipo === 'dano' && entrada.valor != null) {
    return `⚔️ ${entrada.origem} causou ${entrada.valor} em ${entrada.alvo}`
  }
  if (entrada.tipo === 'cura' && entrada.valor != null) {
    return `💚 ${entrada.origem} curou ${entrada.valor} em ${entrada.alvo}`
  }
  if (entrada.tipo === 'morte') {
    return `💀 ${entrada.alvo} caiu!`
  }
  return null
}

// Degradação graciosa: prioriza magias preparadas; se nenhuma estiver
// marcada como preparada (caso comum hoje — a ficha ainda não expõe esse
// toggle), mostra todas com um aviso em vez de uma lista vazia enganosa.
function selecionarMagiasExibidas(magias: MagiaExibida[]): { magias: MagiaExibida[]; aviso: string | null } {
  if (magias.length === 0) return { magias: [], aviso: null }
  const preparadas = magias.filter(m => m.preparada)
  if (preparadas.length > 0) return { magias: preparadas, aviso: null }
  return { magias, aviso: 'Nenhuma magia marcada como preparada na ficha' }
}

function Avatar({ nome, imagemUrl, tamanho = 44 }: { nome: string; imagemUrl?: string | null; tamanho?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 relative"
      style={{ width: tamanho, height: tamanho, backgroundColor: 'var(--surface2)' }}
    >
      <span
        className="text-[var(--text2)] font-cinzel font-bold absolute inset-0 flex items-center justify-center"
        style={{ fontSize: tamanho * 0.4 }}
      >
        {nome.charAt(0).toUpperCase()}
      </span>
      {imagemUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagemUrl}
          alt={nome}
          className="w-full h-full object-cover relative"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
    </div>
  )
}

function EspacosMagiaLeitura({ espacos }: { espacos: EspacosMagiaBatalha }) {
  const niveis = Object.entries(espacos)
    .filter(([, e]) => e.total > 0)
    .map(([n, e]) => ({ nivel: parseInt(n), ...e }))
    .sort((a, b) => a.nivel - b.nivel)

  if (niveis.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]">
      {niveis.map(({ nivel, total, utilizados }) => (
        <div key={nivel} className="flex items-center gap-0.5">
          <span className="text-[var(--text3)] font-cinzel">N{nivel}</span>
          <span style={{ color: 'var(--accent2)' }}>
            {'●'.repeat(Math.max(0, total - utilizados))}{'○'.repeat(Math.min(total, utilizados))}
          </span>
        </div>
      ))}
    </div>
  )
}

function ModalCondicao({ condicao, onFechar }: { condicao: TipoCondicao; onFechar: () => void }) {
  const info = getCondicao(condicao)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg shadow-2xl max-w-sm w-full p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-cinzel text-[var(--accent2)] font-bold text-base flex items-center gap-2">
            <span>{info?.icone}</span> {condicao}
          </h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        {info ? (
          <>
            <p className="text-[var(--text2)] text-sm font-crimson mb-3">{info.descricao}</p>
            {info.efeitos.length > 0 && (
              <ul className="list-disc list-inside space-y-1 mb-3">
                {info.efeitos.map((ef, i) => (
                  <li key={i} className="text-[var(--text3)] text-xs font-crimson">{ef}</li>
                ))}
              </ul>
            )}
            {info.como_sair && (
              <p className="text-[var(--text3)] text-xs font-crimson italic">Como sair: {info.como_sair}</p>
            )}
          </>
        ) : (
          <p className="text-[var(--text3)] text-sm font-crimson">Sem descrição disponível.</p>
        )}
      </div>
    </div>,
    document.body
  )
}

// Popup de combatente — substitui as antigas listas de Aliados/Inimigos.
// Fase 2: só leitura. Fase 3 reaproveita este mesmo popup como seletor de alvo.
function PopupCombatente({
  combatente: c, info, revelacaoPv, ehDM, onFechar,
}: {
  combatente: Combatente
  info: InfoPersonagem | undefined
  revelacaoPv: ModoRevelacao
  ehDM: boolean
  onFechar: () => void
}) {
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const estaMorto = c.morto || c.pv_atual <= 0
  const visibilidade = ehDM ? { modo: 'exato' as const } : pvVisivelParaJogador(c, revelacaoPv)

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={48} />
          <div className="min-w-0 flex-1">
            <p className="font-cinzel text-[var(--gold)] font-bold text-base truncate">{c.nome}{estaMorto ? ' 💀' : ''}</p>
            {c.ausente && <p className="text-[var(--text3)] text-xs font-crimson">Ausente</p>}
          </div>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          {visibilidade.modo === 'exato' && (
            <>
              <span className="text-[var(--text2)] text-sm font-cinzel">PV {c.pv_atual}/{c.pv_maximo}</span>
              <span className="text-[var(--text2)] text-sm font-cinzel">CA {c.ca}</span>
            </>
          )}
          {visibilidade.modo === 'vago' && visibilidade.estado && (
            <span
              className="px-2 py-0.5 rounded border text-xs font-cinzel font-bold"
              style={{ color: ESTADO_VAGO_INFO[visibilidade.estado].cor, borderColor: ESTADO_VAGO_INFO[visibilidade.estado].cor }}
            >
              {ESTADO_VAGO_INFO[visibilidade.estado].label}
            </span>
          )}
          {visibilidade.modo === 'oculto' && (
            <span className="text-[var(--text3)] text-xs font-crimson italic">PV desconhecido</span>
          )}
        </div>

        {c.condicoes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {c.condicoes.map(cond => (
              <button
                key={cond}
                onClick={() => setCondicaoAberta(cond)}
                className="px-2.5 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-xs font-crimson flex items-center gap-1 min-h-[36px]"
              >
                <span>{getCondicao(cond)?.icone}</span>{cond}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text3)] text-xs font-crimson italic">Sem condições ativas</p>
        )}

        {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
      </div>
    </div>,
    document.body
  )
}

// Barra de participantes — NUNCA em ordem de iniciativa (a mesa sorteia por
// cartas a cada rodada; vazar a ordem deixaria os jogadores planejarem
// sabendo quem vem depois). Jogador vê só os PJs; DM vê todos, PJs primeiro.
// O único indício de sequência permitido é o anel de quem age AGORA.
// Tocar um avatar abre o popup de detalhes (substitui as listas removidas).
function BarraParticipantes({
  participantes, turnoCombatenteId, ativa, infoPersonagens, meuCombatenteIds, onTocar,
}: {
  participantes: Combatente[]
  turnoCombatenteId: string | null
  ativa: boolean
  infoPersonagens: Record<string, InfoPersonagem>
  meuCombatenteIds: Set<string>
  onTocar: (id: string) => void
}) {
  return (
    <div className="flex-shrink-0 flex gap-2 overflow-x-auto px-3 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
      {participantes.map(c => {
        const info = c.personagem_id ? infoPersonagens[c.personagem_id] : undefined
        const estaAtivo = ativa && c.id === turnoCombatenteId
        const estaMorto = c.morto || c.pv_atual <= 0
        const ehMeu = meuCombatenteIds.has(c.id)
        return (
          <button
            key={c.id}
            onClick={() => onTocar(c.id)}
            className={cn('flex-shrink-0 flex flex-col items-center gap-0.5 w-14', (estaMorto || c.ausente) && 'opacity-40')}
          >
            <div
              className="rounded-full p-0.5"
              style={{ boxShadow: estaAtivo ? '0 0 0 2px var(--gold)' : ehMeu ? '0 0 0 2px var(--accent2)' : '0 0 0 1px var(--border)' }}
            >
              <div className="relative">
                <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={44} />
                {c.condicoes.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--red2)] border border-[var(--bg2)]" />
                )}
              </div>
            </div>
            <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{c.nome}</span>
          </button>
        )
      })}
    </div>
  )
}

function StatusRodada({
  ativa, statusBatalha, rodadaAtual, combatenteDoTurno, ehMeuTurno,
}: {
  ativa: boolean
  statusBatalha: string
  rodadaAtual: number
  combatenteDoTurno: Combatente | null
  ehMeuTurno: boolean
}) {
  if (statusBatalha === 'pausada') {
    return (
      <div className="flex-shrink-0 py-1.5 text-center">
        <span className="text-[var(--gold)] text-xs font-cinzel animate-pulse">⏸ Pausada</span>
      </div>
    )
  }
  if (!ativa || !combatenteDoTurno) {
    return (
      <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
        Rodada {rodadaAtual}
      </div>
    )
  }
  if (ehMeuTurno) {
    return (
      <div className="flex-shrink-0 py-1.5 bg-[var(--gold)] text-[var(--bg)] text-center font-cinzel font-bold text-xs">
        ⚔️ É a sua vez! · Rodada {rodadaAtual}
      </div>
    )
  }
  return (
    <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
      Vez de {combatenteDoTurno.nome} · Rodada {rodadaAtual}
    </div>
  )
}

// Cartão central — único elemento que pode encolher. Sem scroll: quando o
// conteúdo aperta, a densidade (fonte/espaçamento) cede, nunca overflow.
function CartaoPersonagem({
  combatente: c, info, meusCombatentes, selecionadoId, onSelecionar,
}: {
  combatente: Combatente
  info: InfoPersonagem | undefined
  meusCombatentes: Combatente[]
  selecionadoId: string | null
  onSelecionar: (id: string) => void
}) {
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const estaMorto = c.morto || c.pv_atual <= 0
  const subtitulo = [info?.classe, info?.nivel ? `Nv${info.nivel}` : null].filter(Boolean).join(' · ')
  const derivada = useMemo(() => vantagemDerivada(c.condicoes), [c.condicoes])

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden rounded-xl bg-[var(--bg2)] border border-[var(--gold)]/40 shadow-lg p-3">
      {meusCombatentes.length > 1 && (
        <select
          value={selecionadoId ?? ''}
          onChange={e => onSelecionar(e.target.value)}
          className="input-dd w-full text-xs py-1 flex-shrink-0"
        >
          {meusCombatentes.map(mc => <option key={mc.id} value={mc.id}>{mc.nome}</option>)}
        </select>
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
        <span>CA <b className="text-[var(--text)]">{c.ca}</b></span>
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

      {Object.keys(c.espacos_magia).length > 0 && (
        <div className="flex-shrink-0">
          <EspacosMagiaLeitura espacos={c.espacos_magia} />
        </div>
      )}

      {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
    </div>
  )
}

// Fase 2: somente leitura. Reflete o campo `vantagem` já persistido no
// store (o mesmo que o DM ajusta em TabelaCombate) — quando a Fase 3
// habilitar escrita aqui, basta tirar o `disabled`.
function FaixaVantagem({ combatente }: { combatente: Combatente }) {
  const opcoes = [
    { valor: 'desvantagem' as const, label: '▼ Desvantagem', corAtiva: 'var(--red2)' },
    { valor: null, label: 'Normal', corAtiva: 'var(--surface2)' },
    { valor: 'vantagem' as const, label: '▲ Vantagem', corAtiva: 'var(--green2)' },
  ]

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5">
      <div className="flex items-center rounded-lg overflow-hidden border border-[var(--border)]">
        {opcoes.map(opt => {
          const ativa = combatente.vantagem === opt.valor
          return (
            <button
              key={opt.label}
              disabled
              title="Ajustável em breve — hoje reflete o que o mestre define"
              className={cn(
                'flex-1 text-center py-2 text-[11px] font-cinzel cursor-not-allowed transition-colors min-h-[38px]',
                ativa ? 'text-[var(--text)]' : 'text-[var(--text3)] opacity-60'
              )}
              style={ativa ? { backgroundColor: opt.corAtiva } : undefined}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModalEscolherArma({
  ataques, armaAtual, onEscolher, onLimpar, onFechar,
}: {
  ataques: AtaqueDisponivel[]
  armaAtual: ArmaEmpunhada | null | undefined
  onEscolher: (arma: ArmaEmpunhada) => void
  onLimpar: () => void
  onFechar: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">Empunhar arma</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {ataques.map((a, i) => (
            <button
              key={i}
              onClick={() => onEscolher(a)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
            >
              <span className="text-[var(--text)] text-sm font-crimson truncate">{a.nome}</span>
              <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">{a.bonus} · {a.dano}</span>
            </button>
          ))}
        </div>
        {armaAtual && (
          <button
            onClick={onLimpar}
            className="w-full mt-3 py-2.5 rounded-lg border border-[var(--red2)]/50 text-[var(--red2)] text-xs font-cinzel min-h-[44px]"
          >
            ✕ Desempunhar
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

// Slot de arma empunhada — a única escrita permitida na Fase 2 (preferência
// de UI, não ação de jogo). Toque num slot vazio abre o seletor; toque num
// slot preenchido não ataca ainda (isso é Fase 3) — só o ícone de troca abre
// o seletor de novo.
function SlotArma({
  arma, ataquesDisponiveis, onEscolher, onLimpar,
}: {
  arma: ArmaEmpunhada | null | undefined
  ataquesDisponiveis: AtaqueDisponivel[]
  onEscolher: (arma: ArmaEmpunhada) => void
  onLimpar: () => void
}) {
  const [abrindoPicker, setAbrindoPicker] = useState(false)

  if (!arma && ataquesDisponiveis.length === 0) {
    return (
      <div className="flex-shrink-0 w-16 min-h-[56px] flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[var(--text3)] text-[9px] font-crimson text-center px-1 leading-tight">
        Sem ataques na ficha
      </div>
    )
  }

  if (!arma) {
    return (
      <>
        <button
          onClick={() => setAbrindoPicker(true)}
          className="flex-shrink-0 w-16 min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[var(--accent2)]/60 text-[var(--accent2)] text-[10px] font-cinzel"
        >
          <span className="text-base leading-none">+</span>
          Empunhar
        </button>
        {abrindoPicker && (
          <ModalEscolherArma
            ataques={ataquesDisponiveis}
            armaAtual={null}
            onEscolher={a => { onEscolher(a); setAbrindoPicker(false) }}
            onLimpar={() => setAbrindoPicker(false)}
            onFechar={() => setAbrindoPicker(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="relative flex-shrink-0 w-16 min-h-[56px] rounded-lg border border-[var(--border)] bg-[var(--surface)] flex flex-col items-center justify-center px-1 text-center">
        <p className="text-[var(--text)] text-[11px] font-cinzel font-bold truncate w-full leading-tight">{arma.nome}</p>
        <p className="text-[var(--text3)] text-[10px] font-crimson leading-tight">{arma.dano}</p>
        <button
          onClick={() => setAbrindoPicker(true)}
          title="Trocar arma"
          aria-label="Trocar arma"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--bg3)] border border-[var(--border)] text-[var(--text3)] flex items-center justify-center text-[10px]"
        >
          ⇄
        </button>
      </div>
      {abrindoPicker && (
        <ModalEscolherArma
          ataques={ataquesDisponiveis}
          armaAtual={arma}
          onEscolher={a => { onEscolher(a); setAbrindoPicker(false) }}
          onLimpar={() => { onLimpar(); setAbrindoPicker(false) }}
          onFechar={() => setAbrindoPicker(false)}
        />
      )}
    </>
  )
}

function ModalMagias({ personagemId, personagemNome, onFechar }: { personagemId: string; personagemNome: string; onFechar: () => void }) {
  const [carregando, setCarregando] = useState(true)
  const [magias, setMagias] = useState<MagiaExibida[]>([])

  useEffect(() => {
    let cancelado = false
    createClient()
      .from('magias_personagem')
      .select('id, preparada, nivel, spell:spells!spell_id(name_pt)')
      .eq('personagem_id', personagemId)
      .order('nivel')
      .then(({ data }) => {
        if (cancelado) return
        const linhas = (data ?? []) as unknown as { id: string; preparada: boolean; nivel: number; spell: { name_pt: string } | null }[]
        setMagias(linhas.map(m => ({ id: m.id, nome: m.spell?.name_pt ?? '(sem nome)', nivel: m.nivel, preparada: m.preparada })))
        setCarregando(false)
      })
    return () => { cancelado = true }
  }, [personagemId])

  const { magias: exibidas, aviso } = selecionarMagiasExibidas(magias)

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
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
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  <span className="text-[var(--text)] text-sm font-crimson truncate">{m.nome}</span>
                  <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0 ml-2">{m.nivel === 0 ? 'Truque' : `N${m.nivel}`}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-[var(--text3)] text-[10px] font-crimson italic mt-3 text-center">Conjurar chega na Fase 3</p>
      </div>
    </div>,
    document.body
  )
}

// Rodapé fixo — alcance do polegar. Fase 2 reserva o espaço e valida a
// ergonomia: Ataque e Item ficam desabilitados (escrita é Fase 3); Magia é
// exceção deliberada — é só leitura (lista as magias da ficha), então fica
// habilitada. Armas empunhadas são a única escrita real desta fase.
function BarraAcoes({
  combatente, ehMeuTurno, onDefinirArma,
}: {
  combatente: Combatente
  ehMeuTurno: boolean
  onDefinirArma: (lado: 'esquerda' | 'direita', arma: ArmaEmpunhada | null) => void
}) {
  const [modalMagiaAberto, setModalMagiaAberto] = useState(false)
  const ataquesDisponiveis: AtaqueDisponivel[] = combatente.dados_personagem?.ataques ?? []

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-2 py-1.5 space-y-1">
      <div className="flex items-stretch gap-1.5">
        <SlotArma
          arma={combatente.arma_esquerda}
          ataquesDisponiveis={ataquesDisponiveis}
          onEscolher={a => onDefinirArma('esquerda', a)}
          onLimpar={() => onDefinirArma('esquerda', null)}
        />

        <div className="flex-1 grid grid-cols-3 gap-1.5">
          <button
            disabled
            aria-label="Disponível em breve"
            title="Disponível em breve"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] cursor-not-allowed transition-opacity',
              !ehMeuTurno && 'opacity-40'
            )}
          >
            <span className="text-base leading-none">⚔️</span>
            Ataque
          </button>
          <button
            onClick={() => setModalMagiaAberto(true)}
            aria-label="Ver magias"
            title="Ver magias — conjurar chega na Fase 3"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] transition-opacity',
              !ehMeuTurno && 'opacity-40'
            )}
          >
            <span className="text-base leading-none">✨</span>
            Magia
          </button>
          <button
            disabled
            aria-label="Disponível em breve"
            title="Disponível em breve"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] cursor-not-allowed transition-opacity',
              !ehMeuTurno && 'opacity-40'
            )}
          >
            <span className="text-base leading-none">🎒</span>
            Item
          </button>
        </div>

        <SlotArma
          arma={combatente.arma_direita}
          ataquesDisponiveis={ataquesDisponiveis}
          onEscolher={a => onDefinirArma('direita', a)}
          onLimpar={() => onDefinirArma('direita', null)}
        />
      </div>

      <button
        disabled
        aria-label="Disponível em breve"
        title="Disponível em breve"
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--accent2)]/50 bg-[var(--surface)] text-[var(--accent2)] font-cinzel text-xs py-1 min-h-[30px] cursor-not-allowed"
      >
        <span className="text-sm leading-none">⚡</span> Reação
      </button>

      {modalMagiaAberto && combatente.personagem_id && (
        <ModalMagias
          personagemId={combatente.personagem_id}
          personagemNome={combatente.nome}
          onFechar={() => setModalMagiaAberto(false)}
        />
      )}
    </div>
  )
}

export function MesaCliente() {
  const {
    combatentes, log, rodadaAtual, turnoAtual, turnoCombatenteId, ativa,
    statusBatalha, batalhaId, revelacaoPv, carregarBatalhaAtiva, definirArmaEmpunhada,
  } = useBatalha()
  const { campanhaAtiva } = useCampanha()
  const { ehDM } = usePermissao()

  const [userId, setUserId] = useState<string | null>(null)
  const [infoPersonagens, setInfoPersonagens] = useState<Record<string, InfoPersonagem>>({})
  const [carregandoBatalha, setCarregandoBatalha] = useState(true)
  const [personagemSelecionadoId, setPersonagemSelecionadoId] = useState<string | null>(null)
  const [popupCombatenteId, setPopupCombatenteId] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!campanhaAtiva?.id) { setCarregandoBatalha(false); return }
    let cancelado = false
    setCarregandoBatalha(true)
    carregarBatalhaAtiva(campanhaAtiva.id).finally(() => { if (!cancelado) setCarregandoBatalha(false) })
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaAtiva?.id])

  // Reaproveita a assinatura Realtime já mantida pelo store — não cria outro canal.
  useEffect(() => {
    if (!batalhaId) return
    useBatalha.getState().assinarRealtime()
    return () => { useBatalha.getState().encerrarRealtime() }
  }, [batalhaId])

  const personagemIdsKey = useMemo(
    () => Array.from(new Set(combatentes.map(c => c.personagem_id).filter((id): id is string => !!id))).sort().join(','),
    [combatentes]
  )

  useEffect(() => {
    const ids = personagemIdsKey ? personagemIdsKey.split(',') : []
    if (ids.length === 0) { setInfoPersonagens({}); return }
    let cancelado = false
    createClient()
      .from('personagens')
      .select('id, imagem_url, classe, nivel, deslocamento, user_id')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelado || !data) return
        const mapa: Record<string, InfoPersonagem> = {}
        data.forEach(p => { mapa[p.id] = p })
        setInfoPersonagens(mapa)
      })
    return () => { cancelado = true }
  }, [personagemIdsKey])

  // Toasts de ação — apenas para entradas novas de log, nunca para o histórico carregado.
  const logVistosRef = useRef<Set<string>>(new Set())
  const batalhaLogRef = useRef<string | null>(null)
  useEffect(() => {
    if (batalhaId !== batalhaLogRef.current) {
      batalhaLogRef.current = batalhaId
      logVistosRef.current = new Set(log.map(l => l.id))
      return
    }
    log.forEach(entrada => {
      if (logVistosRef.current.has(entrada.id)) return
      logVistosRef.current.add(entrada.id)
      const msg = mensagemToast(entrada)
      if (msg) toast(msg, { duration: 3000 })
    })
  }, [log, batalhaId])

  const meuCombatentes = useMemo(() => {
    if (!userId) return []
    return combatentes.filter(c => c.personagem_id && infoPersonagens[c.personagem_id]?.user_id === userId)
  }, [combatentes, infoPersonagens, userId])

  const meuCombatenteIds = useMemo(() => new Set(meuCombatentes.map(c => c.id)), [meuCombatentes])

  useEffect(() => {
    if (meuCombatentes.length === 0) { setPersonagemSelecionadoId(null); return }
    if (!personagemSelecionadoId || !meuCombatentes.some(c => c.id === personagemSelecionadoId)) {
      setPersonagemSelecionadoId(meuCombatentes[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuCombatentes])

  const combatenteSelecionado = meuCombatentes.find(c => c.id === personagemSelecionadoId) ?? null

  // Barra de participantes: NUNCA por iniciativa. Jogador só vê os PJs;
  // DM vê todos, PJs primeiro e depois monstros/NPCs — sempre em ordem
  // alfabética, para não revelar a sequência sorteada por cartas.
  const participantesBarra = useMemo(() => {
    const jogadores = ordenarPorNome(combatentes.filter(c => c.tipo === 'jogador'))
    if (!ehDM) return jogadores
    const outros = ordenarPorNome(combatentes.filter(c => c.tipo !== 'jogador'))
    return [...jogadores, ...outros]
  }, [combatentes, ehDM])

  const ativosOrdenados = useMemo(
    () => [...combatentes].sort((a, b) => a.ordem - b.ordem).filter(c => !c.ausente && !c.morto),
    [combatentes]
  )
  const combatenteDoTurno = ativa ? ativosOrdenados[turnoAtual] ?? null : null
  const ehMeuTurno = !!combatenteDoTurno && meuCombatenteIds.has(combatenteDoTurno.id)

  const combatentePopup = popupCombatenteId ? combatentes.find(c => c.id === popupCombatenteId) ?? null : null

  if (carregandoBatalha) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--text3)] font-cinzel text-sm">Carregando...</p>
      </div>
    )
  }

  if (!campanhaAtiva) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-8 text-center">
        <Swords className="w-10 h-10 text-[var(--border)]" />
        <p className="font-cinzel text-[var(--border)] text-lg">Selecione uma campanha</p>
        <p className="text-[var(--border)] text-sm font-crimson">Escolha uma campanha no menu para ver a mesa.</p>
      </div>
    )
  }

  if (!batalhaId || statusBatalha === 'inativa' || statusBatalha === 'concluida') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-8 text-center">
        <Swords className="w-10 h-10 text-[var(--border)]" />
        <p className="font-cinzel text-[var(--border)] text-lg">Nenhuma batalha em andamento</p>
        <p className="text-[var(--border)] text-sm font-crimson max-w-xs">
          Quando o mestre iniciar uma batalha, ela aparecerá aqui automaticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BarraParticipantes
        participantes={participantesBarra}
        turnoCombatenteId={turnoCombatenteId}
        ativa={ativa}
        infoPersonagens={infoPersonagens}
        meuCombatenteIds={meuCombatenteIds}
        onTocar={setPopupCombatenteId}
      />

      <StatusRodada
        ativa={ativa}
        statusBatalha={statusBatalha}
        rodadaAtual={rodadaAtual}
        combatenteDoTurno={combatenteDoTurno}
        ehMeuTurno={ehMeuTurno}
      />

      <div className="flex-1 min-h-0 overflow-hidden px-3 pb-2">
        {combatenteSelecionado ? (
          <CartaoPersonagem
            combatente={combatenteSelecionado}
            info={combatenteSelecionado.personagem_id ? infoPersonagens[combatenteSelecionado.personagem_id] : undefined}
            meusCombatentes={meuCombatentes}
            selecionadoId={personagemSelecionadoId}
            onSelecionar={setPersonagemSelecionadoId}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-center px-4">
            <p className="text-[var(--text3)] text-xs font-crimson">
              Você não está controlando nenhum personagem nesta batalha. Toque em um participante acima para ver detalhes.
            </p>
          </div>
        )}
      </div>

      {combatenteSelecionado && (
        <>
          <FaixaVantagem combatente={combatenteSelecionado} />
          <BarraAcoes
            combatente={combatenteSelecionado}
            ehMeuTurno={ehMeuTurno}
            onDefinirArma={(lado, arma) => definirArmaEmpunhada(combatenteSelecionado.id, lado, arma)}
          />
        </>
      )}

      {combatentePopup && (
        <PopupCombatente
          combatente={combatentePopup}
          info={combatentePopup.personagem_id ? infoPersonagens[combatentePopup.personagem_id] : undefined}
          revelacaoPv={revelacaoPv}
          ehDM={ehDM}
          onFechar={() => setPopupCombatenteId(null)}
        />
      )}
    </div>
  )
}
