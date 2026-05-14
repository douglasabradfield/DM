'use client'

import { useBatalha } from '@/store/batalha'
import type { EspacosMagiaBatalha } from '@/types/batalha'

interface EspacosMagiaProps {
  combatenteId: string
  espacos: EspacosMagiaBatalha
}

export function EspacosMagia({ combatenteId, espacos }: EspacosMagiaProps) {
  const { usarEspaco, recuperarEspaco } = useBatalha()

  const niveisComEspacos = Object.entries(espacos)
    .filter(([, e]) => e.total > 0)
    .map(([nivel, e]) => ({ nivel: parseInt(nivel), ...e }))

  if (niveisComEspacos.length === 0) return null

  return (
    <div className="space-y-1">
      {niveisComEspacos.map(({ nivel, total, utilizados }) => (
        <div key={nivel} className="flex items-center gap-1">
          <span className="text-[#8870a8] text-[10px] w-4 text-center font-cinzel">{nivel}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => {
              const usado = i < utilizados
              return (
                <button
                  key={i}
                  onClick={() => usado ? recuperarEspaco(combatenteId, nivel) : usarEspaco(combatenteId, nivel)}
                  className={`w-3 h-3 rounded-full border transition-all ${
                    usado
                      ? 'bg-transparent border-[#4a3060]'
                      : 'bg-[#9b59b6] border-[#c39bd3]'
                  } hover:scale-125`}
                  title={`Nível ${nivel}: ${total - utilizados}/${total} disponíveis`}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
