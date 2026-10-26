import { cn } from '@/lib/utils'

export function EspacosMagiaSessao({
  slotsMagia, podeEditar, onUsar, onRecuperar,
}: {
  slotsMagia: Record<string, { total: number; usados: number }> | null
  podeEditar: boolean
  onUsar: (nivel: number) => void
  onRecuperar: (nivel: number) => void
}) {
  const niveis = Object.entries(slotsMagia ?? {})
    .filter(([, e]) => e.total > 0)
    .map(([n, e]) => ({ nivel: parseInt(n), ...e }))
    .sort((a, b) => a.nivel - b.nivel)

  if (niveis.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]">
      {niveis.map(({ nivel, total, usados }) => (
        <div key={nivel} className="flex items-center gap-1">
          <span className="text-[var(--text3)] font-cinzel">N{nivel}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => {
              const usado = i < usados
              return (
                <button
                  key={i}
                  disabled={!podeEditar}
                  onClick={() => usado ? onRecuperar(nivel) : onUsar(nivel)}
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border transition-all',
                    usado ? 'bg-transparent border-[var(--border)]' : 'bg-[var(--accent2)] border-[var(--accent2)]',
                    podeEditar ? 'hover:scale-125' : 'opacity-60 cursor-not-allowed'
                  )}
                  title={`Nível ${nivel}: ${total - usados}/${total} disponíveis`}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
