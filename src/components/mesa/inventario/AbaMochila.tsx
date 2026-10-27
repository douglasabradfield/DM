'use client'

import { useMemo, useState } from 'react'
import { ModalCompendioItens, type ItemCompendioEscolhido } from '@/components/personagem/ModalCompendioItens'
import { cn } from '@/lib/utils'
import type { InventarioItemDb, Moedas } from '@/types/dnd'
import type { ContextoAcao, Destinatario } from '../tipos'
import { MOEDAS } from '../constantes'
import { Avatar } from '../ui/Avatar'
import { useInventario } from './useInventario'

type Filtro = 'itens' | 'equipado'

const ROTULO_TIPO: Record<string, string> = {
  arma: 'Arma', armadura: 'Armadura', magico: 'Item mágico', equipamento: 'Equipamento',
}

// O banco não tem campo de "consumível" nem de "foco de conjuração": armas e
// armaduras não são usadas (só equipadas); o resto aceita "Usar".
const ehUsavel = (item: InventarioItemDb) => item.tipo !== 'arma' && item.tipo !== 'armadura'
const categoria = (item: InventarioItemDb) => item.equipado ? 'Equipado' : ROTULO_TIPO[item.tipo ?? ''] ?? 'Item'

const CLASSE_BOTAO_ACAO = 'min-h-[44px] px-3 rounded-lg font-cinzel text-sm disabled:opacity-40'

// Aba Mochila do celular (abaixo de md). Toda a lógica de usar/passar vem de
// useInventario, a mesma do ModalItem. "Passar" vale sempre; "Usar" só com
// `podeUsar` (no combate, quem pode agir).
export function AbaMochila({
  personagemId, moedas, campanhaId, ehDM, contexto, destinatarios,
  podeUsar, podeMovimentar, onMovimentarOuro, onDistribuir,
}: {
  personagemId: string
  moedas: Moedas | null
  campanhaId: string
  ehDM: boolean
  contexto: ContextoAcao
  destinatarios: Destinatario[]
  podeUsar: boolean
  podeMovimentar: boolean
  onMovimentarOuro: () => void
  onDistribuir: () => void
}) {
  const inventario = useInventario({ personagemId, contexto, nomeCanal: `aba-mochila-${personagemId}` })
  const { carregando, itens, enviando } = inventario
  const [filtro, setFiltro] = useState<Filtro>('itens')
  const [compendioAberto, setCompendioAberto] = useState(false)
  const [passo, setPasso] = useState<{ tipo: 'usar' | 'passar'; item: InventarioItemDb } | null>(null)
  const [cura, setCura] = useState('')
  const [quantidade, setQuantidade] = useState('1')

  const chipMoedas = MOEDAS
    .map(m => ({ id: m.id, valor: moedas?.[m.id] ?? 0 }))
    .filter(m => m.valor > 0)
    .map(m => `${m.valor} ${m.id.toUpperCase()}`)
    .join(' · ')

  const visiveis = useMemo(
    () => itens.filter(i => filtro === 'itens' || i.equipado),
    [itens, filtro]
  )

  function abrirPasso(tipo: 'usar' | 'passar', item: InventarioItemDb) {
    setCura('')
    setQuantidade('1')
    setPasso({ tipo, item })
  }

  async function confirmarUso() {
    if (!passo) return
    if (await inventario.usar(passo.item, parseInt(cura) || 0)) setPasso(null)
  }

  async function confirmarPassagem(destino: Destinatario) {
    if (!passo) return
    const qtd = Math.min(Math.max(parseInt(quantidade) || 1, 1), passo.item.quantidade)
    if (await inventario.passar(passo.item, destino, qtd)) setPasso(null)
  }

  async function acrescentar(item: ItemCompendioEscolhido) {
    setCompendioAberto(false)
    await inventario.acrescentar(item)
  }

  // Teclado virtual: depois que ele abre, traz o campo para o meio da tela.
  const rolarParaCampo = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }

  if (passo) {
    const { item } = passo
    return (
      <div className="flex flex-col gap-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-left">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPasso(null)}
            aria-label="Voltar"
            className="min-w-[44px] min-h-[44px] text-[var(--text2)] text-lg"
          >←</button>
          <h2 className="font-cinzel text-[var(--gold)] font-bold text-lg truncate">
            {passo.tipo === 'usar' ? 'Usar' : 'Passar'} {item.nome}
          </h2>
        </div>

        {passo.tipo === 'usar' ? (
          <>
            <label className="block">
              <span className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Cura aplicada (se for poção — opcional)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={cura}
                onChange={e => setCura(e.target.value)}
                onFocus={rolarParaCampo}
                placeholder="0"
                className="input-dd w-full text-center text-lg min-h-[48px]"
              />
            </label>
            <button
              type="button"
              onClick={confirmarUso}
              disabled={enviando}
              className="w-full min-h-[48px] rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold disabled:opacity-50"
            >
              Registrar uso
            </button>
          </>
        ) : (
          <>
            {item.quantidade > 1 && (
              <label className="block">
                <span className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Quantidade (você tem {item.quantidade})</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={item.quantidade}
                  value={quantidade}
                  onChange={e => setQuantidade(e.target.value)}
                  onFocus={rolarParaCampo}
                  className="input-dd w-full text-center text-lg min-h-[48px]"
                />
              </label>
            )}
            {destinatarios.length === 0 ? (
              <p className="text-[var(--text3)] text-sm font-crimson text-center py-4">Ninguém mais para receber agora.</p>
            ) : (
              <>
                <p className="text-[var(--text3)] text-xs font-crimson">Toque em quem vai receber</p>
                <div className="grid grid-cols-4 gap-2">
                  {destinatarios.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      disabled={enviando}
                      onClick={() => confirmarPassagem(d)}
                      className="flex flex-col items-center gap-1 min-h-[64px] disabled:opacity-40"
                    >
                      <Avatar nome={d.nome} imagemUrl={d.imagemUrl} tamanho={44} />
                      <span className="text-[11px] text-[var(--text3)] truncate w-full text-center font-crimson">{d.nome}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-cinzel text-[var(--gold)] font-bold text-lg">Mochila</h2>
        {chipMoedas && (
          <span className="px-2.5 py-1 rounded-full border border-[var(--gold)] text-[var(--gold)] text-xs font-cinzel">
            {chipMoedas}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCompendioAberto(true)}
          disabled={!podeMovimentar || enviando}
          className={cn(CLASSE_BOTAO_ACAO, 'flex-1 border border-[var(--gold)] text-[var(--gold)]')}
        >
          Acrescentar item
        </button>
        <button
          type="button"
          onClick={onMovimentarOuro}
          disabled={!podeMovimentar}
          className={cn(CLASSE_BOTAO_ACAO, 'flex-1 border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)]')}
        >
          Movimentar ouro
        </button>
      </div>
      {ehDM && (
        <button
          type="button"
          onClick={onDistribuir}
          disabled={!podeMovimentar}
          className={cn(CLASSE_BOTAO_ACAO, 'w-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)]')}
        >
          Distribuir tesouro
        </button>
      )}

      <div className="flex rounded-lg border border-[var(--border)] overflow-hidden" role="tablist">
        {(['itens', 'equipado'] as const).map(f => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filtro === f}
            onClick={() => setFiltro(f)}
            className={cn(
              'flex-1 min-h-[44px] font-cinzel text-sm',
              filtro === f ? 'bg-[var(--gold)] text-[var(--bg)] font-bold' : 'bg-[var(--surface)] text-[var(--text2)]'
            )}
          >
            {f === 'itens' ? 'Itens' : 'Equipado'}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="text-[var(--text3)] text-sm font-crimson text-center py-4">Carregando...</p>
      ) : visiveis.length === 0 ? (
        <p className="text-[var(--text3)] text-sm font-crimson text-center py-4">
          {filtro === 'equipado' ? 'Nada equipado' : 'Mochila vazia'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visiveis.map(item => (
            <li
              key={item.id}
              className="flex items-center gap-2 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] min-h-[60px]"
            >
              <span className="w-8 flex-shrink-0 text-[var(--text2)] font-cinzel text-sm">{item.quantidade}×</span>
              <div className="min-w-0 flex-1">
                <p className="text-[var(--text)] font-crimson font-bold text-base truncate">{item.nome}</p>
                <p className="text-[var(--text3)] font-crimson text-xs">{categoria(item)}</p>
              </div>
              {ehUsavel(item) && (
                <button
                  type="button"
                  onClick={() => abrirPasso('usar', item)}
                  disabled={!podeUsar || enviando}
                  className="min-h-[44px] min-w-[56px] px-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold disabled:opacity-40"
                >
                  Usar
                </button>
              )}
              <button
                type="button"
                onClick={() => abrirPasso('passar', item)}
                disabled={enviando}
                className="min-h-[44px] min-w-[64px] px-3 rounded-lg border border-[var(--accent2)]/50 text-[var(--accent2)] font-cinzel text-sm disabled:opacity-40"
              >
                Passar
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[var(--text3)] text-xs font-crimson text-center">
        Passar item ou ouro vale a qualquer hora, inclusive em combate.
      </p>

      {compendioAberto && (
        <ModalCompendioItens
          campanhaId={campanhaId}
          ehDM={ehDM}
          onEscolher={acrescentar}
          onFechar={() => setCompendioAberto(false)}
        />
      )}
    </div>
  )
}
