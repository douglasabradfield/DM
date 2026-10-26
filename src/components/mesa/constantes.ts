// Ordem de exibição pedida: platina primeiro (maior valor), cobre por
// último — não é a ordem de gravação no banco (pc/pp/pe/po/pl), só a leitura.
//
// BACKLOG: personagens.moedas.custom e campanhas.moeda_custom_nome existem
// e já são usados na ficha (FichaPersonagem.tsx), mas ModalOuro e
// ModalDistribuirTesouro não expõem essa moeda — Ganhar/Perder/Dar/
// Distribuir não sabem mexer em 'custom' hoje. Baixa prioridade.
export const MOEDAS: { id: 'pl' | 'po' | 'pe' | 'pp' | 'pc'; label: string }[] = [
  { id: 'pl', label: 'Platina (pl)' },
  { id: 'po', label: 'Ouro (po)' },
  { id: 'pe', label: 'Electro (pe)' },
  { id: 'pp', label: 'Prata (pp)' },
  { id: 'pc', label: 'Cobre (pc)' },
]

// Taxas de conversão padrão de D&D 5e para peças de ouro (po): 1 pl = 10po,
// 1 pe = 0,5po, 1 pp = 0,1po, 1 pc = 0,01po.
export const TAXA_PARA_PO: Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number> = { pl: 10, po: 1, pe: 0.5, pp: 0.1, pc: 0.01 }

export const OPCOES_REACAO = [
  { tipo: 'ataque_oportunidade' as const, label: 'Ataque de oportunidade', precisaAlvo: true, precisaValor: true },
  { tipo: 'contra_magia' as const, label: 'Contra-mágica', precisaAlvo: true, precisaValor: false },
  { tipo: 'escudo' as const, label: 'Escudo', precisaAlvo: false, precisaValor: false },
  { tipo: 'absorver_elementos' as const, label: 'Absorver elementos', precisaAlvo: false, precisaValor: false },
]
