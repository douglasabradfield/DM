import { cn } from '@/lib/utils'

// Toggle de três estados — persiste no combatente via API (nenhuma escrita
// direta) e acompanha a próxima ação enviada. O aviso derivado das condições
// (FaixaVantagem é renderizada logo abaixo do cartão que já mostra os
// motivos) continua só informativo: quem decide é sempre a mesa.
export function FaixaVantagem({
  valor, podeAgir, enviando, onEscolher,
}: {
  valor: 'vantagem' | 'desvantagem' | null
  podeAgir: boolean
  enviando: boolean
  onEscolher: (v: 'vantagem' | 'desvantagem' | null) => void
}) {
  const opcoes = [
    { valor: 'desvantagem' as const, label: '▼ Desvantagem', corAtiva: 'var(--red2)' },
    { valor: null, label: 'Normal', corAtiva: 'var(--surface2)' },
    { valor: 'vantagem' as const, label: '▲ Vantagem', corAtiva: 'var(--green2)' },
  ]

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5">
      <div className="flex items-center rounded-lg overflow-hidden border border-[var(--border)]">
        {opcoes.map(opt => {
          const ativa = valor === opt.valor
          return (
            <button
              key={opt.label}
              onClick={() => onEscolher(opt.valor)}
              disabled={!podeAgir || enviando}
              title={podeAgir ? undefined : 'Aguarde sua vez'}
              className={cn(
                'flex-1 text-center py-2 text-[11px] font-cinzel transition-colors min-h-[38px]',
                (!podeAgir || enviando) && 'cursor-not-allowed opacity-60',
                ativa ? 'text-[var(--text)]' : 'text-[var(--text3)]'
              )}
              style={ativa ? { backgroundColor: opt.corAtiva } : undefined}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
