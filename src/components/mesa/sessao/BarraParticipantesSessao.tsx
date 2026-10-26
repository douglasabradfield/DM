import type { Personagem } from '@/types/dnd'
import { Avatar } from '../ui/Avatar'

// =============================================================================
// Modo sessão — fora de combate. Cartão do PJ editável (PV, PV temp,
// condições, inspiração, espaços de magia) e rodapé com ✨ Magia · 🎒 Item ·
// 💰 Ouro · 🛏️ Descanso, tudo via /api/mesa/acao (sem alvo, sem turno).
// =============================================================================

export function BarraParticipantesSessao({
  personagens, meuPersonagemIds, personagemOperadoId,
}: {
  personagens: Personagem[]
  meuPersonagemIds: Set<string>
  personagemOperadoId: string | null
}) {
  return (
    <div className="flex-shrink-0 flex items-stretch gap-2 overflow-x-auto px-3 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
      {personagens.map(p => {
        const ehOperado = p.id === personagemOperadoId
        const ehMeu = meuPersonagemIds.has(p.id)
        const anel = ehOperado
          ? '0 0 0 2px var(--gold)'
          : ehMeu
            ? '0 0 0 2px var(--accent2)'
            : '0 0 0 1px var(--border)'
        return (
          <div key={p.id} className="flex-shrink-0 flex flex-col items-center gap-0.5 w-14">
            <div className="rounded-full p-0.5" style={{ boxShadow: anel }}>
              <Avatar nome={p.nome} imagemUrl={p.imagem_url} tamanho={44} />
            </div>
            <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{p.nome}</span>
          </div>
        )
      })}
    </div>
  )
}
