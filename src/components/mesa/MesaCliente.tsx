'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBatalha } from '@/store/batalha'
import { useCampanha } from '@/store/campanha'
import { usePermissao } from '@/hooks/usePermissao'
import { useOnline } from '@/hooks/useOnline'
import { createClient } from '@/lib/supabase/client'
import { normalizarTipoDano } from '@/lib/dados-dnd/tipos-dano'
import type { ArmaEmpunhada, Combatente, TipoCondicao, EspacosMagiaBatalha } from '@/types/batalha'
import type { Personagem, TipoDano } from '@/types/dnd'
import { chamarAcaoApi } from '@/lib/batalha/acao-api'
import { Swords } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AcaoPendente, AlvoSelecionado, AtaqueDisponivel, ConjuracaoEscolhida, ContextoAcao, Destinatario, InfoPersonagem } from './tipos'
import { OPCOES_REACAO } from './constantes'
import { ataquesDoCombatente, classificarMagia, mensagemToast, ordenarPorNome } from './helpers'
import { chamarAcaoInventario, chamarAcaoSessaoApi } from './api'
import { useMesaUi } from '@/store/mesa-ui'
import { cn } from '@/lib/utils'
import { PainelAbasMesa } from './PainelAbasMesa'
import { BotaoFichaCompleta } from './BotaoFichaCompleta'
import { ModalItem } from './modais/ModalItem'
import { AbaMochila } from './inventario/AbaMochila'
import { ModalMagias } from './modais/ModalMagias'
import { BandejaAlvos } from './combate/BandejaAlvos'
import { BarraAcoes } from './combate/BarraAcoes'
import { BarraParticipantes } from './combate/BarraParticipantes'
import { CartaoPersonagem } from './combate/CartaoPersonagem'
import { FaixaVantagem } from './combate/FaixaVantagem'
import { ModalListaAtaques } from './combate/ModalListaAtaques'
import { ModalReacao } from './combate/ModalReacao'
import { ModalValorAcao } from './combate/ModalValorAcao'
import { PopupCombatente } from './combate/PopupCombatente'
import { StatusRodada } from './combate/StatusRodada'
import { BarraAcoesSessao } from './sessao/BarraAcoesSessao'
import { BarraParticipantesSessao } from './sessao/BarraParticipantesSessao'
import { CartaoPersonagemSessao } from './sessao/CartaoPersonagemSessao'
import { AbaMagias } from './magias/AbaMagias'
import { ModalDescanso } from './sessao/ModalDescanso'
import { ModalDistribuirTesouro } from './sessao/ModalDistribuirTesouro'
import { ModalOuro } from './sessao/ModalOuro'
import { ModalPrepararMagias } from './sessao/ModalPrepararMagias'

















export function MesaCliente() {
  const {
    combatentes, log, rodadaAtual, turnoAtual, turnoCombatenteId, ativa,
    statusBatalha, batalhaId, carregarBatalhaAtiva, definirArmaEmpunhada,
  } = useBatalha()
  const { campanhaAtiva, sessaoAtiva, sessaoCarregando } = useCampanha()
  const { ehDM } = usePermissao()
  const online = useOnline()
  const abaAtiva = useMesaUi(s => s.abaAtiva)
  const setAba = useMesaUi(s => s.setAba)
  // Abaixo de md, fora da aba Personagem a árvore fica só escondida (CSS), nunca desmontada.
  const classeArvore = cn('flex flex-col h-full overflow-hidden', abaAtiva !== 'personagem' && 'max-md:hidden')

  const [userId, setUserId] = useState<string | null>(null)
  const [infoPersonagens, setInfoPersonagens] = useState<Record<string, InfoPersonagem>>({})
  const [carregandoBatalha, setCarregandoBatalha] = useState(true)
  const [personagemSelecionadoId, setPersonagemSelecionadoId] = useState<string | null>(null)
  const [popupCombatenteId, setPopupCombatenteId] = useState<string | null>(null)

  // Modo sessão (fora de combate) — lista de PJs da campanha, independente
  // de batalha_combatentes (que só existe durante uma batalha).
  const [personagensSessao, setPersonagensSessao] = useState<Personagem[]>([])
  const [personagemOperadoIdSessao, setPersonagemOperadoIdSessao] = useState<string | null>(null)
  const [enviandoSessao, setEnviandoSessao] = useState(false)
  const [modalMagiaSessaoAberto, setModalMagiaSessaoAberto] = useState(false)
  const [modalPrepararSessaoAberto, setModalPrepararSessaoAberto] = useState(false)
  const [modalItemSessaoAberto, setModalItemSessaoAberto] = useState(false)
  const [modalOuroAberto, setModalOuroAberto] = useState(false)
  const [modalDescansoAberto, setModalDescansoAberto] = useState(false)
  const [modalDistribuirAberto, setModalDistribuirAberto] = useState(false)
  const [concedendoInspiracao, setConcedendoInspiracao] = useState(false)

  // O notebook (TabelaCombate) continua o cockpit; a /mesa vira controle
  // remoto do DM andando pela mesa — opera monstros, NPCs e PJs ausentes
  // pelo mesmo fluxo/API do jogador, sem a checagem de "é a sua vez".
  const [dmControlandoId, setDmControlandoId] = useState<string | null>(null)

  // Modais "o quê" — abrem antes de entrar no fluxo de alvo/valor
  const [modalListaAtaqueAberto, setModalListaAtaqueAberto] = useState(false)
  const [modalMagiaAberto, setModalMagiaAberto] = useState(false)
  const [modalItemAberto, setModalItemAberto] = useState(false)
  const [modalReacaoAberto, setModalReacaoAberto] = useState(false)

  // Fluxo de ação em andamento — sempre resolvido via POST à API árbitro.
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente | null>(null)
  const [alvosSelecionados, setAlvosSelecionados] = useState<AlvoSelecionado[]>([])
  const [modalValorAberto, setModalValorAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [vantagemEscolhida, setVantagemEscolhida] = useState<'vantagem' | 'desvantagem' | null>(null)
  const [enviandoVantagem, setEnviandoVantagem] = useState(false)

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

  // Combatentes que o DM pode operar pela /mesa: monstros, NPCs e PJs de
  // jogadores ausentes. PJs presentes continuam controlados pelo próprio
  // jogador — o DM não precisa (nem deve) assumi-los por padrão.
  const combatentesControlaveisDM = useMemo(
    () => ordenarPorNome(combatentes.filter(c => c.tipo !== 'jogador' || c.ausente)),
    [combatentes]
  )

  useEffect(() => {
    if (!ehDM) return
    if (combatentesControlaveisDM.length === 0) { setDmControlandoId(null); return }
    if (!dmControlandoId || !combatentesControlaveisDM.some(c => c.id === dmControlandoId)) {
      setDmControlandoId(combatentesControlaveisDM[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehDM, combatentesControlaveisDM])

  // Combatente "operado" nesta tela — o próprio PJ do jogador, ou quem o DM
  // escolheu no seletor. Todo o resto do fluxo de ação usa só esta variável,
  // sem distinguir DM de jogador a partir daqui.
  const combatenteOperado = ehDM
    ? combatentesControlaveisDM.find(c => c.id === dmControlandoId) ?? null
    : combatenteSelecionado

  // Reflete o campo já persistido (seja pelo próprio toggle, seja pelo mestre).
  useEffect(() => {
    setVantagemEscolhida(combatenteOperado?.vantagem ?? null)
  }, [combatenteOperado?.id, combatenteOperado?.vantagem])

  // =====================================================================
  // Modo sessão — PJs da campanha direto de `personagens` (sem batalha).
  // =====================================================================

  const emModoSessao = !!sessaoAtiva && (!batalhaId || statusBatalha === 'inativa' || statusBatalha === 'concluida')

  useEffect(() => {
    if (!campanhaAtiva?.id) { setPersonagensSessao([]); return }
    let cancelado = false
    createClient()
      .from('personagens')
      .select('*')
      .eq('campanha_id', campanhaAtiva.id)
      .eq('tipo_personagem', 'jogador')
      .eq('ativo', true)
      .then(({ data }) => { if (!cancelado) setPersonagensSessao((data as Personagem[]) ?? []) })
    return () => { cancelado = true }
  }, [campanhaAtiva?.id])

  // Realtime — reflete edições feitas por outros clientes (DM ou outro
  // jogador) sem precisar recarregar a página.
  useEffect(() => {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    const canal = supabase
      .channel(`mesa-personagens:${campanhaAtiva.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'personagens', filter: `campanha_id=eq.${campanhaAtiva.id}` },
        (payload: { new: Personagem }) => {
          setPersonagensSessao(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [campanhaAtiva?.id])

  const meusPersonagensSessao = useMemo(
    () => userId ? personagensSessao.filter(p => p.user_id === userId) : [],
    [personagensSessao, userId]
  )

  // Presença — sessoes.personagens_presentes (null = todos presentes,
  // compatível com sessões antigas e o estado inicial). Usada só para as
  // superfícies sociais (barra de participantes, alvos de transferência) —
  // o seletor "🎭 Operando" do DM continua com a lista completa.
  const personagensPresentes = useMemo(() => {
    const presentes = sessaoAtiva?.personagens_presentes
    return presentes ? personagensSessao.filter(p => presentes.includes(p.id)) : personagensSessao
  }, [personagensSessao, sessaoAtiva?.personagens_presentes])

  // Toast de "recebi algo" — via Realtime em `transferencias`, não pela
  // resposta síncrona da própria chamada (essa já mostra o toast de quem
  // deu). Guardado em ref porque o callback do canal é registrado uma vez
  // e não deve carregar um `meuCombatentes`/`meusPersonagensSessao` velho.
  const meusPersonagemIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const ids = new Set<string>()
    meusPersonagensSessao.forEach(p => ids.add(p.id))
    meuCombatentes.forEach(c => { if (c.personagem_id) ids.add(c.personagem_id) })
    meusPersonagemIdsRef.current = ids
  }, [meusPersonagensSessao, meuCombatentes])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const canal = supabase
      .channel(`mesa-transferencias:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transferencias' },
        (payload: { new: { para_personagem_id: string | null; de_nome: string | null; tipo: 'item' | 'moeda'; item_nome: string | null; quantidade: number | null; moedas: Record<string, number> | null; criado_por: string | null } }) => {
          const t = payload.new
          if (!t.para_personagem_id || !meusPersonagemIdsRef.current.has(t.para_personagem_id)) return
          if (t.criado_por === userId) return
          const remetente = t.de_nome ?? 'Alguém'
          const oQue = t.tipo === 'item'
            ? `${t.quantidade}x ${t.item_nome}`
            : Object.entries(t.moedas ?? {}).map(([m, v]) => `${v} ${m.toUpperCase()}`).join(', ')
          toast.success(`🎁 ${remetente} te deu ${oQue}`)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [userId])

  useEffect(() => {
    if (!ehDM) {
      if (meusPersonagensSessao.length === 0) { setPersonagemOperadoIdSessao(null); return }
      if (!personagemOperadoIdSessao || !meusPersonagensSessao.some(p => p.id === personagemOperadoIdSessao)) {
        setPersonagemOperadoIdSessao(meusPersonagensSessao[0].id)
      }
      return
    }
    if (personagensSessao.length === 0) { setPersonagemOperadoIdSessao(null); return }
    if (!personagemOperadoIdSessao || !personagensSessao.some(p => p.id === personagemOperadoIdSessao)) {
      setPersonagemOperadoIdSessao(personagensSessao[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehDM, meusPersonagensSessao, personagensSessao])

  const personagemOperadoSessao = ehDM
    ? personagensSessao.find(p => p.id === personagemOperadoIdSessao) ?? null
    : meusPersonagensSessao.find(p => p.id === personagemOperadoIdSessao) ?? null

  const meusPersonagemIdsSessao = useMemo(() => new Set(meusPersonagensSessao.map(p => p.id)), [meusPersonagensSessao])

  // Ponto único de escrita fora de combate — sempre /api/mesa/acao (sem
  // alvos, sem turno). Atualiza o estado local a partir da resposta do
  // servidor (fonte da verdade), sem esperar o Realtime.
  async function enviarAcaoSessao(payload: Omit<Parameters<typeof chamarAcaoSessaoApi>[0], 'sessaoId' | 'personagemId'>) {
    if (!sessaoAtiva || !personagemOperadoSessao || enviandoSessao) return
    setEnviandoSessao(true)
    const resultado = await chamarAcaoSessaoApi({
      sessaoId: sessaoAtiva.id,
      personagemId: personagemOperadoSessao.id,
      ...payload,
    })
    setEnviandoSessao(false)
    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao registrar ação')
      return
    }
    if (resultado.personagem) {
      const atualizado = resultado.personagem
      setPersonagensSessao(prev => prev.map(p => p.id === atualizado.id ? atualizado : p))
    }
  }

  function ajustarPVSessao(delta: number) {
    enviarAcaoSessao({ tipo: delta < 0 ? 'dano' : 'cura', valor: Math.abs(delta) })
  }

  function definirPVTempSessao(novoValor: number) {
    enviarAcaoSessao({ tipo: 'pv_temporarios', valor: Math.max(0, novoValor) })
  }

  function adicionarCondicaoSessao(condicao: TipoCondicao) {
    enviarAcaoSessao({ tipo: 'condicao_aplicada', condicao })
  }

  function removerCondicaoSessao(condicao: TipoCondicao) {
    enviarAcaoSessao({ tipo: 'condicao_removida', condicao })
  }

  function usarInspiracaoSessao() {
    enviarAcaoSessao({ tipo: 'usar_inspiracao' })
  }

  function usarEspacoSessao(nivel: number) {
    enviarAcaoSessao({ tipo: 'usar_espaco', nivelMagia: nivel })
  }

  function recuperarEspacoSessao(nivel: number) {
    enviarAcaoSessao({ tipo: 'recuperar_espaco', nivelMagia: nivel })
  }

  function conjurarMagiaSessao({ magia, nivelConjurado }: ConjuracaoEscolhida) {
    setModalMagiaSessaoAberto(false)
    const { efeito } = classificarMagia(magia)
    if (efeito === 'cura') {
      enviarAcaoSessao({
        tipo: 'cura', valor: 1, nivelMagia: nivelConjurado ?? undefined, nomeAcao: magia.nome,
      })
    } else {
      enviarAcaoSessao({ tipo: 'usar_espaco', nivelMagia: nivelConjurado ?? undefined, nomeAcao: magia.nome })
    }
  }

  function descansoLongoSessao() {
    setModalDescansoAberto(false)
    enviarAcaoSessao({ tipo: 'descanso_longo' })
  }

  function descansoCurtoSessao(dadosGastos: number, curaInformada: number) {
    setModalDescansoAberto(false)
    enviarAcaoSessao({ tipo: 'descanso_curto', dadosGastos, curaInformada })
  }

  // DM só — concede ao PJ que estiver operando no seletor da sessão (troque
  // o seletor "🎭 Operando" para escolher outro jogador antes de conceder).
  async function concederInspiracao() {
    if (!sessaoAtiva || !personagemOperadoSessao || concedendoInspiracao) return
    setConcedendoInspiracao(true)
    const resultado = await chamarAcaoInventario({
      sessaoId: sessaoAtiva.id, personagemId: personagemOperadoSessao.id, tipo: 'conceder_inspiracao',
    })
    setConcedendoInspiracao(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao conceder inspiração'); return }
    toast.success(resultado.descricao ?? 'Inspiração concedida!')
  }

  function cancelarAcao() {
    setAcaoPendente(null)
    setAlvosSelecionados([])
    setModalValorAberto(false)
  }

  // Ponto único de escrita de ações — sempre a API árbitro, nunca o Supabase
  // direto. `valor === null` cobre ações sem número (utilitária, reação sem
  // efeito): o alvo ainda vai junto via `descricao`, já que a API só inclui
  // um alvo no resultado quando o valor aplicado é > 0.
  async function enviarAcao(
    pending: AcaoPendente,
    alvos: AlvoSelecionado[],
    valor: number | null,
    tipoDano: TipoDano | null,
    descricaoExtra?: string,
  ) {
    if (!combatenteOperado || !batalhaId || enviando) return
    setEnviando(true)
    const descricaoAlvos = alvos.length > 0 && valor === null ? `Alvo: ${alvos.map(a => a.nome).join(', ')}` : undefined
    const descricaoFinal = [descricaoExtra, descricaoAlvos].filter(Boolean).join(' — ') || undefined

    const resultado = await chamarAcaoApi({
      batalhaId,
      combatenteId: combatenteOperado.id,
      tipo: pending.tipo,
      alvos: alvos.map(a => ({ combatenteId: a.id, valor: valor ?? 0, ...(tipoDano ? { tipoDano } : {}) })),
      nivelMagia: pending.nivelMagia,
      nomeAcao: pending.nomeAcao,
      vantagem: vantagemEscolhida,
      descricao: descricaoFinal,
      marcarEfeitoAtivo: pending.marcarEfeitoAtivo,
    })
    setEnviando(false)

    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao registrar ação')
      return
    }
    cancelarAcao()
  }

  function iniciarAcao(pending: AcaoPendente) {
    setAcaoPendente(pending)
    setAlvosSelecionados([])
    if (!pending.precisaAlvo) {
      if (pending.precisaValor) setModalValorAberto(true)
      else enviarAcao(pending, [], null, null)
    }
  }

  function alternarAlvo(id: string, nome: string) {
    setAlvosSelecionados(prev =>
      prev.some(a => a.id === id) ? prev.filter(a => a.id !== id) : [...prev, { id, nome }]
    )
    setPopupCombatenteId(null)
  }

  function avancarComAlvos() {
    if (!acaoPendente || alvosSelecionados.length === 0) return
    if (acaoPendente.precisaValor) setModalValorAberto(true)
    else enviarAcao(acaoPendente, alvosSelecionados, null, null)
  }

  function confirmarValor(valor: number, tipoDano: TipoDano | null) {
    if (!acaoPendente) return
    enviarAcao(acaoPendente, alvosSelecionados, valor, tipoDano)
  }

  function iniciarAtaqueArma(arma: ArmaEmpunhada) {
    iniciarAcao({
      tipo: 'ataque',
      nomeAcao: arma.nome,
      efeito: 'dano',
      precisaAlvo: true,
      precisaValor: true,
      tipoDanoPadrao: normalizarTipoDano(arma.tipo_dano),
    })
  }

  function escolherAtaqueLista(a: AtaqueDisponivel) {
    setModalListaAtaqueAberto(false)
    iniciarAcao({
      tipo: 'ataque',
      nomeAcao: a.nome,
      efeito: 'dano',
      precisaAlvo: true,
      precisaValor: true,
      tipoDanoPadrao: normalizarTipoDano(a.tipo_dano),
    })
  }

  function conjurarMagia({ magia, nivelConjurado, efeitoAtivo }: ConjuracaoEscolhida) {
    setModalMagiaAberto(false)
    const { efeito } = classificarMagia(magia)
    iniciarAcao({
      // A API decide dano/cura pelo `tipo` (TIPOS_CURA), não por um campo à
      // parte — magia de cura precisa do tipo 'cura' ou seria aplicada como
      // dano no alvo. O nome real da magia continua em nomeAcao.
      tipo: efeito === 'cura' ? 'cura' : 'magia',
      nomeAcao: magia.nome,
      efeito,
      precisaAlvo: efeito !== 'nenhum',
      precisaValor: efeito !== 'nenhum',
      tipoDanoPadrao: magia.tipoDano,
      nivelMagia: nivelConjurado ?? undefined,
      marcarEfeitoAtivo: efeitoAtivo ? magia.nome : undefined,
    })
  }

  function escolherReacao(opt: typeof OPCOES_REACAO[number]) {
    setModalReacaoAberto(false)
    iniciarAcao({
      tipo: opt.tipo,
      nomeAcao: opt.label,
      efeito: opt.precisaValor ? 'dano' : 'nenhum',
      precisaAlvo: opt.precisaAlvo,
      precisaValor: opt.precisaValor,
      tipoDanoPadrao: null,
    })
  }

  function enviarReacaoLivre(descricao: string) {
    setModalReacaoAberto(false)
    enviarAcao(
      { tipo: 'outra_reacao', nomeAcao: 'Outra reação', efeito: 'nenhum', precisaAlvo: false, precisaValor: false, tipoDanoPadrao: null },
      [], null, null, descricao
    )
  }

  async function escolherVantagem(v: 'vantagem' | 'desvantagem' | null) {
    if (!combatenteOperado || !batalhaId || enviandoVantagem) return
    const anterior = combatenteOperado.vantagem ?? null
    setVantagemEscolhida(v)
    setEnviandoVantagem(true)
    const nomeAcao = v === 'vantagem' ? 'Vantagem ativada' : v === 'desvantagem' ? 'Desvantagem ativada' : 'Vantagem removida'
    const resultado = await chamarAcaoApi({
      batalhaId,
      combatenteId: combatenteOperado.id,
      tipo: 'sistema',
      alvos: [],
      nomeAcao,
      vantagem: v,
    })
    setEnviandoVantagem(false)
    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao salvar vantagem')
      setVantagemEscolhida(anterior)
    }
  }

  // "A qualquer momento" — sem checagem de turno (a API trata como reação
  // para efeito de validação). O DM operando o combatente também pode.
  async function encerrarEfeito(nome: string) {
    if (!combatenteOperado || !batalhaId) return
    if (!window.confirm(`Encerrar "${nome}"?`)) return
    const resultado = await chamarAcaoApi({
      batalhaId,
      combatenteId: combatenteOperado.id,
      tipo: 'sistema',
      alvos: [],
      nomeAcao: `Efeito encerrado: ${nome}`,
      encerrarEfeitoAtivo: nome,
    })
    if (!resultado.ok) toast.error(resultado.erro ?? 'Erro ao encerrar efeito')
  }

  // Barra de participantes: NUNCA por iniciativa/ordem de turno, sempre
  // alfabética dentro de cada grupo. O DM sempre vê todos (é o cockpit); o
  // jogador só vê os PJs fora do modo de seleção de alvo — ao selecionar um
  // alvo, os inimigos entram na barra (o segredo é a ordem, não a
  // existência: eles já estão na mesa física, todo mundo os vê).
  const emSelecaoDeAlvo = !!acaoPendente?.precisaAlvo
  const { aliadosBarra, inimigosBarra } = useMemo(() => {
    const vivos = (lista: Combatente[]) => lista.filter(c => !c.morto && !c.ausente)
    if (ehDM || emSelecaoDeAlvo) {
      const base = ehDM ? combatentes : vivos(combatentes)
      return {
        aliadosBarra: ordenarPorNome(base.filter(c => c.tipo !== 'monstro')),
        inimigosBarra: ordenarPorNome(base.filter(c => c.tipo === 'monstro')),
      }
    }
    return { aliadosBarra: ordenarPorNome(combatentes.filter(c => c.tipo === 'jogador')), inimigosBarra: [] as Combatente[] }
  }, [combatentes, ehDM, emSelecaoDeAlvo])

  const alvosSelecionadosIds = useMemo(() => new Set(alvosSelecionados.map(a => a.id)), [alvosSelecionados])

  const ativosOrdenados = useMemo(
    () => [...combatentes].sort((a, b) => a.ordem - b.ordem).filter(c => !c.ausente && !c.morto),
    [combatentes]
  )
  // Sem turno_combatente_id, turnoAtual cai num índice de fallback (0) que
  // não representa ninguém de verdade — tratar como "ninguém na vez", não
  // assumir esse índice silenciosamente.
  const combatenteDoTurno = ativa && turnoCombatenteId ? ativosOrdenados[turnoAtual] ?? null : null
  // O jogador só age quando o combatente OPERADO é exatamente o da vez e é
  // dele — com 2 personagens, o que não é da vez não pode agir (o servidor
  // recusa).
  const ehMeuTurno =
    !!combatenteDoTurno && !!combatenteOperado &&
    combatenteOperado.id === combatenteDoTurno.id &&
    meuCombatenteIds.has(combatenteOperado.id)
  // O DM não tem "vez" — pode agir por qualquer combatente que esteja
  // operando a qualquer momento (a API já trata isso na validação).
  const podeAgirOperado = (ehDM || ehMeuTurno) && online

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

  if (sessaoCarregando) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--text3)] font-cinzel text-sm">Carregando...</p>
      </div>
    )
  }

  if (!sessaoAtiva) {
    const semOp = () => {}
    // Abaixo de md com personagem: ficha em somente leitura. Sem personagem
    // (ou de md para cima) segue a mensagem de sempre.
    const mensagemSemSessao = (
      <div className={cn(
        'h-full flex-col items-center justify-center gap-2 p-8 text-center',
        personagemOperadoSessao ? 'hidden md:flex' : 'flex'
      )}>
        <Swords className="w-10 h-10 text-[var(--border)]" />
        <p className="font-cinzel text-[var(--border)] text-lg">Nenhuma sessão em andamento</p>
        <p className="text-[var(--border)] text-sm font-crimson max-w-xs">
          Aguarde o mestre iniciar a sessão.
        </p>
      </div>
    )
    if (!personagemOperadoSessao) return mensagemSemSessao

    return (
      <>
        <PainelAbasMesa
          semSessao
          personagemFichaId={personagemOperadoSessao.id}
        />
        <div className={cn('flex flex-col h-full overflow-hidden md:hidden', abaAtiva !== 'personagem' && 'hidden')}>
          <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
            Sem sessão em andamento
          </div>
          <div className="flex-1 min-h-0 overflow-hidden px-3 pb-2">
            <CartaoPersonagemSessao
              personagem={personagemOperadoSessao}
              podeEditar={false}
              enviando={false}
              opcoesSelecao={ehDM ? personagensSessao : meusPersonagensSessao}
              mostrarSeletorSempre={ehDM}
              rotuloSeletor={ehDM ? '🎭 Operando' : undefined}
              selecionadoId={personagemOperadoIdSessao}
              onSelecionar={setPersonagemOperadoIdSessao}
              onAjustarPV={semOp}
              onDefinirPVTemp={semOp}
              onAdicionarCondicao={semOp}
              onRemoverCondicao={semOp}
              onUsarInspiracao={semOp}
              onUsarEspaco={semOp}
              onRecuperarEspaco={semOp}
            />
          </div>
          <div className="flex-shrink-0 px-3 pb-3">
            <BotaoFichaCompleta personagemId={personagemOperadoSessao.id} rotulo="Abrir ficha completa" className="w-full" />
          </div>
        </div>
        {mensagemSemSessao}
      </>
    )
  }

  // Painéis das abas do celular — um só, acima das duas árvores, para não
  // remontar na troca sessão/combate. Combate usa os flags/modais do combate
  // (Magias/Itens) e os de sessão para Preparar/Ouro/Distribuir.
  const personagemCombate = combatenteOperado?.personagem_id
    ? personagensSessao.find(p => p.id === combatenteOperado.personagem_id) ?? null
    : null
  // Aba Magias: no combate o "Conjurar" segue o fluxo com alvo/valor (que
  // roda na aba Personagem), então volta para ela depois de escolher.
  const personagemMagias = emModoSessao ? personagemOperadoSessao : personagemCombate
  const abaMagias = personagemMagias ? (
    <AbaMagias
      key={personagemMagias.id}
      personagem={personagemMagias}
      espacosMagia={emModoSessao ? personagemMagias.slots_magia ?? {} : combatenteOperado?.espacos_magia ?? {}}
      podeConjurar={emModoSessao ? !enviandoSessao && online : podeAgirOperado}
      podeEditarEspacos={emModoSessao && !enviandoSessao && online}
      onConjurar={emModoSessao ? conjurarMagiaSessao : escolha => { conjurarMagia(escolha); setAba('personagem') }}
      onUsarEspaco={usarEspacoSessao}
      onRecuperarEspaco={recuperarEspacoSessao}
    />
  ) : (
    <p className="text-[var(--text3)] text-sm font-crimson text-center py-6">
      {ehDM ? 'Nenhum PJ para operar.' : 'Você não tem um personagem nesta campanha.'}
    </p>
  )
  // Aba Mochila: passar item/ouro vale sempre (inclusive em combate); "Usar"
  // segue a mesma regra da barra de ações (sessão: sempre; combate: quem pode agir).
  const personagemMochila = emModoSessao ? personagemOperadoSessao : personagemCombate
  const contextoMochila: ContextoAcao | null = emModoSessao
    ? (sessaoAtiva ? { sessaoId: sessaoAtiva.id } : null)
    : (batalhaId && combatenteOperado ? { batalhaId, combatenteId: combatenteOperado.id } : null)
  // Mesmos destinatários que o ModalItem usa em cada modo.
  const destinatariosMochila: Destinatario[] = !personagemMochila ? []
    : emModoSessao
      ? personagensPresentes
          .filter(p => p.id !== personagemMochila.id)
          .map(p => ({ id: p.id, nome: p.nome, imagemUrl: p.imagem_url }))
      : combatentes
          .filter((c): c is typeof c & { personagem_id: string } => !!c.personagem_id && c.personagem_id !== personagemMochila.id)
          .map(c => ({ id: c.personagem_id, nome: c.nome, imagemUrl: infoPersonagens[c.personagem_id]?.imagem_url }))
  const abaMochila = personagemMochila && contextoMochila ? (
    <AbaMochila
      key={personagemMochila.id}
      personagemId={personagemMochila.id}
      moedas={personagemMochila.moedas}
      campanhaId={personagemMochila.campanha_id}
      ehDM={ehDM}
      contexto={contextoMochila}
      destinatarios={destinatariosMochila}
      podeUsar={emModoSessao ? !enviandoSessao && online : podeAgirOperado}
      podeMovimentar={!enviandoSessao && online}
      onMovimentarOuro={() => setModalOuroAberto(true)}
      onDistribuir={() => setModalDistribuirAberto(true)}
    />
  ) : (
    <p className="text-[var(--text3)] text-sm font-crimson text-center py-6">
      {ehDM ? 'Nenhum PJ para operar.' : 'Você não tem um personagem nesta campanha.'}
    </p>
  )
  const painelAbas = <PainelAbasMesa abaMagias={abaMagias} abaMochila={abaMochila} />

  // Modo sessão — sem batalha ativa: cartão editável do PJ, sem turno.
  if (emModoSessao) {
    const espacosMagiaSessao: EspacosMagiaBatalha = personagemOperadoSessao?.slots_magia ?? {}

    return (
      <>
        {painelAbas}
        <div className={classeArvore}>
        <BarraParticipantesSessao
          personagens={personagensPresentes}
          meuPersonagemIds={meusPersonagemIdsSessao}
          personagemOperadoId={personagemOperadoIdSessao}
        />

        <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
          🟢 Sessão {sessaoAtiva.numero ?? ''} em andamento — fora de combate
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-3 pb-2">
          {personagemOperadoSessao ? (
            <CartaoPersonagemSessao
              personagem={personagemOperadoSessao}
              podeEditar
              enviando={enviandoSessao}
              opcoesSelecao={ehDM ? personagensSessao : meusPersonagensSessao}
              mostrarSeletorSempre={ehDM}
              rotuloSeletor={ehDM ? '🎭 Operando' : undefined}
              selecionadoId={personagemOperadoIdSessao}
              onSelecionar={setPersonagemOperadoIdSessao}
              onAjustarPV={ajustarPVSessao}
              onDefinirPVTemp={definirPVTempSessao}
              onAdicionarCondicao={adicionarCondicaoSessao}
              onRemoverCondicao={removerCondicaoSessao}
              onUsarInspiracao={usarInspiracaoSessao}
              onUsarEspaco={usarEspacoSessao}
              onRecuperarEspaco={recuperarEspacoSessao}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center px-4">
              <p className="text-[var(--text3)] text-xs font-crimson">
                {ehDM
                  ? 'Nenhum PJ na campanha ainda.'
                  : 'Você não tem um personagem nesta campanha.'}
              </p>
            </div>
          )}
        </div>

        {personagemOperadoSessao && (
          <div className="flex-shrink-0 px-3 pb-1.5 md:hidden">
            <BotaoFichaCompleta personagemId={personagemOperadoSessao.id} className="w-full" />
          </div>
        )}

        {personagemOperadoSessao && (
          <BarraAcoesSessao
            podeAgir={!enviandoSessao && online}
            onAbrirMagia={() => setModalMagiaSessaoAberto(true)}
            onAbrirPreparar={() => setModalPrepararSessaoAberto(true)}
            onAbrirItem={() => setModalItemSessaoAberto(true)}
            onAbrirOuro={() => setModalOuroAberto(true)}
            onAbrirDescanso={() => setModalDescansoAberto(true)}
            botoesDM={ehDM ? [
              { label: '🎁 Distribuir', onClick: () => setModalDistribuirAberto(true), grupo: 'mochila' },
              { label: '⭐ Inspiração', onClick: concederInspiracao, grupo: 'personagem' },
            ] : undefined}
          />
        )}

        {modalMagiaSessaoAberto && personagemOperadoSessao && (
          <ModalMagias
            personagemId={personagemOperadoSessao.id}
            personagemNome={personagemOperadoSessao.nome}
            espacosMagia={espacosMagiaSessao}
            onConjurar={conjurarMagiaSessao}
            onFechar={() => setModalMagiaSessaoAberto(false)}
          />
        )}

        {modalPrepararSessaoAberto && personagemOperadoSessao && (
          <ModalPrepararMagias
            personagemId={personagemOperadoSessao.id}
            personagemNome={personagemOperadoSessao.nome}
            onFechar={() => setModalPrepararSessaoAberto(false)}
          />
        )}

        {modalItemSessaoAberto && personagemOperadoSessao && sessaoAtiva && (
          <ModalItem
            personagemId={personagemOperadoSessao.id}
            campanhaId={personagemOperadoSessao.campanha_id}
            ehDM={ehDM}
            contexto={{ sessaoId: sessaoAtiva.id }}
            destinatarios={personagensPresentes
              .filter(p => p.id !== personagemOperadoSessao.id)
              .map(p => ({ id: p.id, nome: p.nome, imagemUrl: p.imagem_url }))}
            onFechar={() => setModalItemSessaoAberto(false)}
          />
        )}

        {modalOuroAberto && personagemOperadoSessao && sessaoAtiva && (
          <ModalOuro
            personagem={personagemOperadoSessao}
            sessaoId={sessaoAtiva.id}
            destinatarios={personagensPresentes
              .filter(p => p.id !== personagemOperadoSessao.id)
              .map(p => ({ id: p.id, nome: p.nome, imagemUrl: p.imagem_url }))}
            onFechar={() => setModalOuroAberto(false)}
          />
        )}

        {modalDescansoAberto && personagemOperadoSessao && (
          <ModalDescanso
            personagem={personagemOperadoSessao}
            onLongo={descansoLongoSessao}
            onCurto={descansoCurtoSessao}
            onFechar={() => setModalDescansoAberto(false)}
          />
        )}

        {modalDistribuirAberto && ehDM && sessaoAtiva && campanhaAtiva && (
          <ModalDistribuirTesouro
            sessaoId={sessaoAtiva.id}
            campanhaId={campanhaAtiva.id}
            personagens={personagensPresentes}
            onFechar={() => setModalDistribuirAberto(false)}
          />
        )}
        </div>
      </>
    )
  }

  return (
    <>
    {painelAbas}
    <div className={classeArvore}>
      <BarraParticipantes
        aliados={aliadosBarra}
        inimigos={inimigosBarra}
        turnoCombatenteId={turnoCombatenteId}
        ativa={ativa}
        infoPersonagens={infoPersonagens}
        meuCombatenteIds={meuCombatenteIds}
        alvosSelecionadosIds={alvosSelecionadosIds}
        onTocar={setPopupCombatenteId}
      />

      <StatusRodada
        ativa={ativa}
        statusBatalha={statusBatalha}
        rodadaAtual={rodadaAtual}
        combatenteDoTurno={combatenteDoTurno}
        ehMeuTurno={ehMeuTurno}
        ehDM={ehDM}
        dmControlandoId={dmControlandoId}
        combatenteOperado={combatenteOperado}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
        {combatenteOperado ? (
          <CartaoPersonagem
            combatente={combatenteOperado}
            info={combatenteOperado.personagem_id ? infoPersonagens[combatenteOperado.personagem_id] : undefined}
            opcoesSelecao={ehDM ? combatentesControlaveisDM : meuCombatentes}
            mostrarSeletorSempre={ehDM}
            rotuloSeletor={ehDM ? '🎭 Operando' : undefined}
            selecionadoId={ehDM ? dmControlandoId : personagemSelecionadoId}
            onSelecionar={ehDM ? setDmControlandoId : setPersonagemSelecionadoId}
            onEncerrarEfeito={encerrarEfeito}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-center px-4">
            <p className="text-[var(--text3)] text-xs font-crimson">
              {ehDM
                ? 'Nenhum monstro, NPC ou PJ ausente para operar ainda.'
                : 'Você não está controlando nenhum personagem nesta batalha. Toque em um participante acima para ver detalhes.'}
            </p>
          </div>
        )}
      </div>

      {combatenteOperado?.personagem_id && (
        <div className="flex-shrink-0 px-3 pb-1.5 md:hidden">
          <BotaoFichaCompleta personagemId={combatenteOperado.personagem_id} className="w-full" />
        </div>
      )}

      {combatenteOperado && (
        <>
          <FaixaVantagem
            valor={vantagemEscolhida}
            podeAgir={podeAgirOperado}
            enviando={enviandoVantagem}
            onEscolher={escolherVantagem}
          />
          <BarraAcoes
            combatente={combatenteOperado}
            ehMeuTurno={podeAgirOperado}
            onDefinirArma={(lado, arma) => definirArmaEmpunhada(combatenteOperado.id, lado, arma)}
            onAtacarComArma={iniciarAtaqueArma}
            onAbrirAtaque={() => setModalListaAtaqueAberto(true)}
            onAbrirMagia={() => setModalMagiaAberto(true)}
            onAbrirItem={() => setModalItemAberto(true)}
            onAbrirReacao={() => setModalReacaoAberto(true)}
          />
        </>
      )}

      {combatentePopup && (
        <PopupCombatente
          combatente={combatentePopup}
          info={combatentePopup.personagem_id ? infoPersonagens[combatentePopup.personagem_id] : undefined}
          ehDM={ehDM}
          selecionandoAlvo={!!acaoPendente?.precisaAlvo}
          alvoJaSelecionado={alvosSelecionados.some(a => a.id === combatentePopup.id)}
          onSelecionarAlvo={() => alternarAlvo(combatentePopup.id, combatentePopup.nome)}
          onFechar={() => setPopupCombatenteId(null)}
        />
      )}

      {modalListaAtaqueAberto && combatenteOperado && (
        <ModalListaAtaques
          ataques={ataquesDoCombatente(combatenteOperado)}
          onEscolher={escolherAtaqueLista}
          onFechar={() => setModalListaAtaqueAberto(false)}
        />
      )}

      {modalMagiaAberto && combatenteOperado?.personagem_id && (
        <ModalMagias
          personagemId={combatenteOperado.personagem_id}
          personagemNome={combatenteOperado.nome}
          espacosMagia={combatenteOperado.espacos_magia}
          onConjurar={conjurarMagia}
          onFechar={() => setModalMagiaAberto(false)}
        />
      )}

      {modalItemAberto && combatenteOperado?.personagem_id && batalhaId && (
        <ModalItem
          personagemId={combatenteOperado.personagem_id}
          campanhaId={campanhaAtiva?.id ?? ''}
          ehDM={ehDM}
          contexto={{ batalhaId, combatenteId: combatenteOperado.id }}
          destinatarios={combatentes
            .filter((c): c is typeof c & { personagem_id: string } => !!c.personagem_id && c.personagem_id !== combatenteOperado.personagem_id)
            .map(c => ({ id: c.personagem_id, nome: c.nome, imagemUrl: infoPersonagens[c.personagem_id]?.imagem_url }))}
          onFechar={() => setModalItemAberto(false)}
        />
      )}

      {modalReacaoAberto && (
        <ModalReacao
          onEscolher={escolherReacao}
          onEnviarLivre={enviarReacaoLivre}
          onFechar={() => setModalReacaoAberto(false)}
        />
      )}

      {modalPrepararSessaoAberto && combatenteOperado?.personagem_id && (
        <ModalPrepararMagias
          personagemId={combatenteOperado.personagem_id}
          personagemNome={combatenteOperado.nome}
          onFechar={() => setModalPrepararSessaoAberto(false)}
        />
      )}

      {modalOuroAberto && personagemCombate && sessaoAtiva && (
        <ModalOuro
          personagem={personagemCombate}
          sessaoId={sessaoAtiva.id}
          destinatarios={personagensSessao
            .filter(p => p.id !== personagemCombate.id)
            .map(p => ({ id: p.id, nome: p.nome, imagemUrl: p.imagem_url }))}
          onFechar={() => setModalOuroAberto(false)}
        />
      )}

      {modalDistribuirAberto && ehDM && sessaoAtiva && campanhaAtiva && (
        <ModalDistribuirTesouro
          sessaoId={sessaoAtiva.id}
          campanhaId={campanhaAtiva.id}
          personagens={personagensPresentes}
          onFechar={() => setModalDistribuirAberto(false)}
        />
      )}

      {acaoPendente?.precisaAlvo && !modalValorAberto && (
        <BandejaAlvos
          acao={acaoPendente}
          alvos={alvosSelecionados}
          enviando={enviando}
          onConfirmar={avancarComAlvos}
          onCancelar={cancelarAcao}
        />
      )}

      {acaoPendente && modalValorAberto && (
        <ModalValorAcao
          acao={acaoPendente}
          alvosNomes={alvosSelecionados.map(a => a.nome)}
          enviando={enviando}
          onConfirmar={confirmarValor}
          onFechar={() => { if (acaoPendente.precisaAlvo) setModalValorAberto(false); else cancelarAcao() }}
        />
      )}
    </div>
    </>
  )
}
