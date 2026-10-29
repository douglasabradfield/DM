// Chave estável de uma lista de ids: ordenada, sem repetidos. Mesma lista em
// qualquer ordem/referência gera a mesma chave (dependência segura de effect).
export function chaveDeIds(ids: string[]): string {
  return Array.from(new Set(ids)).sort().join(',')
}

// Nome de canal Realtime único por instância do hook. O supabase.channel(nome)
// devolve o canal já assinado quando o nome se repete, e um .on() depois do
// .subscribe() lança erro — por isso o nome nunca depende só dos dados.
export function nomeCanalUnico(prefixo: string, chave: string, instancia: string): string {
  return `${prefixo}-${chave.slice(0, 80)}-${instancia}`
}
