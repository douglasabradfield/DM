'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Monstro } from '@/types/dnd'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { useBatalha } from '@/store/batalha'
import { calcularModificadorAtributo, formatarModificador } from '@/lib/utils'
import { Search, Swords } from 'lucide-react'
import toast from 'react-hot-toast'

const CRS = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '30']

export default function BestiarioPage() {
  const [monstros, setMonstros] = useState<Monstro[]>([])
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroCR, setFiltroCR] = useState('')
  const [selecionado, setSelecionado] = useState<Monstro | null>(null)
  const { adicionarCombatente } = useBatalha()

  const buscar = useCallback(async () => {
    setCarregando(true)
    try {
      const supabase = createClient()
      let query = supabase.from('monstros').select('*').limit(50)
      if (busca) query = query.ilike('nome', `%${busca}%`)
      if (filtroCR) query = query.eq('cr', filtroCR)
      const { data } = await query.order('nome')
      setMonstros((data ?? []) as Monstro[])
    } finally {
      setCarregando(false)
    }
  }, [busca, filtroCR])

  useEffect(() => { buscar() }, [buscar])

  function adicionarNaBatalha(m: Monstro) {
    const pv = m.pv ?? 10
    adicionarCombatente({
      personagem_id: null,
      nome: m.nome,
      tipo: 'monstro',
      iniciativa: 0,
      ca: m.ca ?? 10,
      pv_maximo: pv,
      pv_atual: pv,
      pv_temporarios: 0,
      ausente: false,
      morto: false,
      condicoes: [],
      resistencias: [],
      imunidades: [],
      vulnerabilidades: [],
      espacos_magia: {},
      notas: '',
      dados_monstro: {
        cr: m.cr ?? '?',
        tipo: m.tipo ?? '',
        habilidades: m.habilidades ?? '',
        acoes: m.acoes ?? '',
        forca: m.forca ?? 10,
        destreza: m.destreza ?? 10,
        constituicao: m.constituicao ?? 10,
        inteligencia: m.inteligencia ?? 10,
        sabedoria: m.sabedoria ?? 10,
        carisma: m.carisma ?? 10,
      },
      ordem: 999,
    })
    toast.success(`${m.nome} adicionado à batalha!`)
  }

  const atrs = selecionado ? [
    { label: 'FOR', val: selecionado.forca ?? 10 },
    { label: 'DES', val: selecionado.destreza ?? 10 },
    { label: 'CON', val: selecionado.constituicao ?? 10 },
    { label: 'INT', val: selecionado.inteligencia ?? 10 },
    { label: 'SAB', val: selecionado.sabedoria ?? 10 },
    { label: 'CAR', val: selecionado.carisma ?? 10 },
  ] : []

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="w-80 border-r border-[#4a3060] flex flex-col">
        <div className="p-3 border-b border-[#4a3060]">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8870a8]" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar monstro..."
              className="w-full input-dd pl-7 text-sm"
            />
          </div>
          <select value={filtroCR} onChange={e => setFiltroCR(e.target.value)} className="w-full input-dd text-sm">
            <option value="">Todos os CRs</option>
            {CRS.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="p-4 text-center text-[#8870a8] text-sm">Carregando...</div>
          ) : monstros.length === 0 ? (
            <div className="p-4 text-center text-[#4a3060] text-sm">
              <p>Nenhum monstro encontrado.</p>
              <p className="text-xs mt-1">Execute o SQL do setup para popular o bestiário.</p>
            </div>
          ) : (
            monstros.map(m => (
              <button
                key={m.id}
                onClick={() => setSelecionado(m)}
                className={`w-full text-left px-3 py-2 border-b border-[#1e1525] transition-colors ${
                  selecionado?.id === m.id ? 'bg-[#261a2e]' : 'hover:bg-[#1e1525]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#e8dff0] text-sm font-crimson">{m.nome}</span>
                  <span className="text-[#d4a843] text-xs font-cinzel">CR {m.cr}</span>
                </div>
                <p className="text-[#8870a8] text-[10px]">{m.tipo} · PV {m.pv} · CA {m.ca}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalhes */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selecionado ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="font-cinzel text-[#4a3060] text-xl mb-2">Selecione um monstro</p>
              <p className="text-[#4a3060] text-sm font-crimson">Clique em um monstro da lista para ver seus detalhes</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-cinzel text-[#d4a843] text-2xl font-bold">{selecionado.nome}</h2>
                {selecionado.nome_original && <p className="text-[#4a3060] text-sm italic">{selecionado.nome_original}</p>}
                <p className="text-[#b8a8cc] text-sm mt-1">{selecionado.tipo}</p>
              </div>
              <button
                onClick={() => adicionarNaBatalha(selecionado)}
                className="flex items-center gap-2 px-3 py-2 bg-[#9b59b6] border border-[#c39bd3] text-white rounded text-sm font-cinzel hover:bg-[#8e44ad] transition-colors"
              >
                <Swords className="w-4 h-4" /> Adicionar à Batalha
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <PainelGrimorio compacto className="text-center">
                <div className="text-[#8870a8] text-[10px] font-cinzel uppercase">Classe de Armadura</div>
                <div className="text-[#d4a843] text-xl font-cinzel font-bold">{selecionado.ca}</div>
                {selecionado.ca_texto && <div className="text-[#4a3060] text-[10px]">{selecionado.ca_texto}</div>}
              </PainelGrimorio>
              <PainelGrimorio compacto className="text-center">
                <div className="text-[#8870a8] text-[10px] font-cinzel uppercase">Pontos de Vida</div>
                <div className="text-[#27ae60] text-xl font-cinzel font-bold">{selecionado.pv}</div>
                {selecionado.pv_texto && <div className="text-[#4a3060] text-[10px]">{selecionado.pv_texto}</div>}
              </PainelGrimorio>
              <PainelGrimorio compacto className="text-center">
                <div className="text-[#8870a8] text-[10px] font-cinzel uppercase">Nível de Desafio</div>
                <div className="text-[#d4a843] text-xl font-cinzel font-bold">{selecionado.cr}</div>
                <div className="text-[#4a3060] text-[10px]">{selecionado.deslocamento}</div>
              </PainelGrimorio>
            </div>

            {/* Atributos */}
            <PainelGrimorio titulo="Atributos" compacto className="mb-3">
              <div className="grid grid-cols-6 gap-2 text-center">
                {atrs.map(({ label, val }) => {
                  const mod = calcularModificadorAtributo(val)
                  return (
                    <div key={label} className="bg-[#1e1525] rounded p-2">
                      <div className="text-[#8870a8] text-[9px] font-cinzel">{label}</div>
                      <div className="text-[#e8dff0] font-bold">{val}</div>
                      <div className="text-[#b8a8cc] text-xs">{formatarModificador(mod)}</div>
                    </div>
                  )
                })}
              </div>
            </PainelGrimorio>

            {/* Defesas */}
            {(selecionado.resistencia_dano || selecionado.imunidade_dano || selecionado.imunidade_condicao) && (
              <PainelGrimorio titulo="Defesas" compacto className="mb-3">
                {selecionado.imunidade_dano && (
                  <div className="mb-1">
                    <span className="text-[#8870a8] text-xs font-cinzel">Imunidade a Dano: </span>
                    <span className="text-[#27ae60] text-xs">{selecionado.imunidade_dano}</span>
                  </div>
                )}
                {selecionado.resistencia_dano && (
                  <div className="mb-1">
                    <span className="text-[#8870a8] text-xs font-cinzel">Resistência: </span>
                    <span className="text-[#3498db] text-xs">{selecionado.resistencia_dano}</span>
                  </div>
                )}
                {selecionado.imunidade_condicao && (
                  <div>
                    <span className="text-[#8870a8] text-xs font-cinzel">Imunidade Condição: </span>
                    <span className="text-[#9b59b6] text-xs">{selecionado.imunidade_condicao}</span>
                  </div>
                )}
              </PainelGrimorio>
            )}

            {selecionado.habilidades && (
              <PainelGrimorio titulo="Habilidades Especiais" compacto className="mb-3">
                <p className="text-[#b8a8cc] text-sm font-crimson whitespace-pre-wrap">{selecionado.habilidades}</p>
              </PainelGrimorio>
            )}

            {selecionado.acoes && (
              <PainelGrimorio titulo="Ações" compacto className="mb-3">
                <p className="text-[#b8a8cc] text-sm font-crimson whitespace-pre-wrap">{selecionado.acoes}</p>
              </PainelGrimorio>
            )}

            {selecionado.reacoes && (
              <PainelGrimorio titulo="Reações" compacto className="mb-3">
                <p className="text-[#b8a8cc] text-sm font-crimson whitespace-pre-wrap">{selecionado.reacoes}</p>
              </PainelGrimorio>
            )}

            {selecionado.acoes_lendarias && (
              <PainelGrimorio titulo="Ações Lendárias" compacto className="mb-3">
                <p className="text-[#b8a8cc] text-sm font-crimson whitespace-pre-wrap">{selecionado.acoes_lendarias}</p>
              </PainelGrimorio>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
