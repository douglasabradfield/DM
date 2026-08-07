'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBatalha } from '@/store/batalha'
import { useCampanha } from '@/store/campanha'
import { usePermissao } from '@/hooks/usePermissao'
import { createClient } from '@/lib/supabase/client'
import { pvVisivelParaJogador, ESTADO_VAGO_INFO, type ModoRevelacao } from '@/lib/batalha/visibilidade-pv'
import { getCondicao } from '@/lib/dados-dnd/condicoes'
import { BarraVida } from '@/components/batalha/BarraVida'
import type { Combatente, EntradaLog, TipoCondicao, EspacosMagiaBatalha } from '@/types/batalha'
import { cn } from '@/lib/utils'
import { Swords, ChevronDown, ChevronUp, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface InfoPersonagem {
  imagem_url: string | null
  classe: string | null
  nivel: number | null
  deslocamento: number | null
  user_id: string | null
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

function formatarLogCurto(e: EntradaLog): string {
  if (e.tipo === 'dano' && e.valor != null) {
    return `R${e.rodada} · ${e.origem} → ${e.alvo}: ${e.valor} de dano${e.tipo_dano ? ` (${e.tipo_dano})` : ''}`
  }
  if (e.tipo === 'cura' && e.valor != null) {
    return `R${e.rodada} · ${e.origem} → ${e.alvo}: ${e.valor} de cura`
  }
  if (e.tipo === 'morte') return `R${e.rodada} · ${e.alvo} caiu`
  return `R${e.rodada} · ${e.descricao}`
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

  if (niveis.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2.5">
      {niveis.map(({ nivel, total, utilizados }) => (
        <div key={nivel} className="flex items-center gap-1">
          <span className="text-[var(--text3)] text-[10px] font-cinzel">{nivel}º</span>
          <div className="flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full border"
                style={{
                  borderColor: 'var(--accent2)',
                  backgroundColor: i < utilizados ? 'transparent' : 'var(--accent2)',
                }}
              />
            ))}
          </div>
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

function BarraParticipantes({
  combatentes, turnoCombatenteId, ativa, infoPersonagens, meuCombatenteIds,
}: {
  combatentes: Combatente[]
  turnoCombatenteId: string | null
  ativa: boolean
  infoPersonagens: Record<string, InfoPersonagem>
  meuCombatenteIds: Set<string>
}) {
  const ordenados = useMemo(() => [...combatentes].sort((a, b) => a.ordem - b.ordem), [combatentes])

  return (
    <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto px-3 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
      {ordenados.map(c => {
        const info = c.personagem_id ? infoPersonagens[c.personagem_id] : undefined
        const estaAtivo = ativa && c.id === turnoCombatenteId
        const estaMorto = c.morto || c.pv_atual <= 0
        const ehMeu = meuCombatenteIds.has(c.id)
        return (
          <div key={c.id} className={cn('flex-shrink-0 flex flex-col items-center gap-1 w-14', (estaMorto || c.ausente) && 'opacity-40')}>
            <div
              className="rounded-full p-0.5"
              style={{ boxShadow: estaAtivo ? '0 0 0 2px var(--gold)' : ehMeu ? '0 0 0 2px var(--accent2)' : '0 0 0 1px var(--border)' }}
            >
              <div className="relative">
                <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={44} />
                {c.condicoes.length > 0 && (
                  <span
                    title={c.condicoes.join(', ')}
                    className="absolute -top-1 -right-1 text-[11px] leading-none bg-[var(--bg2)] rounded-full w-4 h-4 flex items-center justify-center"
                  >
                    {getCondicao(c.condicoes[0])?.icone ?? '⚠️'}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{c.nome}</span>
          </div>
        )
      })}
    </div>
  )
}

function IndicadorVez({
  ativa, rodadaAtual, combatenteDoTurno, ehMeuTurno,
}: {
  ativa: boolean
  rodadaAtual: number
  combatenteDoTurno: Combatente | null
  ehMeuTurno: boolean
}) {
  if (!ativa || !combatenteDoTurno) return null

  if (ehMeuTurno) {
    return (
      <div className="px-3 py-2.5 bg-[var(--gold)] text-[var(--bg)] text-center font-cinzel font-bold text-sm">
        ⚔️ É a sua vez! · Rodada {rodadaAtual}
      </div>
    )
  }

  return (
    <div className="px-3 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
      Vez de {combatenteDoTurno.nome} · Rodada {rodadaAtual}
    </div>
  )
}

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
  const subtitulo = [info?.classe, info?.nivel ? `Nível ${info.nivel}` : null].filter(Boolean).join(' · ')

  return (
    <div className="mx-3 my-3 p-4 rounded-xl bg-[var(--bg2)] border border-[var(--gold)]/40 shadow-lg">
      {meusCombatentes.length > 1 && (
        <select
          value={selecionadoId ?? ''}
          onChange={e => onSelecionar(e.target.value)}
          className="input-dd w-full mb-3 text-sm"
        >
          {meusCombatentes.map(mc => <option key={mc.id} value={mc.id}>{mc.nome}</option>)}
        </select>
      )}

      <div className="flex items-center gap-3 mb-3">
        <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={64} />
        <div className="min-w-0 flex-1">
          <h2 className="font-cinzel text-[var(--gold)] text-lg font-bold truncate">{c.nome}{estaMorto ? ' 💀' : ''}</h2>
          {subtitulo && <p className="text-[var(--text3)] text-xs font-crimson">{subtitulo}</p>}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-2xl font-cinzel font-bold text-[var(--text)]">{c.pv_atual}</span>
          <span className="text-[var(--text3)] text-sm">/ {c.pv_maximo} PV</span>
          {c.pv_temporarios > 0 && (
            <span className="text-[var(--accent2)] text-xs font-cinzel ml-1">+{c.pv_temporarios} temp</span>
          )}
        </div>
        <BarraVida atual={c.pv_atual} maximo={c.pv_maximo} temporarios={c.pv_temporarios} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[var(--surface)] rounded-lg p-2 text-center">
          <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase">CA</p>
          <p className="text-[var(--text)] font-bold text-lg font-cinzel">{c.ca}</p>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-2 text-center">
          <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Iniciativa</p>
          <p className="text-[var(--text)] font-bold text-lg font-cinzel">{c.iniciativa}</p>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-2 text-center">
          <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Desloc.</p>
          <p className="text-[var(--text)] font-bold text-lg font-cinzel">
            {info?.deslocamento ? `${info.deslocamento}m` : '—'}
          </p>
        </div>
      </div>

      {c.condicoes.length > 0 && (
        <div className="mb-3">
          <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase tracking-wider mb-1.5">Condições</p>
          <div className="flex flex-wrap gap-1.5">
            {c.condicoes.map(cond => (
              <button
                key={cond}
                onClick={() => setCondicaoAberta(cond)}
                className="px-2.5 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-xs font-crimson flex items-center gap-1 min-h-[38px]"
              >
                <span>{getCondicao(cond)?.icone}</span>
                {cond}
              </button>
            ))}
          </div>
        </div>
      )}

      {Object.keys(c.espacos_magia).length > 0 && (
        <div>
          <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase tracking-wider mb-1.5">Espaços de magia</p>
          <EspacosMagiaLeitura espacos={c.espacos_magia} />
        </div>
      )}

      {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
    </div>
  )
}

function LinhaCombatenteMesa({
  combatente: c, revelacaoPv, ehDM, info,
}: {
  combatente: Combatente
  revelacaoPv: ModoRevelacao
  ehDM: boolean
  info: InfoPersonagem | undefined
}) {
  const estaMorto = c.morto || c.pv_atual <= 0
  const visibilidade = ehDM ? { modo: 'exato' as const } : pvVisivelParaJogador(c, revelacaoPv)

  return (
    <div className={cn(
      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[var(--bg2)] border border-[var(--border)]',
      (estaMorto || c.ausente) && 'opacity-50'
    )}>
      <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={36} />
      <div className="min-w-0 flex-1">
        <p className="text-[var(--text)] text-sm font-crimson truncate">{c.nome}{estaMorto ? ' 💀' : ''}</p>
        {c.condicoes.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {c.condicoes.map(cond => (
              <span key={cond} title={cond} className="text-xs">{getCondicao(cond)?.icone ?? '⚠️'}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        {visibilidade.modo === 'exato' && (
          <span className="text-[var(--text2)] text-sm font-cinzel">{c.pv_atual} / {c.pv_maximo}</span>
        )}
        {visibilidade.modo === 'vago' && visibilidade.estado && (
          <span
            className="px-2 py-0.5 rounded border text-[10px] font-cinzel font-bold"
            style={{ color: ESTADO_VAGO_INFO[visibilidade.estado].cor, borderColor: ESTADO_VAGO_INFO[visibilidade.estado].cor }}
          >
            {ESTADO_VAGO_INFO[visibilidade.estado].label}
          </span>
        )}
      </div>
    </div>
  )
}

function ListaCombatentes({
  combatentes, revelacaoPv, ehDM, infoPersonagens, ocultarIds,
}: {
  combatentes: Combatente[]
  revelacaoPv: ModoRevelacao
  ehDM: boolean
  infoPersonagens: Record<string, InfoPersonagem>
  ocultarIds: Set<string>
}) {
  const visiveis = combatentes.filter(c => !ocultarIds.has(c.id))
  const aliados = visiveis.filter(c => c.tipo !== 'monstro')
  const inimigos = visiveis.filter(c => c.tipo === 'monstro')

  if (visiveis.length === 0) return null

  return (
    <div className="px-3 pb-3 space-y-4">
      {aliados.length > 0 && (
        <div>
          <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-1.5">Aliados</p>
          <div className="space-y-1.5">
            {aliados.map(c => (
              <LinhaCombatenteMesa
                key={c.id}
                combatente={c}
                revelacaoPv={revelacaoPv}
                ehDM={ehDM}
                info={c.personagem_id ? infoPersonagens[c.personagem_id] : undefined}
              />
            ))}
          </div>
        </div>
      )}
      {inimigos.length > 0 && (
        <div>
          <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-1.5">Inimigos</p>
          <div className="space-y-1.5">
            {inimigos.map(c => (
              <LinhaCombatenteMesa key={c.id} combatente={c} revelacaoPv={revelacaoPv} ehDM={ehDM} info={undefined} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LogResumido({ log }: { log: EntradaLog[] }) {
  const [aberto, setAberto] = useState(false)
  const relevantes = useMemo(() => log.filter(l => l.tipo !== 'sistema').slice(-10).reverse(), [log])

  if (relevantes.length === 0) return null

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg2)]">
      <button
        onClick={() => setAberto(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px]"
      >
        <span className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wider">📜 Log da batalha</span>
        {aberto ? <ChevronUp className="w-4 h-4 text-[var(--text3)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text3)]" />}
      </button>
      {aberto && (
        <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
          {relevantes.map(e => (
            <p key={e.id} className="text-[var(--text3)] text-[11px] font-crimson">{formatarLogCurto(e)}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function MesaCliente() {
  const {
    combatentes, log, rodadaAtual, turnoAtual, turnoCombatenteId, ativa,
    statusBatalha, batalhaId, revelacaoPv, carregarBatalhaAtiva,
  } = useBatalha()
  const { campanhaAtiva } = useCampanha()
  const { ehDM } = usePermissao()

  const [userId, setUserId] = useState<string | null>(null)
  const [infoPersonagens, setInfoPersonagens] = useState<Record<string, InfoPersonagem>>({})
  const [carregandoBatalha, setCarregandoBatalha] = useState(true)
  const [personagemSelecionadoId, setPersonagemSelecionadoId] = useState<string | null>(null)

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

  const ativosOrdenados = useMemo(
    () => [...combatentes].sort((a, b) => a.ordem - b.ordem).filter(c => !c.ausente && !c.morto),
    [combatentes]
  )
  const combatenteDoTurno = ativa ? ativosOrdenados[turnoAtual] ?? null : null
  const ehMeuTurno = !!combatenteDoTurno && meuCombatenteIds.has(combatenteDoTurno.id)

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
        combatentes={combatentes}
        turnoCombatenteId={turnoCombatenteId}
        ativa={ativa}
        infoPersonagens={infoPersonagens}
        meuCombatenteIds={meuCombatenteIds}
      />

      <div className="flex-1 overflow-y-auto">
        <IndicadorVez
          ativa={ativa}
          rodadaAtual={rodadaAtual}
          combatenteDoTurno={combatenteDoTurno}
          ehMeuTurno={ehMeuTurno}
        />

        {statusBatalha === 'pausada' && (
          <div className="px-3 py-1.5 text-center">
            <span className="text-[var(--gold)] text-xs font-cinzel animate-pulse">⏸ BATALHA PAUSADA</span>
          </div>
        )}

        {combatenteSelecionado && (
          <CartaoPersonagem
            combatente={combatenteSelecionado}
            info={combatenteSelecionado.personagem_id ? infoPersonagens[combatenteSelecionado.personagem_id] : undefined}
            meusCombatentes={meuCombatentes}
            selecionadoId={personagemSelecionadoId}
            onSelecionar={setPersonagemSelecionadoId}
          />
        )}

        <ListaCombatentes
          combatentes={combatentes}
          revelacaoPv={revelacaoPv}
          ehDM={ehDM}
          infoPersonagens={infoPersonagens}
          ocultarIds={combatenteSelecionado ? new Set([combatenteSelecionado.id]) : new Set()}
        />
      </div>

      <LogResumido log={log} />
    </div>
  )
}
