// Recursos de classe com usos limitados — regras de 2024 (SRD 5.2).
//
// Módulo de dado puro, sem chamada de banco, no mesmo padrão de
// espacos-magia.ts. Cobre as 12 classes. Subclasses ficam fora: Domínio
// Divino, Patrono Sobrenatural, Caminho do Furioso e afins trazem recursos
// próprios e entram em etapa separada.
//
// Fontes, consultadas em 06/10/2026, uma página por classe no SRD 5.2:
//   Bárbaro       https://5e24srd.com/classes/barbarian.html
//   Bardo         https://5e24srd.com/classes/bard.html
//   Bruxo         https://5e24srd.com/classes/warlock.html
//   Clérigo       https://5e24srd.com/classes/cleric.html
//   Druida        https://5e24srd.com/classes/druid.html
//   Feiticeiro    https://5e24srd.com/classes/sorcerer.html
//   Guerreiro     https://5e24srd.com/classes/fighter.html
//   Ladino        https://5e24srd.com/classes/rogue.html
//   Mago          https://5e24srd.com/classes/wizard.html
//   Monge         https://5e24srd.com/classes/monk.html
//   Paladino      https://5e24srd.com/classes/paladin.html
//   Patrulheiro   https://5e24srd.com/classes/ranger.html

/**
 * Como os usos voltam. A distinção entre 'curto' e 'um_curto_todos_longo'
 * é o que a tela de descanso precisa para saber o que restaurar.
 */
export type RecuperacaoRecurso =
  | 'longo'                    // todos os usos voltam em descanso longo
  | 'curto'                    // todos os usos voltam em descanso curto
  | 'um_curto_todos_longo'     // 1 uso em descanso curto, todos em longo

/** Como o total de usos é calculado. */
export type CalculoUsos =
  /** Degraus por nível de classe: { nível em que muda: total de usos }. */
  | { tipo: 'degraus'; degraus: Record<number, number> }
  /** Total igual ao modificador de um atributo, com piso. */
  | { tipo: 'modificador'; atributo: 'carisma' | 'sabedoria' | 'inteligencia'; minimo: number }
  /** Poço de pontos igual ao nível multiplicado por um fator. */
  | { tipo: 'poco_por_nivel'; multiplicador: number }
  /** Um uso por item ganho, nos níveis listados. Usos somados. */
  | { tipo: 'um_por_nivel'; niveis: number[] }

export interface RecursoClasse {
  id: string
  nome: string
  /** slug da classe, igual ao de `classes.slug` no banco. */
  classe: string
  /** Nível de classe em que o recurso aparece. */
  nivelMinimo: number
  usos: CalculoUsos
  recuperacao: RecuperacaoRecurso
  /** Unidade exibida: usos contáveis ou pontos de um poço. */
  unidade: 'usos' | 'pontos'
  /**
   * Quando presente, este registro não é um recurso próprio: a partir de
   * `nivelMinimo` ele só troca a recuperação do recurso cujo id está aqui.
   * `getRecursosPorClasse` resolve isso e nunca devolve os dois.
   */
  alteraRecuperacaoDe?: string
  nota?: string
}

export const RECURSOS_CLASSE: RecursoClasse[] = [
  // Clérigo
  {
    id: 'canalizar-divindade-clerigo',
    nome: 'Canalizar Divindade',
    classe: 'cleric',
    nivelMinimo: 2,
    usos: { tipo: 'degraus', degraus: { 2: 2, 6: 3, 18: 4 } },
    recuperacao: 'um_curto_todos_longo',
    unidade: 'usos',
  },
  {
    id: 'intervencao-divina',
    nome: 'Intervenção Divina',
    classe: 'cleric',
    nivelMinimo: 10,
    usos: { tipo: 'degraus', degraus: { 10: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'No nível 20, conjurar Desejo por esta característica exige 2d4 descansos longos antes do próximo uso.',
  },

  // Druida
  {
    id: 'forma-selvagem',
    nome: 'Forma Selvagem',
    classe: 'druid',
    nivelMinimo: 2,
    usos: { tipo: 'degraus', degraus: { 2: 2, 6: 3, 17: 4 } },
    recuperacao: 'um_curto_todos_longo',
    unidade: 'usos',
  },
  {
    id: 'ressurgencia-natural',
    nome: 'Ressurgência Natural',
    classe: 'druid',
    nivelMinimo: 5,
    usos: { tipo: 'degraus', degraus: { 5: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Conta apenas o sentido Forma Selvagem para espaço de magia, que é o limitado a uma vez por descanso longo. Gastar espaço de magia para ganhar uso de Forma Selvagem não tem limite próprio.',
  },

  // Paladino
  {
    id: 'canalizar-divindade-paladino',
    nome: 'Canalizar Divindade',
    classe: 'paladin',
    nivelMinimo: 3,
    usos: { tipo: 'degraus', degraus: { 3: 2, 11: 3 } },
    recuperacao: 'um_curto_todos_longo',
    unidade: 'usos',
  },
  {
    id: 'imposicao-de-maos',
    nome: 'Imposição de Mãos',
    classe: 'paladin',
    nivelMinimo: 1,
    usos: { tipo: 'poco_por_nivel', multiplicador: 5 },
    recuperacao: 'longo',
    unidade: 'pontos',
  },
  {
    id: 'golpe-divino-paladino',
    nome: 'Golpe Divino sem espaço',
    classe: 'paladin',
    nivelMinimo: 2,
    usos: { tipo: 'degraus', degraus: { 2: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Conjurar Golpe Divino uma vez sem gastar espaço de magia.',
  },
  {
    id: 'montaria-fiel',
    nome: 'Montaria Fiel',
    classe: 'paladin',
    nivelMinimo: 5,
    usos: { tipo: 'degraus', degraus: { 5: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Conjurar Encontrar Corcel uma vez sem gastar espaço de magia.',
  },
  {
    id: 'nimbo-sagrado',
    nome: 'Nimbo Sagrado',
    classe: 'paladin',
    nivelMinimo: 20,
    usos: { tipo: 'degraus', degraus: { 20: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Também recuperável gastando um espaço de magia de 5º nível.',
  },

  // Bardo
  {
    id: 'inspiracao-bardica',
    nome: 'Inspiração Bárdica',
    classe: 'bard',
    nivelMinimo: 1,
    usos: { tipo: 'modificador', atributo: 'carisma', minimo: 1 },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'A partir do nível 5, por Fonte de Inspiração, passa a voltar em descanso curto.',
  },
  {
    id: 'fonte-de-inspiracao',
    nome: 'Fonte de Inspiração',
    classe: 'bard',
    nivelMinimo: 5,
    usos: { tipo: 'modificador', atributo: 'carisma', minimo: 1 },
    recuperacao: 'curto',
    unidade: 'usos',
    alteraRecuperacaoDe: 'inspiracao-bardica',
  },

  // Bruxo
  {
    id: 'astucia-magica',
    nome: 'Astúcia Mágica',
    classe: 'warlock',
    nivelMinimo: 2,
    usos: { tipo: 'degraus', degraus: { 2: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Recupera metade dos espaços de Magia de Pacto, arredondando para cima. No nível 20, por Mestre Arcano, recupera todos.',
  },
  {
    id: 'contatar-patrono',
    nome: 'Contatar Patrono',
    classe: 'warlock',
    nivelMinimo: 9,
    usos: { tipo: 'degraus', degraus: { 9: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
  },
  {
    id: 'arcano-mistico-6',
    nome: 'Arcano Místico (6º nível)',
    classe: 'warlock',
    nivelMinimo: 11,
    usos: { tipo: 'um_por_nivel', niveis: [11] },
    recuperacao: 'longo',
    unidade: 'usos',
  },
  {
    id: 'arcano-mistico-7',
    nome: 'Arcano Místico (7º nível)',
    classe: 'warlock',
    nivelMinimo: 13,
    usos: { tipo: 'um_por_nivel', niveis: [13] },
    recuperacao: 'longo',
    unidade: 'usos',
  },
  {
    id: 'arcano-mistico-8',
    nome: 'Arcano Místico (8º nível)',
    classe: 'warlock',
    nivelMinimo: 15,
    usos: { tipo: 'um_por_nivel', niveis: [15] },
    recuperacao: 'longo',
    unidade: 'usos',
  },
  {
    id: 'arcano-mistico-9',
    nome: 'Arcano Místico (9º nível)',
    classe: 'warlock',
    nivelMinimo: 17,
    usos: { tipo: 'um_por_nivel', niveis: [17] },
    recuperacao: 'longo',
    unidade: 'usos',
  },

  // Mago
  {
    id: 'recuperacao-arcana',
    nome: 'Recuperação Arcana',
    classe: 'wizard',
    nivelMinimo: 1,
    usos: { tipo: 'degraus', degraus: { 1: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Usada durante um descanso curto. Devolve espaços somando metade do nível de mago, arredondando para cima, e nenhum espaço acima do 5º nível.',
  },
  {
    id: 'memorizar-magia',
    nome: 'Memorizar Magia',
    classe: 'wizard',
    nivelMinimo: 5,
    usos: { tipo: 'degraus', degraus: { 5: 1 } },
    recuperacao: 'curto',
    unidade: 'usos',
  },

  // Guerreiro
  {
    id: 'segundo-folego',
    nome: 'Segundo Fôlego',
    classe: 'fighter',
    nivelMinimo: 1,
    usos: { tipo: 'degraus', degraus: { 1: 2, 4: 3, 10: 4 } },
    recuperacao: 'um_curto_todos_longo',
    unidade: 'usos',
    nota: 'Mente Tática, no nível 2, gasta um uso deste recurso. Se a verificação ainda falhar, o uso não é gasto.',
  },
  {
    id: 'acao-ardente',
    nome: 'Ação Ardente',
    classe: 'fighter',
    nivelMinimo: 2,
    usos: { tipo: 'degraus', degraus: { 2: 1, 17: 2 } },
    recuperacao: 'curto',
    unidade: 'usos',
    nota: 'No nível 17, dois usos por descanso, mas só um por turno.',
  },
  {
    id: 'indomavel',
    nome: 'Indomável',
    classe: 'fighter',
    nivelMinimo: 9,
    usos: { tipo: 'degraus', degraus: { 9: 1, 13: 2, 17: 3 } },
    recuperacao: 'longo',
    unidade: 'usos',
  },

  // Bárbaro
  // Fúria Implacável, nível 11, não entra: o limite dela é uma CD que sobe 5
  // a cada uso e volta a 10 no descanso, não uma contagem de usos.
  {
    id: 'furia',
    nome: 'Fúria',
    classe: 'barbarian',
    nivelMinimo: 1,
    usos: { tipo: 'degraus', degraus: { 1: 2, 3: 3, 6: 4, 12: 5, 17: 6 } },
    recuperacao: 'um_curto_todos_longo',
    unidade: 'usos',
  },
  {
    id: 'furia-persistente',
    nome: 'Fúria Persistente',
    classe: 'barbarian',
    nivelMinimo: 15,
    usos: { tipo: 'degraus', degraus: { 15: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Ao rolar iniciativa, recupera todos os usos de Fúria. Uma vez por descanso longo.',
  },

  // Monge
  {
    id: 'pontos-de-foco',
    nome: 'Pontos de Foco',
    classe: 'monk',
    nivelMinimo: 2,
    usos: { tipo: 'poco_por_nivel', multiplicador: 1 },
    recuperacao: 'curto',
    unidade: 'pontos',
    nota: 'Total igual ao nível de monge. Golpe Atordoante e Defesa Superior gastam deste poço, sem contador próprio.',
  },
  {
    id: 'metabolismo-incomum',
    nome: 'Metabolismo Incomum',
    classe: 'monk',
    nivelMinimo: 2,
    usos: { tipo: 'degraus', degraus: { 2: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Ao rolar iniciativa, recupera todos os Pontos de Foco e cura.',
  },

  // Ladino
  // Golpe Ardiloso, nível 5, não entra: gasta dados de Ataque Furtivo, sem
  // contador próprio. Talento Confiável e Mente Escorregadia são passivos.
  {
    id: 'golpe-de-sorte',
    nome: 'Golpe de Sorte',
    classe: 'rogue',
    nivelMinimo: 20,
    usos: { tipo: 'degraus', degraus: { 20: 1 } },
    recuperacao: 'curto',
    unidade: 'usos',
  },

  // Feiticeiro
  {
    id: 'feiticaria-inata',
    nome: 'Feitiçaria Inata',
    classe: 'sorcerer',
    nivelMinimo: 1,
    usos: { tipo: 'degraus', degraus: { 1: 2 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'A partir do nível 7, sem usos restantes, pode ser ativada gastando 2 Pontos de Feitiçaria.',
  },
  {
    id: 'pontos-de-feiticaria',
    nome: 'Pontos de Feitiçaria',
    classe: 'sorcerer',
    nivelMinimo: 2,
    usos: { tipo: 'poco_por_nivel', multiplicador: 1 },
    recuperacao: 'longo',
    unidade: 'pontos',
    nota: 'Total igual ao nível de feiticeiro.',
  },
  {
    id: 'restauracao-feiticeira',
    nome: 'Restauração Feiticeira',
    classe: 'sorcerer',
    nivelMinimo: 5,
    usos: { tipo: 'degraus', degraus: { 5: 1 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Usada em descanso curto. Devolve Pontos de Feitiçaria até metade do nível de feiticeiro, arredondando para baixo.',
  },

  // Patrulheiro
  {
    id: 'marca-do-cacador',
    nome: 'Marca do Caçador',
    classe: 'ranger',
    nivelMinimo: 1,
    usos: { tipo: 'degraus', degraus: { 1: 2, 5: 3, 9: 4, 13: 5 } },
    recuperacao: 'longo',
    unidade: 'usos',
    nota: 'Vem da característica Inimigo Favorito: conjurar Marca do Caçador sem gastar espaço de magia.',
  },
  {
    id: 'incansavel',
    nome: 'Incansável',
    classe: 'ranger',
    nivelMinimo: 10,
    usos: { tipo: 'modificador', atributo: 'sabedoria', minimo: 1 },
    recuperacao: 'longo',
    unidade: 'usos',
  },
  {
    id: 'veu-da-natureza',
    nome: 'Véu da Natureza',
    classe: 'ranger',
    nivelMinimo: 14,
    usos: { tipo: 'modificador', atributo: 'sabedoria', minimo: 1 },
    recuperacao: 'longo',
    unidade: 'usos',
  },
]

/** Recursos que uma classe tem naquele nível, já com o total calculado. */
export function getRecursosPorClasse(
  classeSlug: string,
  nivel: number,
  modificadores: { carisma?: number; sabedoria?: number; inteligencia?: number } = {}
): { recurso: RecursoClasse; total: number }[] {
  const n = Math.min(Math.max(nivel, 1), 20)
  const ativos = RECURSOS_CLASSE.filter(r => r.classe === classeSlug && n >= r.nivelMinimo)

  // Registros com alteraRecuperacaoDe não são recursos: trocam a recuperação
  // de outro e saem da lista.
  const trocas = new Map<string, RecuperacaoRecurso>()
  for (const r of ativos) {
    if (r.alteraRecuperacaoDe) trocas.set(r.alteraRecuperacaoDe, r.recuperacao)
  }

  return ativos
    .filter(r => !r.alteraRecuperacaoDe)
    .map(r => {
      const novaRecuperacao = trocas.get(r.id)
      return {
        recurso: novaRecuperacao ? { ...r, recuperacao: novaRecuperacao } : r,
        total: calcularTotalUsos(r.usos, n, modificadores),
      }
    })
    .filter(x => x.total > 0)
}

export function calcularTotalUsos(
  usos: CalculoUsos,
  nivel: number,
  modificadores: { carisma?: number; sabedoria?: number; inteligencia?: number } = {}
): number {
  switch (usos.tipo) {
    case 'degraus': {
      let total = 0
      for (const [nivelDegrau, valor] of Object.entries(usos.degraus)) {
        if (nivel >= Number(nivelDegrau)) total = valor
      }
      return total
    }
    case 'modificador':
      return Math.max(usos.minimo, modificadores[usos.atributo] ?? 0)
    case 'poco_por_nivel':
      return nivel * usos.multiplicador
    case 'um_por_nivel':
      return usos.niveis.filter(nv => nivel >= nv).length
  }
}
