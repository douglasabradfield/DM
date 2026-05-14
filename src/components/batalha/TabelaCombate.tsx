'use client'

import { useState } from 'react'
import { useBatalha } from '@/store/batalha'
import { LinhaCombatente } from './LinhaCombatente'
import { LogBatalha } from './LogBatalha'
import { DadosVirtuais } from './DadosVirtuais'
import { SidebarMonstros } from './SidebarMonstros'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { getEspacosMagia } from '@/lib/dados-dnd/espacos-magia'
import { createClient } from '@/lib/supabase/client'
import type { Personagem } from '@/types/dnd'
import {
  Play, SkipForward, ChevronLeft, ChevronRight,
  RotateCcw, Zap, RefreshCw, Plus, Dices, List
} from 'lucide-react'
import toast from 'react-hot-toast'

export function TabelaCombate() {
  const {
    combatentes, rodadaAtual, turnoAtual, ativa,
    iniciarBatalha, encerrarBatalha, resetarBatalha,
    adicionarCombatente, confirmarIniciativa, rolarIniciativasMonstros,
    proximoTurno, turnoAnterior, proximaRodada,
    aplicarTodosDanos, zerarContadores,
  } = useBatalha()

  const [aba, setAba] = useState<'combate' | 'dados' | 'log' | 'monstros'>('combate')
  const [adicionandoPJ, setAdicionandoPJ] = useState(false)
  const [nomePJ, setNomePJ] = useState('')
  const [campanhaPJId, setCampanhaPJId] = useState('')

  const combatentesOrdenados = [...combatentes].sort((a, b) => a.ordem - b.ordem)
  const ativosCount = combatentes.filter(c => !c.ausente && !c.morto).length
  const combatenteAtivo = combatentesOrdenados.filter(c => !c.ausente && !c.morto)[turnoAtual]

  async function carregarPersonagens() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: campanhas } = await supabase.from('campanhas').select('id').eq('dm_id', user.id).eq('ativa', true).limit(1)
    if (!campanhas?.[0]) { toast.error('Nenhuma campanha ativa encontrada'); return }

    const { data: personagens } = await supabase.from('personagens').select('*').eq('campanha_id', campanhas[0].id).eq('ativo', true)

    if (!personagens?.length) { toast.error('Nenhum personagem encontrado'); return }

    personagens.forEach((p: Personagem) => {
      const desMod = Math.floor((p.destreza - 10) / 2)
      const espacos: Record<number, { total: number; utilizados: number }> = {}
      const slots = getEspacosMagia(p.nivel)
      slots.forEach((total, idx) => {
        if (total > 0) espacos[idx + 1] = { total, utilizados: 0 }
      })

      adicionarCombatente({
        personagem_id: p.id,
        nome: p.nome,
        tipo: 'jogador',
        iniciativa: 0,
        ca: p.ca,
        pv_maximo: p.pv_maximo,
        pv_atual: p.pv_atual,
        pv_temporarios: p.pv_temporarios,
        ausente: false,
        morto: false,
        condicoes: [],
        resistencias: p.resistencias ?? [],
        imunidades: p.imunidades ?? [],
        vulnerabilidades: p.vulnerabilidades ?? [],
        espacos_magia: espacos,
        notas: '',
        dados_monstro: null,
        ordem: 999,
      })
    })
    toast.success(`${personagens.length} personagens adicionados`)
  }

  function adicionarMonstroManual() {
    adicionarCombatente({
      personagem_id: null,
      nome: 'Monstro Personalizado',
      tipo: 'monstro',
      iniciativa: 0,
      ca: 12,
      pv_maximo: 30,
      pv_atual: 30,
      pv_temporarios: 0,
      ausente: false,
      morto: false,
      condicoes: [],
      resistencias: [],
      imunidades: [],
      vulnerabilidades: [],
      espacos_magia: {},
      notas: '',
      dados_monstro: null,
      ordem: 999,
    })
  }

  return (
    <div className="flex h-full">
      {/* Painel principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-[#150f18] border-b border-[#4a3060] px-3 py-2 flex items-center gap-2 flex-wrap">
          {/* Controles de rodada */}
          <div className="flex items-center gap-2 bg-[#1e1525] border border-[#4a3060] rounded px-3 py-1">
            <button onClick={turnoAnterior} disabled={!ativa} className="text-[#8870a8] hover:text-[#b8a8cc] disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-20">
              <span className="font-cinzel text-[#d4a843] text-sm font-bold">Rodada {rodadaAtual}</span>
              <span className="text-[#8870a8] text-xs ml-2">T{turnoAtual + 1}/{Math.max(1, ativosCount)}</span>
            </div>
            <button onClick={proximoTurno} disabled={!ativa} className="text-[#8870a8] hover:text-[#b8a8cc] disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={proximaRodada} disabled={!ativa} className="text-[#8870a8] hover:text-[#b8a8cc] disabled:opacity-30 ml-1" title="Próxima rodada">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {combatenteAtivo && ativa && (
            <span className="text-[#f0c060] text-sm font-cinzel">⚔️ {combatenteAtivo.nome}</span>
          )}

          <div className="flex-1" />

          {/* Ações */}
          <BotaoRunico variante="secundario" tamanho="sm" onClick={rolarIniciativasMonstros} title="Rolar iniciativa dos monstros">
            🎲 Iniciativas
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={confirmarIniciativa}>
            🎯 Ordenar
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={aplicarTodosDanos}>
            <Zap className="w-3 h-3" /> Aplicar Danos
          </BotaoRunico>
          <BotaoRunico variante="secundario" tamanho="sm" onClick={zerarContadores}>
            <RotateCcw className="w-3 h-3" /> Zerar
          </BotaoRunico>

          {!ativa ? (
            <BotaoRunico variante="ouro" tamanho="sm" onClick={iniciarBatalha}>
              <Play className="w-3 h-3" /> Iniciar
            </BotaoRunico>
          ) : (
            <BotaoRunico variante="perigo" tamanho="sm" onClick={encerrarBatalha}>
              Encerrar
            </BotaoRunico>
          )}
          <BotaoRunico variante="fantasma" tamanho="sm" onClick={resetarBatalha}>
            <RefreshCw className="w-3 h-3" /> Reset
          </BotaoRunico>
        </div>

        {/* Abas */}
        <div className="bg-[#150f18] border-b border-[#4a3060] flex">
          {[
            { id: 'combate', label: '⚔️ Combate' },
            { id: 'dados', label: '🎲 Dados' },
            { id: 'log', label: '📜 Log' },
            { id: 'monstros', label: '👹 Monstros' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setAba(id as typeof aba)}
              className={`px-4 py-1.5 text-xs font-cinzel border-b-2 transition-colors ${
                aba === id
                  ? 'border-[#d4a843] text-[#d4a843]'
                  : 'border-transparent text-[#8870a8] hover:text-[#b8a8cc]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto">
          {aba === 'combate' && (
            <div>
              {/* Botões adicionar */}
              <div className="flex gap-2 p-2 bg-[#0d0a0e] border-b border-[#1e1525]">
                <button
                  onClick={carregarPersonagens}
                  className="flex items-center gap-1 text-xs text-[#3498db] hover:text-[#5dade2] transition-colors"
                >
                  <Plus className="w-3 h-3" /> Carregar PJs da Campanha
                </button>
                <span className="text-[#4a3060]">|</span>
                <button
                  onClick={adicionarMonstroManual}
                  className="flex items-center gap-1 text-xs text-[#e74c3c] hover:text-[#e74c3c]/80 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Monstro Manual
                </button>
              </div>

              {combatentes.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-cinzel text-[#4a3060] text-lg mb-2">Nenhum combatente</p>
                  <p className="text-[#4a3060] text-sm font-crimson">Adicione personagens e monstros para começar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1e1525] sticky top-0 z-10">
                      <tr className="text-[#8870a8] text-[10px] font-cinzel uppercase tracking-wider">
                        <th className="px-1 py-1.5 text-center w-8">✓</th>
                        <th className="px-1 py-1.5 text-center w-6">St</th>
                        <th className="px-2 py-1.5 text-left">Nome</th>
                        <th className="px-1 py-1.5 text-center w-14">Init</th>
                        <th className="px-1 py-1.5 text-center w-12">CA</th>
                        <th className="px-2 py-1.5 text-left min-w-28">PV</th>
                        <th className="px-1 py-1.5 text-center w-28">Tipo Dano</th>
                        <th className="px-1 py-1.5 text-center w-28">Dano</th>
                        <th className="px-1 py-1.5 text-center w-24">Cura</th>
                        <th className="px-1 py-1.5 text-center w-16">💥 Tot</th>
                        <th className="px-1 py-1.5 text-center w-16">💊 Tot</th>
                        <th className="px-1 py-1.5 text-left min-w-24">Condições</th>
                        <th className="px-1 py-1.5 text-left min-w-20">Magia</th>
                        <th className="px-1 py-1.5 text-left min-w-24">Notas</th>
                        <th className="px-1 py-1.5 text-center w-16">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combatentesOrdenados.map((c, i) => {
                        const ativosParaIndice = combatentesOrdenados.filter(x => !x.ausente && !x.morto)
                        const indiceAtivo = ativosParaIndice.indexOf(c)
                        const estaAtivo = indiceAtivo === turnoAtual && ativa
                        return (
                          <LinhaCombatente
                            key={c.id}
                            combatente={c}
                            ativo={estaAtivo}
                            indice={i}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {aba === 'dados' && (
            <div className="p-4 max-w-md">
              <PainelGrimorio titulo="Dados Virtuais" ornamentado>
                <DadosVirtuais />
              </PainelGrimorio>
            </div>
          )}

          {aba === 'log' && (
            <div className="h-full">
              <LogBatalha />
            </div>
          )}

          {aba === 'monstros' && (
            <div className="max-w-sm">
              <SidebarMonstros />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
