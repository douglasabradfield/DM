'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { usePlanoEfetivo } from '@/hooks/usePlanoEfetivo'
import { ChevronLeft, ChevronRight, Check, Dices } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Alinhamento } from '@/types/dnd'

// ─── Static D&D Data ──────────────────────────────────────────────────────────

const ATRIBUTOS_KEYS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'] as const
type AtribKey = typeof ATRIBUTOS_KEYS[number]

const ATRIBUTO_LABEL: Record<AtribKey, { label: string; abrev: string }> = {
  forca:       { label: 'Força',        abrev: 'FOR' },
  destreza:    { label: 'Destreza',     abrev: 'DES' },
  constituicao:{ label: 'Constituição', abrev: 'CON' },
  inteligencia:{ label: 'Inteligência', abrev: 'INT' },
  sabedoria:   { label: 'Sabedoria',    abrev: 'SAB' },
  carisma:     { label: 'Carisma',      abrev: 'CAR' },
}

interface BonusAtributo extends Partial<Record<AtribKey, number>> { livre?: number }

interface DadosRaca {
  nome: string
  bonus: BonusAtributo
  deslocamento: number
  tracos: string
  icone: string
}

const DADOS_RACAS: DadosRaca[] = [
  { nome: 'Anão da Colina',      bonus: { constituicao: 2, sabedoria: 1 },               deslocamento: 7.5,  icone: '⛏️', tracos: 'Visão no Escuro, Resiliência Anã, Prof. em Machados e Martelos' },
  { nome: 'Anão da Montanha',    bonus: { forca: 2, constituicao: 2 },                    deslocamento: 7.5,  icone: '🪨', tracos: 'Visão no Escuro, Resiliência Anã, Prof. em Armaduras Anãs' },
  { nome: 'Alto Elfo',           bonus: { destreza: 2, inteligencia: 1 },                 deslocamento: 9,    icone: '✨', tracos: 'Visão no Escuro, Sentidos Aguçados, Herança Feérica, Truque Extra' },
  { nome: 'Elfo da Floresta',    bonus: { destreza: 2, sabedoria: 1 },                    deslocamento: 10.5, icone: '🌿', tracos: 'Visão no Escuro, Sentidos Aguçados, Herança Feérica, Pés Ágeis' },
  { nome: 'Drow',                bonus: { destreza: 2, carisma: 1 },                      deslocamento: 9,    icone: '🕷️', tracos: 'Visão Superior, Sensibilidade à Luz Solar, Magia Drow' },
  { nome: 'Halfling Pés-Leves',  bonus: { destreza: 2, carisma: 1 },                      deslocamento: 7.5,  icone: '🌸', tracos: 'Sortudo, Valente, Agilidade Halfling, Naturalidade em Esconder' },
  { nome: 'Halfling Robusto',    bonus: { destreza: 2, constituicao: 1 },                  deslocamento: 7.5,  icone: '💪', tracos: 'Sortudo, Valente, Agilidade Halfling, Resistência Robusta' },
  { nome: 'Humano',              bonus: { forca:1, destreza:1, constituicao:1, inteligencia:1, sabedoria:1, carisma:1 }, deslocamento: 9, icone: '👤', tracos: '+1 em todos os atributos, Idioma Adicional' },
  { nome: 'Draconato',           bonus: { forca: 2, carisma: 1 },                         deslocamento: 9,    icone: '🐉', tracos: 'Ancestral Dracônico, Sopro de Arma, Resistência a Dano' },
  { nome: 'Gnomo da Floresta',   bonus: { inteligencia: 2, destreza: 1 },                 deslocamento: 7.5,  icone: '🍄', tracos: 'Visão no Escuro, Astúcia Gnômica, Ilusionismo Natural' },
  { nome: 'Gnomo das Rochas',    bonus: { inteligencia: 2, constituicao: 1 },              deslocamento: 7.5,  icone: '⚙️', tracos: 'Visão no Escuro, Astúcia Gnômica, Conhecimento Tecnicista' },
  { nome: 'Meio-Elfo',           bonus: { carisma: 2, livre: 2 },                         deslocamento: 9,    icone: '🌙', tracos: 'Visão no Escuro, Herança Feérica, +1 livre em 2 atributos, 2 perícias extras' },
  { nome: 'Meio-Orc',            bonus: { forca: 2, constituicao: 1 },                    deslocamento: 9,    icone: '⚔️', tracos: 'Visão no Escuro, Ameaçador, Resistência Implacável, Ataques Selvagens' },
  { nome: 'Tiefling',            bonus: { inteligencia: 1, carisma: 2 },                  deslocamento: 9,    icone: '😈', tracos: 'Visão no Escuro, Resistência Infernal, Legado Infernal' },
]

const TODAS_PERICIAS = [
  'Acrobacia','Adestrar Animais','Arcanismo','Atletismo','Atuação',
  'Enganação','Furtividade','História','Intimidação','Intuição',
  'Investigação','Medicina','Natureza','Percepção','Persuasão',
  'Prestidigitação','Religião','Sobrevivência',
]

interface DadosClasse {
  nome: string
  dado_vida: string
  pv_nv1: number
  atributo_principal: string
  saves: AtribKey[]
  pericias_qtd: number
  pericias_opcoes: string[] | 'todas'
  conjurador: boolean
  equipamento: string
}

const DADOS_CLASSES: DadosClasse[] = [
  { nome:'Bárbaro',    dado_vida:'d12', pv_nv1:12, atributo_principal:'Força',              saves:['forca','constituicao'],   pericias_qtd:2, pericias_opcoes:['Adestrar Animais','Atletismo','Intimidação','Natureza','Percepção','Sobrevivência'],                                         conjurador:false, equipamento:'Machado de batalha (ou 2 machados de mão), 4 zarabatanas, Mochila de Explorador' },
  { nome:'Bardo',      dado_vida:'d8',  pv_nv1:8,  atributo_principal:'Carisma',            saves:['destreza','carisma'],      pericias_qtd:3, pericias_opcoes:'todas',                                                                                                                     conjurador:true,  equipamento:'Rapieira, arco curto, couro, adaga, Bolsa de Componentes' },
  { nome:'Bruxo',      dado_vida:'d8',  pv_nv1:8,  atributo_principal:'Carisma',            saves:['sabedoria','carisma'],     pericias_qtd:2, pericias_opcoes:['Arcanismo','Enganação','História','Intimidação','Investigação','Natureza','Religião'],                                      conjurador:true,  equipamento:'Besta leve + 20 virotes (ou arma simples), bolsa de componentes, couro, 2 adagas' },
  { nome:'Clérigo',    dado_vida:'d8',  pv_nv1:8,  atributo_principal:'Sabedoria',          saves:['sabedoria','carisma'],     pericias_qtd:2, pericias_opcoes:['História','Intuição','Medicina','Persuasão','Religião'],                                                                   conjurador:true,  equipamento:'Maça (ou martelo de guerra), escudo, armadura de escamas, símbolo sagrado, Mochila de Sacerdote' },
  { nome:'Druida',     dado_vida:'d8',  pv_nv1:8,  atributo_principal:'Sabedoria',          saves:['inteligencia','sabedoria'],pericias_qtd:2, pericias_opcoes:['Adestrar Animais','Arcanismo','Atletismo','História','Intuição','Medicina','Natureza','Percepção','Religião','Sobrevivência'],conjurador:true,  equipamento:'Escudo de madeira (ou arma simples), cajado, couro, Mochila de Explorador' },
  { nome:'Feiticeiro', dado_vida:'d6',  pv_nv1:6,  atributo_principal:'Carisma',            saves:['constituicao','carisma'],  pericias_qtd:2, pericias_opcoes:['Arcanismo','Enganação','Intuição','Intimidação','Persuasão','Religião'],                                                    conjurador:true,  equipamento:'Besta leve + 20 virotes, 2 adagas, bolsa de componentes, Mochila de Explorador' },
  { nome:'Guerreiro',  dado_vida:'d10', pv_nv1:10, atributo_principal:'Força ou Destreza',  saves:['forca','constituicao'],   pericias_qtd:2, pericias_opcoes:['Acrobacia','Adestrar Animais','Atletismo','História','Intuição','Intimidação','Percepção','Sobrevivência'],                  conjurador:false, equipamento:'Cota de malha (ou couro + arco longo), escudo (ou arma marcial extra), arma marcial, arma simples' },
  { nome:'Ladino',     dado_vida:'d8',  pv_nv1:8,  atributo_principal:'Destreza',           saves:['destreza','inteligencia'], pericias_qtd:4, pericias_opcoes:['Acrobacia','Atletismo','Enganação','Furtividade','Intimidação','Intuição','Investigação','Percepção','Persuasão','Prestidigitação'],conjurador:false, equipamento:'Rapieira (ou espada curta), arco curto + 20 flechas, pacote de arrombamento, couro, 2 adagas' },
  { nome:'Mago',       dado_vida:'d6',  pv_nv1:6,  atributo_principal:'Inteligência',       saves:['inteligencia','sabedoria'],pericias_qtd:2, pericias_opcoes:['Arcanismo','História','Intuição','Investigação','Medicina','Religião'],                                                     conjurador:true,  equipamento:'Cajado (ou adaga), grimório, bolsa de componentes, Mochila de Estudioso' },
  { nome:'Monge',      dado_vida:'d8',  pv_nv1:8,  atributo_principal:'Destreza e Sabedoria',saves:['forca','destreza'],      pericias_qtd:2, pericias_opcoes:['Acrobacia','Atletismo','História','Intuição','Religião','Furtividade'],                                                      conjurador:false, equipamento:'Arma simples (ou espada curta), 10 dardos, Mochila de Dungeon' },
  { nome:'Paladino',   dado_vida:'d10', pv_nv1:10, atributo_principal:'Força e Carisma',    saves:['sabedoria','carisma'],    pericias_qtd:2, pericias_opcoes:['Atletismo','Intuição','Intimidação','Medicina','Persuasão','Religião'],                                                      conjurador:true,  equipamento:'Arma marcial + escudo (ou 2 armas marciais), 5 zarabatanas, cota de malha, símbolo sagrado' },
  { nome:'Patrulheiro',dado_vida:'d8',  pv_nv1:8,  atributo_principal:'Destreza e Sabedoria',saves:['forca','destreza'],      pericias_qtd:3, pericias_opcoes:['Adestrar Animais','Atletismo','Intuição','Investigação','Natureza','Percepção','Furtividade','Sobrevivência'],                conjurador:true,  equipamento:'Arma marcial + escudo (ou 2 armas marciais), arco longo + 20 flechas, couro de escamas' },
]

interface DadosAntecedente {
  nome: string
  pericias: string[]
  equipamento: string
  tracos: string
}

const DADOS_ANTECEDENTES: DadosAntecedente[] = [
  { nome:'Acólito',             pericias:['História','Religião'],          equipamento:'Símbolo sagrado, livro de preces, 5 velas, vestes, 15 po',              tracos:'Abrigo: pode receber abrigo em templos da sua fé' },
  { nome:'Artesão de Guilda',   pericias:['Atletismo','Percepção'],         equipamento:'Ferramentas de artesão, carta da guilda, roupas finas, 15 po',          tracos:'Membro de Guilda: hospedagem e assistência médica básica' },
  { nome:'Charlatão',           pericias:['Enganação','Furtividade'],       equipamento:'Roupas finas, disfarce, ferramentas de falsificação, 15 po',            tracos:'Identidade Falsa: possui identidade alternativa documentada' },
  { nome:'Criminoso',           pericias:['Enganação','Furtividade'],       equipamento:'Pé de cabra, roupas escuras com capuz, ferramentas de ladrão, 15 po',   tracos:'Contato Criminal: acesso a informações do submundo' },
  { nome:'Eremita',             pericias:['Medicina','Religião'],           equipamento:'Estojo de pergaminhos, cobertor, kit de cura, roupas comuns, 5 po',     tracos:'Descoberta: conhece um segredo importante' },
  { nome:'Forasteiro',          pericias:['Atletismo','Sobrevivência'],     equipamento:'Bastão, armadilha de caça, troféu animal, roupas de viajante, 10 po',   tracos:'Andarilho: excelente memória geográfica' },
  { nome:'Marinheiro',          pericias:['Atletismo','Percepção'],         equipamento:'Marlinspike, seda de 50 pés, tinta e caneta, roupas comuns, 10 po',     tracos:'Passagem de Navio: pode obter passagem gratuita em embarcações' },
  { nome:'Nobre',               pericias:['História','Persuasão'],          equipamento:'Jogo de xadrez, pergaminhos de nobreza, roupas finas, anel de sinete, 25 po', tracos:'Posição de Privilégio: pessoas te tratam como superior' },
  { nome:'Sábio',               pericias:['Arcanismo','História'],          equipamento:'Frasco de tinta, caneta, carta de colega morto, roupas comuns, 10 po',  tracos:'Pesquisador: sabe onde encontrar qualquer informação' },
  { nome:'Soldado',             pericias:['Atletismo','Intimidação'],       equipamento:'Insígnia de ranking, troféu inimigo, dados de osso, roupas comuns, 10 po', tracos:'Posto Militar: militares de nível inferior lhe obedecem' },
]

const ALINHAMENTOS: Alinhamento[] = [
  'Leal e Bom','Neutro e Bom','Caótico e Bom',
  'Leal e Neutro','Neutro','Caótico e Neutro',
  'Leal e Mau','Neutro e Mau','Caótico e Mau',
]

const CUSTOS: Record<number, number> = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 }
const PONTOS_TOTAL = 27

// ─── Types ────────────────────────────────────────────────────────────────────

type Passo = 'raca' | 'classe' | 'antecedente' | 'atributos' | 'pericias' | 'equipamento' | 'magias' | 'detalhes' | 'revisao'

type AtributosBase = Record<AtribKey, number>

interface PersonagemEmCriacao {
  raca: string
  classe: string
  antecedente: string
  atributos_base: AtributosBase
  metodo_atributos: 'pointbuy' | 'rolagem'
  pericias_selecionadas: string[]
  equipamento_texto: string
  nome: string
  jogador_nome: string
  alinhamento: string
  tracos_personalidade: string
  ideais: string
  vinculos: string
  fraquezas: string
}

function atributosVazios(): AtributosBase {
  return { forca:8, destreza:8, constituicao:8, inteligencia:8, sabedoria:8, carisma:8 }
}

const PASSO_LABEL: Record<Passo, string> = {
  raca:'Raça', classe:'Classe', antecedente:'Antecedente', atributos:'Atributos',
  pericias:'Perícias', equipamento:'Equipamento', magias:'Magias', detalhes:'Detalhes', revisao:'Revisão',
}

function podeProsseguir(passo: Passo, p: PersonagemEmCriacao): boolean {
  switch (passo) {
    case 'raca': return !!p.raca
    case 'classe': return !!p.classe
    case 'antecedente': return !!p.antecedente
    case 'atributos': {
      const total = ATRIBUTOS_KEYS.reduce((acc, k) => acc + (CUSTOS[p.atributos_base[k]] ?? 0), 0)
      return p.metodo_atributos === 'rolagem' || total <= PONTOS_TOTAL
    }
    case 'pericias': {
      const classe = DADOS_CLASSES.find(c => c.nome === p.classe)
      return !classe || p.pericias_selecionadas.length >= classe.pericias_qtd
    }
    case 'equipamento': return true
    case 'magias': return true
    case 'detalhes': return !!p.nome.trim()
    case 'revisao': return true
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CriarPersonagemPage() {
  const router = useRouter()
  const { campanhaAtiva, papelPorCampanha } = useCampanha()
  const planoEfetivo = usePlanoEfetivo()

  const [passo, setPasso] = useState<Passo>('raca')
  const [salvando, setSalvando] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [nomeUsuario, setNomeUsuario] = useState('')

  const [personagem, setPersonagem] = useState<PersonagemEmCriacao>({
    raca:'', classe:'', antecedente:'',
    atributos_base: atributosVazios(),
    metodo_atributos: 'pointbuy',
    pericias_selecionadas: [],
    equipamento_texto: '',
    nome:'', jogador_nome:'', alinhamento:'Neutro',
    tracos_personalidade:'', ideais:'', vinculos:'', fraquezas:'',
  })

  const ehJogador = papelPorCampanha[campanhaAtiva?.id ?? ''] === 'jogador'
  const liberado = ehJogador && planoEfetivo === 'guild_master'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('profiles').select('nome').eq('id', user.id).single()
        .then(({ data }) => { if (data?.nome) setNomeUsuario(data.nome) })
    })
  }, [])

  const racaSelecionada = DADOS_RACAS.find(r => r.nome === personagem.raca)
  const classeSelecionada = DADOS_CLASSES.find(c => c.nome === personagem.classe)
  const antecedenteSelecionado = DADOS_ANTECEDENTES.find(a => a.nome === personagem.antecedente)

  const PASSOS_BASE: Passo[] = ['raca','classe','antecedente','atributos','pericias','equipamento','detalhes','revisao']
  const passos: Passo[] = classeSelecionada?.conjurador
    ? ['raca','classe','antecedente','atributos','pericias','equipamento','magias','detalhes','revisao']
    : PASSOS_BASE
  const idxAtual = passos.indexOf(passo)

  function atualizar<K extends keyof PersonagemEmCriacao>(campo: K, valor: PersonagemEmCriacao[K]) {
    setPersonagem(prev => ({ ...prev, [campo]: valor }))
  }

  function calcAtributoFinal(key: AtribKey): number {
    return personagem.atributos_base[key] + (racaSelecionada?.bonus[key] ?? 0)
  }

  function calcPV(): number {
    const pvBase = classeSelecionada?.pv_nv1 ?? 8
    const modCon = Math.floor((calcAtributoFinal('constituicao') - 10) / 2)
    return pvBase + modCon
  }

  function calcCA(): number {
    return 10 + Math.floor((calcAtributoFinal('destreza') - 10) / 2)
  }

  async function criarPersonagem() {
    if (!campanhaAtiva?.id || !userId) { toast.error('Selecione uma campanha'); return }
    setSalvando(true)
    try {
      const supabase = createClient()
      const periciasObj: Record<string, boolean> = {}
      personagem.pericias_selecionadas.forEach(p => { periciasObj[p] = true })

      const novoPersonagem = {
        campanha_id: campanhaAtiva.id,
        user_id: userId,
        nome: personagem.nome,
        jogador_nome: personagem.jogador_nome || nomeUsuario,
        tipo_personagem: 'jogador' as const,
        raca: personagem.raca,
        classe: personagem.classe,
        antecedente: personagem.antecedente,
        alinhamento: personagem.alinhamento,
        nivel: 1,
        forca: calcAtributoFinal('forca'),
        destreza: calcAtributoFinal('destreza'),
        constituicao: calcAtributoFinal('constituicao'),
        inteligencia: calcAtributoFinal('inteligencia'),
        sabedoria: calcAtributoFinal('sabedoria'),
        carisma: calcAtributoFinal('carisma'),
        ca: calcCA(),
        pv_maximo: calcPV(),
        pv_atual: calcPV(),
        pv_temporarios: 0,
        dado_vida: classeSelecionada?.dado_vida ?? 'd8',
        bonus_proficiencia: 2,
        iniciativa: Math.floor((calcAtributoFinal('destreza') - 10) / 2),
        deslocamento: racaSelecionada?.deslocamento ?? 9,
        inspiracao: 0,
        pericias: periciasObj,
        salvaguardas: Object.fromEntries((classeSelecionada?.saves ?? []).map(s => [s, true])),
        ataques: [],
        resistencias: [],
        imunidades: [],
        vulnerabilidades: [],
        equipamento: personagem.equipamento_texto || classeSelecionada?.equipamento || null,
        tracos_personalidade: personagem.tracos_personalidade || null,
        ideais: personagem.ideais || null,
        vinculos: personagem.vinculos || null,
        fraquezas: personagem.fraquezas || null,
        ativo: false,
      }

      const { data: criado, error } = await supabase.from('personagens').insert(novoPersonagem).select('id').single()
      if (error) throw error

      await supabase.from('notificacoes').insert({
        user_id: campanhaAtiva.dm_id,
        tipo: 'personagem_aguardando_aprovacao',
        titulo: 'Personagem Aguardando Aprovação',
        mensagem: `${personagem.nome} (${personagem.raca} ${personagem.classe}) de ${personagem.jogador_nome || nomeUsuario} aguarda aprovação.`,
        link: `/personagens/${criado.id}`,
        lida: false,
      })

      toast.success('Personagem enviado para aprovação do Mestre!')
      router.push('/personagens')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao criar personagem')
    } finally {
      setSalvando(false)
    }
  }

  if (!campanhaAtiva) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <p className="font-cinzel text-[var(--gold)] text-xl">Nenhuma campanha selecionada</p>
          <Link href="/personagens" className="text-sm text-[var(--accent)] hover:underline font-crimson">Voltar</Link>
        </div>
      </div>
    )
  }

  if (!liberado) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="text-4xl">🔒</div>
          <p className="font-cinzel text-[var(--gold)] text-xl">Acesso Restrito</p>
          <p className="text-[var(--text3)] font-crimson text-sm max-w-xs">
            A criação guiada de personagens está disponível para jogadores convidados em campanhas Guild Master.
          </p>
          <Link href="/personagens" className="inline-block text-sm text-[var(--accent)] hover:underline font-crimson">
            ← Voltar aos Personagens
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header com progresso */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-cinzel text-[var(--gold)] text-xl font-bold">✨ Criar Personagem</h1>
          <Link href="/personagens" className="text-xs text-[var(--text3)] hover:text-[var(--text)] font-cinzel transition-colors">
            Cancelar
          </Link>
        </div>
        <div className="flex gap-0.5 mb-1">
          {passos.map((p, i) => (
            <div key={p} className={`h-1.5 flex-1 rounded-full transition-all ${i <= idxAtual ? 'bg-[var(--accent)]' : 'bg-[var(--surface)]'}`} />
          ))}
        </div>
        <p className="text-[10px] text-[var(--text3)] font-cinzel uppercase tracking-wider">
          Passo {idxAtual + 1} de {passos.length} — {PASSO_LABEL[passo]}
        </p>
      </div>

      {/* Conteúdo do passo */}
      {passo === 'raca' && (
        <StepRaca selecionada={personagem.raca} onSelecionar={raca => atualizar('raca', raca)} />
      )}
      {passo === 'classe' && (
        <StepClasse selecionada={personagem.classe} onSelecionar={classe => {
          atualizar('classe', classe)
          atualizar('pericias_selecionadas', [])
        }} />
      )}
      {passo === 'antecedente' && (
        <StepAntecedente selecionado={personagem.antecedente} onSelecionar={ant => atualizar('antecedente', ant)} />
      )}
      {passo === 'atributos' && racaSelecionada && (
        <StepAtributos
          atributosBase={personagem.atributos_base}
          metodo={personagem.metodo_atributos}
          racaBonus={racaSelecionada.bonus}
          onAtualizarAtributos={a => atualizar('atributos_base', a)}
          onAtualizarMetodo={m => { atualizar('metodo_atributos', m); atualizar('atributos_base', atributosVazios()) }}
        />
      )}
      {passo === 'pericias' && classeSelecionada && (
        <StepPericias
          classeDados={classeSelecionada}
          antecedenteDados={antecedenteSelecionado}
          racaNome={personagem.raca}
          selecionadas={personagem.pericias_selecionadas}
          onAtualizar={p => atualizar('pericias_selecionadas', p)}
        />
      )}
      {passo === 'equipamento' && (
        <StepEquipamento
          classeDados={classeSelecionada}
          antecedenteDados={antecedenteSelecionado}
          texto={personagem.equipamento_texto}
          onAtualizar={t => atualizar('equipamento_texto', t)}
        />
      )}
      {passo === 'magias' && <StepMagias classe={personagem.classe} />}
      {passo === 'detalhes' && (
        <StepDetalhes personagem={personagem} nomeUsuario={nomeUsuario} onAtualizar={atualizar} />
      )}
      {passo === 'revisao' && racaSelecionada && classeSelecionada && (
        <StepRevisao
          personagem={personagem}
          racaDados={racaSelecionada}
          classeDados={classeSelecionada}
          antecedenteDados={antecedenteSelecionado}
          pvMaximo={calcPV()}
          ca={calcCA()}
          atribFinal={calcAtributoFinal}
          nomeUsuario={nomeUsuario}
        />
      )}

      {/* Navegação */}
      <div className="flex justify-between mt-6 pt-4 border-t border-[var(--border)]">
        <button
          onClick={() => { const ant = passos[idxAtual - 1]; if (ant) setPasso(ant); else router.push('/personagens') }}
          className="flex items-center gap-2 px-4 py-2 font-cinzel text-sm text-[var(--text3)] border border-[var(--border)] rounded hover:border-[var(--text)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {idxAtual === 0 ? 'Cancelar' : 'Anterior'}
        </button>
        {passo === 'revisao' ? (
          <button
            onClick={criarPersonagem}
            disabled={salvando || !personagem.nome}
            className="flex items-center gap-2 px-5 py-2 font-cinzel text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {salvando ? 'Enviando...' : '⚔️ Enviar para Aprovação'}
          </button>
        ) : (
          <button
            onClick={() => { const prox = passos[idxAtual + 1]; if (prox) setPasso(prox) }}
            disabled={!podeProsseguir(passo, personagem)}
            className="flex items-center gap-2 px-5 py-2 font-cinzel text-sm bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepRaca({ selecionada, onSelecionar }: { selecionada: string; onSelecionar: (r: string) => void }) {
  return (
    <div>
      <h2 className="font-cinzel text-[var(--text)] text-lg mb-1">Escolha sua Raça</h2>
      <p className="text-[var(--text3)] text-sm font-crimson mb-4">A raça define bônus de atributos, traços e velocidade base.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DADOS_RACAS.map(raca => {
          const bonusTexto = Object.entries(raca.bonus)
            .filter(([k]) => k !== 'livre')
            .map(([k, v]) => `+${v} ${ATRIBUTO_LABEL[k as AtribKey]?.abrev ?? k.toUpperCase()}`)
            .join(', ')
          return (
            <button key={raca.nome} onClick={() => onSelecionar(raca.nome)}
              className={`text-left p-3 border rounded-xl transition-all ${selecionada === raca.nome ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{raca.icone}</span>
                <span className="font-cinzel text-[var(--text)] text-sm font-semibold">{raca.nome}</span>
                {selecionada === raca.nome && <Check className="w-4 h-4 text-[var(--accent)] ml-auto" />}
              </div>
              <p className="text-[var(--accent2)] text-xs font-cinzel">{bonusTexto}{raca.bonus.livre ? ` + ${raca.bonus.livre} livre` : ''}</p>
              <p className="text-[var(--text3)] text-[11px] font-crimson mt-0.5">{raca.tracos}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepClasse({ selecionada, onSelecionar }: { selecionada: string; onSelecionar: (c: string) => void }) {
  return (
    <div>
      <h2 className="font-cinzel text-[var(--text)] text-lg mb-1">Escolha sua Classe</h2>
      <p className="text-[var(--text3)] text-sm font-crimson mb-4">A classe define suas habilidades, dado de vida e proficiências.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DADOS_CLASSES.map(classe => (
          <button key={classe.nome} onClick={() => onSelecionar(classe.nome)}
            className={`text-left p-3 border rounded-xl transition-all ${selecionada === classe.nome ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-cinzel text-[var(--text)] text-sm font-semibold">{classe.nome}</span>
              {classe.conjurador && <span className="text-[10px] px-1.5 py-0.5 border border-[var(--accent2)] text-[var(--accent2)] rounded font-cinzel">Conjurador</span>}
              {selecionada === classe.nome && <Check className="w-4 h-4 text-[var(--accent)] ml-auto" />}
            </div>
            <div className="flex gap-3 text-xs text-[var(--text3)] font-cinzel">
              <span>🎲 {classe.dado_vida}</span>
              <span>PV Nv1: {classe.pv_nv1}</span>
              <span>{classe.pericias_qtd} perícias</span>
            </div>
            <p className="text-[var(--text3)] text-[11px] font-crimson mt-0.5">Principal: {classe.atributo_principal}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepAntecedente({ selecionado, onSelecionar }: { selecionado: string; onSelecionar: (a: string) => void }) {
  return (
    <div>
      <h2 className="font-cinzel text-[var(--text)] text-lg mb-1">Escolha seu Antecedente</h2>
      <p className="text-[var(--text3)] text-sm font-crimson mb-4">O antecedente define sua origem e habilidades sociais.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DADOS_ANTECEDENTES.map(ant => (
          <button key={ant.nome} onClick={() => onSelecionar(ant.nome)}
            className={`text-left p-3 border rounded-xl transition-all ${selecionado === ant.nome ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-cinzel text-[var(--text)] text-sm font-semibold">{ant.nome}</span>
              {selecionado === ant.nome && <Check className="w-4 h-4 text-[var(--accent)] ml-auto" />}
            </div>
            <p className="text-[var(--accent2)] text-xs font-cinzel">Perícias: {ant.pericias.join(', ')}</p>
            <p className="text-[var(--text3)] text-[11px] font-crimson mt-0.5">{ant.tracos}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepAtributos({ atributosBase, metodo, racaBonus, onAtualizarAtributos, onAtualizarMetodo }: {
  atributosBase: AtributosBase
  metodo: 'pointbuy' | 'rolagem'
  racaBonus: BonusAtributo
  onAtualizarAtributos: (a: AtributosBase) => void
  onAtualizarMetodo: (m: 'pointbuy' | 'rolagem') => void
}) {
  const custoTotal = ATRIBUTOS_KEYS.reduce((acc, k) => acc + (CUSTOS[atributosBase[k]] ?? 0), 0)
  const pontosRestantes = PONTOS_TOTAL - custoTotal

  function rolar(): AtributosBase {
    const novo = { ...atributosBase }
    for (const key of ATRIBUTOS_KEYS) {
      const dados = [1,2,3,4].map(() => Math.floor(Math.random() * 6) + 1)
      dados.sort((a, b) => b - a)
      novo[key] = dados.slice(0, 3).reduce((a, b) => a + b, 0)
    }
    return novo
  }

  return (
    <div>
      <h2 className="font-cinzel text-[var(--text)] text-lg mb-3">Atributos</h2>
      <div className="flex gap-2 mb-4">
        {(['pointbuy', 'rolagem'] as const).map(m => (
          <button key={m} onClick={() => onAtualizarMetodo(m)}
            className={`px-3 py-1.5 text-xs font-cinzel rounded border transition-colors ${metodo === m ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text3)] hover:border-[var(--accent)]/50'}`}
          >
            {m === 'pointbuy' ? 'Compra de Pontos' : '🎲 Rolagem (4d6)'}
          </button>
        ))}
      </div>
      {metodo === 'pointbuy' && (
        <div className={`mb-3 px-3 py-2 rounded-lg border text-sm font-cinzel ${pontosRestantes < 0 ? 'border-[var(--red2)] text-[var(--red2)] bg-[var(--red2)]/10' : pontosRestantes === 0 ? 'border-[var(--green2)] text-[var(--green2)] bg-[var(--green2)]/10' : 'border-[var(--border)] text-[var(--text3)]'}`}>
          Pontos restantes: {pontosRestantes} / {PONTOS_TOTAL}
        </div>
      )}
      {metodo === 'rolagem' && (
        <button onClick={() => onAtualizarAtributos(rolar())}
          className="mb-4 flex items-center gap-2 px-4 py-2 border border-[var(--accent)] text-[var(--accent)] rounded font-cinzel text-sm hover:bg-[var(--accent)]/10 transition-colors"
        >
          <Dices className="w-4 h-4" /> Rolar todos os atributos
        </button>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ATRIBUTOS_KEYS.map(key => {
          const bonus = racaBonus[key] ?? 0
          const base = atributosBase[key]
          const final = base + bonus
          const mod = Math.floor((final - 10) / 2)
          return (
            <div key={key} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 text-center">
              <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase tracking-wider mb-2">{ATRIBUTO_LABEL[key].abrev}</p>
              {metodo === 'pointbuy' ? (
                <div className="flex items-center justify-center gap-1 mb-1">
                  <button
                    onClick={() => { if (base > 8) onAtualizarAtributos({ ...atributosBase, [key]: base - 1 }) }}
                    className="w-6 h-6 rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--surface2)] transition-colors font-bold"
                  >−</button>
                  <span className="font-cinzel font-bold text-xl text-[var(--gold)] w-8 text-center">{base}</span>
                  <button
                    onClick={() => {
                      if (base >= 15) return
                      const novoCusto = CUSTOS[base + 1] ?? 99
                      const custoAtual = CUSTOS[base] ?? 0
                      if (custoTotal - custoAtual + novoCusto > PONTOS_TOTAL) return
                      onAtualizarAtributos({ ...atributosBase, [key]: base + 1 })
                    }}
                    className="w-6 h-6 rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--surface2)] transition-colors font-bold"
                  >+</button>
                </div>
              ) : (
                <div className="mb-1"><span className="font-cinzel font-bold text-xl text-[var(--gold)]">{base}</span></div>
              )}
              {bonus > 0 && <p className="text-[var(--green2)] text-[10px] font-cinzel">+{bonus} racial</p>}
              <div className="mt-1 h-px bg-[var(--border)]" />
              <p className="mt-1 font-cinzel font-bold text-[var(--accent2)] text-base">{final}</p>
              <p className="text-[var(--text3)] text-[10px]">{mod >= 0 ? `+${mod}` : mod}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StepPericias({ classeDados, antecedenteDados, racaNome, selecionadas, onAtualizar }: {
  classeDados: DadosClasse
  antecedenteDados?: DadosAntecedente
  racaNome: string
  selecionadas: string[]
  onAtualizar: (p: string[]) => void
}) {
  const periciasAntecedente = antecedenteDados?.pericias ?? []
  const extrasLivre = racaNome === 'Meio-Elfo' ? 2 : 0
  const qtdTotal = classeDados.pericias_qtd + extrasLivre
  const opcoes = classeDados.pericias_opcoes === 'todas' ? TODAS_PERICIAS : classeDados.pericias_opcoes

  function toggle(pericia: string) {
    if (selecionadas.includes(pericia)) onAtualizar(selecionadas.filter(p => p !== pericia))
    else if (selecionadas.length < qtdTotal) onAtualizar([...selecionadas, pericia])
  }

  return (
    <div>
      <h2 className="font-cinzel text-[var(--text)] text-lg mb-1">Perícias</h2>
      <p className="text-[var(--text3)] text-sm font-crimson mb-3">
        Escolha {qtdTotal} perícia{qtdTotal !== 1 ? 's' : ''} da sua classe{extrasLivre > 0 ? ` (+${extrasLivre} extras de Meio-Elfo)` : ''}.
        {' '}({selecionadas.length}/{qtdTotal} selecionadas)
      </p>
      {periciasAntecedente.length > 0 && (
        <div className="mb-3 p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
          <p className="text-[var(--text3)] text-xs font-cinzel uppercase mb-1">Do Antecedente (automático)</p>
          <div className="flex gap-2 flex-wrap">
            {periciasAntecedente.map(p => (
              <span key={p} className="px-2 py-0.5 text-xs font-cinzel border border-[var(--green2)] text-[var(--green2)] rounded">✓ {p}</span>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {opcoes.map(pericia => {
          const jaTemAntecedente = periciasAntecedente.includes(pericia)
          const selecionada = selecionadas.includes(pericia)
          const cheia = selecionadas.length >= qtdTotal
          return (
            <button key={pericia} onClick={() => !jaTemAntecedente && toggle(pericia)}
              disabled={jaTemAntecedente || (!selecionada && cheia)}
              className={`text-left px-3 py-2 text-sm font-crimson rounded border transition-all ${
                jaTemAntecedente ? 'border-[var(--green2)]/40 text-[var(--green2)]/50 cursor-default' :
                selecionada ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)]' :
                !cheia ? 'border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)]/50' :
                'border-[var(--border)] text-[var(--text3)] opacity-40 cursor-not-allowed'
              }`}
            >
              {selecionada && !jaTemAntecedente && <span className="mr-1">✓</span>}{pericia}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepEquipamento({ classeDados, antecedenteDados, texto, onAtualizar }: {
  classeDados?: DadosClasse
  antecedenteDados?: DadosAntecedente
  texto: string
  onAtualizar: (t: string) => void
}) {
  const equipPadrao = [classeDados?.equipamento, antecedenteDados?.equipamento].filter(Boolean).join('\n')
  return (
    <div>
      <h2 className="font-cinzel text-[var(--text)] text-lg mb-1">Equipamento Inicial</h2>
      <p className="text-[var(--text3)] text-sm font-crimson mb-4">Revise e personalize o equipamento sugerido para sua classe e antecedente.</p>
      {equipPadrao && (
        <div className="mb-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
          <p className="text-[var(--text3)] text-xs font-cinzel uppercase mb-1">Sugestão</p>
          <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-line">{equipPadrao}</p>
          {!texto && (
            <button onClick={() => onAtualizar(equipPadrao)} className="mt-2 text-xs text-[var(--accent)] hover:underline font-cinzel">
              Usar sugestão
            </button>
          )}
        </div>
      )}
      <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Seu equipamento</label>
      <textarea value={texto} onChange={e => onAtualizar(e.target.value)} rows={5}
        className="w-full input-dd mt-1 resize-none text-sm font-crimson" placeholder="Liste seu equipamento inicial..." />
    </div>
  )
}

function StepMagias({ classe }: { classe: string }) {
  return (
    <div>
      <h2 className="font-cinzel text-[var(--text)] text-lg mb-1">Magias Iniciais</h2>
      <p className="text-[var(--text3)] text-sm font-crimson mb-4">
        Como {classe}, você tem acesso à conjuração desde o nível 1.
      </p>
      <div className="p-4 bg-[var(--surface)] border border-[var(--accent)]/30 rounded-xl">
        <p className="text-[var(--accent2)] font-cinzel text-sm mb-2">✨ Dica</p>
        <p className="text-[var(--text2)] text-sm font-crimson">
          Após aprovação pelo Mestre, acesse sua ficha e use o campo de busca na aba de Conjuração para adicionar seus truques e magias conhecidas.
        </p>
      </div>
    </div>
  )
}

function StepDetalhes({ personagem, nomeUsuario, onAtualizar }: {
  personagem: PersonagemEmCriacao
  nomeUsuario: string
  onAtualizar: <K extends keyof PersonagemEmCriacao>(campo: K, valor: PersonagemEmCriacao[K]) => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-cinzel text-[var(--text)] text-lg">Detalhes do Personagem</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Nome do Personagem *</label>
          <input type="text" value={personagem.nome} onChange={e => onAtualizar('nome', e.target.value)}
            className="w-full input-dd mt-1" placeholder="Aragorn" required />
        </div>
        <div>
          <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Nome do Jogador</label>
          <input type="text" value={personagem.jogador_nome} onChange={e => onAtualizar('jogador_nome', e.target.value)}
            className="w-full input-dd mt-1" placeholder={nomeUsuario || 'Seu nome'} />
        </div>
      </div>
      <div>
        <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Alinhamento</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {ALINHAMENTOS.map(al => (
            <button key={al} onClick={() => onAtualizar('alinhamento', al)}
              className={`text-xs font-crimson px-2 py-1.5 rounded border transition-colors ${personagem.alinhamento === al ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)]' : 'border-[var(--border)] text-[var(--text3)] hover:border-[var(--accent)]/50'}`}
            >{al}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Traços de Personalidade</label>
        <textarea value={personagem.tracos_personalidade} onChange={e => onAtualizar('tracos_personalidade', e.target.value)}
          rows={2} className="w-full input-dd mt-1 resize-none text-sm font-crimson" placeholder="Como você age? Que maneirismos tem?" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Ideais</label>
          <textarea value={personagem.ideais} onChange={e => onAtualizar('ideais', e.target.value)}
            rows={3} className="w-full input-dd mt-1 resize-none text-sm font-crimson" placeholder="O que te guia?" />
        </div>
        <div>
          <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Vínculos</label>
          <textarea value={personagem.vinculos} onChange={e => onAtualizar('vinculos', e.target.value)}
            rows={3} className="w-full input-dd mt-1 resize-none text-sm font-crimson" placeholder="O que te conecta ao mundo?" />
        </div>
        <div>
          <label className="text-[var(--text3)] text-xs font-cinzel uppercase">Defeitos</label>
          <textarea value={personagem.fraquezas} onChange={e => onAtualizar('fraquezas', e.target.value)}
            rows={3} className="w-full input-dd mt-1 resize-none text-sm font-crimson" placeholder="Sua fraqueza ou vício?" />
        </div>
      </div>
    </div>
  )
}

function StepRevisao({ personagem, racaDados, classeDados, antecedenteDados, pvMaximo, ca, atribFinal, nomeUsuario }: {
  personagem: PersonagemEmCriacao
  racaDados: DadosRaca
  classeDados: DadosClasse
  antecedenteDados?: DadosAntecedente
  pvMaximo: number
  ca: number
  atribFinal: (k: AtribKey) => number
  nomeUsuario: string
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-cinzel text-[var(--text)] text-lg">Revisão Final</h2>
      <div className="p-3 bg-[var(--accent2)]/10 border border-[var(--accent2)]/30 rounded-xl">
        <p className="text-[var(--accent2)] font-cinzel text-xs font-bold uppercase mb-1">⏳ Aguardando Aprovação</p>
        <p className="text-[var(--text2)] text-sm font-crimson">
          Seu personagem será enviado ao Mestre para aprovação. Você receberá uma notificação quando aprovado.
        </p>
      </div>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
        <div className="flex items-baseline gap-3">
          <h3 className="font-cinzel text-[var(--gold)] text-xl font-bold">{personagem.nome || '(sem nome)'}</h3>
          <span className="text-[var(--text3)] text-sm font-crimson">{personagem.jogador_nome || nomeUsuario}</span>
        </div>
        <p className="text-[var(--text2)] font-crimson">{racaDados.nome} · {classeDados.nome} Nível 1 · {antecedenteDados?.nome}</p>
        <p className="text-[var(--text3)] text-sm font-crimson">{personagem.alinhamento}</p>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
          <div className="text-center">
            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">PV Máx</p>
            <p className="font-cinzel font-bold text-[var(--green2)] text-xl">{pvMaximo}</p>
          </div>
          <div className="text-center">
            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">CA</p>
            <p className="font-cinzel font-bold text-[var(--accent2)] text-xl">{ca}</p>
          </div>
          <div className="text-center">
            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase">Dado</p>
            <p className="font-cinzel font-bold text-[var(--gold)] text-xl">{classeDados.dado_vida}</p>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-1 pt-2 border-t border-[var(--border)]">
          {ATRIBUTOS_KEYS.map(key => {
            const final = atribFinal(key)
            const mod = Math.floor((final - 10) / 2)
            return (
              <div key={key} className="text-center bg-[var(--bg3)] rounded p-1">
                <p className="text-[var(--text3)] text-[9px] font-cinzel">{ATRIBUTO_LABEL[key].abrev}</p>
                <p className="font-bold text-[var(--text)] text-sm">{final}</p>
                <p className="text-[var(--text2)] text-[10px]">{mod >= 0 ? `+${mod}` : mod}</p>
              </div>
            )
          })}
        </div>
        {(personagem.pericias_selecionadas.length > 0 || (antecedenteDados?.pericias.length ?? 0) > 0) && (
          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1">Perícias</p>
            <p className="text-[var(--text2)] text-sm font-crimson">
              {[...(antecedenteDados?.pericias ?? []), ...personagem.pericias_selecionadas].join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
