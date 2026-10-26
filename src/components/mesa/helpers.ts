import { resolverTipoDanoSRD } from '@/lib/dados-dnd/tipos-dano'
import type { Combatente, EntradaLog, EspacosMagiaBatalha } from '@/types/batalha'
import { MOEDAS, TAXA_PARA_PO } from './constantes'
import type { AtaqueDisponivel, MagiaExibida } from './tipos'

// Ícone por tipo de item — mesmo vocabulário de `tipo` usado no compêndio da
// ficha (arma/armadura/magico/equipamento).
export function iconeItem(tipo: string | null): string {
  switch (tipo) {
    case 'arma': return '⚔️'
    case 'armadura': return '🛡️'
    case 'magico': return '✨'
    case 'equipamento': return '🎒'
    default: return '📦'
  }
}

// Classificação da magia para o fluxo de conjuração: dano/cura pedem alvo e
// valor; utilitária só registra no log; concentração ganha a opção extra de
// marcar como efeito ativo (não é exclusiva das outras três).
export function classificarMagia(m: MagiaExibida): { efeito: 'dano' | 'cura' | 'nenhum' } {
  if (m.danoDice) return { efeito: 'dano' }
  if (m.curaDice) return { efeito: 'cura' }
  return { efeito: 'nenhum' }
}

export function ordenarPorNome(combatentes: Combatente[]): Combatente[] {
  return [...combatentes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// Jogadores têm ataques em dados_personagem.ataques; monstros/NPCs do
// bestiário trazem ataques_estruturados (MonsterAction[]) — formatos
// diferentes, mesmo uso nos slots de arma / lista de ataque. Só entram os
// que têm dado de dano (o resto — traços, lendárias sem dano — não cabe
// no modelo "nome/bônus/dano" desses controles.
export function ataquesDoCombatente(c: Combatente): AtaqueDisponivel[] {
  if (c.dados_personagem?.ataques) return c.dados_personagem.ataques
  if (c.ataques_estruturados) {
    return c.ataques_estruturados
      .filter(a => a.damage_dice)
      .map(a => ({
        nome: a.name_pt,
        bonus: a.attack_bonus != null ? (a.attack_bonus >= 0 ? `+${a.attack_bonus}` : `${a.attack_bonus}`) : '',
        dano: a.damage_dice ?? '',
        tipo_dano: resolverTipoDanoSRD(a) ?? undefined,
      }))
  }
  return []
}

export function mensagemToast(entrada: EntradaLog): string | null {
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

// Degradação graciosa. Truques (nível 0) não têm preparação em D&D 5e —
// aparecem sempre. Para nível 1+: se há alguma preparada, mostra só as
// preparadas (+ truques); se nenhuma está preparada, mostra todas com um
// aviso em vez de uma lista enganosamente curta.
export function selecionarMagiasExibidas(magias: MagiaExibida[]): { magias: MagiaExibida[]; aviso: string | null } {
  if (magias.length === 0) return { magias: [], aviso: null }
  const truques = magias.filter(m => m.nivel === 0)
  const comNivel = magias.filter(m => m.nivel > 0)
  const preparadas = comNivel.filter(m => m.preparada)
  if (preparadas.length > 0) return { magias: [...truques, ...preparadas], aviso: null }
  return { magias, aviso: 'Nenhuma magia marcada como preparada na ficha' }
}

// Só níveis com espaço realmente disponível — o mínimo é o da magia (regra
// 5e: não dá para conjurar abaixo do nível base), o teto é 9.
export function niveisDisponiveisParaMagia(
  nivelBase: number,
  espacosMagia: EspacosMagiaBatalha
): { nivel: number; disponivel: number; total: number }[] {
  return Array.from({ length: 9 - nivelBase + 1 }, (_, i) => nivelBase + i)
    .map(nivel => {
      const espaco = espacosMagia[nivel]
      return espaco ? { nivel, disponivel: espaco.total - espaco.usados, total: espaco.total } : null
    })
    .filter((x): x is { nivel: number; disponivel: number; total: number } => !!x && x.disponivel > 0)
}

export function totalEmPO(moedas: Partial<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number>> | null | undefined): number {
  if (!moedas) return 0
  return MOEDAS.reduce((soma, m) => soma + (moedas[m.id] ?? 0) * TAXA_PARA_PO[m.id], 0)
}
