interface ComDatas {
  liberado_em?: string | null
  criado_em: string
}

// Mais recém-liberada primeiro. Sem liberado_em (liberadas antes da coluna
// existir) vêm depois, entre si por criado_em desc.
export function compararLiberacao(a: ComDatas, b: ComDatas): number {
  const la = a.liberado_em ? new Date(a.liberado_em).getTime() : null
  const lb = b.liberado_em ? new Date(b.liberado_em).getTime() : null
  if (la !== null && lb !== null && la !== lb) return lb - la
  if (la !== null && lb === null) return -1
  if (la === null && lb !== null) return 1
  return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
}
