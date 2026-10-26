import type { TipoCondicao } from '@/types/batalha'
import type { TipoDano } from '@/types/dnd'
import type { AcaoInventarioParams, ResultadoAcaoInventario, ResultadoAcaoSessao, TipoAcaoSessao } from './tipos'

export async function chamarAcaoSessaoApi(payload: {
  sessaoId: string
  personagemId: string
  tipo: TipoAcaoSessao
  valor?: number
  tipoDano?: TipoDano
  condicao?: TipoCondicao
  nivelMagia?: number
  dadosGastos?: number
  curaInformada?: number
  nomeAcao?: string
  descricao?: string
}): Promise<ResultadoAcaoSessao> {
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
    return { ok: true, personagem: dados.personagem }
  } catch {
    return { ok: false, erro: 'Sem conexão — tente novamente' }
  }
}

export async function chamarAcaoInventario(payload: AcaoInventarioParams): Promise<ResultadoAcaoInventario> {
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
    return { ok: true, descricao: dados?.descricao }
  } catch {
    return { ok: false, erro: 'Sem conexão — tente novamente' }
  }
}
