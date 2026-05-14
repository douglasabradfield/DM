import { cn } from '@/lib/utils'

interface DivisorOrnamentadoProps {
  className?: string
  texto?: string
}

export function DivisorOrnamentado({ className, texto }: DivisorOrnamentadoProps) {
  return (
    <div className={cn('flex items-center gap-3 my-4', className)}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#4a3060]" />
      <div className="flex items-center gap-1 text-[#d4a843]">
        <span className="text-xs">✦</span>
        {texto && <span className="font-cinzel text-xs text-[#b8a8cc] uppercase tracking-widest px-1">{texto}</span>}
        <span className="text-xs">✦</span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#4a3060]" />
    </div>
  )
}
