import { compararLiberacao } from '@/lib/imagens-ordem'
import type { ImagemGaleria } from '@/components/galeria/GaleriaImagens'

// Lógica pura do painel Mapa e imagens da /mesa (sem Supabase, sem React).

// Ordem de exibição: liberado_em desc, depois criado_em desc.
export function ordenarImagens(imagens: ImagemGaleria[]): ImagemGaleria[] {
  return imagens.slice().sort(compararLiberacao)
}

// Quem não é o DM da campanha só enxerga o que o mestre liberou.
export function filtrarPorPapel(imagens: ImagemGaleria[], ehDM: boolean): ImagemGaleria[] {
  return ehDM ? imagens : imagens.filter(i => i.visivel_jogadores)
}

export function separarMapasEFotos(imagens: ImagemGaleria[]) {
  return {
    mapas: imagens.filter(i => i.tipo === 'mapa'),
    fotos: imagens.filter(i => i.tipo === 'imagem'),
  }
}

// "Novas" são só as fotos (não os mapas) ainda não abertas pelo usuário.
export function contarNovas(fotos: ImagemGaleria[], vistas: Set<string>): number {
  return fotos.filter(i => !vistas.has(i.id)).length
}

// Mapa escolhido, ou o primeiro da lista se o id não existe mais.
export function escolherMapa(mapas: ImagemGaleria[], mapaId: string | null): ImagemGaleria | null {
  return mapas.find(m => m.id === mapaId) ?? mapas[0] ?? null
}

// Aplica um evento Realtime (INSERT/UPDATE/DELETE) à lista atual.
export function aplicarEventoImagem(
  atual: ImagemGaleria[],
  evento: { tipo: 'DELETE'; id?: string } | { tipo: 'UPSERT'; linha: ImagemGaleria },
  ehDM: boolean,
): ImagemGaleria[] {
  if (evento.tipo === 'DELETE') {
    return evento.id ? atual.filter(i => i.id !== evento.id) : atual
  }
  const { linha } = evento
  if (!linha?.id) return atual
  if (!ehDM && !linha.visivel_jogadores) return atual.filter(i => i.id !== linha.id)
  const existe = atual.some(i => i.id === linha.id)
  const proxima = existe ? atual.map(i => i.id === linha.id ? linha : i) : [linha, ...atual]
  return ordenarImagens(proxima)
}

export function chaveVistas(userId: string, campanhaId: string) {
  return `dd-imagens-vistas:${userId}:${campanhaId}`
}

export function lerVistas(chave: string | null): Set<string> {
  if (!chave) return new Set()
  try {
    const bruto = localStorage.getItem(chave)
    const lista = bruto ? JSON.parse(bruto) : []
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function gravarVistas(chave: string | null, vistas: Set<string>) {
  if (!chave) return
  try {
    localStorage.setItem(chave, JSON.stringify([...vistas]))
  } catch { /* sem localStorage: a tela segue funcionando */ }
}
