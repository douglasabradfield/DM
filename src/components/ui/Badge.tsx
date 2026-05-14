import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variante?: 'padrao' | 'perigo' | 'cura' | 'ouro' | 'roxo' | 'info'
  className?: string
  onClick?: () => void
}

export function Badge({ children, variante = 'padrao', className, onClick }: BadgeProps) {
  const variantes = {
    padrao: 'bg-[#261a2e] border-[#4a3060] text-[#b8a8cc]',
    perigo: 'bg-[#c0392b]/20 border-[#e74c3c]/50 text-[#e74c3c]',
    cura: 'bg-[#1a6b3a]/20 border-[#27ae60]/50 text-[#27ae60]',
    ouro: 'bg-[#d4a843]/20 border-[#d4a843]/50 text-[#d4a843]',
    roxo: 'bg-[#9b59b6]/20 border-[#9b59b6]/50 text-[#c39bd3]',
    info: 'bg-[#2980b9]/20 border-[#3498db]/50 text-[#5dade2]',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border font-crimson',
        variantes[variante],
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onClick}
    >
      {children}
    </span>
  )
}
