import type { TipoDano } from '@/types/dnd'
import type { EspacosMagiaBatalha } from '@/types/batalha'
import { aplicarResistencias } from '@/lib/dados-dnd/tipos-dano'

interface AlvoDano {
  pv_temporarios: number
  resistencias: TipoDano[]
  imunidades: TipoDano[]
  vulnerabilidades: TipoDano[]
}

// PV temporários absorvem primeiro — o resto (se houver) desconta do PV atual, nunca abaixo de zero.
// tipoDano null = dano sem tipo (queda, narrativo) — ignora resistência/imunidade/vulnerabilidade de propósito.
export function calcularDano(
  valor: number,
  tipoDano: TipoDano | null,
  alvo: AlvoDano
): { danoFinal: number; absorvidoTemporario: number; modificador: string } {
  const { danoFinal, modificador } = tipoDano
    ? aplicarResistencias(valor, tipoDano, alvo.resistencias, alvo.imunidades, alvo.vulnerabilidades)
    : { danoFinal: valor, modificador: '' }
  const absorvidoTemporario = alvo.pv_temporarios > 0 ? Math.min(alvo.pv_temporarios, danoFinal) : 0
  return { danoFinal, absorvidoTemporario, modificador }
}

interface AlvoCura {
  pv_atual: number
  pv_maximo: number
}

export function aplicarCura(valor: number, alvo: AlvoCura): { pvFinal: number; curaEfetiva: number } {
  const pvFinal = Math.min(alvo.pv_maximo, alvo.pv_atual + valor)
  const curaEfetiva = pvFinal - alvo.pv_atual
  return { pvFinal, curaEfetiva }
}

export function consumirEspaco(
  espacos: EspacosMagiaBatalha,
  nivel: number
): { novosEspacos: EspacosMagiaBatalha; ok: boolean } {
  const espaco = espacos[nivel]
  if (!espaco || espaco.utilizados >= espaco.total) {
    return { novosEspacos: espacos, ok: false }
  }
  return {
    novosEspacos: { ...espacos, [nivel]: { ...espaco, utilizados: espaco.utilizados + 1 } },
    ok: true,
  }
}
