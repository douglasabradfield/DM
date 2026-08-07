// Aviso informativo derivado das condições ativas — a mesa decide, o
// toggle manual de vantagem/desvantagem é que vale de fato.
//
// Exaustão fica de fora de propósito: o app rastreia a condição de forma
// binária (só "Exaustão" na lista, sem nível de 1 a 6) e a regra de
// desvantagem em ataques só vale a partir do nível 3. Um aviso que pode
// estar errado é pior que nenhum aviso.
// Agarrado e Enfeitiçado também ficam de fora: não têm efeito direto de
// rolagem em ataques.
// "Restringido" (regra 5e) é a condição "Impedido" nesta base.

type Rolagem = 'vantagem' | 'desvantagem'

interface RegraCondicao {
  nosAtaques?: Rolagem
  contraEle?: Rolagem
  rotulo: string
}

const REGRAS: Record<string, RegraCondicao> = {
  'Cego': { nosAtaques: 'desvantagem', contraEle: 'vantagem', rotulo: 'Cego' },
  'Amedrontado': { nosAtaques: 'desvantagem', rotulo: 'Amedrontado (enquanto vê a fonte)' },
  'Envenenado': { nosAtaques: 'desvantagem', rotulo: 'Envenenado' },
  'Caído': { nosAtaques: 'desvantagem', contraEle: 'vantagem', rotulo: 'Caído (corpo a corpo — à distância é desvantagem)' },
  'Paralisado': { contraEle: 'vantagem', rotulo: 'Paralisado' },
  'Inconsciente': { contraEle: 'vantagem', rotulo: 'Inconsciente' },
  'Petrificado': { contraEle: 'vantagem', rotulo: 'Petrificado' },
  'Atordoado': { contraEle: 'vantagem', rotulo: 'Atordoado' },
  'Impedido': { nosAtaques: 'desvantagem', contraEle: 'vantagem', rotulo: 'Impedido' },
}

export function vantagemDerivada(condicoes: string[]): {
  nosAtaques: Rolagem | null
  contraEle: Rolagem | null
  motivos: string[]
} {
  const rotulosNosAtaques: string[] = []
  const rotulosContraEle: string[] = []
  let vantagensNosAtaques = 0
  let desvantagensNosAtaques = 0
  let vantagensContraEle = 0
  let desvantagensContraEle = 0

  for (const condicao of condicoes) {
    const regra = REGRAS[condicao]
    if (!regra) continue

    if (regra.nosAtaques === 'vantagem') { vantagensNosAtaques++; rotulosNosAtaques.push(regra.rotulo) }
    if (regra.nosAtaques === 'desvantagem') { desvantagensNosAtaques++; rotulosNosAtaques.push(regra.rotulo) }
    if (regra.contraEle === 'vantagem') { vantagensContraEle++; rotulosContraEle.push(regra.rotulo) }
    if (regra.contraEle === 'desvantagem') { desvantagensContraEle++; rotulosContraEle.push(regra.rotulo) }
  }

  // Vantagem e desvantagem da mesma rolagem se anulam (regra 5e).
  const nosAtaques: Rolagem | null =
    vantagensNosAtaques > 0 && desvantagensNosAtaques > 0 ? null
    : vantagensNosAtaques > 0 ? 'vantagem'
    : desvantagensNosAtaques > 0 ? 'desvantagem'
    : null

  const contraEle: Rolagem | null =
    vantagensContraEle > 0 && desvantagensContraEle > 0 ? null
    : vantagensContraEle > 0 ? 'vantagem'
    : desvantagensContraEle > 0 ? 'desvantagem'
    : null

  const motivos: string[] = []
  if (nosAtaques) {
    const rotulo = nosAtaques === 'vantagem' ? 'Vantagem' : 'Desvantagem'
    motivos.push(`${rotulo} nos seus ataques — ${rotulosNosAtaques.join(', ')}`)
  }
  if (contraEle) {
    motivos.push(`Ataques contra você têm ${contraEle} — ${rotulosContraEle.join(', ')}`)
  }

  return { nosAtaques, contraEle, motivos }
}
