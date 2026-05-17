'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useCampanha } from '@/store/campanha'
import { useRouter } from 'next/navigation'
import { FileUp, X } from 'lucide-react'
import toast from 'react-hot-toast'

export function BotaoImportarFicha() {
  const { campanhaAtiva } = useCampanha()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [processando, setProcessando] = useState(false)
  const [modal, setModal] = useState(false)
  const [nomeJogador, setNomeJogador] = useState('')
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)

  function abrirModal() {
    if (!campanhaAtiva) { toast.error('Selecione uma campanha primeiro'); return }
    setModal(true)
  }

  async function importar() {
    if (!arquivoSelecionado || !campanhaAtiva) return
    setProcessando(true)
    try {
      const form = new FormData()
      form.append('arquivo', arquivoSelecionado)

      const resp = await fetch('/api/personagem/importar-ficha', { method: 'POST', body: form })
      const json = await resp.json()

      if (!resp.ok) {
        toast.error(json.erro ?? 'Erro ao importar ficha')
        return
      }

      const dados = json.dados
      const supabase = createClient()
      const { error } = await supabase.from('personagens').insert({
        campanha_id: campanhaAtiva.id,
        nome: dados.nome || 'Personagem Importado',
        jogador_nome: nomeJogador || dados.nome || 'Jogador',
        tipo_personagem: 'jogador',
        nivel: dados.nivel || 1,
        classe: dados.classe || null,
        raca: dados.raca || null,
        antecedente: dados.antecedente || null,
        alinhamento: dados.alinhamento || null,
        pontos_experiencia: dados.pontos_experiencia || 0,
        forca: dados.forca || 10,
        destreza: dados.destreza || 10,
        constituicao: dados.constituicao || 10,
        inteligencia: dados.inteligencia || 10,
        sabedoria: dados.sabedoria || 10,
        carisma: dados.carisma || 10,
        ca: dados.ca || 10,
        iniciativa: dados.iniciativa || 0,
        deslocamento: dados.deslocamento || 9,
        pv_maximo: dados.pv_maximo || 8,
        pv_atual: dados.pv_maximo || 8,
        pv_temporarios: 0,
        bonus_proficiencia: dados.bonus_proficiencia || 2,
        tracos_personalidade: dados.tracos_personalidade || null,
        ideais: dados.ideais || null,
        vinculos: dados.vinculos || null,
        fraquezas: dados.fraquezas || null,
        outras_proficiencias: dados.outras_proficiencias || null,
        caracteristicas_talentos: dados.caracteristicas_talentos || null,
        ataques: [],
        salvaguardas: {},
        pericias: {},
        resistencias: [],
        imunidades: [],
        vulnerabilidades: [],
      })

      if (error) throw error

      toast.success(`${dados.nome || 'Personagem'} importado com sucesso!`)
      setModal(false)
      setArquivoSelecionado(null)
      router.refresh()
    } catch {
      toast.error('Erro ao salvar personagem importado')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <>
      <button
        onClick={abrirModal}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] text-[var(--text2)] rounded text-xs font-cinzel hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <FileUp className="w-3 h-3" /> Importar PDF
      </button>

      {modal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={() => setModal(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--gold)] rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-cinzel text-[var(--gold)] text-base font-bold">Importar Ficha PDF</h3>
              <button onClick={() => setModal(false)} className="text-[var(--border)] hover:text-[var(--text)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[var(--text3)] text-xs font-crimson mb-4">
              Envie uma ficha de personagem em PDF para importar automaticamente via IA.
              Funciona melhor com fichas do D&amp;D Beyond e fichas oficiais digitais.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[var(--text3)] text-xs font-cinzel uppercase block mb-1">Nome do Jogador</label>
                <input
                  type="text"
                  value={nomeJogador}
                  onChange={e => setNomeJogador(e.target.value)}
                  placeholder="João"
                  className="input-dd w-full"
                />
              </div>

              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => setArquivoSelecionado(e.target.files?.[0] ?? null)}
                />
                {!arquivoSelecionado ? (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="w-full border-2 border-dashed border-[var(--border)] rounded-lg p-5 text-center hover:border-[var(--accent)] transition-colors"
                  >
                    <FileUp className="w-6 h-6 mx-auto mb-2 text-[var(--text3)]" />
                    <p className="text-[var(--text3)] text-sm font-crimson">Clique para selecionar PDF</p>
                    <p className="text-[var(--border)] text-xs mt-1">máx. 5 MB</p>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-2 bg-[var(--bg3)] rounded border border-[var(--border)]">
                    <span className="text-[var(--text2)] text-sm font-crimson truncate flex-1">{arquivoSelecionado.name}</span>
                    <button onClick={() => setArquivoSelecionado(null)} className="text-[var(--border)] hover:text-[var(--red2)] ml-2">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(false)} className="flex-1 py-2 border border-[var(--border)] rounded text-[var(--text2)] text-sm font-cinzel">Cancelar</button>
              <button
                onClick={importar}
                disabled={!arquivoSelecionado || processando}
                className="flex-1 py-2 bg-[var(--accent)] hover:opacity-90 text-[var(--bg)] rounded font-cinzel text-sm disabled:opacity-50"
              >
                {processando ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
