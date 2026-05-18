'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useBatalha } from '@/store/batalha'
import { useCampanha } from '@/store/campanha'
import type { Combatente } from '@/types/batalha'
import { LinhaCombatente } from './LinhaCombatente'
import { LogBatalha } from './LogBatalha'
import { DadosVirtuais } from './DadosVirtuais'
import { SidebarMonstros } from './SidebarMonstros'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { getEspacosMagia } from '@/lib/dados-dnd/espacos-magia'
import { createClient } from '@/lib/supabase/client'
import { getNivelPorXP } from '@/lib/dados-dnd/xp-niveis'
import { calcularDificuldade, xpParaCR, type NivelDificuldade } from '@/lib/dados-dnd/xp-encontro'
import type { Personagem } from '@/types/dnd'
import {
  Play, SkipForward, ChevronLeft, ChevronRight,
  RotateCcw, Zap, RefreshCw, Plus, Star, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

export function TabelaCombate() {
  const {
    combatentes, rodadaAtual, turnoAtual, ativa,
    statusBatalha, nomeBatalha,
    iniciarBatalha, encerrarBatalha, pausarBatalha, retomarBatalha, carregarBatalhaAtiva,
    resetarBatalha,
    adicionarCombatente, confirmarIniciativa, rolarIniciativasMonstros,
    proximoTurno, turnoAnterior, proximaRodada,
    aplicarTodosDanos, zerarContadores, reordenarCombatentes,
    xpGanhoNaBatalha, xpDistribuido,
  } = useBatalha()
  const { campanhaAtiva } = useCampanha()

  const [aba, setAba] = useState<'combate' | 'dados' | 'log' | 'monstros'>('combate')
  const [modalXP, setModalXP] = useState(false)
  const [modalInspiracao, setModalInspiracao] = useState(false)
  const [modalIniciar, setModalIniciar] = useState(false)
  const [modalCarregar, setModalCarregar] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [avisoXP, setAvisoXP] = useState(false)
  const campanhaAnteriorRef = useRef<string | null>(null)

  useEffect(() => {
    const idAnterior = campanhaAnteriorRef.current
    const idAtual = campanhaAtiva?.id ?? null

    if (idAnterior && idAnterior !== idAtual && combatentes.length > 0) {
      if (statusBatalha === 'ativa') {
        if (window.confirm('Você trocou de campanha. A batalha atual será pausada. Continuar?')) {
          pausarBatalha()
        }
      } else {
        resetarBatalha()
      }
    }

    campanhaAnteriorRef.current = idAtual

    if (idAtual && statusBatalha === 'inativa') {
      carregarBatalhaAtiva(idAtual)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaAtiva?.id])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const combatentesOrdenados = [...combatentes].sort((a, b) => a.ordem - b.ordem)
  const ativosCount = combatentes.filter(c => !c.ausente && !c.morto).length
  const combatenteAtivo = combatentesOrdenados.filter(c => !c.ausente && !c.morto)[turnoAtual]

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reordenarCombatentes(String(active.id), String(over.id))
  }

  function adicionarMonstroManual() {
    adicionarCombatente({
      personagem_id: null,
      nome: 'Monstro Personalizado',
      tipo: 'monstro',
      iniciativa: 0,
      ca: 12,
      pv_maximo: 30,
      pv_atual: 30,
      pv_temporarios: 0,
      ausente: false,
      morto: false,
      condicoes: [],
      resistencias: [],
      imunidades: [],
      vulnerabilidades: [],
      espacos_magia: {},
      notas: '',
      dados_monstro: null,
      ordem: 999,
    })
  }

  function adicionarNPC() {
    adicionarCombatente({
      personagem_id: null,
      nome: 'NPC',
      tipo: 'npc',
      iniciativa: 0,
      ca: 10,
      pv_maximo: 15,
      pv_atual: 15,
      pv_temporarios: 0,
      ausente: false,
      morto: false,
      condicoes: [],
      resistencias: [],
      imunidades: [],
      vulnerabilidades: [],
      espacos_magia: {},
      notas: '',
      dados_monstro: null,
      ordem: 999,
    })
  }

  return (
    <>
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-[var(--bg2)] border-b border-[var(--border)] px-3 py-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-[var(--bg3)] border border-[var(--border)] rounded px-3 py-1">
            <button onClick={turnoAnterior} disabled={!ativa} className="text-[var(--text3)] hover:text-[var(--text2)] disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-20">
              <span className="font-cinzel text-[var(--gold)] text-sm font-bold">Rodada {rodadaAtual}</span>
              <span className="text-[var(--text3)] text-xs ml-2">T{turnoAtual + 1}/{Math.max(1, ativosCount)}</span>
            </div>
            <button onClick={proximoTurno} disabled={!ativa} className="text-[var(--text3)] hover:text-[var(--text2)] disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={proximaRodada} disabled={!ativa} className="text-[var(--text3)] hover:text-[var(--text2)] disabled:opacity-30 ml-1" title="Próxima rodada">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {combatenteAtivo && ativa && (
            <span className="text-[var(--gold2)] text-sm font-cinzel">⚔️ {combatenteAtivo.nome}</span>
          )}

          <div className="flex-1" />

          <BotaoRunico variante="secundario" tamanho="sm" onClick={rolarIniciativasMonstros} title="Rolar iniciativa dos monstros">
            🎲 Iniciativas
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={confirmarIniciativa}>
            🎯 Ordenar
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={aplicarTodosDanos}>
            <Zap className="w-3 h-3" /> Aplicar Danos
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={zerarContadores}>
            <RotateCcw className="w-3 h-3" /> Zerar
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={() => setModalXP(true)}>
            <Star className="w-3 h-3" /> XP
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={() => setModalInspiracao(true)}>
            ⭐ Inspiração
          </BotaoRunico>

          {statusBatalha === 'inativa' && (
            <BotaoRunico variante="ouro" tamanho="sm" onClick={() => setModalIniciar(true)}>
              <Play className="w-3 h-3" /> Iniciar
            </BotaoRunico>
          )}

          {statusBatalha === 'ativa' && (
            <>
              <BotaoRunico variante="secundario" tamanho="sm" onClick={pausarBatalha}>
                ⏸ Pausar
              </BotaoRunico>
              <BotaoRunico
                variante="perigo"
                tamanho="sm"
                disabled={encerrando}
                onClick={async () => {
                  if (!xpDistribuido) { setAvisoXP(true); return }
                  if (!confirm('Encerrar a batalha? Isso salvará o log no diário.')) return
                  setEncerrando(true)
                  try {
                    await encerrarBatalha()
                    toast.success('Batalha encerrada e salva no diário!')
                  } catch (e) {
                    console.error(e)
                    toast.error('Erro ao encerrar batalha')
                  } finally {
                    setEncerrando(false)
                  }
                }}
              >
                {encerrando ? '⏳ Salvando...' : '🏁 Encerrar'}
              </BotaoRunico>
            </>
          )}

          {statusBatalha === 'pausada' && (
            <>
              <span className="text-[var(--gold)] text-xs font-cinzel animate-pulse">⏸ PAUSADA</span>
              <BotaoRunico variante="ouro" tamanho="sm" onClick={retomarBatalha}>
                ▶ Retomar
              </BotaoRunico>
              <BotaoRunico
                variante="perigo"
                tamanho="sm"
                disabled={encerrando}
                onClick={async () => {
                  if (!xpDistribuido) { setAvisoXP(true); return }
                  if (!confirm('Encerrar a batalha?')) return
                  setEncerrando(true)
                  try {
                    await encerrarBatalha()
                    toast.success('Batalha encerrada!')
                  } catch (e) {
                    console.error(e)
                    toast.error('Erro ao encerrar batalha')
                  } finally {
                    setEncerrando(false)
                  }
                }}
              >
                {encerrando ? '⏳ Salvando...' : '🏁 Encerrar'}
              </BotaoRunico>
            </>
          )}

          {statusBatalha === 'concluida' && (
            <span className="text-[var(--text3)] text-xs font-cinzel">✅ {nomeBatalha}</span>
          )}

          <BotaoRunico variante="fantasma" tamanho="sm" onClick={resetarBatalha}>
            <RefreshCw className="w-3 h-3" /> Reset
          </BotaoRunico>
        </div>

        {/* Abas */}
        <div className="bg-[var(--bg2)] border-b border-[var(--border)] flex">
          {[
            { id: 'combate', label: '⚔️ Combate' },
            { id: 'dados', label: '🎲 Dados' },
            { id: 'log', label: '📜 Log' },
            { id: 'monstros', label: '👹 Monstros' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setAba(id as typeof aba)}
              className={`px-4 py-1.5 text-xs font-cinzel border-b-2 transition-colors ${
                aba === id
                  ? 'border-[var(--gold)] text-[var(--gold)]'
                  : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto">
          {aba === 'combate' && (
            <div>
              <PainelDificuldade combatentes={combatentes} />
              <div className="flex gap-2 p-2 bg-[var(--bg)] border-b border-[var(--bg3)]">
                <button
                  onClick={() => {
                    if (!campanhaAtiva?.id) { toast.error('Selecione uma campanha primeiro'); return }
                    setModalCarregar(true)
                  }}
                  className="flex items-center gap-1 text-xs text-[var(--accent2)] hover:text-[var(--accent)] transition-colors"
                >
                  <Plus className="w-3 h-3" /> Carregar Personagens
                </button>
                <span className="text-[var(--border)]">|</span>
                <button
                  onClick={adicionarMonstroManual}
                  className="flex items-center gap-1 text-xs text-[var(--red2)] hover:text-[var(--red2)]/80 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Monstro Manual
                </button>
                <span className="text-[var(--border)]">|</span>
                <button
                  onClick={adicionarNPC}
                  className="flex items-center gap-1 text-xs text-[var(--accent2)] hover:text-[var(--accent2)]/80 transition-colors"
                >
                  <Plus className="w-3 h-3" /> NPC
                </button>
              </div>

              {combatentes.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-cinzel text-[var(--border)] text-lg mb-2">Nenhum combatente</p>
                  <p className="text-[var(--border)] text-sm font-crimson">Adicione personagens e monstros para começar</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={combatentesOrdenados.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--bg3)] sticky top-0 z-10">
                        <tr className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider">
                          <th className="px-1 py-1.5 w-6"></th>
                          <th className="px-1 py-1.5 text-center w-6">St</th>
                          <th className="px-2 py-1.5 text-left">Nome</th>
                          <th className="px-1 py-1.5 text-center w-14">Init</th>
                          <th className="px-1 py-1.5 text-center w-16">Van/Des</th>
                          <th className="px-1 py-1.5 text-center w-12">CA</th>
                          <th className="px-2 py-1.5 text-left min-w-28">PV</th>
                          <th className="px-1 py-1.5 text-center w-24">Tipo Dano</th>
                          <th className="px-1 py-1.5 text-center w-28">Dano / Cura</th>
                          <th className="px-1 py-1.5 text-center w-16">💥 Tot</th>
                          <th className="px-1 py-1.5 text-center w-16">💊 Tot</th>
                          <th className="px-1 py-1.5 text-left min-w-24">Condições</th>
                          <th className="px-1 py-1.5 text-left min-w-20">Magia</th>
                          <th className="px-1 py-1.5 text-center w-20">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combatentesOrdenados.map((c, i) => {
                          const ativosParaIndice = combatentesOrdenados.filter(x => !x.ausente && !x.morto)
                          const indiceAtivo = ativosParaIndice.indexOf(c)
                          const estaAtivo = indiceAtivo === turnoAtual && ativa
                          return (
                            <LinhaCombatente
                              key={c.id}
                              combatente={c}
                              ativo={estaAtivo}
                              indice={i}
                            />
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </SortableContext>
              </DndContext>
              )}
            </div>
          )}

          {aba === 'dados' && (
            <div className="p-4 max-w-md">
              <PainelGrimorio titulo="Dados Virtuais" ornamentado>
                <DadosVirtuais />
              </PainelGrimorio>
            </div>
          )}

          {aba === 'log' && (
            <div className="h-full">
              <LogBatalha />
            </div>
          )}

          {aba === 'monstros' && (
            <div className="max-w-sm">
              <SidebarMonstros />
            </div>
          )}
        </div>
      </div>
    </div>

    {avisoXP && createPortal(
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" onClick={() => setAvisoXP(false)}>
        <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
          <h3 className="font-cinzel text-[var(--gold)] text-lg font-bold mb-2">⚠️ XP não distribuído</h3>
          <p className="text-[var(--text2)] text-sm mb-5 font-crimson">O XP da batalha ainda não foi distribuído aos jogadores. Deseja distribuir antes de encerrar?</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setAvisoXP(false); setModalXP(true) }}
              className="py-2 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white rounded-lg font-cinzel text-sm"
            >
              ⭐ Distribuir XP agora
            </button>
            <button
              onClick={async () => {
                setAvisoXP(false)
                if (!confirm('Encerrar sem distribuir XP?')) return
                setEncerrando(true)
                try {
                  await encerrarBatalha()
                  toast.success('Batalha encerrada e salva no diário!')
                } catch (e) {
                  console.error(e)
                  toast.error('Erro ao encerrar batalha')
                } finally {
                  setEncerrando(false)
                }
              }}
              className="py-2 border border-[var(--border)] rounded-lg text-[var(--text2)] hover:bg-[var(--surface)] text-sm"
            >
              Encerrar sem distribuir
            </button>
            <button onClick={() => setAvisoXP(false)} className="py-2 text-[var(--text3)] hover:text-[var(--text2)] text-sm">
              Cancelar
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {modalXP && <ModalDistribuirXP xpSugerido={xpGanhoNaBatalha} onFechar={() => setModalXP(false)} />}
    {modalInspiracao && <ModalDarInspiracao onFechar={() => setModalInspiracao(false)} />}
    {modalCarregar && campanhaAtiva?.id && (
      <ModalCarregarPersonagens campanhaId={campanhaAtiva.id} onFechar={() => setModalCarregar(false)} />
    )}
    {modalIniciar && (
      <ModalIniciarBatalha
        onConfirmar={async (nome) => {
          setModalIniciar(false)
          if (!campanhaAtiva?.id) {
            toast.error('Selecione uma campanha primeiro')
            return
          }
          try {
            await iniciarBatalha(nome, campanhaAtiva.id)
            toast.success(`Batalha "${nome}" iniciada!`)
          } catch (e) {
            console.error(e)
            toast.error('Erro ao iniciar batalha')
          }
        }}
        onCancelar={() => setModalIniciar(false)}
      />
    )}
    </>
  )
}

function ModalDistribuirXP({ onFechar, xpSugerido }: { onFechar: () => void; xpSugerido?: number }) {
  const [xpTotal, setXpTotal] = useState(xpSugerido && xpSugerido > 0 ? String(xpSugerido) : '')
  const [loading, setLoading] = useState(false)
  const combatentes = useBatalha(s => s.combatentes)
  const marcarXPDistribuido = useBatalha(s => s.marcarXPDistribuido)

  const jogadores = combatentes.filter(c => c.tipo === 'jogador' && !c.ausente)
  const xpPorJogador = jogadores.length > 0
    ? Math.floor((parseInt(xpTotal) || 0) / jogadores.length)
    : 0

  async function distribuir() {
    if (!xpTotal || xpPorJogador === 0) return
    setLoading(true)
    const supabase = createClient()
    let semId = 0
    let sucesso = 0

    for (const jogador of jogadores) {
      if (!jogador.personagem_id) { semId++; continue }

      const { data: personagem, error: errBusca } = await supabase
        .from('personagens')
        .select('id, nome, pontos_experiencia, nivel')
        .eq('id', jogador.personagem_id)
        .single()

      if (errBusca || !personagem) {
        console.error(`Erro ao buscar personagem de ${jogador.nome}:`, errBusca)
        toast.error(`Personagem não encontrado: ${jogador.nome}`)
        continue
      }

      const novaXP = (personagem.pontos_experiencia || 0) + xpPorJogador
      const novoNivel = getNivelPorXP(novaXP)

      const { error: errUpdate } = await supabase.from('personagens').update({
        pontos_experiencia: novaXP,
        nivel: novoNivel.nivel,
        bonus_proficiencia: novoNivel.bonusProficiencia,
      }).eq('id', personagem.id)

      if (errUpdate) {
        console.error(`Erro ao distribuir XP para ${personagem.nome}:`, errUpdate)
        toast.error(`Erro ao salvar ${personagem.nome}: ${errUpdate.message}`)
        continue
      }

      sucesso++
      if (novoNivel.nivel > (personagem.nivel || 1)) {
        toast.success(`🎉 ${personagem.nome} subiu para o nível ${novoNivel.nivel}!`, { duration: 5000 })
      }
    }

    if (semId > 0) toast.error(`${semId} jogador(es) sem personagem vinculado foram ignorados`)
    if (sucesso > 0) {
      toast.success(`✅ ${xpPorJogador.toLocaleString('pt-BR')} XP distribuídos para ${sucesso} jogadores!`)
      marcarXPDistribuido(xpPorJogador, jogadores.filter(j => j.personagem_id).map(j => j.nome))
    }
    setLoading(false)
    onFechar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" onClick={onFechar}>
      <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-cinzel text-[var(--gold)] text-lg font-bold mb-4">⭐ Distribuir Experiência</h3>

        <div className="mb-4">
          <label className="text-[var(--text3)] text-xs font-cinzel uppercase tracking-wider block mb-1">XP Total Ganho</label>
          <input
            type="number"
            value={xpTotal}
            onChange={e => setXpTotal(e.target.value)}
            placeholder="Ex: 1500"
            className="input-dd w-full text-lg text-center"
            autoFocus
          />
        </div>

        <div className="bg-[var(--surface)] rounded-lg p-3 mb-4 text-center">
          <p className="text-[var(--text3)] text-xs mb-1">{jogadores.length} jogador(es) presente(s)</p>
          <p className="text-[var(--gold)] text-2xl font-cinzel font-bold">{xpPorJogador.toLocaleString('pt-BR')} XP</p>
          <p className="text-[var(--text3)] text-xs">por personagem</p>
        </div>

        <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
          {jogadores.map(j => (
            <div key={j.id} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text2)]">{j.nome}</span>
              <span className="text-[var(--gold)] font-cinzel">
                {j.personagem_id ? `+${xpPorJogador.toLocaleString('pt-BR')} XP` : <span className="text-[var(--text3)] text-xs">sem vínculo</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onFechar} className="flex-1 py-2 border border-[var(--border)] rounded-lg text-[var(--text2)] hover:bg-[var(--surface)] text-sm">Cancelar</button>
          <button
            onClick={distribuir}
            disabled={loading || xpPorJogador === 0}
            className="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white rounded-lg font-cinzel text-sm disabled:opacity-50"
          >
            {loading ? 'Distribuindo...' : '⭐ Distribuir'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ModalDarInspiracao({ onFechar }: { onFechar: () => void }) {
  const [loading, setLoading] = useState(false)
  const combatentes = useBatalha(s => s.combatentes)
  const jogadores = combatentes.filter(c => c.tipo === 'jogador' && !c.ausente)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(jogadores.map(j => j.id)))

  function toggleJogador(id: string) {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  async function distribuir() {
    setLoading(true)
    const supabase = createClient()
    let sucesso = 0

    for (const jogador of jogadores) {
      if (!selecionados.has(jogador.id)) continue
      if (!jogador.personagem_id) {
        toast.error(`${jogador.nome} não tem personagem vinculado`)
        continue
      }

      const { data: p, error: errBusca } = await supabase
        .from('personagens')
        .select('id, nome, inspiracao')
        .eq('id', jogador.personagem_id)
        .single()

      if (errBusca || !p) {
        console.error(`Erro ao buscar ${jogador.nome}:`, errBusca)
        toast.error(`Personagem não encontrado: ${jogador.nome}`)
        continue
      }

      const novaInspiracao = Math.min(5, ((p.inspiracao as number) || 0) + 1)
      const { error: errUpdate } = await supabase
        .from('personagens')
        .update({ inspiracao: novaInspiracao })
        .eq('id', p.id)

      if (errUpdate) {
        console.error(`Erro ao atualizar inspiração de ${p.nome}:`, errUpdate)
        toast.error(`Erro ao salvar ${p.nome}: ${errUpdate.message}`)
        continue
      }

      sucesso++
    }

    if (sucesso > 0) toast.success(`⭐ Inspiração distribuída para ${sucesso} jogador(es)!`)
    setLoading(false)
    onFechar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" onClick={onFechar}>
      <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-cinzel text-[var(--gold)] text-lg font-bold mb-2">⭐ Dar Inspiração Heroica</h3>
        <p className="text-[var(--text3)] text-sm mb-4 font-crimson">Selecione quem vai receber +1 inspiração (máx. 5 por personagem)</p>

        <div className="space-y-2 mb-4">
          {jogadores.map(j => (
            <label key={j.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selecionados.has(j.id)}
                onChange={() => toggleJogador(j.id)}
                className="accent-[var(--gold)] w-4 h-4"
              />
              <span className="text-[var(--text)] group-hover:text-[var(--gold)] transition-colors">{j.nome}</span>
              {!j.personagem_id && <span className="text-[var(--text3)] text-xs">(sem vínculo)</span>}
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onFechar} className="flex-1 py-2 border border-[var(--border)] rounded-lg text-[var(--text2)] hover:bg-[var(--surface)] text-sm">Cancelar</button>
          <button
            onClick={distribuir}
            disabled={loading || selecionados.size === 0}
            className="flex-1 py-2 bg-[var(--gold)] hover:bg-[var(--gold2)] text-[var(--bg)] rounded-lg font-cinzel font-bold text-sm disabled:opacity-50"
          >
            {loading ? 'Distribuindo...' : '⭐ Dar Inspiração'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ModalCarregarPersonagens({ campanhaId, onFechar }: { campanhaId: string; onFechar: () => void }) {
  const { adicionarCombatente } = useBatalha()
  const [personagens, setPersonagens] = useState<Personagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data } = await supabase.from('personagens').select('*').eq('campanha_id', campanhaId).eq('ativo', true)
      const lista = (data ?? []) as Personagem[]
      setPersonagens(lista)
      setSelecionados(new Set(lista.filter(p => (p.tipo_personagem ?? 'jogador') === 'jogador').map(p => p.id)))
      setCarregando(false)
    }
    carregar()
  }, [campanhaId])

  const grupos: { tipo: 'jogador' | 'npc' | 'monstro'; label: string; cor: string }[] = [
    { tipo: 'jogador', label: '👤 Jogadores', cor: 'var(--gold)' },
    { tipo: 'npc', label: '🧙 NPCs', cor: 'var(--green2)' },
    { tipo: 'monstro', label: '👹 Monstros', cor: 'var(--red2)' },
  ]

  function toggle(id: string) {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  function toggleGrupo(tipo: string) {
    const doGrupo = personagens.filter(p => (p.tipo_personagem ?? 'jogador') === tipo).map(p => p.id)
    const todosSel = doGrupo.every(id => selecionados.has(id))
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (todosSel) doGrupo.forEach(id => novo.delete(id))
      else doGrupo.forEach(id => novo.add(id))
      return novo
    })
  }

  function confirmar() {
    const escolhidos = personagens.filter(p => selecionados.has(p.id))
    if (!escolhidos.length) return

    escolhidos.forEach(p => {
      const espacos: Record<number, { total: number; utilizados: number }> = {}
      const slots = getEspacosMagia(p.nivel)
      slots.forEach((total, idx) => {
        if (total > 0) espacos[idx + 1] = { total, utilizados: 0 }
      })

      adicionarCombatente({
        personagem_id: p.id,
        nome: p.nome,
        tipo: (p.tipo_personagem ?? 'jogador') as 'jogador' | 'npc' | 'monstro',
        iniciativa: 0,
        ca: p.ca,
        pv_maximo: p.pv_maximo,
        pv_atual: p.pv_atual,
        pv_temporarios: p.pv_temporarios,
        ausente: false,
        morto: false,
        condicoes: [],
        resistencias: p.resistencias ?? [],
        imunidades: p.imunidades ?? [],
        vulnerabilidades: p.vulnerabilidades ?? [],
        espacos_magia: espacos,
        notas: '',
        dados_monstro: null,
        dados_personagem: {
          nivel: p.nivel ?? 1,
          classe: p.classe ?? null,
          ataques: (p.ataques ?? []).map(a => ({
            nome: a.nome,
            bonus: a.bonus_ataque,
            dano: a.dano,
          })),
        },
        ordem: 999,
        inspiracao: typeof p.inspiracao === 'number' ? p.inspiracao : 0,
        nivel: p.nivel ?? 1,
      })
    })

    toast.success(`${escolhidos.length} personagem(ns) adicionado(s)`)
    onFechar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" onClick={onFechar}>
      <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-cinzel text-[var(--gold)] text-lg font-bold">⚔️ Carregar Personagens</h3>
          {!carregando && (
            <span className="text-[var(--text3)] text-xs font-cinzel">{selecionados.size} selecionado(s)</span>
          )}
        </div>

        {carregando ? (
          <div className="py-8 text-center text-[var(--text3)] font-cinzel text-sm">Carregando...</div>
        ) : personagens.length === 0 ? (
          <div className="py-8 text-center text-[var(--text3)] font-cinzel text-sm">Nenhum personagem na campanha</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {grupos.map(({ tipo, label, cor }) => {
              const lista = personagens.filter(p => (p.tipo_personagem ?? 'jogador') === tipo)
              if (!lista.length) return null
              const todosSel = lista.every(p => selecionados.has(p.id))
              return (
                <div key={tipo}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-cinzel text-xs uppercase tracking-wider" style={{ color: cor }}>{label}</span>
                    <button
                      onClick={() => toggleGrupo(tipo)}
                      className="text-[var(--text3)] text-[10px] hover:text-[var(--text2)] transition-colors"
                    >
                      {todosSel ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {lista.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer group px-2 py-1 rounded hover:bg-[var(--surface)] transition-colors">
                        <input
                          type="checkbox"
                          checked={selecionados.has(p.id)}
                          onChange={() => toggle(p.id)}
                          className="w-4 h-4 accent-[var(--gold)]"
                        />
                        <span className="text-[var(--text)] group-hover:text-[var(--text)] text-sm font-crimson flex-1">{p.nome}</span>
                        {p.classe && <span className="text-[var(--text3)] text-xs">{p.classe} Nv{p.nivel || 1}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
          <button onClick={onFechar} className="flex-1 py-2 border border-[var(--border)] rounded-lg text-[var(--text2)] hover:bg-[var(--surface)] text-sm">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={selecionados.size === 0}
            className="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white rounded-lg font-cinzel font-bold text-sm disabled:opacity-50"
          >
            Adicionar ({selecionados.size})
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const COR_DIFICULDADE: Record<NivelDificuldade, string> = {
  trivial: 'text-[var(--text3)]',
  facil:   'text-[#27ae60]',
  medio:   'text-[#f39c12]',
  dificil: 'text-[#e67e22]',
  mortal:  'text-[var(--red2)]',
}

const LABEL_DIFICULDADE: Record<NivelDificuldade, string> = {
  trivial: 'Trivial',
  facil:   'Fácil',
  medio:   'Médio',
  dificil: 'Difícil',
  mortal:  'Mortal',
}

function PainelDificuldade({ combatentes }: { combatentes: Combatente[] }) {
  const [aberto, setAberto] = useState(false)

  const monstros = combatentes.filter(c => c.tipo === 'monstro' && !c.ausente)
  const jogadores = combatentes.filter(c => c.tipo === 'jogador' && !c.ausente)
  const numJogadores = jogadores.length

  const crs = monstros.map(c => c.dados_monstro?.cr ?? '0')
  const niveis = jogadores.length > 0
    ? jogadores.map(j => j.nivel ?? 1)
    : [1]
  const nivelMedioExibido = niveis.length > 0
    ? Math.round(niveis.reduce((a, b) => a + b, 0) / niveis.length)
    : 1

  const resultado = calcularDificuldade(niveis, crs)
  const xpAjustadoTotal = Math.round(resultado.xpBruto * resultado.multiplicador)

  let dificuldadeFinal: NivelDificuldade = 'trivial'
  if (xpAjustadoTotal >= resultado.limiares.mortal)       dificuldadeFinal = 'mortal'
  else if (xpAjustadoTotal >= resultado.limiares.dificil) dificuldadeFinal = 'dificil'
  else if (xpAjustadoTotal >= resultado.limiares.medio)   dificuldadeFinal = 'medio'
  else if (xpAjustadoTotal >= resultado.limiares.facil)   dificuldadeFinal = 'facil'

  if (monstros.length === 0 && jogadores.length === 0 && !aberto) return null

  return (
    <div className="bg-[var(--bg3)] border-b border-[var(--border)]">
      <button
        onClick={() => setAberto(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[var(--surface)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider">Dificuldade do Encontro</span>
          {monstros.length > 0 && numJogadores > 0 && (
            <span className={`text-xs font-cinzel font-bold ${COR_DIFICULDADE[dificuldadeFinal]}`}>
              {LABEL_DIFICULDADE[dificuldadeFinal]}
            </span>
          )}
          {monstros.length > 0 && (
            <span className="text-[var(--text3)] text-[10px]">
              {xpAjustadoTotal.toLocaleString('pt-BR')} XP · {numJogadores} jogador{numJogadores !== 1 ? 'es' : ''} · {monstros.length} monstro{monstros.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3 h-3 text-[var(--text3)] transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text3)]">
            <span className="font-cinzel">
              {numJogadores} jogador{numJogadores !== 1 ? 'es' : ''}
              {numJogadores > 0 && ` · nível médio ${nivelMedioExibido}`}
            </span>
            {numJogadores > 0 && jogadores.map(j => (
              <span key={j.id} className="text-[var(--text3)] text-[10px]">
                {j.nome} Nv{j.nivel ?? 1}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
            {(['facil', 'medio', 'dificil', 'mortal'] as NivelDificuldade[]).map(d => (
              <div key={d} className={`bg-[var(--bg2)] rounded p-1.5 border ${dificuldadeFinal === d ? 'border-current' : 'border-[var(--border)]'} ${COR_DIFICULDADE[d]}`}>
                <div className="font-cinzel">{LABEL_DIFICULDADE[d]}</div>
                <div className="font-bold">{resultado.limiares[d as keyof typeof resultado.limiares].toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>

          {monstros.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[var(--text3)]">XP bruto: <span className="text-[var(--text)]">{resultado.xpBruto.toLocaleString('pt-BR')}</span></span>
              <span className="text-[var(--text3)]">×{resultado.multiplicador}</span>
              <span className="text-[var(--text3)]">XP ajustado: <span className={`font-bold ${COR_DIFICULDADE[dificuldadeFinal]}`}>{xpAjustadoTotal.toLocaleString('pt-BR')}</span></span>
              {numJogadores > 0 && <span className={`font-cinzel font-bold text-sm ${COR_DIFICULDADE[dificuldadeFinal]}`}>{LABEL_DIFICULDADE[dificuldadeFinal]}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ModalIniciarBatalha({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (nome: string) => void
  onCancelar: () => void
}) {
  const agora = new Date()
  const sugestao = `Batalha — ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  const [nome, setNome] = useState(sugestao)

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70"
      onClick={onCancelar}
    >
      <div
        className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-cinzel text-[var(--gold)] text-lg font-bold mb-1">⚔️ Iniciar Batalha</h3>
        <p className="text-[var(--text3)] text-sm mb-4 font-crimson">
          Dê um nome para identificar esta batalha no diário
        </p>
        <input
          type="text"
          value={nome}
          onChange={e => setNome(e.target.value)}
          className="input-dd w-full mb-4"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && nome.trim() && onConfirmar(nome.trim())}
        />
        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="flex-1 py-2 border border-[var(--border)] rounded-lg text-[var(--text2)] hover:bg-[var(--surface)] text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => nome.trim() && onConfirmar(nome.trim())}
            className="flex-1 py-2 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white rounded-lg font-cinzel font-bold text-sm"
          >
            ⚔️ Iniciar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
