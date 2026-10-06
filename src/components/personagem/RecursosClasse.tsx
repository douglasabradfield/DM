'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRecursosPorClasse } from '@/lib/dados-dnd/recursos-classe'
import { getSlugClasse, normalizarNomeClasse } from '@/lib/dados-dnd/classes'
import type { RecursoPersonagem } from '@/types/database'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Modificadores = { carisma?: number; sabedoria?: number; inteligencia?: number }

const ROTULO_RECUPERACAO: Record<RecursoPersonagem['recuperacao'], string> = {
  longo: 'descanso longo',
  curto: 'descanso curto',
  um_curto_todos_longo: '1 no curto, todos no longo',
}

// Lê os recursos do personagem e acompanha mudanças feitas fora desta tela
// (descanso arbitrado pela API da mesa, outra aba com a ficha aberta).
export function useRecursosPersonagem(personagemId: string | null | undefined) {
  const [recursos, setRecursos] = useState<RecursoPersonagem[]>([])
  const [carregado, setCarregado] = useState(false)

  const carregar = useCallback(async () => {
    if (!personagemId) { setRecursos([]); setCarregado(true); return }
    const supabase = createClient()
    const { data, error } = await supabase
      .from('recursos_personagem')
      .select('*')
      .eq('personagem_id', personagemId)
      .order('ordem')
      .order('nome')
    if (error) console.error('Carregar recursos_personagem:', error)
    setRecursos((data ?? []) as RecursoPersonagem[])
    setCarregado(true)
  }, [personagemId])

  useEffect(() => {
    carregar()
    if (!personagemId) return
    const supabase = createClient()
    const canal = supabase
      .channel(`recursos-${personagemId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recursos_personagem', filter: `personagem_id=eq.${personagemId}` }, () => { carregar() })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [personagemId, carregar])

  return { recursos, setRecursos, carregado, recarregar: carregar }
}

// Exibição compacta, só leitura — usada na mesa ao lado dos espaços de magia.
export function RecursosLeitura({ personagemId }: { personagemId: string }) {
  const { recursos } = useRecursosPersonagem(personagemId)
  const visiveis = recursos.filter(r => r.total > 0)
  if (visiveis.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]">
      {visiveis.map(r => (
        <div key={r.id} className="flex items-center gap-0.5" title={`${r.nome}: ${r.total - r.usados}/${r.total} disponíveis · ${ROTULO_RECUPERACAO[r.recuperacao]}`}>
          <span className="text-[var(--text3)] font-cinzel truncate max-w-[110px]">{r.nome}</span>
          {r.unidade === 'pontos' ? (
            <span className="font-cinzel" style={{ color: 'var(--gold)' }}>{r.total - r.usados}/{r.total}</span>
          ) : (
            <span style={{ color: 'var(--gold)' }}>
              {'●'.repeat(Math.max(0, r.total - r.usados))}{'○'.repeat(Math.min(r.total, r.usados))}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

interface ReferenciaRecursos {
  classe: string | null
  nivel: number
  modificadores: Modificadores
}

interface ItemPlano {
  chave: string
  texto: string
}

// Bloco de recursos da ficha. `referencia` é o nível/classe/atributos da
// última GRAVAÇÃO da ficha (não o que está digitado), para que o aviso de
// mudança e a semeadura não reajam a valor intermediário de input.
export function RecursosClasse({
  personagemId, referencia, podeEditar,
}: {
  personagemId: string
  referencia: ReferenciaRecursos
  podeEditar: boolean
}) {
  const { recursos, setRecursos, carregado, recarregar } = useRecursosPersonagem(personagemId)
  const [semeando, setSemeando] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)

  const slug = getSlugClasse(referencia.classe)
  const nivel = Math.min(Math.max(referencia.nivel || 1, 1), 20)
  const esperados = slug ? getRecursosPorClasse(slug, nivel, referencia.modificadores) : []
  const idsEsperados = new Set(esperados.map(e => e.recurso.id))

  // Aviso de mudança de nível/classe — mesmo padrão não destrutivo do aviso
  // de espaços de magia: lista o que mudaria, aplica só com clique.
  const referenciaVista = useRef({ nivel, classe: normalizarNomeClasse(referencia.classe) })
  const [avisoAtivo, setAvisoAtivo] = useState(false)
  useEffect(() => {
    const atual = { nivel, classe: normalizarNomeClasse(referencia.classe) }
    const ref = referenciaVista.current
    if (atual.nivel !== ref.nivel || atual.classe !== ref.classe) {
      referenciaVista.current = atual
      setAvisoAtivo(true)
    }
  }, [nivel, referencia.classe])

  function planoSemeadura(): ItemPlano[] {
    const plano: ItemPlano[] = []
    for (const { recurso, total } of esperados) {
      const linha = recursos.find(r => r.recurso_id === recurso.id)
      if (!linha) {
        plano.push({ chave: recurso.id, texto: `Novo: ${recurso.nome} — ${total} ${recurso.unidade}, ${ROTULO_RECUPERACAO[recurso.recuperacao]}` })
        continue
      }
      const mudancas: string[] = []
      if (linha.nome !== recurso.nome) mudancas.push(`nome "${linha.nome}" → "${recurso.nome}"`)
      if (linha.total !== total) {
        const corte = linha.usados > total ? ` (usados caem de ${linha.usados} para ${total})` : ''
        mudancas.push(`total ${linha.total} → ${total}${corte}`)
      }
      if (linha.recuperacao !== recurso.recuperacao) {
        mudancas.push(`recuperação ${ROTULO_RECUPERACAO[linha.recuperacao]} → ${ROTULO_RECUPERACAO[recurso.recuperacao]}`)
      }
      if (mudancas.length > 0) plano.push({ chave: recurso.id, texto: `${recurso.nome}: ${mudancas.join('; ')}` })
    }
    for (const linha of recursos) {
      if (linha.origem === 'classe' && linha.recurso_id && !idsEsperados.has(linha.recurso_id)) {
        plano.push({ chave: `fora-${linha.id}`, texto: `${linha.nome}: não existe mais para esta classe e nível — fica na ficha marcado como desatualizado, apague se quiser` })
      }
    }
    return plano
  }

  async function semear() {
    if (!slug) {
      toast.error(`Classe "${referencia.classe ?? ''}" não reconhecida — salve a ficha com uma classe válida.`)
      return
    }
    setSemeando(true)
    try {
      const supabase = createClient()
      let falhas = 0
      for (const [idx, { recurso, total }] of esperados.entries()) {
        const linha = recursos.find(r => r.recurso_id === recurso.id)
        // .select() em toda escrita: com RLS errado o PostgREST devolve
        // sucesso sem afetar linha nenhuma — aqui isso vira erro visível.
        if (linha) {
          // Nunca sobrescreve usados: só limita ao novo total.
          const { data, error } = await supabase.from('recursos_personagem').update({
            nome: recurso.nome,
            total,
            recuperacao: recurso.recuperacao,
            usados: Math.min(linha.usados, total),
            atualizado_em: new Date().toISOString(),
          }).eq('id', linha.id).select('id')
          if (error || !data?.length) { falhas++; console.error('Semear (update):', recurso.id, error) }
        } else {
          const { data, error } = await supabase.from('recursos_personagem').insert({
            personagem_id: personagemId,
            recurso_id: recurso.id,
            nome: recurso.nome,
            total,
            usados: 0,
            recuperacao: recurso.recuperacao,
            unidade: recurso.unidade,
            origem: 'classe',
            ordem: idx,
            nota: recurso.nota ?? null,
          }).select('id')
          if (error || !data?.length) { falhas++; console.error('Semear (insert):', recurso.id, error) }
        }
      }
      await recarregar()
      if (falhas > 0) toast.error(`${falhas} recurso(s) não foram gravados. Veja o console.`)
      else toast.success(esperados.length > 0 ? 'Recursos semeados pela classe.' : 'A classe não tem recursos com usos limitados neste nível.')
      setAvisoAtivo(false)
    } finally {
      setSemeando(false)
    }
  }

  async function gravarUsados(recurso: RecursoPersonagem, novoUsados: number) {
    if (!podeEditar) return
    const usados = Math.max(0, Math.min(recurso.total, novoUsados))
    if (usados === recurso.usados) return
    setRecursos(prev => prev.map(r => r.id === recurso.id ? { ...r, usados } : r))
    const supabase = createClient()
    const { data, error } = await supabase.from('recursos_personagem')
      .update({ usados, atualizado_em: new Date().toISOString() })
      .eq('id', recurso.id)
      .select('id')
    if (error || !data?.length) {
      console.error('Gravar usados de recurso:', error)
      toast.error(`Não foi possível gravar ${recurso.nome}.`)
      setRecursos(prev => prev.map(r => r.id === recurso.id ? { ...r, usados: recurso.usados } : r))
    }
  }

  function toggleUso(recurso: RecursoPersonagem, indice: number) {
    if (indice < recurso.usados) gravarUsados(recurso, recurso.usados - 1)
    else if (recurso.usados < recurso.total) gravarUsados(recurso, recurso.usados + 1)
  }

  async function apagar(recurso: RecursoPersonagem) {
    if (!confirm(`Apagar o recurso "${recurso.nome}" da ficha?`)) return
    const supabase = createClient()
    const { data, error } = await supabase.from('recursos_personagem').delete().eq('id', recurso.id).select('id')
    if (error || !data?.length) {
      console.error('Apagar recurso:', error)
      toast.error('Não foi possível apagar o recurso.')
      return
    }
    setRecursos(prev => prev.filter(r => r.id !== recurso.id))
  }

  const plano = podeEditar && carregado ? planoSemeadura() : []

  return (
    <div>
      {podeEditar && avisoAtivo && plano.length > 0 && (
        <div className="border border-[var(--gold)]/50 bg-[var(--gold)]/5 rounded p-3 mb-3 space-y-2">
          <p className="text-[var(--gold)] text-xs font-cinzel">
            ⚠️ Nível ou classe mudou — os recursos da ficha diferem da tabela de {referencia.classe || 'classe'} nível {nivel}.
          </p>
          <ul className="text-[var(--text2)] text-sm font-crimson list-disc pl-5">
            {plano.map(item => <li key={item.chave}>{item.texto}</li>)}
          </ul>
          <p className="text-[var(--text3)] text-xs font-crimson">
            Nada foi alterado. Aplicar não zera usos gastos nem apaga recursos manuais.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={semear}
              disabled={semeando}
              className="text-xs font-cinzel text-[var(--accent)] border border-[var(--accent)]/40 px-3 py-1 rounded hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
            >
              ↺ Aplicar pela classe
            </button>
            <button
              onClick={() => setAvisoAtivo(false)}
              className="text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] px-3 py-1 rounded hover:border-[var(--border2)] transition-colors"
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      {!carregado ? (
        <p className="text-[var(--text3)] text-sm font-crimson text-center py-3">Carregando...</p>
      ) : recursos.length === 0 ? (
        <p className="text-[var(--border)] text-sm font-crimson text-center py-3">
          Nenhum recurso de classe.{podeEditar ? ' Use “Semear recursos pela classe” ou cadastre um manualmente.' : ''}
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {recursos.map(r => {
            const desatualizado = r.origem === 'classe' && !!r.recurso_id && !idsEsperados.has(r.recurso_id)
            return (
              <div key={r.id} className="bg-[var(--bg3)] rounded p-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[var(--text)] text-sm font-cinzel">{r.nome}</span>
                      {r.origem !== 'classe' && (
                        <span className="text-[9px] font-cinzel uppercase text-[var(--text3)] border border-[var(--border)] rounded px-1">{r.origem}</span>
                      )}
                      {desatualizado && (
                        <span className="text-[9px] font-cinzel uppercase text-[var(--red)] border border-[var(--red)]/50 rounded px-1" title="Não existe mais para a classe e nível atuais. A semeadura não apaga — apague se quiser.">
                          desatualizado
                        </span>
                      )}
                    </div>
                    <div className="text-[var(--text3)] text-[10px] font-crimson">Recupera: {ROTULO_RECUPERACAO[r.recuperacao]}</div>
                  </div>
                  {podeEditar && (
                    <button onClick={() => apagar(r)} className="text-[var(--border)] hover:text-[var(--red)] p-1 -m-1 flex-shrink-0" title="Apagar recurso">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {r.unidade === 'pontos' ? (
                  <ControlePontos recurso={r} podeEditar={podeEditar} onGravar={u => gravarUsados(r, u)} />
                ) : (
                  <>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {Array.from({ length: r.total }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => toggleUso(r, i)}
                          disabled={!podeEditar}
                          className={`text-base transition-colors ${
                            i < r.usados ? 'text-[var(--text3)]/40' : 'text-[var(--accent)]'
                          } hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={i < r.usados ? 'Uso gasto' : 'Uso disponível'}
                        >
                          {i < r.usados ? '○' : '●'}
                        </button>
                      ))}
                    </div>
                    <div className="text-[var(--border)] text-[9px] mt-1">{r.usados}/{r.total} usados</div>
                  </>
                )}
                {r.nota && <p className="text-[var(--text3)] text-[10px] font-crimson mt-1 italic">{r.nota}</p>}
              </div>
            )
          })}
        </div>
      )}

      {podeEditar && (
        cadastrando ? (
          <FormRecursoManual
            personagemId={personagemId}
            onCancelar={() => setCadastrando(false)}
            onCriado={async () => { setCadastrando(false); await recarregar() }}
          />
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={semear}
              disabled={semeando}
              className="text-xs font-cinzel text-[var(--accent)] border border-[var(--accent)]/40 px-3 py-1 rounded hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
              title={slug ? undefined : 'Classe não reconhecida'}
            >
              {semeando ? 'Semeando...' : '🌱 Semear recursos pela classe'}
            </button>
            <button
              onClick={() => setCadastrando(true)}
              className="text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] px-3 py-1 rounded hover:border-[var(--border2)] transition-colors"
            >
              + Recurso manual
            </button>
          </div>
        )
      )}
    </div>
  )
}

// Poço de pontos (Imposição de Mãos chega a 100) — campo com mais/menos em
// vez de círculos. Mostra os pontos RESTANTES; grava como usados.
function ControlePontos({ recurso, podeEditar, onGravar }: {
  recurso: RecursoPersonagem
  podeEditar: boolean
  onGravar: (usados: number) => void
}) {
  const restantes = recurso.total - recurso.usados
  const [texto, setTexto] = useState(String(restantes))
  useEffect(() => { setTexto(String(restantes)) }, [restantes])

  function confirmarTexto() {
    const n = Math.max(0, Math.min(recurso.total, parseInt(texto) || 0))
    setTexto(String(n))
    if (n !== restantes) onGravar(recurso.total - n)
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <button
        type="button"
        onClick={() => onGravar(recurso.usados + 1)}
        disabled={!podeEditar || restantes <= 0}
        className="w-8 h-8 rounded bg-[var(--surface)] text-[var(--text2)] border border-[var(--border)] font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        title="Gastar 1 ponto"
      >−</button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={texto}
        disabled={!podeEditar}
        onChange={e => setTexto(e.target.value.replace(/\D/g, ''))}
        onBlur={confirmarTexto}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        onFocus={e => e.target.select()}
        className="w-16 input-dd text-center"
      />
      <button
        type="button"
        onClick={() => onGravar(recurso.usados - 1)}
        disabled={!podeEditar || recurso.usados <= 0}
        className="w-8 h-8 rounded bg-[var(--surface)] text-[var(--text2)] border border-[var(--border)] font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        title="Recuperar 1 ponto"
      >+</button>
      <span className="text-[var(--text3)] text-xs font-crimson">de {recurso.total} pontos</span>
    </div>
  )
}

function FormRecursoManual({ personagemId, onCancelar, onCriado }: {
  personagemId: string
  onCancelar: () => void
  onCriado: () => void
}) {
  const [nome, setNome] = useState('')
  const [total, setTotal] = useState('1')
  const [unidade, setUnidade] = useState<RecursoPersonagem['unidade']>('usos')
  const [recuperacao, setRecuperacao] = useState<RecursoPersonagem['recuperacao']>('longo')
  const [gravando, setGravando] = useState(false)

  async function criar() {
    const totalNum = Math.max(0, parseInt(total) || 0)
    if (!nome.trim()) { toast.error('Informe o nome do recurso.'); return }
    if (totalNum <= 0) { toast.error('O total precisa ser maior que zero.'); return }
    setGravando(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('recursos_personagem').insert({
      personagem_id: personagemId,
      recurso_id: null,
      nome: nome.trim(),
      total: totalNum,
      usados: 0,
      recuperacao,
      unidade,
      origem: 'manual',
      ordem: 1000,
    }).select('id')
    setGravando(false)
    if (error || !data?.length) {
      console.error('Criar recurso manual:', error)
      toast.error('Não foi possível criar o recurso.')
      return
    }
    toast.success('Recurso criado.')
    onCriado()
  }

  return (
    <div className="border border-[var(--border)] rounded p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Nome</span>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full input-dd" placeholder="Varinha de Mísseis Mágicos" />
        </label>
        <label className="block">
          <span className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Total</span>
          <input type="text" inputMode="numeric" value={total} onChange={e => setTotal(e.target.value.replace(/\D/g, ''))} className="w-full input-dd text-center" />
        </label>
        <label className="block">
          <span className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Unidade</span>
          <select value={unidade} onChange={e => setUnidade(e.target.value as RecursoPersonagem['unidade'])} className="w-full input-dd">
            <option value="usos">Usos</option>
            <option value="pontos">Pontos</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[var(--text3)] text-[9px] font-cinzel uppercase">Recuperação</span>
          <select value={recuperacao} onChange={e => setRecuperacao(e.target.value as RecursoPersonagem['recuperacao'])} className="w-full input-dd">
            <option value="longo">Descanso longo</option>
            <option value="curto">Descanso curto</option>
            <option value="um_curto_todos_longo">1 no curto, todos no longo</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={criar}
          disabled={gravando}
          className="text-xs font-cinzel text-[var(--green)] border border-[var(--green)]/40 px-3 py-1 rounded hover:bg-[var(--green)]/10 transition-colors disabled:opacity-40"
        >
          ✓ Criar
        </button>
        <button
          onClick={onCancelar}
          className="text-xs font-cinzel text-[var(--text3)] border border-[var(--border)] px-3 py-1 rounded hover:border-[var(--border2)] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
