import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function rolarDado(lados: number): number {
  return Math.floor(Math.random() * lados) + 1
}

export function rolarExpressao(expressao: string): { total: number; detalhes: string } {
  const match = expressao.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
  if (!match) return { total: 0, detalhes: 'Expressão inválida' }

  const quantidade = parseInt(match[1])
  const lados = parseInt(match[2])
  const operador = match[3]
  const modificador = match[4] ? parseInt(match[4]) : 0

  const resultados: number[] = []
  for (let i = 0; i < quantidade; i++) {
    resultados.push(rolarDado(lados))
  }

  const soma = resultados.reduce((a, b) => a + b, 0)
  let total = soma
  if (operador === '+') total = soma + modificador
  if (operador === '-') total = soma - modificador

  const detalhes = `[${resultados.join(', ')}]${operador ? ` ${operador} ${modificador}` : ''} = ${total}`
  return { total, detalhes }
}

export function calcularModificadorAtributo(valor: number): number {
  return Math.floor((valor - 10) / 2)
}

export function formatarModificador(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}
