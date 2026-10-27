'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ModalCompendioItens, type ItemCompendioEscolhido } from '@/components/personagem/ModalCompendioItens'
import type { InventarioItemDb } from '@/types/dnd'
import type { ContextoAcao, Destinatario } from '../tipos'
import { iconeItem } from '../helpers'
import { useInventario } from '../inventario/useInventario'
import { Avatar } from '../ui/Avatar'

// 🎒 Item — lista do inventário. Fase 3: só registra o uso no log e aplica
// cura se o jogador informar um valor (poção). Sem decremento de
// quantidade nem transferência — isso é Fase 4.

export function ModalItem({
  personagemId, campanhaId, ehDM, contexto, destinatarios, onFechar,
}: {
  personagemId: string
  campanhaId: string
  ehDM: boolean
  contexto: ContextoAcao
  destinatarios: Destinatario[]
  onFechar: () => void
}) {
  const [itemEscolhido, setItemEscolhido] = useState<InventarioItemDb | null>(null)
  const [vista, setVista] = useState<'detalhe' | 'usar' | 'dar'>('detalhe')
  const [cura, setCura] = useState('')
  const [compendioAberto, setCompendioAberto] = useState(false)
  const inventario = useInventario({ personagemId, contexto })
  const { carregando, itens, enviando } = inventario

  async function usar() {
    if (!itemEscolhido) return
    if (await inventario.usar(itemEscolhido, parseInt(cura) || 0)) setItemEscolhido(null)
  }

  async function darPara(destino: Destinatario) {
    if (!itemEscolhido) return
    if (await inventario.passar(itemEscolhido, destino, 1)) setItemEscolhido(null)
  }

  async function equipar(equipado: boolean) {
    if (!itemEscolhido) return
    if (await inventario.equipar(itemEscolhido, equipado)) setItemEscolhido(prev => prev ? { ...prev, equipado } : prev)
  }

  async function descartar() {
    if (!itemEscolhido) return
    if (await inventario.descartar(itemEscolhido)) setItemEscolhido(null)
  }

  async function acrescentar(item: ItemCompendioEscolhido) {
    setCompendioAberto(false)
    await inventario.acrescentar(item)
  }

  function abrirItem(item: InventarioItemDb) {
    setItemEscolhido(item)
    setVista('detalhe')
    setCura('')
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {!itemEscolhido ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">🎒 Inventário</h3>
              <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            {carregando ? (
              <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Carregando...</p>
            ) : itens.length === 0 ? (
              <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Inventário vazio</p>
            ) : (
              <div className="space-y-1">
                {itens.map(item => (
                  <button
                    key={item.id}
                    onClick={() => abrirItem(item)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
                  >
                    <span className="text-base flex-shrink-0">{iconeItem(item.tipo)}</span>
                    <span className="text-[var(--text)] text-sm font-crimson truncate flex-1">
                      {item.nome}{item.equipado && <span className="text-[var(--accent2)] text-[10px] ml-1">(equipado)</span>}
                    </span>
                    <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">×{item.quantidade}</span>
                  </button>
                ))}
              </div>
            )}
            {!carregando && (
              <button
                onClick={() => setCompendioAberto(true)}
                disabled={enviando}
                className="w-full mt-3 py-2.5 rounded-lg border border-dashed border-[var(--accent)]/50 text-[var(--accent)] font-cinzel text-xs min-h-[44px] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-50"
              >
                + Acrescentar do compêndio
              </button>
            )}
            {compendioAberto && (
              <ModalCompendioItens
                campanhaId={campanhaId}
                ehDM={ehDM}
                onEscolher={acrescentar}
                onFechar={() => setCompendioAberto(false)}
              />
            )}
          </>
        ) : vista === 'dar' ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setVista('detalhe')} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate flex-1">Dar {itemEscolhido.nome}</h3>
            </div>
            {destinatarios.length === 0 ? (
              <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Ninguém mais para receber agora.</p>
            ) : (
              <>
                <p className="text-[var(--text3)] text-[11px] font-crimson mb-2">Toque em quem vai receber</p>
                <div className="grid grid-cols-4 gap-2">
                  {destinatarios.map(d => (
                    <button
                      key={d.id}
                      disabled={enviando}
                      onClick={() => darPara(d)}
                      className="flex flex-col items-center gap-1 disabled:opacity-40"
                    >
                      <Avatar nome={d.nome} imagemUrl={d.imagemUrl} tamanho={44} />
                      <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{d.nome}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : vista === 'usar' ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setVista('detalhe')} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate flex-1">Usar {itemEscolhido.nome}</h3>
            </div>
            <label className="block mb-3">
              <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase block mb-1">Cura aplicada (se for poção — opcional)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={cura}
                onChange={e => setCura(e.target.value)}
                placeholder="0"
                className="input-dd w-full text-center text-lg py-2"
                autoFocus
              />
            </label>
            <button
              onClick={usar}
              disabled={enviando}
              className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-50"
            >
              Registrar uso
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setItemEscolhido(null)} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
              <div className="min-w-0 flex-1">
                <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">{itemEscolhido.nome}</h3>
                {itemEscolhido.raridade && <p className="text-[var(--text3)] text-[10px] font-cinzel">{itemEscolhido.raridade}</p>}
              </div>
              <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            {itemEscolhido.descricao && (
              <p className="text-[var(--text2)] text-xs font-crimson leading-relaxed mb-3">{itemEscolhido.descricao}</p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setVista('usar')}
                disabled={enviando}
                className="py-2.5 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-xs font-bold min-h-[44px] disabled:opacity-50"
              >
                Usar
              </button>
              <button
                onClick={() => setVista('dar')}
                disabled={enviando}
                className="py-2.5 rounded-lg border border-[var(--accent2)]/50 text-[var(--accent2)] font-cinzel text-xs min-h-[44px] disabled:opacity-50"
              >
                Dar
              </button>
              <button
                onClick={() => equipar(!itemEscolhido.equipado)}
                disabled={enviando}
                className="py-2.5 rounded-lg border border-[var(--border)] text-[var(--text2)] font-cinzel text-xs min-h-[44px] disabled:opacity-50"
              >
                {itemEscolhido.equipado ? 'Desequipar' : 'Equipar'}
              </button>
              <button
                onClick={descartar}
                disabled={enviando}
                className="py-2.5 rounded-lg border border-[var(--red2)]/50 text-[var(--red2)] font-cinzel text-xs min-h-[44px] disabled:opacity-50"
              >
                Descartar
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
