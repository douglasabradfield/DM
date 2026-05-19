'use client'

import { usePlanoEfetivo } from '@/hooks/usePlanoEfetivo'
import { planoSuficiente } from '@/lib/planos'
import { GaleriaImagens } from '@/components/galeria/GaleriaImagens'
import { BloqueioPlano } from '@/components/ui/BloqueioPlano'

export default function ImagensPage() {
  const planoEfetivo = usePlanoEfetivo()

  if (!planoSuficiente(planoEfetivo, 'guild_master')) {
    return <BloqueioPlano recurso="Imagens" planoNecessario="Guilda" />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg2)]">
        <h1 className="font-cinzel text-[var(--gold)] text-lg font-bold">🖼️ Galeria de Imagens</h1>
        <p className="text-[var(--text3)] text-xs font-crimson mt-0.5">Ilustrações, arte de personagens e referências visuais da campanha</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <GaleriaImagens tipo="imagem" />
      </div>
    </div>
  )
}
