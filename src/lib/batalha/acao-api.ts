import type { TipoDano } from '@/types/dnd'
import type { TipoEntradaLog } from '@/types/batalha'

// Contrato de AcaoBatalhaPayload em src/app/api/mesa/acao/route.ts — ponto
// único de envio de ação de combate, usado pela mesa e pela aba Batalha.
export interface PayloadAcaoBatalha {
  batalhaId: string
  combatenteId: string
  tipo: TipoEntradaLog
  alvos: { combatenteId: string; valor: number; tipoDano?: TipoDano }[]
  nivelMagia?: number
  nomeAcao?: string
  vantagem?: 'vantagem' | 'desvantagem' | null
  descricao?: string
  marcarEfeitoAtivo?: string
  encerrarEfeitoAtivo?: string
}

// Contrato de AcaoEstadoPayload — edição de estado sem ator, só o mestre.
export type TipoAcaoEstado =
  | 'dano_ambiente' | 'cura_ambiente' | 'ajustar_pv'
  | 'definir_pv_maximo' | 'definir_espacos' | 'zerar_contadores'

export interface PayloadAcaoEstado {
  batalhaId: string
  tipo: TipoAcaoEstado
  alvos: {
    combatenteId: string
    valor?: number
    pvTemporarios?: number
    pvMaximo?: number
    nivelMagia?: number
    usar?: boolean
  }[]
  tipoDano?: TipoDano
  motivo?: string
}

export interface ResultadoAcao {
  ok: boolean
  erro?: string
}

export async function chamarAcaoApi(payload: PayloadAcaoBatalha | PayloadAcaoEstado): Promise<ResultadoAcao> {
  try {
    const resp = await fetch('/api/mesa/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const dados = await resp.json().catch(() => null)
    if (!resp.ok) {
      return { ok: false, erro: dados?.erro ?? 'Erro ao registrar ação' }
    }
    return { ok: true }
  } catch {
    return { ok: false, erro: 'Sem conexão — tente novamente' }
  }
}
