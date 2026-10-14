'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ScrollText, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Spell } from '@/types/dnd'
import type { MagiaImportada } from '@/lib/magias/validar-importacao'

type Etapa =
  | { tipo: 'colar' }
  | { tipo: 'conferir'; magia: MagiaImportada }
  | { tipo: 'pronto'; magia: Spell; duplicada: boolean }

export function ImportadorMagia({ campanhaId, onAdicionarAFicha }: {
  campanhaId: string
  onAdicionarAFicha?: (magia: Spell) => Promise<void> | void
}) {
  const [aberto, setAberto] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'colar' })
  const [textoColado, setTextoColado] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setAberto(false)
    setEtapa({ tipo: 'colar' })
    setTextoColado('')
    setErro(null)
  }

  async function chamar(url: string, corpo: unknown) {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const json = await resp.json().catch(() => ({}))
    return { ok: resp.ok, json }
  }

  async function extrair() {
    setCarregando(true)
    setErro(null)
    try {
      const { ok, json } = await chamar('/api/magias/extrair', { texto: textoColado })
      if (!ok) { setErro(json.erro ?? 'Erro ao ler a magia'); return }
      setEtapa({ tipo: 'conferir', magia: json.magia })
    } catch {
      setErro('Sem conexão. Tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  async function confirmar(magia: MagiaImportada) {
    setCarregando(true)
    setErro(null)
    try {
      const { ok, json } = await chamar('/api/magias/importar', { magia, campanhaId })
      if (!ok) { setErro(json.erro ?? 'Erro ao importar a magia'); return }
      if (json.duplicada) toast('Essa magia já existe no compêndio', { icon: 'ℹ️' })
      else toast.success(`${magia.name_pt} importada para a mesa!`)
      setEtapa({ tipo: 'pronto', magia: json.magia as Spell, duplicada: json.duplicada === true })
    } catch {
      setErro('Sem conexão. Tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  const botaoPrimario = 'flex-1 py-2.5 bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] rounded font-cinzel text-sm disabled:opacity-50'
  const botaoSecundario = 'flex-1 py-2.5 border border-[var(--border)] rounded text-[var(--text2)] text-sm font-cinzel'

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="no-print w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 border border-[var(--border)] text-[var(--text2)] rounded text-sm font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <ScrollText className="w-4 h-4" /> Importar magia
      </button>

      {aberto && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70" onClick={fechar}>
          <div
            className="bg-[var(--bg2)] border border-[var(--gold)] rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-cinzel text-[var(--gold)] text-base font-bold">Importar magia</h3>
              <button onClick={fechar} className="text-[var(--border)] hover:text-[var(--text)] p-1" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            {etapa.tipo === 'colar' && (
              <>
                <p className="text-[var(--text3)] text-xs font-crimson mb-2">
                  Cole o texto da magia (português ou inglês). A IA preenche os campos e você confere antes de salvar.
                  A magia fica disponível para toda a mesa.
                </p>
                <textarea
                  value={textoColado}
                  onChange={e => setTextoColado(e.target.value)}
                  rows={9}
                  maxLength={8000}
                  placeholder="Bola de Fogo&#10;3º nível, evocação&#10;Tempo de conjuração: 1 ação..."
                  className="input-dd w-full text-base sm:text-sm"
                />
                {erro && <p role="alert" className="text-[var(--red2)] text-sm font-crimson mt-2">{erro}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={fechar} className={botaoSecundario}>Cancelar</button>
                  <button onClick={extrair} disabled={!textoColado.trim() || carregando} className={botaoPrimario}>
                    {carregando ? 'Lendo...' : 'Ler magia'}
                  </button>
                </div>
              </>
            )}

            {etapa.tipo === 'conferir' && (
              <>
                <div className="bg-[var(--bg3)] border border-[var(--border)] rounded p-3 space-y-1">
                  <p className="font-cinzel text-[var(--accent2)] text-lg leading-tight">{etapa.magia.name_pt}</p>
                  <p className="text-[var(--text2)] text-sm font-crimson">
                    {etapa.magia.level === 0 ? 'Truque' : `${etapa.magia.level}º nível`} de {etapa.magia.school_pt}
                    {etapa.magia.concentration && ' · Concentração'}{etapa.magia.ritual && ' · Ritual'}
                  </p>
                  <p className="text-[var(--text3)] text-xs font-crimson">
                    {etapa.magia.casting_time_pt} · {etapa.magia.range_pt} · {etapa.magia.components_pt} · {etapa.magia.duration_pt}
                  </p>
                  <p className="text-[var(--text2)] text-sm font-crimson whitespace-pre-wrap max-h-40 overflow-y-auto pt-1">
                    {etapa.magia.description_pt}
                  </p>
                </div>
                {erro && <p role="alert" className="text-[var(--red2)] text-sm font-crimson mt-2">{erro}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setEtapa({ tipo: 'colar' }); setErro(null) }} className={botaoSecundario}>Voltar</button>
                  <button onClick={() => confirmar(etapa.magia)} disabled={carregando} className={botaoPrimario}>
                    {carregando ? 'Salvando...' : 'Importar'}
                  </button>
                </div>
              </>
            )}

            {etapa.tipo === 'pronto' && (
              <>
                <p role="status" className={etapa.duplicada ? 'text-[var(--gold)] font-crimson' : 'text-[var(--green2,var(--accent2))] font-crimson'}>
                  {etapa.duplicada
                    ? `Essa magia já existe no compêndio (${etapa.magia.name_pt}). Nada foi alterado.`
                    : `${etapa.magia.name_pt} foi importada e já está disponível para toda a mesa.`}
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={fechar} className={botaoSecundario}>Fechar</button>
                  {onAdicionarAFicha && (
                    <button
                      onClick={async () => { await onAdicionarAFicha(etapa.magia); fechar() }}
                      className={botaoPrimario}
                    >
                      Adicionar à ficha
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
