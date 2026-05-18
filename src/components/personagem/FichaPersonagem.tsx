'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useCampanha } from '@/store/campanha'
import type { Personagem, Spell, ItemInventario } from '@/types/dnd'
import { calcularModificadorAtributo, formatarModificador } from '@/lib/utils'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { ModalLevelUp } from '@/components/personagem/ModalLevelUp'
import { createClient } from '@/lib/supabase/client'
import { useBatalha } from '@/store/batalha'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import { ESPACOS_MAGIA } from '@/lib/dados-dnd/espacos-magia'
import { getNivelPorXP, getProgressoXP } from '@/lib/dados-dnd/xp-niveis'
import type { TipoDano } from '@/types/dnd'
import { Search, X } from 'lucide-react'
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
  spell: Spell
}

interface FichaPersonagemProps {
  personagem: Personagem
  onAtualizar?: (p: Partial<Personagem>) => void
}

export function FichaPersonagem({ personagem: p, onAtualizar }: FichaPersonagemProps) {
  const router = useRouter()
  const atualizarCombatentePorPersonagem = useBatalha(s => s.atualizarCombatentePorPersonagem)
  const campanhaAtiva = useCampanha(s => s.campanhaAtiva)
  const [moedaCustomNome, setMoedaCustomNome] = useState(campanhaAtiva?.moeda_custom_nome || 'Especial')

  useEffect(() => {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    supabase.from('campanhas').select('moeda_custom_nome').eq('id', campanhaAtiva.id).single()
      .then(({ data }) => { if (data?.moeda_custom_nome) setMoedaCustomNome(data.moeda_custom_nome) })
  }, [campanhaAtiva?.id])

  const [userId, setUserId] = useState<string | null>(null)
  const isDM = !!campanhaAtiva && !!userId && campanhaAtiva.dm_id === userId

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [])

  const [pagina, setPagina] = useState(1)
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

  // Inventário
  const [inventario, setInventario] = useState<ItemInventario[]>(
    Array.isArray(p.inventario) ? (p.inventario as ItemInventario[]) : []
  )
  const [itemPopup, setItemPopup] = useState<ItemInventario | null>(null)

  function alterarQuantidade(idx: number, delta: number) {
    setInventario(prev => prev
      .map((item, i) => i === idx ? { ...item, quantidade: item.quantidade + delta } : item)
      .filter(item => item.quantidade > 0)
    )
    setAlterado(true)
  }

  function removerItem(idx: number) {
    setInventario(prev => prev.filter((_, i) => i !== idx))
    setAlterado(true)
  }

  // Magias
  const [magiasPersonagem, setMagiasPersonagem] = useState<MagiaPersonagem[]>([])
  const [buscaMagia, setBuscaMagia] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<Spell[]>([])
  const [buscandoMagia, setBuscandoMagia] = useState(false)
  const [espacosUtilizados, setEspacosUtilizados] = useState<Record<number, number>>({})

  function atualizar<K extends keyof Personagem>(campo: K, valor: Personagem[K]) {
    setDados(prev => ({ ...prev, [campo]: valor }))
    setAlterado(true)
  }

  function voltar() {
    if (alterado && !confirm('Há alterações não salvas. Deseja sair sem salvar?')) return
    router.push('/personagens')
  }

  async function salvar() {
    setSalvando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('personagens').update({
        ...dados,
        inventario,
        nivel: parseInt(String(dados.nivel)) || 1,
        bonus_proficiencia: parseInt(String(dados.bonus_proficiencia)) || 2,
        pontos_experiencia: parseInt(String(dados.pontos_experiencia)) || 0,
        inspiracao: parseInt(String(dados.inspiracao)) || 0,
        ca: parseInt(String(dados.ca)) || 10,
        pv_maximo: parseInt(String(dados.pv_maximo)) || 1,
        pv_atual: parseInt(String(dados.pv_atual)) || 0,
        pv_temporarios: parseInt(String(dados.pv_temporarios)) || 0,
        imagem_url: dados.imagem_url ?? null,
        moedas: dados.moedas ?? null,
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
      router.push('/personagens')
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

  // Espaços de magia por nível
  const espacosPorNivel = ESPACOS_MAGIA[Math.min(Math.max(dados.nivel, 1), 20)] ?? ESPACOS_MAGIA[1]

  function toggleEspaco(nivel: number, indice: number) {
    setEspacosUtilizados(prev => {
      const utilizados = prev[nivel] ?? 0
      const total = espacosPorNivel[nivel - 1] ?? 0
      if (indice < utilizados) {
        return { ...prev, [nivel]: utilizados - 1 }
      } else if (utilizados < total) {
        return { ...prev, [nivel]: utilizados + 1 }
      }
      return prev
    })
  }

  function descansarLongo() {
    setEspacosUtilizados({})
    toast.success('Descanso longo! Espaços de magia recuperados.')
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
      const { data, error } = await supabase
        .from('spells')
        .select('id, slug, name_pt, name_en, level, school_pt, casting_time_pt, range_pt, components_pt, duration_pt, description_pt, classes_pt, concentration, ritual')
        .ilike('name_pt', `%${termo}%`)
        .order('level', { ascending: true })
        .order('name_pt', { ascending: true })
        .limit(20)
      if (error) console.error('Busca de magias:', error)
      setResultadosBusca((data ?? []) as Spell[])
    } finally {
      setBuscandoMagia(false)
    }
  }, [])

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
  const percepcaoPassiva = 10 + modSab + ((dados.pericias?.['Percepção'] ?? false) ? dados.bonus_proficiencia : 0)

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
    const { id: _id, criado_em: _c, atualizado_em: _a, campanha_id: _camp, ...resto } = dados
    const { error } = await supabase.from('personagens').insert({
      ...resto,
      campanha_id: campId,
      inventario,
    })
    if (error) { toast.error('Erro ao copiar personagem'); return }
    toast.success(`${dados.nome} copiado!`)
    setModalCopiar(false)
  }

  return (
    <div className="max-w-4xl mx-auto">
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
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-cinzel text-2xl text-[#d4a843]">{dados.nome}</h1>
          <p className="text-[#8870a8] text-sm">{dados.raca} · {dados.classe} Nv{dados.nivel} · {dados.alinhamento}</p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => setPagina(n)}
              className={`font-cinzel text-xs px-3 py-1.5 rounded border transition-colors ${
                pagina === n ? 'bg-[#261a2e] border-[#d4a843] text-[#d4a843]' : 'border-[#4a3060] text-[#8870a8] hover:border-[#6b4890]'
              }`}
            >
              Página {n}
            </button>
          ))}
          <button
            onClick={abrirModalCopiar}
            className="font-cinzel text-xs px-3 py-1.5 rounded border border-[#4a3060] text-[#8870a8] hover:border-[#6b4890] transition-colors"
          >
            Copiar
          </button>
          <button
            onClick={voltar}
            className="font-cinzel text-xs px-3 py-1.5 rounded border border-[#4a3060] text-[#8870a8] hover:border-[#6b4890] transition-colors"
          >
            ← Voltar
          </button>
          <BotaoRunico variante="ouro" tamanho="sm" onClick={salvar} carregando={salvando}>
            Salvar
          </BotaoRunico>
        </div>
      </div>

      {pagina === 1 && (
        <div className="space-y-3">
          {/* Header linha 1: Nome | Classe+Nível | Antecedente | Jogador */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Nome</label>
              <input type="text" value={dados.nome ?? ''} onChange={e => atualizar('nome', e.target.value)} className="w-full input-dd" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Classe</label>
                <input type="text" value={dados.classe ?? ''} onChange={e => atualizar('classe', e.target.value)} className="w-full input-dd" />
              </div>
              <div>
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Nível</label>
                <input type="number" value={dados.nivel} onChange={e => atualizar('nivel', parseInt(e.target.value) || 1)} className="w-full input-dd text-center" />
              </div>
            </div>
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Antecedente</label>
              <input type="text" value={dados.antecedente ?? ''} onChange={e => atualizar('antecedente', e.target.value)} className="w-full input-dd" />
            </div>
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Jogador</label>
              <input type="text" value={dados.jogador_nome ?? ''} onChange={e => atualizar('jogador_nome', e.target.value)} className="w-full input-dd" />
            </div>
          </div>

          {/* Header linha 2: Inspiração | Raça | Tendência | XP */}
          <div className="grid grid-cols-4 gap-2 items-start">
            <InspiracaoHeroica
              valor={typeof dados.inspiracao === 'number' ? dados.inspiracao : 0}
              onChange={val => atualizar('inspiracao', val as never)}
            />
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Raça</label>
              <input type="text" value={dados.raca ?? ''} onChange={e => atualizar('raca', e.target.value)} className="w-full input-dd" />
            </div>
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Tendência</label>
              <input type="text" value={dados.alinhamento ?? ''} onChange={e => atualizar('alinhamento', e.target.value)} className="w-full input-dd" />
            </div>
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Pontos de Experiência</label>
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
                  return <p className="text-[9px] text-[#d4a843] font-cinzel mt-0.5">⭐ Nível máximo!</p>
                }
                const xpFaltando = prog.proximoNivel.xpNecessario - xp
                return (
                  <div className="mt-0.5 space-y-0.5">
                    <div className="h-1.5 bg-[#1e1525] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#9b59b6] to-[#d4a843] rounded-full transition-all" style={{ width: `${prog.percentual}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-[#8870a8]">
                      <span>Nv{prog.nivelAtual.nivel}</span>
                      <span className="text-[#d4a843]">−{xpFaltando.toLocaleString('pt-BR')} XP</span>
                      <span>Nv{prog.proximoNivel.nivel}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Corpo: 3 colunas */}
          <div className="grid grid-cols-3 gap-3">
            {/* Col 1 — Atributos + Percepção Passiva + Idiomas */}
            <div className="space-y-2">
              {ATRIBUTOS.map(({ key, label }) => (
                <AtributoCard
                  key={key}
                  label={label}
                  value={dados[key as keyof Personagem] as number}
                  onChange={v => atualizar(key, v)}
                />
              ))}
              <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg3)] rounded border border-[var(--border)]">
                <span className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Percepção Passiva</span>
                <span className="text-[var(--gold)] font-cinzel font-bold text-sm">{percepcaoPassiva}</span>
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

            {/* Col 2 — Combate + Perícias + Inventário */}
            <div className="space-y-2">
              {/* Bônus de Proficiência */}
              <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg3)] rounded border border-[var(--border)]">
                <span className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Bônus de Proficiência</span>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--gold)] font-cinzel font-bold text-sm">+</span>
                  <input type="number" value={dados.bonus_proficiencia} onChange={e => atualizar('bonus_proficiencia', parseInt(e.target.value) || 2)} className="w-10 input-dd text-center text-sm font-bold" />
                </div>
              </div>

              {/* Salvaguardas */}
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

              {/* Perícias */}
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

              {/* CA / Iniciativa / Deslocamento */}
              <div className="grid grid-cols-3 gap-1">
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">CA</label>
                  <input type="number" value={dados.ca} onChange={e => atualizar('ca', parseInt(e.target.value) || 10)} className="w-full input-dd text-center" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Iniciativa</label>
                  <input type="number" value={dados.iniciativa} onChange={e => atualizar('iniciativa', parseInt(e.target.value) || 0)} className="w-full input-dd text-center" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Desl. (m)</label>
                  <input type="number" value={dados.deslocamento} onChange={e => atualizar('deslocamento', parseInt(e.target.value) || 9)} className="w-full input-dd text-center" />
                </div>
              </div>

              {/* Pontos de Vida */}
              <div className="grid grid-cols-3 gap-1">
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase block">PV Máx</label>
                  <input type="number" value={dados.pv_maximo} onChange={e => atualizar('pv_maximo', parseInt(e.target.value) || 1)} className="w-full input-dd text-center" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase block">PV Atual</label>
                  <input type="number" value={dados.pv_atual} onChange={e => atualizar('pv_atual', parseInt(e.target.value) || 0)} className="w-full input-dd text-center" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase block">PV Temp</label>
                  <input type="number" value={dados.pv_temporarios} onChange={e => atualizar('pv_temporarios', parseInt(e.target.value) || 0)} className="w-full input-dd text-center" />
                </div>
              </div>

              {/* Dados de Vida & Teste de Morte */}
              <PainelGrimorio titulo="Dados de Vida & Morte" compacto>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Dado de Vida</label>
                    <input type="text" value={dados.dado_vida ?? ''} onChange={e => atualizar('dado_vida', e.target.value)} className="w-full input-dd text-center" placeholder="d8" />
                  </div>
                  <div>
                    <label className="text-[#8870a8] text-[9px] font-cinzel uppercase mb-1 block">Teste de Morte</label>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[#27ae60] text-[9px] font-cinzel w-12">Sucesso</span>
                      {[0, 1, 2].map(i => (
                        <button key={i} onClick={() => setTesteMorte(prev => ({ ...prev, sucessos: prev.sucessos === i + 1 ? i : i + 1 }))} className={`w-4 h-4 rounded-full border transition-colors ${testeMorte.sucessos > i ? 'bg-[#27ae60] border-[#27ae60]' : 'border-[#4a3060] hover:border-[#27ae60]'}`} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#e74c3c] text-[9px] font-cinzel w-12">Falha</span>
                      {[0, 1, 2].map(i => (
                        <button key={i} onClick={() => setTesteMorte(prev => ({ ...prev, falhas: prev.falhas === i + 1 ? i : i + 1 }))} className={`w-4 h-4 rounded-full border transition-colors ${testeMorte.falhas > i ? 'bg-[#e74c3c] border-[#e74c3c]' : 'border-[#4a3060] hover:border-[#e74c3c]'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </PainelGrimorio>

              {/* Ataques */}
              <PainelGrimorio titulo="Ataques" compacto>
                <div className="space-y-1">
                  {(dados.ataques ?? []).map((atq, i) => (
                    <div key={i} className="grid grid-cols-3 gap-1 text-xs">
                      <input value={atq.nome} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], nome: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="Nome" />
                      <input value={atq.bonus_ataque} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], bonus_ataque: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="+5" />
                      <input value={atq.dano} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], dano: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="1d8+3" />
                    </div>
                  ))}
                  <button onClick={() => atualizar('ataques', [...dados.ataques, { nome: '', bonus_ataque: '', dano: '', tipo_dano: '', notas: '' }])} className="text-xs text-[#9b59b6] hover:text-[#c39bd3] transition-colors mt-1">+ Adicionar ataque</button>
                </div>
              </PainelGrimorio>

              {/* Moedas */}
              <PainelGrimorio titulo="Moedas" compacto>
                <div className="grid grid-cols-3 gap-1 text-center">
                  {([
                    { key: 'pc', label: 'PC', cor: 'text-[#adb5bd]' },
                    { key: 'pp', label: 'PP', cor: 'text-[#c0c0c0]' },
                    { key: 'po', label: 'PO', cor: 'text-[var(--gold)]' },
                    { key: 'pe', label: 'PE', cor: 'text-[#3498db]' },
                    { key: 'pl', label: 'PL', cor: 'text-[var(--accent2)]' },
                  ] as const).map(({ key, label, cor }) => (
                    <div key={key}>
                      <label className={`${cor} text-[9px] font-cinzel uppercase`}>{label}</label>
                      <InputNumerico value={dados.moedas?.[key] ?? 0} onChange={val => atualizar('moedas', { ...(dados.moedas ?? { pc: 0, pp: 0, po: 0, pe: 0, pl: 0, custom: 0 }), [key]: val })} className="w-full input-dd text-center text-xs mt-0.5" />
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
                {inventario.length === 0 ? (
                  <p className="text-[var(--border)] text-sm font-crimson text-center py-2">Inventário vazio</p>
                ) : (
                  <div className="space-y-1">
                    {inventario.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-[var(--bg3)] rounded">
                        <button onClick={() => setItemPopup(item)} className="flex-1 text-left min-w-0">
                          <span className="text-[var(--text)] text-sm font-crimson truncate block">{item.nome}</span>
                          {item.raridade && <span className="text-[var(--text3)] text-[10px] font-cinzel">{item.raridade}</span>}
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => alterarQuantidade(idx, -1)} className="w-5 h-5 text-xs bg-[var(--surface)] rounded hover:bg-[var(--surface2)] text-[var(--text2)] leading-none flex items-center justify-center">−</button>
                          <span className="text-[var(--text)] text-xs w-5 text-center font-cinzel">{item.quantidade}</span>
                          <button onClick={() => alterarQuantidade(idx, 1)} className="w-5 h-5 text-xs bg-[var(--surface)] rounded hover:bg-[var(--surface2)] text-[var(--text2)] leading-none flex items-center justify-center">+</button>
                        </div>
                        <button onClick={() => removerItem(idx)} className="text-[var(--border)] hover:text-[var(--red2)] transition-colors flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[var(--text3)] text-[10px] font-cinzel mt-2 text-right">{inventario.length} ite{inventario.length === 1 ? 'm' : 'ns'}</p>
              </PainelGrimorio>

              {/* Defesas */}
              <PainelGrimorio titulo="Defesas" compacto>
                <div className="space-y-1">
                  {TIPOS_DANO.map(({ id, nome, icone }) => {
                    const defesa = getDefesa(id)
                    return (
                      <div key={id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-4">{icone}</span>
                        <span className="text-[#b8a8cc] flex-1 font-crimson">{nome}</span>
                        {(['resistencia', 'imunidade', 'vulnerabilidade'] as TipoDefesa[]).map(d => (
                          <button
                            key={d}
                            onClick={() => setDefesa(id, defesa === d ? null : d)}
                            className={`px-1 py-0.5 rounded text-[9px] font-cinzel border transition-colors ${
                              defesa === d
                                ? d === 'resistencia' ? 'bg-[#3498db]/30 border-[#3498db] text-[#3498db]'
                                : d === 'imunidade' ? 'bg-[#27ae60]/30 border-[#27ae60] text-[#27ae60]'
                                : 'bg-[#e74c3c]/30 border-[#e74c3c] text-[#e74c3c]'
                                : 'border-[#4a3060] text-[#4a3060] hover:border-[#6b4890]'
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

            {/* Col 3 — Traços + Características */}
            <div className="space-y-2">
              {[
                { label: 'Traços de Personalidade', key: 'tracos_personalidade', rows: 3 },
                { label: 'Ideais', key: 'ideais', rows: 2 },
                { label: 'Vínculos', key: 'vinculos', rows: 2 },
                { label: 'Defeitos', key: 'fraquezas', rows: 2 },
                { label: 'Características & Talentos', key: 'caracteristicas_talentos', rows: 6 },
              ].map(({ label, key, rows }) => (
                <div key={key}>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">{label}</label>
                  <textarea
                    value={(dados[key as keyof Personagem] as string) ?? ''}
                    onChange={e => atualizar(key as keyof Personagem, e.target.value as never)}
                    rows={rows}
                    className="w-full input-dd resize-none text-xs"
                  />
                </div>
              ))}
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
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">{label}</label>
                <input type="text" value={(dados[key as keyof Personagem] as string) ?? ''} onChange={e => atualizar(key as keyof Personagem, e.target.value as never)} className="w-full input-dd text-sm" />
              </div>
            ))}
          </div>

          {/* Corpo: 2 colunas */}
          <div className="grid grid-cols-2 gap-4">
            {/* Col 1 — Aparência + História */}
            <div className="space-y-3">
              <PainelGrimorio titulo="Aparência Física" compacto>
                <div className="mb-2">
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">URL da Imagem</label>
                  <input type="url" value={dados.imagem_url ?? ''} onChange={e => atualizar('imagem_url', e.target.value)} className="w-full input-dd text-sm mt-1" placeholder="https://..." />
                  {dados.imagem_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dados.imagem_url} alt={dados.nome} className="w-full h-28 object-cover rounded mt-2 border border-[var(--border)]" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Descrição da Aparência</label>
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
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Classe Conjuradora</label>
                <input type="text" className="w-full input-dd" placeholder="Mago, Clérigo..." />
              </div>
              <div>
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Atributo de Conjuração</label>
                <input type="text" className="w-full input-dd" placeholder="Inteligência" />
              </div>
              <div>
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">CD de Magia</label>
                <input type="number" className="w-full input-dd text-center" />
              </div>
            </div>

            {/* Espaços de magia */}
            <DivisorOrnamentado texto="Espaços de Magia" />
            <div className="grid grid-cols-3 gap-3 mb-3">
              {espacosPorNivel.map((total, idx) => {
                if (total === 0) return null
                const nivel = idx + 1
                const utilizados = espacosUtilizados[nivel] ?? 0
                return (
                  <div key={nivel} className="bg-[#1e1525] rounded p-2">
                    <div className="text-[#8870a8] text-[9px] font-cinzel uppercase mb-1">Nível {nivel}</div>
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: total }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => toggleEspaco(nivel, i)}
                          className={`text-base transition-colors ${
                            i < utilizados ? 'text-[#4a3060]' : 'text-[#9b59b6]'
                          } hover:scale-110`}
                          title={i < utilizados ? 'Espaço usado' : 'Espaço disponível'}
                        >
                          {i < utilizados ? '○' : '●'}
                        </button>
                      ))}
                    </div>
                    <div className="text-[#4a3060] text-[9px] mt-1">{utilizados}/{total} usados</div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={descansarLongo}
              className="text-xs font-cinzel text-[#27ae60] border border-[#27ae60]/40 px-3 py-1 rounded hover:bg-[#27ae60]/10 transition-colors"
            >
              🌙 Descanso Longo
            </button>
          </PainelGrimorio>

          {/* Magias conhecidas */}
          <PainelGrimorio titulo="Magias Conhecidas" compacto>
            {/* Busca */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8870a8]" />
              <input
                type="text"
                value={buscaMagia}
                onChange={e => setBuscaMagia(e.target.value)}
                placeholder="Buscar magia para adicionar..."
                className="w-full input-dd pl-9 text-sm"
              />
              {resultadosBusca.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-[#261a2e] border border-[#4a3060] rounded shadow-xl mt-1 max-h-48 overflow-y-auto">
                  {resultadosBusca.map(m => (
                    <button
                      key={m.id}
                      onClick={() => adicionarMagia(m)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#1e1525] transition-colors flex items-center justify-between"
                    >
                      <span className="text-[#e8dff0] font-crimson">{m.name_pt}</span>
                      <span className="text-[#8870a8] text-xs">{m.level === 0 ? 'Truque' : `Nv${m.level}`} · {m.school_pt}</span>
                    </button>
                  ))}
                </div>
              )}
              {buscandoMagia && (
                <div className="absolute top-full left-0 right-0 z-50 bg-[#261a2e] border border-[#4a3060] rounded p-2 text-center text-[#8870a8] text-xs mt-1">
                  Buscando...
                </div>
              )}
            </div>

            {/* Lista de magias por nível */}
            {Object.keys(magiasPorNivel).length === 0 ? (
              <p className="text-[#4a3060] text-sm font-crimson text-center py-4">Nenhuma magia adicionada</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(magiasPorNivel)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([nivel, magias]) => (
                    <div key={nivel}>
                      <p className="text-[#8870a8] text-[10px] font-cinzel uppercase tracking-wider mb-1">
                        {parseInt(nivel) === 0 ? 'Truques' : `${nivel}º Nível`}
                      </p>
                      <div className="space-y-0.5">
                        {magias.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-2 py-1 bg-[#1e1525] rounded">
                            <span className="text-[#b8a8cc] text-sm font-crimson">{m.spell.name_pt}</span>
                            <button
                              onClick={() => removerMagia(m.id)}
                              className="text-[#4a3060] hover:text-[#e74c3c] transition-colors"
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
    </div>
  )
}

function AtributoCard({ label, value, onChange }: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const mod = calcularModificadorAtributo(value)
  return (
    <div className="flex flex-col items-center border border-[#4a3060] rounded-lg overflow-hidden bg-[#1e1525]">
      <div className="w-full bg-[#261a2e] py-1 text-center">
        <span className="text-[#8870a8] text-[9px] font-cinzel uppercase tracking-wider">{label}</span>
      </div>
      <div className="py-2 flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-full border-2 border-[#4a3060] bg-[#261a2e] flex items-center justify-center">
          <span className="text-[#d4a843] text-base font-bold font-cinzel leading-none">{formatarModificador(mod)}</span>
        </div>
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 10)}
          className="w-14 input-dd text-center text-sm font-bold"
          title={label}
        />
      </div>
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

function InspiracaoHeroica({ valor, onChange }: { valor: number; onChange: (novo: number) => void }) {
  return (
    <div>
      <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Inspiração Heroica</label>
      <div className="flex items-center gap-1 mt-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(valor === i ? i - 1 : i)}
            title={i <= valor ? `Usar inspiração (${valor} restante${valor !== 1 ? 's' : ''})` : `${i} inspiração`}
            className="text-xl transition-all hover:scale-110 leading-none"
          >
            {i <= valor ? '⭐' : '☆'}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-[#8870a8] mt-0.5">
        {valor === 0 ? 'Sem inspiração' : `${valor}/5 — clique em ⭐ para usar uma`}
      </p>
    </div>
  )
}
