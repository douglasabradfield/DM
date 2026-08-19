'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useCampanha } from '@/store/campanha'
import type { Personagem, Spell, InventarioItemDb } from '@/types/dnd'
import { calcularModificadorAtributo, formatarModificador, cn } from '@/lib/utils'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { ModalLevelUp } from '@/components/personagem/ModalLevelUp'
import { createClient } from '@/lib/supabase/client'
import { useBatalha } from '@/store/batalha'
import { useOnline } from '@/hooks/useOnline'
import { TIPOS_DANO, normalizarTipoDano } from '@/lib/dados-dnd/tipos-dano'
import { getEspacosMagiaPorClasse, ehPactoArcano } from '@/lib/dados-dnd/espacos-magia'
import { getNivelPorXP, getProgressoXP } from '@/lib/dados-dnd/xp-niveis'
import type { TipoDano } from '@/types/dnd'
import { Search, X, MoreVertical } from 'lucide-react'
import toast from 'react-hot-toast'

const PERICIAS = [
  { nome: 'Acrobacia', atributo: 'destreza' },
  { nome: 'Adestrar Animais', atributo: 'sabedoria' },
  { nome: 'Arcanismo', atributo: 'inteligencia' },
  { nome: 'Atletismo', atributo: 'forca' },
  { nome: 'Atuação', atributo: 'carisma' },
  { nome: 'Enganação', atributo: 'carisma' },
  { nome: 'Furtividade', atributo: 'destreza' },
  { nome: 'História', atributo: 'inteligencia' },
  { nome: 'Intimidação', atributo: 'carisma' },
  { nome: 'Intuição', atributo: 'sabedoria' },
  { nome: 'Investigação', atributo: 'inteligencia' },
  { nome: 'Medicina', atributo: 'sabedoria' },
  { nome: 'Natureza', atributo: 'inteligencia' },
  { nome: 'Percepção', atributo: 'sabedoria' },
  { nome: 'Persuasão', atributo: 'carisma' },
  { nome: 'Prestidigitação', atributo: 'destreza' },
  { nome: 'Religião', atributo: 'inteligencia' },
  { nome: 'Sobrevivência', atributo: 'sabedoria' },
] as const

const ATRIBUTOS = [
  { key: 'forca', label: 'Força', abrev: 'FOR' },
  { key: 'destreza', label: 'Destreza', abrev: 'DES' },
  { key: 'constituicao', label: 'Constituição', abrev: 'CON' },
  { key: 'inteligencia', label: 'Inteligência', abrev: 'INT' },
  { key: 'sabedoria', label: 'Sabedoria', abrev: 'SAB' },
  { key: 'carisma', label: 'Carisma', abrev: 'CAR' },
] as const

type TipoDefesa = 'resistencia' | 'imunidade' | 'vulnerabilidade'

interface MagiaPersonagem {
  id: string
  personagem_id: string
  spell_id: number | null
  magia_id: string | null
  preparada: boolean
  spell: Spell
}

interface FichaPersonagemProps {
  personagem: Personagem
  onAtualizar?: (p: Partial<Personagem>) => void
}

export function FichaPersonagem({ personagem: p, onAtualizar }: FichaPersonagemProps) {
  const router = useRouter()
  const atualizarCombatentePorPersonagem = useBatalha(s => s.atualizarCombatentePorPersonagem)
  const combatenteAtivo = useBatalha(s => s.combatentes.find(c => c.personagem_id === p.id))
  const campanhaAtiva = useCampanha(s => s.campanhaAtiva)
  const papelPorCampanha = useCampanha(s => s.papelPorCampanha)
  const [moedaCustomNome, setMoedaCustomNome] = useState(campanhaAtiva?.moeda_custom_nome || 'Especial')

  useEffect(() => {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    supabase.from('campanhas').select('moeda_custom_nome').eq('id', campanhaAtiva.id).single()
      .then(({ data }) => { if (data?.moeda_custom_nome) setMoedaCustomNome(data.moeda_custom_nome) })
  }, [campanhaAtiva?.id])

  const [userId, setUserId] = useState<string | null>(null)
  const isDM = !!campanhaAtiva && !!userId && campanhaAtiva.dm_id === userId
  const ehJogador = campanhaAtiva ? papelPorCampanha[campanhaAtiva.id] === 'jogador' : false
  const podeEditar = !ehJogador || p.user_id === userId
  const online = useOnline()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [])

  const [pagina, setPagina] = useState(1)
  // Ataques criados antes de abrir a ficha (índice < qtdAtaquesIniciais) são
  // "legados" — podem ficar sem tipo de dano sem bloquear o salvamento
  // (dados antigos do grupo). Ataques adicionados nesta sessão de edição
  // (índice >= qtdAtaquesIniciais, sempre appendados via push) exigem tipo
  // antes de salvar. Ver validação em salvar().
  const [qtdAtaquesIniciais] = useState(() => (p.ataques ?? []).length)
  const [dados, setDados] = useState({
    ...p,
    pontos_experiencia: p.pontos_experiencia ?? 0,
    inspiracao: typeof p.inspiracao === 'number' ? p.inspiracao : 0,
    bonus_proficiencia: p.bonus_proficiencia ?? 2,
    moedas: p.moedas ?? { pc: 0, pp: 0, po: 0, pe: 0, pl: 0, custom: 0 },
  })
  const [salvando, setSalvando] = useState(false)
  const [alterado, setAlterado] = useState(false)
  const alteradoRef = useRef(false)
  useEffect(() => { alteradoRef.current = alterado }, [alterado])

  useEffect(() => {
    if (combatenteAtivo) {
      setDados(prev => ({
        ...prev,
        pv_atual: combatenteAtivo.pv_atual,
        pv_temporarios: combatenteAtivo.pv_temporarios ?? 0,
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combatenteAtivo?.pv_atual, combatenteAtivo?.pv_temporarios])

  // Campos voláteis (PV, PV temp, espaços de magia, inspiração) ficam travados
  // quando este personagem está numa batalha não encerrada — a tela de mesa é
  // quem manda nesses valores enquanto o combate dura. Consultado direto no
  // banco (não via useBatalha) porque essa página pode abrir sem a store de
  // batalha carregada, ex: jogador acessando a ficha em outra aba.
  const [emCombate, setEmCombate] = useState(false)
  useEffect(() => {
    if (!campanhaAtiva?.id) { setEmCombate(false); return }
    const idCampanha = campanhaAtiva.id
    const supabase = createClient()
    let cancelado = false

    async function verificarCombate() {
      const { data } = await supabase
        .from('batalha_combatentes')
        .select('id, batalhas!inner(status, campanha_id)')
        .eq('personagem_id', p.id)
        .eq('batalhas.campanha_id', idCampanha)
        .neq('batalhas.status', 'encerrada')
        .limit(1)
      if (!cancelado) setEmCombate((data?.length ?? 0) > 0)
    }

    verificarCombate()

    const canal = supabase
      .channel(`ficha-combate-${p.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batalha_combatentes', filter: `personagem_id=eq.${p.id}` }, verificarCombate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'batalhas', filter: `campanha_id=eq.${idCampanha}` }, verificarCombate)
      .subscribe()

    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [p.id, campanhaAtiva?.id])

  useEffect(() => {
    const supabase = createClient()
    const canal = supabase
      .channel(`personagem-${p.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'personagens', filter: `id=eq.${p.id}` },
        payload => {
          if (!alteradoRef.current) {
            setDados(prev => ({ ...prev, ...(payload.new as Partial<typeof prev>) }))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [p.id])

  const [levelUp, setLevelUp] = useState<{ novoNivel: number; novaProf: number } | null>(null)
  const nivelNotificado = useRef(p.nivel)

  // Inventário — Fase 4: lê/escreve em inventario_itens via API árbitro
  // (/api/mesa/acao, modo ficha — só personagemId, sem sessão/batalha ativa
  // exigida). personagens.inventario (jsonb) fica congelado como legado,
  // nunca mais lido nem escrito por aqui.
  const [inventario, setInventario] = useState<InventarioItemDb[]>([])
  const [itemPopup, setItemPopup] = useState<InventarioItemDb | null>(null)
  const [buscaInventario, setBuscaInventario] = useState('')
  const [modalCompendio, setModalCompendio] = useState(false)
  const [buscaCompendio, setBuscaCompendio] = useState('')
  const [abaCompendio, setAbaCompendio] = useState<'magicos' | 'armas' | 'armaduras' | 'gear'>('gear')
  const [itensCompendio, setItensCompendio] = useState<Record<string, unknown>[]>([])
  const [buscandoCompendio, setBuscandoCompendio] = useState(false)

  const carregarInventario = useCallback(() => {
    createClient()
      .from('inventario_itens')
      .select('*')
      .eq('personagem_id', p.id)
      .order('nome')
      .then(({ data }) => setInventario((data as InventarioItemDb[]) ?? []))
  }, [p.id])

  useEffect(() => { carregarInventario() }, [carregarInventario])

  // Realtime — reflete itens recebidos por transferência (mesa) ou
  // adicionados/removidos em outra aba sem precisar recarregar a página.
  useEffect(() => {
    const supabase = createClient()
    const canal = supabase
      .channel(`ficha-inventario-${p.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario_itens', filter: `personagem_id=eq.${p.id}` },
        carregarInventario
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [p.id, carregarInventario])

  async function chamarInventarioApi(payload: Record<string, unknown>): Promise<boolean> {
    try {
      const resp = await fetch('/api/mesa/acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personagemId: p.id, ...payload }),
      })
      const dados = await resp.json().catch(() => null)
      if (!resp.ok) {
        toast.error(dados?.erro ?? 'Erro ao atualizar inventário')
        return false
      }
      return true
    } catch {
      toast.error('Sem conexão — tente novamente')
      return false
    }
  }

  async function alterarQuantidade(item: InventarioItemDb, delta: number) {
    const novaQtd = item.quantidade + delta
    if (await chamarInventarioApi({ tipo: 'definir_item', itemId: item.id, quantidade: novaQtd })) carregarInventario()
  }

  async function removerItem(item: InventarioItemDb) {
    if (await chamarInventarioApi({ tipo: 'definir_item', itemId: item.id, remover: true })) carregarInventario()
  }

  async function equiparItem(item: InventarioItemDb, equipado: boolean) {
    if (await chamarInventarioApi({ tipo: 'definir_item', itemId: item.id, equipado })) {
      carregarInventario()
      setItemPopup(prev => prev && prev.id === item.id ? { ...prev, equipado } : prev)
    }
  }

  const buscarCompendio = useCallback(async (termo: string, aba: string) => {
    if (!termo.trim()) { setItensCompendio([]); return }
    setBuscandoCompendio(true)
    try {
      const tabelas: Record<string, { tabela: string; campos: string }> = {
        magicos:   { tabela: 'magic_items',      campos: 'slug,name_pt,name_en,category,rarity,description_pt' },
        armas:     { tabela: 'equipment_weapons', campos: 'slug,name_pt,name_en,damage_dice,damage_type_pt,properties_pt,weight_lb,cost_cp' },
        armaduras: { tabela: 'equipment_armor',   campos: 'slug,name_pt,name_en,base_ac_formula_pt,stealth_disadvantage,strength_requirement,weight_lb,cost_cp,category_pt' },
        gear:      { tabela: 'equipment_gear',    campos: 'slug,name_pt,name_en,category_pt,cost_gp,weight_lb,description_pt' },
      }
      const { tabela, campos } = tabelas[aba] ?? tabelas.gear
      const supabase = createClient()
      // Itens custom só aparecem para quem está na campanha dona — e, para
      // quem não é DM, só se o mestre marcou visivel_jogadores.
      const ehDM = papelPorCampanha[p.campanha_id] === 'dm'
      let query = supabase.from(tabela).select(campos).or(`name_pt.ilike.%${termo}%,name_en.ilike.%${termo}%`)
      query = ehDM
        ? query.or(`criado_por.is.null,campanha_id.eq.${p.campanha_id}`)
        : query.or(`criado_por.is.null,and(campanha_id.eq.${p.campanha_id},visivel_jogadores.eq.true)`)
      const { data } = await query.limit(10)
      setItensCompendio((data ?? []) as unknown as Record<string, unknown>[])
    } finally {
      setBuscandoCompendio(false)
    }
  }, [p.campanha_id, papelPorCampanha])

  useEffect(() => {
    const t = setTimeout(() => buscarCompendio(buscaCompendio, abaCompendio), 300)
    return () => clearTimeout(t)
  }, [buscaCompendio, abaCompendio, buscarCompendio])

  async function adicionarDoCompendio(item: Record<string, unknown>) {
    const slug = item.slug as string
    const namePt = item.name_pt as string

    let tipo: string
    let raridade: string | null = null
    let descricao = ''

    if (abaCompendio === 'magicos') {
      tipo = 'magico'
      raridade = (item.rarity as string) ?? null
      descricao = (item.description_pt as string) || ''
    } else if (abaCompendio === 'armas') {
      tipo = 'arma'
      descricao = `${item.damage_dice} ${item.damage_type_pt}${item.properties_pt ? ' · ' + item.properties_pt : ''}`
    } else if (abaCompendio === 'armaduras') {
      tipo = 'armadura'
      descricao = `${item.base_ac_formula_pt}${item.stealth_disadvantage ? ' · Desvantagem em Furtividade' : ''}${item.strength_requirement ? ` · Força mín. ${item.strength_requirement}` : ''}`
    } else {
      tipo = 'equipamento'
      descricao = (item.description_pt as string) || ''
    }

    const ok = await chamarInventarioApi({
      tipo: 'adicionar_item', itemRef: slug, nome: namePt, tipoItem: tipo, raridade, descricaoItem: descricao, quantidade: 1,
    })
    if (ok) {
      toast.success(`${namePt} adicionado!`)
      carregarInventario()
    }
    setModalCompendio(false)
    setBuscaCompendio('')
    setItensCompendio([])
  }

  // Magias
  const [magiasPersonagem, setMagiasPersonagem] = useState<MagiaPersonagem[]>([])
  const [buscaMagia, setBuscaMagia] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<Spell[]>([])
  const [buscandoMagia, setBuscandoMagia] = useState(false)
  const [espacosUtilizados, setEspacosUtilizados] = useState<Record<number, number>>(() => {
    const raw = p.slots_magia
    if (!raw) return {}
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [parseInt(k), v?.usados ?? 0]))
  })
  const [espacosTotais, setEspacosTotais] = useState<Record<number, number>>(() => {
    const raw = p.slots_magia
    const temTotalSalvo = raw && Object.values(raw).some(v => (v?.total ?? 0) > 0)
    if (raw && temTotalSalvo) {
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [parseInt(k), v?.total ?? 0]))
    }
    const seed = getEspacosMagiaPorClasse(p.classe, p.nivel)
    return Object.fromEntries(seed.map((total, idx) => [idx + 1, total]))
  })
  const [modoAjuste, setModoAjuste] = useState(false)
  const [magiaPopup, setMagiaPopup] = useState<Spell | null>(null)

  function atualizar<K extends keyof Personagem>(campo: K, valor: Personagem[K]) {
    if (!podeEditar) return
    setDados(prev => ({ ...prev, [campo]: valor }))
    setAlterado(true)
  }

  function voltar() {
    if (alterado && !confirm('Há alterações não salvas. Deseja sair sem salvar?')) return
    router.push('/personagens')
  }

  async function salvar() {
    const ataquesNovosSemTipo = (dados.ataques ?? [])
      .filter((a, i) => i >= qtdAtaquesIniciais && (a.nome?.trim() || a.dano?.trim()) && !normalizarTipoDano(a.tipo_dano))
    if (ataquesNovosSemTipo.length > 0) {
      toast.error(`Selecione o tipo de dano do(s) ataque(s): ${ataquesNovosSemTipo.map(a => a.nome || '(sem nome)').join(', ')}`)
      return
    }
    setSalvando(true)
    try {
      const supabase = createClient()
      // slots_magia é gravado só por salvarSlotsDb() — dados.slots_magia é um
      // snapshot congelado do carregamento da ficha e sobrescreveria ajustes
      // feitos depois. inventario (jsonb legado) não é mais gravado por
      // aqui — itens agora vivem em inventario_itens, via API árbitro
      // (chamarInventarioApi) — a coluna fica congelada como estava.
      const { slots_magia: _ignorado, inventario: _inventarioLegado, ...dadosParaSalvar } = dados
      const { error } = await supabase.from('personagens').update({
        ...dadosParaSalvar,
        nivel: parseInt(String(dados.nivel)) || 1,
        bonus_proficiencia: parseInt(String(dados.bonus_proficiencia)) || 2,
        pontos_experiencia: parseInt(String(dados.pontos_experiencia)) || 0,
        inspiracao: parseInt(String(dados.inspiracao)) || 0,
        ca: parseInt(String(dados.ca)) || 10,
        pv_maximo: parseInt(String(dados.pv_maximo)) || 1,
        pv_atual: parseInt(String(dados.pv_atual)) || 0,
        pv_temporarios: parseInt(String(dados.pv_temporarios)) || 0,
        imagem_url: dados.imagem_url ?? null,
        moedas: dados.moedas ? {
          pc:     Number(dados.moedas.pc)     || 0,
          pp:     Number(dados.moedas.pp)     || 0,
          pe:     Number(dados.moedas.pe)     || 0,
          po:     Number(dados.moedas.po)     || 0,
          pl:     Number(dados.moedas.pl)     || 0,
          custom: Number(dados.moedas.custom) || 0,
        } : null,
        atualizado_em: new Date().toISOString(),
      }).eq('id', p.id)
      if (error) {
        console.error('Erro ao salvar personagem:', error)
        toast.error(`Erro ao salvar: ${error.message}`)
        return
      }
      toast.success('Personagem salvo!')
      setAlterado(false)
      onAtualizar?.(dados)

      // Notificar DM sobre level-up (somente jogadores)
      if (!isDM && dados.nivel > nivelNotificado.current && campanhaAtiva?.dm_id) {
        await supabase.from('notificacoes').insert({
          user_id: campanhaAtiva.dm_id,
          tipo: 'level_up',
          titulo: '⬆️ Personagem subiu de nível!',
          mensagem: `${dados.nome} chegou ao nível ${dados.nivel}!`,
          link: `/personagens/${p.id}`,
          lida: false,
        })
        nivelNotificado.current = dados.nivel
      }
      // Sincroniza com a batalha se o personagem estiver em combate
      atualizarCombatentePorPersonagem(p.id, {
        ca: parseInt(String(dados.ca)) || 10,
        pv_maximo: parseInt(String(dados.pv_maximo)) || 1,
        pv_atual: parseInt(String(dados.pv_atual)) || 0,
        pv_temporarios: parseInt(String(dados.pv_temporarios)) || 0,
        inspiracao: parseInt(String(dados.inspiracao)) || 0,
        resistencias: dados.resistencias ?? [],
        imunidades: dados.imunidades ?? [],
        vulnerabilidades: dados.vulnerabilidades ?? [],
      })
    } catch (err) {
      console.error('Exceção ao salvar personagem:', err)
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function aprovarPersonagem() {
    setSalvando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('personagens').update({ ativo: true }).eq('id', p.id)
      if (error) throw error
      const playerUserId = (dados as Record<string, unknown>).user_id as string | null
      if (playerUserId) {
        await supabase.from('notificacoes').insert({
          user_id: playerUserId,
          tipo: 'personagem_aprovado',
          titulo: 'Personagem Aprovado!',
          mensagem: `${dados.nome} foi aprovado pelo Mestre e já está disponível na campanha.`,
          link: `/personagens/${p.id}`,
          lida: false,
        })
      }
      setDados(prev => ({ ...prev, ativo: true }))
      toast.success(`${dados.nome} aprovado!`)
    } catch {
      toast.error('Erro ao aprovar personagem')
    } finally {
      setSalvando(false)
    }
  }

  function toggleEspaco(nivel: number, indice: number) {
    if (!podeEditar) return
    const utilizados = espacosUtilizados[nivel] ?? 0
    const total = espacosTotais[nivel] ?? 0
    let novoUtilizados: number
    if (indice < utilizados) {
      novoUtilizados = utilizados - 1
    } else if (utilizados < total) {
      novoUtilizados = utilizados + 1
    } else {
      return
    }
    const novos = { ...espacosUtilizados, [nivel]: novoUtilizados }
    setEspacosUtilizados(novos)
    salvarSlotsDb(novos)
  }

  async function salvarSlotsDb(usados: Record<number, number> = espacosUtilizados, totais: Record<number, number> = espacosTotais) {
    const slotsDb: Record<string, { total: number; usados: number }> = {}
    const espacosBatalha: Record<number, { total: number; utilizados: number }> = {}
    for (let n = 1; n <= 9; n++) {
      const total = totais[n] ?? 0
      const u = usados[n] ?? 0
      slotsDb[String(n)] = { total, usados: u }
      if (total > 0) espacosBatalha[n] = { total, utilizados: u }
    }
    const supabase = createClient()
    const { error } = await supabase.from('personagens').update({ slots_magia: slotsDb }).eq('id', p.id)
    if (error) console.error('Sync slots_magia:', error)
    atualizarCombatentePorPersonagem(p.id, { espacos_magia: espacosBatalha })
  }

  function descansarLongo() {
    const vazios: Record<number, number> = {}
    setEspacosUtilizados(vazios)
    salvarSlotsDb(vazios)
    toast.success('Descanso longo! Espaços de magia recuperados.')
  }

  function alterarTotalNivel(nivel: number, novoTotal: number) {
    setEspacosTotais(prev => ({ ...prev, [nivel]: novoTotal }))
  }

  function salvarTotalNivel(nivel: number) {
    const total = espacosTotais[nivel] ?? 0
    const usadosAtual = espacosUtilizados[nivel] ?? 0
    const novosUsados = usadosAtual > total ? { ...espacosUtilizados, [nivel]: total } : espacosUtilizados
    if (novosUsados !== espacosUtilizados) setEspacosUtilizados(novosUsados)
    salvarSlotsDb(novosUsados, espacosTotais)
  }

  function recalcularPelaClasse() {
    if (!confirm('Recalcular espaços de magia pela classe? Isso substituirá os totais atuais.')) return
    const seed = getEspacosMagiaPorClasse(dados.classe, dados.nivel)
    const novosTotais = Object.fromEntries(seed.map((total, idx) => [idx + 1, total]))
    const novosUsados: Record<number, number> = {}
    for (let n = 1; n <= 9; n++) {
      novosUsados[n] = Math.min(espacosUtilizados[n] ?? 0, novosTotais[n] ?? 0)
    }
    setEspacosTotais(novosTotais)
    setEspacosUtilizados(novosUsados)
    salvarSlotsDb(novosUsados, novosTotais)
  }

  // Defesas por tipo de dano
  function getDefesa(tipo: TipoDano): TipoDefesa | null {
    if ((dados.imunidades as TipoDano[])?.includes(tipo)) return 'imunidade'
    if ((dados.resistencias as TipoDano[])?.includes(tipo)) return 'resistencia'
    if ((dados.vulnerabilidades as TipoDano[])?.includes(tipo)) return 'vulnerabilidade'
    return null
  }

  function setDefesa(tipo: TipoDano, defesa: TipoDefesa | null) {
    const remover = (arr: TipoDano[]) => (arr ?? []).filter(t => t !== tipo)
    const adicionar = (arr: TipoDano[]) => [...remover(arr ?? []), tipo]

    atualizar('resistencias', defesa === 'resistencia' ? adicionar(dados.resistencias as TipoDano[]) : remover(dados.resistencias as TipoDano[]) as never)
    atualizar('imunidades', defesa === 'imunidade' ? adicionar(dados.imunidades as TipoDano[]) : remover(dados.imunidades as TipoDano[]) as never)
    atualizar('vulnerabilidades', defesa === 'vulnerabilidade' ? adicionar(dados.vulnerabilidades as TipoDano[]) : remover(dados.vulnerabilidades as TipoDano[]) as never)
  }

  // Busca de magias
  const buscarMagias = useCallback(async (termo: string) => {
    if (termo.length < 2) { setResultadosBusca([]); return }
    setBuscandoMagia(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('spells')
        .select('id, slug, name_pt, name_en, level, school_pt, casting_time_pt, range_pt, components_pt, duration_pt, description_pt, classes_pt, concentration, ritual')
        .ilike('name_pt', `%${termo}%`)
      // Magias custom só aparecem para quem está na campanha dona — e, para
      // quem não é DM, só se o mestre marcou visivel_jogadores.
      const ehDM = papelPorCampanha[p.campanha_id] === 'dm'
      query = ehDM
        ? query.or(`criado_por.is.null,campanha_id.eq.${p.campanha_id}`)
        : query.or(`criado_por.is.null,and(campanha_id.eq.${p.campanha_id},visivel_jogadores.eq.true)`)
      const { data, error } = await query
        .order('level', { ascending: true })
        .order('name_pt', { ascending: true })
        .limit(20)
      if (error) console.error('Busca de magias:', error)
      setResultadosBusca((data ?? []) as Spell[])
    } finally {
      setBuscandoMagia(false)
    }
  }, [p.campanha_id, papelPorCampanha])

  useEffect(() => {
    const t = setTimeout(() => buscarMagias(buscaMagia), 300)
    return () => clearTimeout(t)
  }, [buscaMagia, buscarMagias])

  const carregarMagias = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('magias_personagem')
      .select(`
        id, preparada, classe_conjuradora, spell_id, magia_id,
        spell:spells!spell_id(
          id, slug, name_pt, name_en, level,
          school_pt, casting_time_pt, range_pt,
          components_pt, duration_pt,
          concentration, ritual, description_pt, classes_pt
        )
      `)
      .eq('personagem_id', p.id)
      .order('nivel')
    if (error) console.error('Erro ao carregar magias:', error)
    if (data) setMagiasPersonagem(data as unknown as MagiaPersonagem[])
  }, [p.id])

  useEffect(() => { carregarMagias() }, [carregarMagias])

  async function adicionarMagia(magia: Spell) {
    const spellIdNum = Number(magia.id)
    if (magiasPersonagem.some(m => m.spell_id === spellIdNum || m.spell?.id === magia.id)) {
      toast.error('Magia já adicionada')
      return
    }
    const supabase = createClient()
    const { error } = await supabase
      .from('magias_personagem')
      .insert({
        personagem_id: p.id,
        spell_id: spellIdNum,
        magia_id: null,
        nome: magia.name_pt,
        nivel: magia.level,
        preparada: false,
        classe_conjuradora: dados.classe || magia.classes_pt?.split(',')[0]?.trim() || '',
      })
    if (error) {
      console.error('Erro ao adicionar magia:', error)
      toast.error(`Erro ao adicionar magia: ${error.message}`)
      return
    }
    await carregarMagias()
    setBuscaMagia('')
    setResultadosBusca([])
    toast.success(`${magia.name_pt} adicionada!`)
  }

  async function removerMagia(id: string) {
    const supabase = createClient()
    await supabase.from('magias_personagem').delete().eq('id', id)
    setMagiasPersonagem(prev => prev.filter(m => m.id !== id))
  }

  async function togglePreparada(m: MagiaPersonagem) {
    const novoValor = !m.preparada
    setMagiasPersonagem(prev => prev.map(x => x.id === m.id ? { ...x, preparada: novoValor } : x))
    const supabase = createClient()
    const { error } = await supabase.from('magias_personagem').update({ preparada: novoValor }).eq('id', m.id)
    if (error) {
      console.error('Erro ao atualizar preparada:', error)
      toast.error('Erro ao atualizar magia preparada')
      setMagiasPersonagem(prev => prev.map(x => x.id === m.id ? { ...x, preparada: m.preparada } : x))
    }
  }

  const [percepcaoPassivaOverride, setPercepcaoPassivaOverride] = useState<number | null>(null)
  const [ajustesPericias, setAjustesPericias] = useState<Record<string, number>>({})

  function ajustarPericia(nome: string, delta: number) {
    setAjustesPericias(prev => ({ ...prev, [nome]: (prev[nome] ?? 0) + delta }))
  }

  function resetarAjuste(nome: string) {
    setAjustesPericias(prev => ({ ...prev, [nome]: 0 }))
  }

  const modFor = calcularModificadorAtributo(dados.forca)
  const modDes = calcularModificadorAtributo(dados.destreza)
  const modCon = calcularModificadorAtributo(dados.constituicao)
  const modInt = calcularModificadorAtributo(dados.inteligencia)
  const modSab = calcularModificadorAtributo(dados.sabedoria)
  const modCar = calcularModificadorAtributo(dados.carisma)
  const mods = { forca: modFor, destreza: modDes, constituicao: modCon, inteligencia: modInt, sabedoria: modSab, carisma: modCar }
  const percepcaoPassivaCalculada = 10 + modSab + ((dados.pericias?.['Percepção'] ?? false) ? dados.bonus_proficiencia : 0)
  const percepcaoPassiva = percepcaoPassivaOverride ?? percepcaoPassivaCalculada

  // Magias agrupadas por nível
  const magiasPorNivel = magiasPersonagem.reduce<Record<number, MagiaPersonagem[]>>((acc, m) => {
    const n = m.spell.level
    if (!acc[n]) acc[n] = []
    acc[n].push(m)
    return acc
  }, {})

  const [testeMorte, setTesteMorte] = useState({ sucessos: 0, falhas: 0 })
  const [modalCopiar, setModalCopiar] = useState(false)
  const [campanhasDisponiveis, setCampanhasDisponiveis] = useState<{ id: string; nome: string }[]>([])
  const [menuAberto, setMenuAberto] = useState(false)
  const [modalTransferir, setModalTransferir] = useState(false)
  type MembroTransferir = { id: string; nome: string; username: string | null }
  const [membrosTransferir, setMembrosTransferir] = useState<MembroTransferir[]>([])

  async function abrirModalCopiar() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('campanhas')
      .select('id, nome')
      .eq('dm_id', user.id)
      .eq('ativa', true)
      .neq('id', dados.campanha_id)
      .order('nome')
    setCampanhasDisponiveis((data ?? []) as { id: string; nome: string }[])
    setModalCopiar(true)
  }

  async function copiarParaCampanha(campId: string) {
    const supabase = createClient()
    // slots_magia é gravado só por salvarSlotsDb(); dados.slots_magia é um snapshot
    // congelado do carregamento da ficha e não deve ser copiado para o personagem novo.
    const { id: _id, criado_em: _c, atualizado_em: _a, campanha_id: _camp, slots_magia: _ignorado, ...resto } = dados
    const { error } = await supabase.from('personagens').insert({
      ...resto,
      campanha_id: campId,
      inventario,
    })
    if (error) { toast.error('Erro ao copiar personagem'); return }
    toast.success(`${dados.nome} copiado!`)
    setModalCopiar(false)
  }

  useEffect(() => {
    if (!modalTransferir || !campanhaAtiva?.id || !userId) return
    // Via API (service role) — profiles só permite "ver o próprio perfil"
    // por RLS, então o join direto pelo client sempre voltava sem nome
    // pra qualquer membro que não fosse o próprio usuário logado.
    fetch(`/api/campanhas/${campanhaAtiva.id}/jogadores`)
      .then(r => r.ok ? r.json() : { jogadores: [] })
      .then(({ jogadores }) => setMembrosTransferir(
        (jogadores as MembroTransferir[]).filter(j => j.id !== userId)
      ))
  }, [modalTransferir, campanhaAtiva?.id, userId])

  async function transferirPersonagem(novoUserId: string, nomeJogador: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('personagens')
      .update({ user_id: novoUserId, jogador_nome: nomeJogador, ativo: true })
      .eq('id', p.id)
    if (error) { toast.error('Erro ao transferir personagem'); return }
    await supabase.from('notificacoes').insert({
      user_id: novoUserId,
      tipo: 'personagem_transferido',
      titulo: '🎲 Personagem transferido para você!',
      mensagem: `O personagem "${p.nome}" agora é seu!`,
      link: `/personagens/${p.id}`,
    })
    toast.success(`Personagem transferido para ${nomeJogador}!`)
    setModalTransferir(false)
    router.refresh()
  }

  const dropdownMenu = menuAberto && (
    <div className="absolute right-0 top-full mt-1 bg-[var(--bg2)] border border-[var(--border)] rounded shadow-xl z-50 min-w-[160px]">
      <button
        onClick={() => { setMenuAberto(false); abrirModalCopiar() }}
        className="w-full text-left px-3 py-2 text-xs font-cinzel text-[var(--text3)] hover:bg-[var(--surface)] hover:text-[var(--gold)] transition-colors"
      >
        Copiar personagem
      </button>
      {isDM && !p.user_id && p.tipo_personagem === 'jogador' && (
        <button
          onClick={() => { setMenuAberto(false); setModalTransferir(true) }}
          className="w-full text-left px-3 py-2 text-xs font-cinzel text-[var(--text3)] hover:bg-[var(--surface)] hover:text-[var(--gold)] transition-colors border-t border-[var(--border)]"
        >
          👤 Transferir para Jogador
        </button>
      )}
    </div>
  )

  const PAGINAS_LABEL: [1 | 2 | 3, string][] = [[1, 'Ficha'], [2, 'Detalhes'], [3, 'Magias']]

  return (
    <div className="max-w-4xl mx-auto pb-32 md:pb-0">
      {/* Banner de aprovação pendente */}
      {!dados.ativo && isDM && (
        <div className="mb-4 p-4 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 rounded-xl flex items-center justify-between gap-4">
          <div>
            <p className="font-cinzel text-[var(--accent2)] text-sm font-bold">⏳ Personagem Aguardando Aprovação</p>
            <p className="text-[var(--text2)] text-sm font-crimson mt-0.5">
              {dados.nome} foi criado por um jogador e aguarda sua aprovação para entrar na campanha.
            </p>
          </div>
          <button
            onClick={aprovarPersonagem}
            disabled={salvando}
            className="flex-shrink-0 px-4 py-2 bg-[var(--green2)] text-[var(--bg)] font-cinzel text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {salvando ? 'Aprovando...' : '✓ Aprovar'}
          </button>
        </div>
      )}
      {!dados.ativo && !isDM && (
        <div className="mb-4 p-3 bg-[var(--accent2)]/10 border border-[var(--accent2)]/40 rounded-xl">
          <p className="font-cinzel text-[var(--accent2)] text-sm">⏳ Aguardando aprovação do Mestre</p>
        </div>
      )}
      {ehJogador && !podeEditar && (
        <div className="mb-4 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center">
          <p className="text-[var(--text3)] text-sm font-cinzel">👁️ Você está visualizando este personagem em modo leitura</p>
        </div>
      )}
      {emCombate && (
        <div className="mb-4 p-3 bg-[var(--red2)]/10 border border-[var(--red2)]/40 rounded-xl text-center">
          <p className="text-[var(--red2)] text-sm font-cinzel">⚔️ Em combate — altere pela tela de mesa</p>
        </div>
      )}
      {/* Cabeçalho */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-cinzel text-2xl text-[var(--gold)] truncate">{dados.nome}</h1>
            <p className="text-[var(--text3)] text-sm truncate">{dados.raca} · {dados.classe} Nv{dados.nivel} · {dados.alinhamento}</p>
          </div>

          {/* Desktop: inalterado */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setPagina(n)}
                className={`font-cinzel text-xs px-3 py-1.5 rounded border transition-colors ${
                  pagina === n ? 'bg-[var(--surface)] border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text3)] hover:border-[var(--border2)]'
                }`}
              >
                Página {n}
              </button>
            ))}
            <div className="relative">
              <button
                onClick={() => setMenuAberto(v => !v)}
                className="font-cinzel text-xs px-2 py-1.5 rounded border border-[var(--border)] text-[var(--text3)] hover:border-[var(--border2)] transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {dropdownMenu}
            </div>
            <button
              onClick={voltar}
              className="font-cinzel text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text3)] hover:border-[var(--border2)] transition-colors"
            >
              ← Voltar
            </button>
            <BotaoRunico variante="ouro" tamanho="sm" onClick={salvar} carregando={salvando} disabled={!podeEditar || !online} title={!online ? 'Sem conexão' : undefined}>
              Salvar
            </BotaoRunico>
          </div>

          {/* Mobile: só o essencial — o resto some para a barra de abas e o rodapé fixo */}
          <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setMenuAberto(v => !v)}
                className="p-2 rounded border border-[var(--border)] text-[var(--text3)]"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {dropdownMenu}
            </div>
            <button
              onClick={voltar}
              className="font-cinzel text-sm px-2.5 py-1.5 rounded border border-[var(--border)] text-[var(--text3)]"
            >
              ←
            </button>
          </div>
        </div>

        {/* Mobile: seletor de página compacto, substitui as abas de desktop */}
        <div className="flex md:hidden gap-1 mt-3">
          {PAGINAS_LABEL.map(([n, label]) => (
            <button
              key={n}
              onClick={() => setPagina(n)}
              className={`flex-1 font-cinzel text-xs py-2 rounded border transition-colors ${
                pagina === n ? 'bg-[var(--surface)] border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text3)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {pagina === 1 && (
        <div className="space-y-3">
          {/* Header linha 1: Nome | Classe+Nível | Antecedente | Jogador */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nome</label>
              <input type="text" value={dados.nome ?? ''} onChange={e => atualizar('nome', e.target.value)} className="w-full input-dd" disabled={!podeEditar} />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Classe</label>
                <input type="text" value={dados.classe ?? ''} onChange={e => atualizar('classe', e.target.value)} className="w-full input-dd" disabled={!podeEditar} />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nível</label>
                <input type="number" inputMode="numeric" value={dados.nivel} onChange={e => atualizar('nivel', parseInt(e.target.value) || 1)} className="w-full input-dd text-center" disabled={!podeEditar} />
              </div>
            </div>
            <div>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Antecedente</label>
              <input type="text" value={dados.antecedente ?? ''} onChange={e => atualizar('antecedente', e.target.value)} className="w-full input-dd" disabled={!podeEditar} />
            </div>
            <div>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Jogador</label>
              <input type="text" value={dados.jogador_nome ?? ''} onChange={e => atualizar('jogador_nome', e.target.value)} className="w-full input-dd" disabled={!podeEditar} />
            </div>
          </div>

          {/* Header linha 2: Inspiração | Raça | Tendência | XP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-start">
            <InspiracaoHeroica
              valor={typeof dados.inspiracao === 'number' ? dados.inspiracao : 0}
              onChange={val => atualizar('inspiracao', val as never)}
              disabled={emCombate}
            />
            <div>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Raça</label>
              <input type="text" value={dados.raca ?? ''} onChange={e => atualizar('raca', e.target.value)} className="w-full input-dd" disabled={!podeEditar} />
            </div>
            <div>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Tendência</label>
              <input type="text" value={dados.alinhamento ?? ''} onChange={e => atualizar('alinhamento', e.target.value)} className="w-full input-dd" disabled={!podeEditar} />
            </div>
            <div>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Pontos de Experiência</label>
              <InputNumerico
                value={dados.pontos_experiencia ?? 0}
                onChange={novaXP => {
                  const nivelAtual = dados.nivel || 1
                  const novoNivel = getNivelPorXP(novaXP)
                  if (novoNivel.nivel > nivelAtual) {
                    setLevelUp({ novoNivel: novoNivel.nivel, novaProf: novoNivel.bonusProficiencia })
                    atualizar('nivel', novoNivel.nivel)
                    atualizar('bonus_proficiencia', novoNivel.bonusProficiencia)
                  }
                  atualizar('pontos_experiencia', novaXP)
                }}
                className="w-full input-dd"
              />
              {(() => {
                const xp = dados.pontos_experiencia ?? 0
                const prog = getProgressoXP(xp)
                if (!prog.proximoNivel) {
                  return <p className="text-[9px] text-[var(--gold)] font-cinzel mt-0.5">⭐ Nível máximo!</p>
                }
                const xpFaltando = prog.proximoNivel.xpNecessario - xp
                return (
                  <div className="mt-0.5 space-y-0.5">
                    <div className="h-1.5 bg-[var(--bg3)] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--gold)] rounded-full transition-all" style={{ width: `${prog.percentual}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-[var(--text3)]">
                      <span>Nv{prog.nivelAtual.nivel}</span>
                      <span className="text-[var(--gold)]">−{xpFaltando.toLocaleString('pt-BR')} XP</span>
                      <span>Nv{prog.proximoNivel.nivel}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Corpo: 3 colunas (empilha em telas < md) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Col 1 — Atributos estreitos + Prof/Salvaguardas/Perícias ao lado */}
            <div className="space-y-2">
              <div className="flex gap-3">
                {/* Atributos — coluna estreita fixa */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {ATRIBUTOS.map(({ key, abrev }) => (
                    <AtributoCard
                      key={key}
                      abrev={abrev}
                      value={dados[key as keyof Personagem] as number}
                      onChange={v => atualizar(key, v)}
                      disabled={!podeEditar}
                    />
                  ))}
                </div>

                {/* Prof + Salvaguardas + Perícias */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="border border-[var(--border)] rounded-xl p-2 text-center">
                    <p className="text-[var(--text3)] text-[8px] uppercase font-cinzel leading-tight">Bônus de Proficiência</p>
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      <span className="font-cinzel font-bold text-[var(--gold)] text-xl leading-none">+</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={2}
                        max={6}
                        value={dados.bonus_proficiencia || 2}
                        onChange={e => atualizar('bonus_proficiencia', parseInt(e.target.value) || 2)}
                        onFocus={e => e.target.select()}
                        className="w-8 font-cinzel font-bold text-[var(--gold)] text-xl bg-transparent border-none outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  <PainelGrimorio titulo="Salvaguardas" compacto>
                    <div className="space-y-0.5">
                      {ATRIBUTOS.map(({ key, label }) => {
                        const temProf = dados.salvaguardas?.[key] ?? false
                        const mod = mods[key as keyof typeof mods] ?? 0
                        const valorFinal = mod + (temProf ? dados.bonus_proficiencia : 0)
                        return (
                          <div key={key} className="flex items-center gap-1.5">
                            <input type="checkbox" checked={temProf} onChange={e => atualizar('salvaguardas', { ...dados.salvaguardas, [key]: e.target.checked })} className="w-3 h-3 accent-[var(--accent)] flex-shrink-0" />
                            <span className="text-[var(--gold)] text-xs font-cinzel font-bold w-6 text-right flex-shrink-0">{valorFinal >= 0 ? `+${valorFinal}` : `${valorFinal}`}</span>
                            <span className="text-[var(--text2)] text-xs font-crimson">{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </PainelGrimorio>

                  <PainelGrimorio titulo="Perícias" compacto>
                    <div className="space-y-0.5">
                      {PERICIAS.map(({ nome, atributo }) => {
                        const temProf = dados.pericias?.[nome] ?? false
                        const modBase = (mods[atributo as keyof typeof mods] ?? 0) + (temProf ? dados.bonus_proficiencia : 0)
                        const ajuste = ajustesPericias[nome] ?? 0
                        const valorFinal = modBase + ajuste
                        return (
                          <div key={nome} className="flex items-center gap-1 py-0.5">
                            <input type="checkbox" checked={temProf} onChange={e => atualizar('pericias', { ...dados.pericias, [nome]: e.target.checked })} className="w-3 h-3 accent-[var(--accent)] flex-shrink-0" />
                            <span className="text-[var(--gold)] text-xs font-cinzel font-bold w-6 text-right flex-shrink-0">{valorFinal >= 0 ? `+${valorFinal}` : `${valorFinal}`}</span>
                            <span className="text-[var(--text2)] text-xs flex-1 font-crimson truncate">{nome}</span>
                            <span className="text-[var(--text3)] text-[8px] font-cinzel flex-shrink-0">{atributo.slice(0,3).toUpperCase()}</span>
                            <button onClick={() => ajustarPericia(nome, -1)} className="w-4 h-4 text-[10px] bg-[var(--bg3)] rounded hover:bg-[var(--surface)] text-[var(--text2)] leading-none flex items-center justify-center flex-shrink-0">−</button>
                            <span className="text-[8px] text-[var(--text3)] w-5 text-center flex-shrink-0">{ajuste !== 0 ? (ajuste > 0 ? `+${ajuste}` : `${ajuste}`) : '±0'}</span>
                            <button onClick={() => ajustarPericia(nome, +1)} className="w-4 h-4 text-[10px] bg-[var(--bg3)] rounded hover:bg-[var(--surface)] text-[var(--text2)] leading-none flex items-center justify-center flex-shrink-0">+</button>
                            {ajuste !== 0 && (
                              <button onClick={() => resetarAjuste(nome)} className="text-[var(--accent)] text-[9px] hover:text-[var(--accent2)] transition-colors flex-shrink-0" title="Resetar ajuste">↺</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </PainelGrimorio>
                </div>
              </div>

              <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg3)] rounded border border-[var(--border)]">
                <div className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center flex-shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={percepcaoPassiva}
                    onChange={e => setPercepcaoPassivaOverride(parseInt(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    className="w-7 text-center font-cinzel font-bold text-sm text-[var(--text)] bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <p className="text-[var(--text3)] text-[9px] uppercase font-cinzel flex-1">Sabedoria Passiva (Percepção)</p>
                {percepcaoPassivaOverride !== null && (
                  <button
                    onClick={() => setPercepcaoPassivaOverride(null)}
                    className="text-[var(--accent)] text-[9px] hover:text-[var(--accent2)] transition-colors flex-shrink-0"
                    title="Resetar para valor calculado"
                  >↺</button>
                )}
              </div>

              <PainelGrimorio titulo="Idiomas & Proficiências" compacto>
                <textarea
                  value={dados.outras_proficiencias ?? ''}
                  onChange={e => atualizar('outras_proficiencias', e.target.value)}
                  rows={4}
                  className="w-full input-dd resize-none text-sm"
                  placeholder="Armaduras leves, espadas longas, Élfico, Comum..."
                />
              </PainelGrimorio>
            </div>

            {/* Col 2 — Combate + Inventário */}
            <div className="space-y-2">
              {/* CA / Iniciativa / Deslocamento */}
              <div className="grid grid-cols-3 gap-1">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">CA</label>
                  <input type="number" inputMode="numeric" value={dados.ca} onChange={e => atualizar('ca', parseInt(e.target.value) || 10)} className="w-full input-dd text-center" disabled={!podeEditar} />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Iniciativa</label>
                  <input type="number" inputMode="numeric" value={dados.iniciativa} onChange={e => atualizar('iniciativa', parseInt(e.target.value) || 0)} className="w-full input-dd text-center" disabled={!podeEditar} />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Desl. (m)</label>
                  <input type="number" inputMode="numeric" value={dados.deslocamento} onChange={e => atualizar('deslocamento', parseInt(e.target.value) || 9)} className="w-full input-dd text-center" disabled={!podeEditar} />
                </div>
              </div>

              {/* Pontos de Vida */}
              <div className="grid grid-cols-3 gap-1">
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase block">PV Máx</label>
                  <CampoNumerico value={dados.pv_maximo} onChange={v => atualizar('pv_maximo', v)} min={1} disabled={!podeEditar} />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase block">PV Atual</label>
                  <CampoNumerico value={dados.pv_atual} onChange={v => atualizar('pv_atual', v)} min={0} disabled={!podeEditar || emCombate} />
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase block">PV Temp</label>
                  <CampoNumerico value={dados.pv_temporarios} onChange={v => atualizar('pv_temporarios', v)} min={0} disabled={!podeEditar || emCombate} />
                </div>
              </div>

              {/* Dados de Vida & Teste de Morte */}
              <PainelGrimorio titulo="Dados de Vida & Morte" compacto>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Dado de Vida</label>
                    <input type="text" value={dados.dado_vida ?? ''} onChange={e => atualizar('dado_vida', e.target.value)} className="w-full input-dd text-center" placeholder="d8" />
                  </div>
                  <div>
                    <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase mb-1 block">Teste de Morte</label>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[var(--green)] text-[9px] font-cinzel w-12">Sucesso</span>
                      {[0, 1, 2].map(i => (
                        <button key={i} onClick={() => setTesteMorte(prev => ({ ...prev, sucessos: prev.sucessos === i + 1 ? i : i + 1 }))} className={`w-4 h-4 rounded-full border transition-colors ${testeMorte.sucessos > i ? 'bg-[var(--green)] border-[var(--green)]' : 'border-[var(--border)] hover:border-[var(--green)]'}`} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--red2)] text-[9px] font-cinzel w-12">Falha</span>
                      {[0, 1, 2].map(i => (
                        <button key={i} onClick={() => setTesteMorte(prev => ({ ...prev, falhas: prev.falhas === i + 1 ? i : i + 1 }))} className={`w-4 h-4 rounded-full border transition-colors ${testeMorte.falhas > i ? 'bg-[var(--red2)] border-[var(--red2)]' : 'border-[var(--border)] hover:border-[var(--red2)]'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </PainelGrimorio>

              {/* Ataques */}
              <PainelGrimorio titulo="Ataques" compacto>
                <div className="space-y-1">
                  {(() => {
                    const semTipo = (dados.ataques ?? []).filter(a => (a.nome?.trim() || a.dano?.trim()) && !normalizarTipoDano(a.tipo_dano)).length
                    return semTipo > 0 ? (
                      <p className="text-[var(--gold)] text-[10px] font-crimson italic mb-1">
                        ⚠️ {semTipo} ataque(s) sem tipo de dano — resistências não serão aplicadas
                      </p>
                    ) : null
                  })()}
                  {(dados.ataques ?? []).map((atq, i) => {
                    const tipoValido = normalizarTipoDano(atq.tipo_dano)
                    const semTipo = (atq.nome?.trim() || atq.dano?.trim()) && !tipoValido
                    return (
                      <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
                        <input value={atq.nome} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], nome: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="Nome" />
                        <input value={atq.bonus_ataque} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], bonus_ataque: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="+5" />
                        <input value={atq.dano} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], dano: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="1d8+3" />
                        <select
                          value={tipoValido ?? ''}
                          onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], tipo_dano: e.target.value }; atualizar('ataques', a) }}
                          className={`input-dd ${semTipo ? 'border-[var(--gold)]' : ''}`}
                        >
                          <option value="">Selecione</option>
                          {TIPOS_DANO.map(t => (
                            <option key={t.id} value={t.id}>{t.icone} {t.nome}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                  <button onClick={() => atualizar('ataques', [...dados.ataques, { nome: '', bonus_ataque: '', dano: '', tipo_dano: '', notas: '' }])} className="text-xs text-[var(--accent)] hover:text-[var(--accent2)] transition-colors mt-1">+ Adicionar ataque</button>
                </div>
              </PainelGrimorio>

              {/* Moedas */}
              <PainelGrimorio titulo="Moedas" compacto>
                <div className="grid grid-cols-3 gap-1 text-center">
                  {([
                    { key: 'pc',      label: 'PC', cor: 'text-[#cd7f32]' },
                    { key: 'pp',      label: 'PP', cor: 'text-[#c0c0c0]' },
                    { key: 'po',      label: 'PO', cor: 'text-[var(--gold)]' },
                    { key: 'pe',      label: 'PE', cor: 'text-[var(--green2)]' },
                    { key: 'pl',      label: 'PL', cor: 'text-[var(--accent2)]' },
                  ] as const).map(({ key, label, cor }) => (
                    <div key={key}>
                      <label className={`${cor} text-[9px] font-cinzel uppercase`}>{label}</label>
                      <InputNumerico
                        value={(dados.moedas as unknown as Record<string, number>)?.[key] ?? 0}
                        onChange={val => atualizar('moedas', { ...(dados.moedas ?? { pc: 0, pp: 0, po: 0, pe: 0, pl: 0, custom: 0 }), [key]: val })}
                        className="w-full input-dd text-center text-xs mt-0.5"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-[var(--accent)] text-[9px] font-cinzel uppercase">{moedaCustomNome}</label>
                    <InputNumerico value={dados.moedas?.custom ?? 0} onChange={val => atualizar('moedas', { ...(dados.moedas ?? { pc: 0, pp: 0, po: 0, pe: 0, pl: 0, custom: 0 }), custom: val })} className="w-full input-dd text-center text-xs mt-0.5" />
                  </div>
                </div>
              </PainelGrimorio>

              {/* Inventário */}
              <PainelGrimorio titulo="Inventário" compacto>
                <div className="relative mb-2">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)] text-xs pointer-events-none">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={buscaInventario}
                    onChange={e => setBuscaInventario(e.target.value)}
                    placeholder="Buscar no inventário..."
                    className="input-dd w-full pl-7 text-xs py-1.5"
                  />
                </div>
                {inventario.filter(i => !buscaInventario || i.nome.toLowerCase().includes(buscaInventario.toLowerCase())).length === 0 ? (
                  <p className="text-[var(--border)] text-sm font-crimson text-center py-2">
                    {buscaInventario ? 'Nenhum item encontrado' : 'Inventário vazio'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {inventario.map(item => {
                      if (buscaInventario && !item.nome.toLowerCase().includes(buscaInventario.toLowerCase())) return null
                      return (
                        <div key={item.id} className="flex items-center gap-2 px-2 py-1 bg-[var(--bg3)] rounded">
                          <button onClick={() => setItemPopup(item)} className="flex-1 text-left min-w-0">
                            <span className="text-[var(--text)] text-sm font-crimson truncate block">
                              {item.nome}{item.equipado && <span className="text-[var(--accent2)] text-[10px] ml-1">(equipado)</span>}
                            </span>
                            {item.raridade && <span className="text-[var(--text3)] text-[10px] font-cinzel">{item.raridade}</span>}
                          </button>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => alterarQuantidade(item, -1)} className="w-5 h-5 text-xs bg-[var(--surface)] rounded hover:bg-[var(--surface2)] text-[var(--text2)] leading-none flex items-center justify-center">−</button>
                            <span className="text-[var(--text)] text-xs w-5 text-center font-cinzel">{item.quantidade}</span>
                            <button onClick={() => alterarQuantidade(item, 1)} className="w-5 h-5 text-xs bg-[var(--surface)] rounded hover:bg-[var(--surface2)] text-[var(--text2)] leading-none flex items-center justify-center">+</button>
                          </div>
                          <button onClick={() => removerItem(item)} className="text-[var(--border)] hover:text-[var(--red2)] transition-colors flex-shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => setModalCompendio(true)}
                    className="text-[var(--accent)] text-[10px] hover:opacity-80 font-cinzel flex items-center gap-1"
                  >
                    + Compêndio
                  </button>
                  <p className="text-[var(--text3)] text-[10px] font-cinzel">{inventario.length} ite{inventario.length === 1 ? 'm' : 'ns'}</p>
                </div>
              </PainelGrimorio>

            </div>

            {/* Col 3 — Traços + Características + Defesas */}
            <div className="space-y-2">
              {[
                { label: 'Traços de Personalidade', key: 'tracos_personalidade', rows: 3 },
                { label: 'Ideais', key: 'ideais', rows: 2 },
                { label: 'Vínculos', key: 'vinculos', rows: 2 },
                { label: 'Defeitos', key: 'fraquezas', rows: 2 },
                { label: 'Características & Talentos', key: 'caracteristicas_talentos', rows: 6 },
              ].map(({ label, key, rows }) => (
                <div key={key}>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">{label}</label>
                  <textarea
                    value={(dados[key as keyof Personagem] as string) ?? ''}
                    onChange={e => atualizar(key as keyof Personagem, e.target.value as never)}
                    rows={rows}
                    className="w-full input-dd resize-none text-xs"
                  />
                </div>
              ))}

              {/* Defesas */}
              <PainelGrimorio titulo="Defesas" compacto>
                <div className="space-y-1">
                  {TIPOS_DANO.map(({ id, nome, icone }) => {
                    const defesa = getDefesa(id)
                    return (
                      <div key={id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-4">{icone}</span>
                        <span className="text-[var(--text2)] flex-1 font-crimson">{nome}</span>
                        {(['resistencia', 'imunidade', 'vulnerabilidade'] as TipoDefesa[]).map(d => (
                          <button
                            key={d}
                            onClick={() => setDefesa(id, defesa === d ? null : d)}
                            className={`px-1 py-0.5 rounded text-[9px] font-cinzel border transition-colors ${
                              defesa === d
                                ? d === 'resistencia' ? 'bg-[#3498db]/30 border-[#3498db] text-[#3498db]'
                                : d === 'imunidade' ? 'bg-[var(--green)]/30 border-[var(--green)] text-[var(--green)]'
                                : 'bg-[var(--red2)]/30 border-[var(--red2)] text-[var(--red2)]'
                                : 'border-[var(--border)] text-[var(--border)] hover:border-[var(--border2)]'
                            }`}
                            title={{ resistencia: '🛡️ Resistência', imunidade: '🚫 Imunidade', vulnerabilidade: '⚡ Vulnerabilidade' }[d]}
                          >
                            {d === 'resistencia' ? '🛡' : d === 'imunidade' ? '🚫' : '⚡'}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </PainelGrimorio>
            </div>
          </div>
        </div>
      )}

      {pagina === 2 && (
        <div className="space-y-3">
          {/* Header: 6 atributos físicos em grid 3×2 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Idade', key: 'idade' },
              { label: 'Altura', key: 'altura' },
              { label: 'Peso', key: 'peso' },
              { label: 'Olhos', key: 'cor_olhos' },
              { label: 'Pele', key: 'cor_pele' },
              { label: 'Cabelo', key: 'cor_cabelo' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">{label}</label>
                <input type="text" value={(dados[key as keyof Personagem] as string) ?? ''} onChange={e => atualizar(key as keyof Personagem, e.target.value as never)} className="w-full input-dd text-sm" />
              </div>
            ))}
          </div>

          {/* Corpo: 2 colunas (empilha em telas < md) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Col 1 — Aparência + História */}
            <div className="space-y-3">
              <PainelGrimorio titulo="Aparência Física" compacto>
                <div className="mb-2">
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">URL da Imagem</label>
                  <input type="url" value={dados.imagem_url ?? ''} onChange={e => atualizar('imagem_url', e.target.value)} className="w-full input-dd text-sm mt-1" placeholder="https://..." />
                  {dados.imagem_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dados.imagem_url} alt={dados.nome} className="w-full h-28 object-cover rounded mt-2 border border-[var(--border)]" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
                <div>
                  <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Descrição da Aparência</label>
                  <textarea value={dados.aparencia ?? ''} onChange={e => atualizar('aparencia', e.target.value)} rows={3} className="w-full input-dd resize-none text-sm" />
                </div>
              </PainelGrimorio>

              <PainelGrimorio titulo="História do Personagem" compacto>
                <textarea value={dados.historia ?? ''} onChange={e => atualizar('historia', e.target.value)} rows={10} className="w-full input-dd resize-none text-sm" />
              </PainelGrimorio>
            </div>

            {/* Col 2 — Aliados + Outras Características + Tesouros */}
            <div className="space-y-3">
              <PainelGrimorio titulo="Aliados & Organizações" compacto>
                <textarea value={dados.aliados_organizacoes ?? ''} onChange={e => atualizar('aliados_organizacoes', e.target.value)} rows={5} className="w-full input-dd resize-none text-sm" />
              </PainelGrimorio>

              <PainelGrimorio titulo="Outras Características" compacto>
                <textarea value={dados.equipamento ?? ''} onChange={e => atualizar('equipamento', e.target.value)} rows={5} className="w-full input-dd resize-none text-sm" placeholder="Características especiais, habilidades de raça/classe..." />
              </PainelGrimorio>

              <PainelGrimorio titulo="Tesouros" compacto>
                <textarea value={dados.tesouros ?? ''} onChange={e => atualizar('tesouros', e.target.value)} rows={5} className="w-full input-dd resize-none text-sm" />
              </PainelGrimorio>
            </div>
          </div>
        </div>
      )}

      {pagina === 3 && (
        <div className="space-y-4">
          <PainelGrimorio titulo="Conjuração" ornamentado>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Classe Conjuradora</label>
                <input type="text" value={dados.classe_conjuradora ?? ''} onChange={e => atualizar('classe_conjuradora', e.target.value)} className="w-full input-dd" placeholder="Mago, Clérigo..." disabled={!podeEditar} />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Atributo de Conjuração</label>
                <input type="text" value={dados.atributo_conjuracao ?? ''} onChange={e => atualizar('atributo_conjuracao', e.target.value)} className="w-full input-dd" placeholder="Inteligência" disabled={!podeEditar} />
              </div>
              <div>
                <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">CD de Magia</label>
                <input type="number" inputMode="numeric" value={dados.cd_magia ?? ''} onChange={e => atualizar('cd_magia', parseInt(e.target.value) || 0)} className="w-full input-dd text-center" disabled={!podeEditar} />
              </div>
            </div>

            {/* Espaços de magia */}
            <DivisorOrnamentado texto="Espaços de Magia" />
            {ehPactoArcano(dados.classe) && (
              <p className="text-[var(--gold)] text-[10px] font-crimson mb-2">
                Pacto Arcano — todos os espaços são do mesmo nível e voltam em descanso curto.
              </p>
            )}
            {!modoAjuste && Object.values(espacosTotais).every(t => !t) ? (
              <p className="text-[var(--border)] text-sm font-crimson text-center py-3">
                Nenhum espaço de magia. Use ✏️ Ajustar para definir.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 mb-3">
                {Array.from({ length: 9 }).map((_, idx) => {
                  const nivel = idx + 1
                  const total = espacosTotais[nivel] ?? 0
                  if (!modoAjuste && total === 0) return null
                  const utilizados = espacosUtilizados[nivel] ?? 0
                  return (
                    <div key={nivel} className="bg-[var(--bg3)] rounded p-2">
                      <div className="text-[var(--text3)] text-[9px] font-cinzel uppercase mb-1">Nível {nivel}</div>
                      {modoAjuste ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={9}
                          value={total}
                          onChange={e => alterarTotalNivel(nivel, Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
                          onBlur={() => salvarTotalNivel(nivel)}
                          className="w-full input-dd text-center"
                          disabled={!podeEditar || emCombate}
                        />
                      ) : (
                        <>
                          <div className="flex gap-1 flex-wrap">
                            {Array.from({ length: total }).map((_, i) => (
                              <button
                                key={i}
                                onClick={() => toggleEspaco(nivel, i)}
                                disabled={!podeEditar || emCombate}
                                className={`text-base transition-colors ${
                                  i < utilizados ? 'text-[var(--text3)]/40' : 'text-[var(--accent)]'
                                } hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed`}
                                title={i < utilizados ? 'Espaço usado' : 'Espaço disponível'}
                              >
                                {i < utilizados ? '○' : '●'}
                              </button>
                            ))}
                          </div>
                          <div className="text-[var(--border)] text-[9px] mt-1">{utilizados}/{total} usados</div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {modoAjuste ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={recalcularPelaClasse}
                  className="text-xs font-cinzel text-[var(--accent)] border border-[var(--accent)]/40 px-3 py-1 rounded hover:bg-[var(--accent)]/10 transition-colors"
                >
                  ↺ Recalcular pela classe
                </button>
                <button
                  onClick={() => setModoAjuste(false)}
                  className="text-xs font-cinzel text-[var(--green)] border border-[var(--green)]/40 px-3 py-1 rounded hover:bg-[var(--green)]/10 transition-colors"
                >
                  ✓ Concluir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={descansarLongo}
                  disabled={emCombate}
                  className="text-xs font-cinzel text-[var(--green)] border border-[var(--green)]/40 px-3 py-1 rounded hover:bg-[var(--green)]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🌙 Descanso Longo
                </button>
                {podeEditar && !emCombate && (
                  <button
                    onClick={() => setModoAjuste(true)}
                    className="text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] px-3 py-1 rounded hover:border-[var(--border2)] transition-colors"
                  >
                    ✏️ Ajustar
                  </button>
                )}
              </div>
            )}
          </PainelGrimorio>

          {/* Magias conhecidas */}
          <PainelGrimorio
            titulo="Magias Conhecidas"
            subtitulo={magiasPersonagem.some(m => m.spell.level > 0) ? `${magiasPersonagem.filter(m => m.spell.level > 0 && m.preparada).length} preparada(s)` : undefined}
            compacto
          >
            {/* Busca */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" />
              <input
                type="text"
                value={buscaMagia}
                onChange={e => setBuscaMagia(e.target.value)}
                placeholder="Buscar magia para adicionar..."
                className="w-full input-dd pl-9 text-sm"
              />
              {resultadosBusca.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl mt-1 max-h-48 overflow-y-auto">
                  {resultadosBusca.map(m => (
                    <button
                      key={m.id}
                      onClick={() => adicionarMagia(m)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg3)] transition-colors flex items-center justify-between"
                    >
                      <span className="text-[var(--text)] font-crimson">{m.name_pt}</span>
                      <span className="text-[var(--text3)] text-xs">{m.level === 0 ? 'Truque' : `Nv${m.level}`} · {m.school_pt}</span>
                    </button>
                  ))}
                </div>
              )}
              {buscandoMagia && (
                <div className="absolute top-full left-0 right-0 z-50 bg-[var(--surface)] border border-[var(--border)] rounded p-2 text-center text-[var(--text3)] text-xs mt-1">
                  Buscando...
                </div>
              )}
            </div>

            {/* Lista de magias por nível */}
            {Object.keys(magiasPorNivel).length === 0 ? (
              <p className="text-[var(--border)] text-sm font-crimson text-center py-4">Nenhuma magia adicionada</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(magiasPorNivel)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([nivel, magias]) => (
                    <div key={nivel}>
                      <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-1">
                        {parseInt(nivel) === 0 ? 'Truques' : `${nivel}º Nível`}
                      </p>
                      <div className="space-y-0.5">
                        {magias.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-2 py-1 bg-[var(--bg3)] rounded hover:bg-[var(--surface)] transition-colors group">
                            {m.spell.level > 0 && (
                              <input
                                type="checkbox"
                                checked={m.preparada}
                                onChange={() => togglePreparada(m)}
                                title="Preparada"
                                className="w-3.5 h-3.5 accent-[var(--accent)] flex-shrink-0 mr-1.5"
                              />
                            )}
                            <button
                              onClick={() => setMagiaPopup(m.spell)}
                              className="flex-1 text-left min-w-0"
                            >
                              <span className="text-[var(--text2)] text-sm font-crimson group-hover:text-[var(--gold)] transition-colors">{m.spell.name_pt}</span>
                              <span className="text-[var(--border)] text-[10px] ml-1.5 group-hover:text-[var(--text3)]">
                                {m.spell.level === 0 ? 'Truque' : `Nv${m.spell.level}`}
                              </span>
                            </button>
                            <button
                              onClick={() => removerMagia(m.id)}
                              className="text-[var(--border)] hover:text-[var(--red2)] transition-colors flex-shrink-0 ml-2"
                              title="Remover"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </PainelGrimorio>
        </div>
      )}

      {/* Mobile: Salvar sempre alcançável, sem depender do fim do scroll */}
      <div className="above-bottomnav fixed inset-x-0 md:hidden z-40 px-4 pt-2 pb-3 bg-[var(--bg2)] border-t border-[var(--border)]">
        <BotaoRunico variante="ouro" tamanho="sm" onClick={salvar} carregando={salvando} disabled={!podeEditar || !online} className="w-full" title={!online ? 'Sem conexão' : undefined}>
          Salvar
        </BotaoRunico>
      </div>

      {levelUp && (
        <ModalLevelUp
          personagemNome={dados.nome}
          novoNivel={levelUp.novoNivel}
          novaProf={levelUp.novaProf}
          onFechar={() => setLevelUp(null)}
        />
      )}

      {itemPopup && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setItemPopup(null)}
        >
          <div
            className="bg-[var(--bg2)] border border-[var(--border)] rounded p-4 max-w-md w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-cinzel text-[var(--accent2)] text-lg">{itemPopup.nome}</h3>
                {itemPopup.tipo && <p className="text-[var(--text3)] text-xs font-cinzel capitalize">{itemPopup.tipo}</p>}
                {itemPopup.raridade && <p className="text-[var(--gold)] text-xs font-cinzel">{itemPopup.raridade}</p>}
              </div>
              <button onClick={() => setItemPopup(null)} className="text-[var(--border)] hover:text-[var(--text)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {itemPopup.descricao ? (
              <p className="text-[var(--text2)] text-sm font-crimson leading-relaxed whitespace-pre-wrap">{itemPopup.descricao}</p>
            ) : (
              <p className="text-[var(--border)] text-sm font-crimson italic">Sem descrição disponível.</p>
            )}
            {podeEditar && (
              <button
                onClick={() => equiparItem(itemPopup, !itemPopup.equipado)}
                className="mt-3 w-full py-2 rounded border border-[var(--border)] text-[var(--text2)] font-cinzel text-xs hover:border-[var(--accent2)] hover:text-[var(--accent2)] transition-colors"
              >
                {itemPopup.equipado ? 'Desequipar' : 'Equipar'}
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {magiaPopup && createPortal(
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70"
          onClick={() => setMagiaPopup(null)}
        >
          <div
            className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-cinzel text-[var(--gold)] font-bold text-lg">{magiaPopup.name_pt}</h3>
                <p className="text-[var(--text3)] text-xs italic">{magiaPopup.name_en}</p>
              </div>
              <button onClick={() => setMagiaPopup(null)} className="text-[var(--text3)] hover:text-[var(--text)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 text-sm">
              <p><span className="text-[var(--text3)] font-cinzel text-xs">Nível:</span> <span className="text-[var(--text)]">{magiaPopup.level === 0 ? 'Truque' : `${magiaPopup.level}º nível`}</span></p>
              {magiaPopup.school_pt && <p><span className="text-[var(--text3)] font-cinzel text-xs">Escola:</span> <span className="text-[var(--text)]">{magiaPopup.school_pt}</span></p>}
              {magiaPopup.casting_time_pt && <p><span className="text-[var(--text3)] font-cinzel text-xs">Tempo:</span> <span className="text-[var(--text)]">{magiaPopup.casting_time_pt}</span></p>}
              {magiaPopup.range_pt && <p><span className="text-[var(--text3)] font-cinzel text-xs">Alcance:</span> <span className="text-[var(--text)]">{magiaPopup.range_pt}</span></p>}
              {magiaPopup.components_pt && <p><span className="text-[var(--text3)] font-cinzel text-xs">Componentes:</span> <span className="text-[var(--text)]">{magiaPopup.components_pt}</span></p>}
              {magiaPopup.duration_pt && <p><span className="text-[var(--text3)] font-cinzel text-xs">Duração:</span> <span className="text-[var(--text)]">{magiaPopup.duration_pt}</span></p>}
              <div className="flex gap-1.5 mt-1">
                {magiaPopup.concentration && (
                  <span className="text-[var(--accent)] text-xs border border-[var(--accent)] px-2 py-0.5 rounded font-cinzel">Concentração</span>
                )}
                {magiaPopup.ritual && (
                  <span className="text-[var(--gold2)] text-xs border border-[var(--gold2)] px-2 py-0.5 rounded font-cinzel">Ritual</span>
                )}
              </div>
              {magiaPopup.description_pt && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-[var(--text2)] text-sm leading-relaxed whitespace-pre-wrap font-crimson">{magiaPopup.description_pt}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {modalCompendio && createPortal(
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70"
          onClick={() => setModalCompendio(false)}
        >
          <div
            className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="font-cinzel text-[var(--gold)] font-bold">Adicionar do Compêndio</h3>
              <button onClick={() => setModalCompendio(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex border-b border-[var(--border)]">
              {([
                { id: 'gear',      label: '🎒 Geral' },
                { id: 'armas',     label: '⚔️ Armas' },
                { id: 'armaduras', label: '🛡️ Armadura' },
                { id: 'magicos',   label: '✨ Mágicos' },
              ] as const).map(aba => (
                <button
                  key={aba.id}
                  onClick={() => { setAbaCompendio(aba.id); setItensCompendio([]) }}
                  className={`flex-1 py-2.5 text-xs font-cinzel transition-colors ${abaCompendio === aba.id ? 'text-[var(--gold)] border-b-2 border-[var(--gold)]' : 'text-[var(--text3)]'}`}
                >
                  {aba.label}
                </button>
              ))}
            </div>
            <div className="p-3 border-b border-[var(--border)]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={buscaCompendio}
                  onChange={e => setBuscaCompendio(e.target.value)}
                  placeholder="Buscar item..."
                  className="input-dd w-full pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {buscandoCompendio && (
                <p className="text-[var(--text3)] text-sm text-center py-4 animate-pulse">Buscando...</p>
              )}
              {!buscandoCompendio && buscaCompendio && itensCompendio.length === 0 && (
                <p className="text-[var(--text3)] text-sm text-center py-4">Nenhum item encontrado</p>
              )}
              {!buscaCompendio && (
                <p className="text-[var(--text3)] text-xs text-center py-4 italic">Digite para buscar...</p>
              )}
              {itensCompendio.map(item => (
                <button
                  key={item.slug as string}
                  onClick={() => adicionarDoCompendio(item)}
                  className="w-full text-left p-3 mb-1 border border-[var(--border)] rounded-lg hover:border-[var(--gold)] hover:bg-[var(--surface)] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-cinzel text-[var(--text)] text-sm font-bold">{item.name_pt as string}</p>
                      <p className="text-[var(--text3)] text-[10px] italic">{item.name_en as string}</p>
                      {abaCompendio === 'armas' && (
                        <p className="text-[var(--text3)] text-xs mt-0.5">
                          {item.damage_dice as string} {item.damage_type_pt as string}
                          {item.properties_pt ? ` · ${item.properties_pt as string}` : ''}
                        </p>
                      )}
                      {abaCompendio === 'armaduras' && (
                        <p className="text-[var(--text3)] text-xs mt-0.5">
                          {item.base_ac_formula_pt as string}
                          {item.stealth_disadvantage ? ' · ⚠️ Furtividade' : ''}
                        </p>
                      )}
                      {abaCompendio === 'magicos' && (
                        <p className={`text-xs mt-0.5 ${
                          item.rarity === 'legendary' ? 'text-orange-400' :
                          item.rarity === 'very_rare' ? 'text-purple-400' :
                          item.rarity === 'rare'      ? 'text-blue-400' :
                          item.rarity === 'uncommon'  ? 'text-green-400' : 'text-[var(--text3)]'
                        }`}>
                          {item.rarity === 'legendary' ? 'Lendário' : item.rarity === 'very_rare' ? 'Muito Raro' : item.rarity === 'rare' ? 'Raro' : item.rarity === 'uncommon' ? 'Incomum' : 'Comum'}
                        </p>
                      )}
                      {abaCompendio === 'gear' && !!item.description_pt && (
                        <p className="text-[var(--text3)] text-[10px] mt-0.5 line-clamp-1">{item.description_pt as string}</p>
                      )}
                    </div>
                    <span className="text-[var(--accent)] text-lg flex-shrink-0">+</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {modalCopiar && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setModalCopiar(false)}
        >
          <div
            className="bg-[var(--bg2)] border border-[var(--border)] rounded p-5 max-w-sm w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-cinzel text-[var(--gold)] text-base">Copiar Personagem</h3>
              <button onClick={() => setModalCopiar(false)} className="text-[var(--border)] hover:text-[var(--text)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[var(--text3)] text-xs font-crimson mb-3">Selecione a campanha de destino para <span className="text-[var(--text)]">{dados.nome}</span>:</p>
            {campanhasDisponiveis.length === 0 ? (
              <p className="text-[var(--border)] text-sm font-crimson text-center py-3">Nenhuma outra campanha disponível</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {campanhasDisponiveis.map(c => (
                  <button
                    key={c.id}
                    onClick={() => copiarParaCampanha(c.id)}
                    className="w-full text-left px-3 py-2 bg-[var(--bg3)] hover:bg-[var(--surface)] border border-[var(--border)] rounded transition-colors"
                  >
                    <span className="font-cinzel text-[var(--text)] text-sm">{c.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {modalTransferir && createPortal(
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70"
          onClick={() => setModalTransferir(false)}
        >
          <div
            className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-cinzel text-[var(--gold)] font-bold mb-4">👤 Transferir Personagem</h3>
            <p className="text-[var(--text2)] text-sm font-crimson mb-4">
              Escolha o jogador que vai receber <span className="text-[var(--text)]">{p.nome}</span>:
            </p>
            {membrosTransferir.length === 0 ? (
              <p className="text-[var(--border)] text-sm font-crimson text-center py-3">Nenhum jogador disponível na campanha</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                {membrosTransferir.map(m => (
                  <button
                    key={m.id}
                    onClick={() => transferirPersonagem(m.id, m.nome)}
                    className="w-full text-left p-3 border border-[var(--border)] rounded-xl hover:border-[var(--gold)] hover:bg-[var(--surface)] font-cinzel text-sm text-[var(--text)] transition-all"
                  >
                    {m.nome}
                    {m.username && (
                      <span className="text-[var(--text3)] text-xs ml-2">— @{m.username}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setModalTransferir(false)}
              className="w-full py-2 border border-[var(--border)] rounded-lg text-[var(--text2)] text-sm font-cinzel"
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function AtributoCard({ abrev, value, onChange, disabled }: {
  abrev: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const mod = calcularModificadorAtributo(value)
  return (
    <div
      className="flex flex-col items-center border-2 border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)] w-20 md:w-16 flex-shrink-0"
    >
      <div className="w-full text-center py-0.5 bg-[var(--bg3)] border-b border-[var(--border)]">
        <span className="font-cinzel text-[var(--text3)] text-[8px] uppercase tracking-widest">{abrev}</span>
      </div>
      <div className="my-1.5 w-9 h-9 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] flex items-center justify-center">
        <span className="font-cinzel font-bold text-base text-[var(--gold)] leading-none">{formatarModificador(mod)}</span>
      </div>
      <div className="w-full border-t border-[var(--border)] bg-[var(--bg3)] flex items-center">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={disabled}
          className="md:hidden flex-shrink-0 w-5 h-7 text-[var(--text3)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none"
        >−</button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 10)}
          onFocus={e => e.target.select()}
          disabled={disabled}
          className="w-full min-w-0 flex-1 text-center font-cinzel font-bold text-sm py-1 bg-transparent border-none outline-none text-[var(--text)] focus:text-[var(--gold)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(Math.min(30, value + 1))}
          disabled={disabled}
          className="md:hidden flex-shrink-0 w-5 h-7 text-[var(--text3)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none"
        >+</button>
      </div>
    </div>
  )
}

// Campo numérico com steppers +/− visíveis só no mobile (md:hidden) — no
// desktop o input fica idêntico ao original, os botões apenas não renderizam.
function CampoNumerico({ value, onChange, min, max, step = 1, disabled, inputClassName }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  inputClassName?: string
}) {
  function ajustar(delta: number) {
    let novo = value + delta
    if (min !== undefined) novo = Math.max(min, novo)
    if (max !== undefined) novo = Math.min(max, novo)
    onChange(novo)
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => ajustar(-step)}
        disabled={disabled}
        className="md:hidden flex-shrink-0 w-7 h-7 rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--surface2)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold leading-none"
      >−</button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || (min ?? 0))}
        onFocus={e => e.target.select()}
        disabled={disabled}
        className={inputClassName ?? 'w-full input-dd text-center'}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => ajustar(step)}
        disabled={disabled}
        className="md:hidden flex-shrink-0 w-7 h-7 rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--surface2)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold leading-none"
      >+</button>
    </div>
  )
}

function InputNumerico({ value, onChange, min = 0, max, className, placeholder }: {
  value: number; onChange: (valor: number) => void
  min?: number; max?: number; className?: string; placeholder?: string
}) {
  const [texto, setTexto] = useState(value === 0 ? '' : String(value))
  useEffect(() => { setTexto(value === 0 ? '' : String(value)) }, [value])
  return (
    <input
      type="text" inputMode="numeric" pattern="[0-9]*"
      value={texto} placeholder={placeholder ?? '0'} className={className}
      onChange={e => {
        const raw = e.target.value.replace(/\D/g, '')
        setTexto(raw)
        const num = parseInt(raw) || 0
        const limitado = max !== undefined ? Math.min(num, max) : num
        onChange(Math.max(min, limitado))
      }}
      onBlur={() => { const num = parseInt(texto) || 0; setTexto(num === 0 ? '' : String(num)) }}
      onFocus={e => e.target.select()}
    />
  )
}

function InspiracaoHeroica({ valor, onChange, disabled }: { valor: number; onChange: (novo: number) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Inspiração Heroica</label>
      <div className="flex items-center gap-1 mt-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(valor === i ? i - 1 : i)}
            disabled={disabled}
            title={disabled ? 'Em combate — altere pela tela de mesa' : i <= valor ? `Usar inspiração (${valor} restante${valor !== 1 ? 's' : ''})` : `${i} inspiração`}
            className="text-xl transition-all hover:scale-110 leading-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {i <= valor ? '⭐' : '☆'}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-[var(--text3)] mt-0.5">
        {valor === 0 ? 'Sem inspiração' : `${valor}/5 — clique em ⭐ para usar uma`}
      </p>
    </div>
  )
}
