// Regras puras do uso de recursos pela barra de ações da /mesa (Canalizar
// Divindade e Inspiração heroica). Sem banco, sem efeitos: a rota
// /api/mesa/acao lê o estado, chama estas funções e grava o resultado.

export type TipoRecursoTurno = 'canalizar_divindade' | 'inspiracao_heroica'

export const ROTULO_RECURSO_TURNO: Record<TipoRecursoTurno, string> = {
  canalizar_divindade: 'Canalizar Divindade',
  inspiracao_heroica: 'Inspiração heroica',
}

export const TIPOS_RECURSO_TURNO = Object.keys(ROTULO_RECURSO_TURNO) as TipoRecursoTurno[]

export function ehTipoRecursoTurno(v: unknown): v is TipoRecursoTurno {
  return typeof v === 'string' && (TIPOS_RECURSO_TURNO as string[]).includes(v)
}

// recurso_id das linhas de recursos_personagem semeadas por recursos-classe.ts
export function ehCanalizarDivindade(recursoId: string | null | undefined): boolean {
  return !!recursoId && recursoId.startsWith('canalizar-divindade')
}

export interface ContextoUsoRecurso {
  ehDM: boolean
  // O usuário é dono do personagem ou controla o combatente.
  controla: boolean
  // O combatente que usa é o do turno atual.
  ehVezDoCombatente: boolean
  // Usos disponíveis agora (total - usados; inspiração: contador da ficha).
  disponiveis: number
}

export type ResultadoValidacao = { ok: true } | { ok: false; erro: string; status: number }

// DM age fora da vez (como nas demais ações da mesa); jogador só no próprio
// personagem e na própria vez. O contador nunca fica negativo: sem uso, recusa.
export function validarUsoRecurso(tipo: TipoRecursoTurno, ctx: ContextoUsoRecurso): ResultadoValidacao {
  if (!ctx.ehDM && !ctx.controla) {
    return { ok: false, erro: 'Você não controla este combatente — verifique se selecionou o personagem certo.', status: 403 }
  }
  if (!ctx.ehDM && !ctx.ehVezDoCombatente) {
    return { ok: false, erro: 'Não é a sua vez — aguarde seu turno para agir.', status: 403 }
  }
  if (!(ctx.disponiveis > 0)) {
    const erro = tipo === 'canalizar_divindade'
      ? 'Sem usos de Canalizar Divindade — espere um descanso.'
      : 'Este personagem não tem inspiração heroica.'
    return { ok: false, erro, status: 403 }
  }
  return { ok: true }
}

// Novo valor do contador após o uso; nunca abaixo de zero.
export function descontarInspiracao(atual: number): number {
  return Math.max(0, atual - 1)
}

// Novo `usados` após o uso; nunca acima do total.
export function descontarUsoRecurso(usados: number, total: number): number {
  return Math.min(total, usados + 1)
}

// Texto do evento — fixo, sem PV nem número nenhum. O cartão "Último evento"
// reconhece a entrada pelo texto exato (ver reconhecerEventoRecurso).
export function descricaoEventoRecurso(nome: string, tipo: TipoRecursoTurno): string {
  return `${nome} usou ${ROTULO_RECURSO_TURNO[tipo]}`
}

export function reconhecerEventoRecurso(origem: string, descricao: string | null | undefined): TipoRecursoTurno | null {
  if (!descricao) return null
  return TIPOS_RECURSO_TURNO.find(t => descricao === descricaoEventoRecurso(origem, t)) ?? null
}
