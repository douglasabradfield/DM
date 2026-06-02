'use client'

import { useBatalha } from '@/store/batalha'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import { cn } from '@/lib/utils'

const iconesTipo: Record<string, string> = {
  // automáticos
  dano:                '💥',
  cura:                '💊',
  condicao:            '⚡',
  morte:               '☠️',
  magia:               '✨',
  iniciativa:          '🎯',
  nota:                '📝',
  sistema:             '⚙️',
  // ação principal
  ataque:              '⚔️',
  ataque_extra:        '⚔️',
  usar_item:           '⚔️',
  ajudar:              '⚔️',
  agarrar:             '⚔️',
  recuar:              '⚔️',
  // ação bônus
  acao_bonus_ataque:   '✨',
  acao_bonus_magia:    '✨',
  cura_bonus:          '💚',
  forma_alternativa:   '✨',
  // reação
  ataque_oportunidade: '🛡️',
  contra_magia:        '🛡️',
  escudo:              '🛡️',
  absorver_elementos:  '🛡️',
  queda_controlada:    '🛡️',
  outra_reacao:        '🛡️',
  // efeitos
  pv_temporarios:      '💚',
  estabilizar:         '💚',
  condicao_aplicada:   '🔮',
  condicao_removida:   '🔮',
  concentracao:        '🔮',
  // genérico
  outro:               '📝',
}

export function LogBatalha() {
  const { log, rodadaAtual } = useBatalha()

  const ultimas = log.slice(-50).reverse()

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#4a3060] flex items-center justify-between">
        <span className="font-cinzel text-[#d4a843] text-xs uppercase tracking-wider">Log de Batalha</span>
        <span className="text-[#8870a8] text-xs">Rodada {rodadaAtual}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {ultimas.length === 0 ? (
          <p className="text-[#4a3060] text-xs text-center py-4 font-crimson">
            Nenhuma ação registrada
          </p>
        ) : (
          ultimas.map(entrada => {
            const infoDano = entrada.tipo_dano ? TIPOS_DANO.find(t => t.id === entrada.tipo_dano) : null
            return (
              <div
                key={entrada.id}
                className={cn(
                  'text-xs p-1.5 rounded border-l-2 bg-[#1e1525] font-crimson',
                  entrada.tipo === 'morte' ? 'border-[#e74c3c]' :
                  entrada.tipo === 'cura' ? 'border-[#27ae60]' :
                  entrada.tipo === 'dano' ? 'border-[#c0392b]' :
                  'border-[#4a3060]'
                )}
              >
                <div className="flex items-center gap-1">
                  <span>{iconesTipo[entrada.tipo]}</span>
                  <span className="text-[#8870a8]">R{entrada.rodada}</span>
                  {infoDano && <span style={{ color: infoDano.cor }}>{infoDano.icone}</span>}
                </div>
                <p className="text-[#b8a8cc] leading-tight">{entrada.descricao}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
