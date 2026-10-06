// Nome de classe → slug de `classes.slug`.
//
// `personagens.classe` guarda o nome de exibição em português ou inglês
// ("Clérigo", "Bruxo", "Warlock"), digitado livremente na ficha. Os módulos
// de dado (recursos-classe.ts) usam o slug. Cobre as 12 classes, inclusive
// as não conjuradoras, que o CLASSE_CONJURADORA_MAP de espacos-magia.ts não
// tem. Módulo de dado puro, sem chamada de banco.

export type SlugClasse =
  | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
  | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard'

// Chaves já normalizadas: minúsculas e sem acento (ver normalizarNomeClasse).
const CLASSE_SLUG_MAP: Record<string, SlugClasse> = {
  // Português
  'barbaro': 'barbarian',
  'bardo': 'bard',
  'clerigo': 'cleric',
  'druida': 'druid',
  'guerreiro': 'fighter',
  'monge': 'monk',
  'paladino': 'paladin',
  'patrulheiro': 'ranger',
  'guardiao': 'ranger',
  'ladino': 'rogue',
  'feiticeiro': 'sorcerer',
  'bruxo': 'warlock',
  'mago': 'wizard',
  // Inglês
  'barbarian': 'barbarian',
  'bard': 'bard',
  'cleric': 'cleric',
  'druid': 'druid',
  'fighter': 'fighter',
  'monk': 'monk',
  'paladin': 'paladin',
  'ranger': 'ranger',
  'rogue': 'rogue',
  'sorcerer': 'sorcerer',
  'warlock': 'warlock',
  'wizard': 'wizard',
  // Subclasses gravadas como classe (mesmos nomes de CLASSE_CONJURADORA_MAP)
  'cavaleiro arcano': 'fighter',
  'eldritch knight': 'fighter',
  'trapaceiro arcano': 'rogue',
  'arcane trickster': 'rogue',
}

export function normalizarNomeClasse(classe: string | null | undefined): string {
  return (classe ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Slug da classe, ou null se o nome não for reconhecido. */
export function getSlugClasse(classe: string | null | undefined): SlugClasse | null {
  return CLASSE_SLUG_MAP[normalizarNomeClasse(classe)] ?? null
}
