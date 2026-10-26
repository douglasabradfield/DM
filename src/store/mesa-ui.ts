import { create } from 'zustand'

export type AbaMesa = 'personagem' | 'magias' | 'mochila' | 'mapa'

interface EstadoMesaUi {
  abaAtiva: AbaMesa
  setAba: (aba: AbaMesa) => void
}

// Não persistido — reseta ao recarregar, como o store da batalha.
export const useMesaUi = create<EstadoMesaUi>((set) => ({
  abaAtiva: 'personagem',
  setAba: (aba) => set({ abaAtiva: aba }),
}))
