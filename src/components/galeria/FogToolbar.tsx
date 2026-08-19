'use client'

import { cn } from '@/lib/utils'
import type { ModoPincel, TamanhoPincel } from '@/hooks/useFogPincel'

interface FogToolbarProps {
  fogAtivo: boolean
  percentual: number
  processando: boolean
  salvando: boolean
  modoPincel: ModoPincel
  onModoPincel: (m: ModoPincel) => void
  tamanhoPincel: TamanhoPincel
  onTamanhoPincel: (t: TamanhoPincel) => void
  verComoJogador: boolean
  onVerComoJogador: (v: boolean) => void
  onAtivar: () => void
  onDesativar: () => void
  onRevelarTudo: () => void
  onOcultarTudo: () => void
}

const TAMANHOS: { id: TamanhoPincel; label: string }[] = [
  { id: 'pequeno', label: 'P' },
  { id: 'medio', label: 'M' },
  { id: 'grande', label: 'G' },
]

// Barra de ferramentas do fog of war — só renderizada para o DM em imagens
// tipo='mapa'. Layout em pills com flex-wrap: em 360px ela quebra em duas
// linhas em vez de estourar a largura da tela.
export function FogToolbar({
  fogAtivo, percentual, processando, salvando,
  modoPincel, onModoPincel, tamanhoPincel, onTamanhoPincel,
  verComoJogador, onVerComoJogador,
  onAtivar, onDesativar, onRevelarTudo, onOcultarTudo,
}: FogToolbarProps) {
  if (!fogAtivo) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-2 flex-shrink-0 bg-black/40 flex-wrap">
        <button
          onClick={onAtivar}
          disabled={processando}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-cinzel bg-[var(--accent)] text-[var(--bg)] disabled:opacity-50"
        >
          🌫️ {processando ? 'Ativando...' : 'Ativar névoa de guerra'}
        </button>
      </div>
    )
  }

  if (verComoJogador) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-2 flex-shrink-0 bg-black/40 flex-wrap">
        <span className="text-white/70 text-xs font-crimson">👁️ Modo jogador — {percentual}% revelado</span>
        <button
          onClick={() => onVerComoJogador(false)}
          className="px-3 py-2 rounded-full text-xs font-cinzel bg-white/10 text-white/70"
        >
          Voltar ao modo mestre
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1.5 px-2 py-2 flex-shrink-0 bg-black/40 flex-wrap">
      <button
        onClick={() => onModoPincel(modoPincel === 'revelar' ? null : 'revelar')}
        title="Revelar — arrastar pinta"
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-cinzel transition-colors',
          modoPincel === 'revelar' ? 'bg-[var(--green2)] text-[var(--bg)]' : 'bg-white/10 text-white/70'
        )}
      >
        🔦 Revelar
      </button>
      <button
        onClick={() => onModoPincel(modoPincel === 'ocultar' ? null : 'ocultar')}
        title="Ocultar — arrastar pinta"
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-cinzel transition-colors',
          modoPincel === 'ocultar' ? 'bg-[var(--accent)] text-[var(--bg)]' : 'bg-white/10 text-white/70'
        )}
      >
        🌑 Ocultar
      </button>

      <div className="flex items-center gap-0.5 bg-white/10 rounded-full p-0.5" title="Tamanho do pincel">
        {TAMANHOS.map(t => (
          <button
            key={t.id}
            onClick={() => onTamanhoPincel(t.id)}
            className={cn(
              'w-6 h-6 rounded-full text-[10px] font-cinzel transition-colors',
              tamanhoPincel === t.id ? 'bg-[var(--gold)] text-[var(--bg)]' : 'text-white/60'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <span className="text-white/50 text-[10px] font-crimson px-1">
        {salvando ? 'salvando...' : `${percentual}% revelado`}
      </span>

      <button
        onClick={onRevelarTudo}
        disabled={processando}
        title="Revelar o mapa inteiro"
        className="px-2.5 py-1.5 rounded-full text-[11px] font-cinzel bg-white/10 text-white/70 disabled:opacity-50"
      >
        ☀️ Tudo
      </button>
      <button
        onClick={onOcultarTudo}
        disabled={processando}
        title="Ocultar o mapa inteiro"
        className="px-2.5 py-1.5 rounded-full text-[11px] font-cinzel bg-white/10 text-white/70 disabled:opacity-50"
      >
        🌑 Tudo
      </button>
      <button
        onClick={() => onVerComoJogador(true)}
        title="Conferir como os jogadores veem"
        className="px-2.5 py-1.5 rounded-full text-[11px] font-cinzel bg-white/10 text-white/70"
      >
        👁️ Jogador
      </button>
      <button
        onClick={onDesativar}
        disabled={processando}
        title="Desativar a névoa de guerra nesta imagem"
        className="px-2.5 py-1.5 rounded-full text-[11px] font-cinzel bg-[var(--red2)]/20 text-[var(--red2)] disabled:opacity-50"
      >
        ✖ Névoa
      </button>
    </div>
  )
}
