'use client'

import { useState } from 'react'
import type { Personagem } from '@/types/dnd'
import { calcularModificadorAtributo, formatarModificador } from '@/lib/utils'
import { DivisorOrnamentado } from '@/components/ui/DivisorOrnamentado'
import { BotaoRunico } from '@/components/ui/BotaoRunico'
import { PainelGrimorio } from '@/components/ui/PainelGrimorio'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const PERICIAS = [
  { nome: 'Acrobacia', atributo: 'destreza' },
  { nome: 'Adestrar Animais', atributo: 'sabedoria' },
  { nome: 'Arcanismo', atributo: 'inteligencia' },
  { nome: 'Atletismo', atributo: 'forca' },
  { nome: 'Atuação', atributo: 'carisma' },
  { nome: 'Enganação', atributo: 'carisma' },
  { nome: 'Furtividade', atributo: 'destreza' },
  { nome: 'História', atributo: 'inteligencia' },
  { nome: 'Intimidação', atributo: 'carisma' },
  { nome: 'Intuição', atributo: 'sabedoria' },
  { nome: 'Investigação', atributo: 'inteligencia' },
  { nome: 'Medicina', atributo: 'sabedoria' },
  { nome: 'Natureza', atributo: 'inteligencia' },
  { nome: 'Percepção', atributo: 'sabedoria' },
  { nome: 'Persuasão', atributo: 'carisma' },
  { nome: 'Prestidigitação', atributo: 'destreza' },
  { nome: 'Religião', atributo: 'inteligencia' },
  { nome: 'Sobrevivência', atributo: 'sabedoria' },
]

const ATRIBUTOS = [
  { key: 'forca', label: 'Força', abrev: 'FOR' },
  { key: 'destreza', label: 'Destreza', abrev: 'DES' },
  { key: 'constituicao', label: 'Constituição', abrev: 'CON' },
  { key: 'inteligencia', label: 'Inteligência', abrev: 'INT' },
  { key: 'sabedoria', label: 'Sabedoria', abrev: 'SAB' },
  { key: 'carisma', label: 'Carisma', abrev: 'CAR' },
] as const

interface FichaPersonagemProps {
  personagem: Personagem
  onAtualizar?: (p: Partial<Personagem>) => void
}

export function FichaPersonagem({ personagem: p, onAtualizar }: FichaPersonagemProps) {
  const [pagina, setPagina] = useState(1)
  const [dados, setDados] = useState(p)
  const [salvando, setSalvando] = useState(false)

  function atualizar<K extends keyof Personagem>(campo: K, valor: Personagem[K]) {
    setDados(prev => ({ ...prev, [campo]: valor }))
  }

  async function salvar() {
    setSalvando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('personagens').update({
        ...dados,
        atualizado_em: new Date().toISOString(),
      }).eq('id', p.id)
      if (error) throw error
      toast.success('Personagem salvo!')
      onAtualizar?.(dados)
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const modFor = calcularModificadorAtributo(dados.forca)
  const modDes = calcularModificadorAtributo(dados.destreza)
  const modCon = calcularModificadorAtributo(dados.constituicao)
  const modInt = calcularModificadorAtributo(dados.inteligencia)
  const modSab = calcularModificadorAtributo(dados.sabedoria)
  const modCar = calcularModificadorAtributo(dados.carisma)
  const mods = { forca: modFor, destreza: modDes, constituicao: modCon, inteligencia: modInt, sabedoria: modSab, carisma: modCar }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-cinzel text-2xl text-[#d4a843]">{dados.nome}</h1>
          <p className="text-[#8870a8] text-sm">{dados.raca} · {dados.classe} Nv{dados.nivel} · {dados.alinhamento}</p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => setPagina(n)}
              className={`font-cinzel text-xs px-3 py-1.5 rounded border transition-colors ${
                pagina === n ? 'bg-[#261a2e] border-[#d4a843] text-[#d4a843]' : 'border-[#4a3060] text-[#8870a8] hover:border-[#6b4890]'
              }`}
            >
              Página {n}
            </button>
          ))}
          <BotaoRunico variante="ouro" tamanho="sm" onClick={salvar} carregando={salvando}>
            Salvar
          </BotaoRunico>
        </div>
      </div>

      {pagina === 1 && (
        <div className="grid grid-cols-3 gap-4">
          {/* Coluna 1 - Atributos */}
          <div className="space-y-3">
            <PainelGrimorio titulo="Atributos" compacto>
              <div className="space-y-2">
                {ATRIBUTOS.map(({ key, label, abrev }) => {
                  const val = dados[key] as number
                  const mod = calcularModificadorAtributo(val)
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-8 text-center bg-[#1e1525] border border-[#4a3060] rounded p-1">
                        <div className="text-[#8870a8] text-[8px] font-cinzel">{abrev}</div>
                        <div className="text-[#d4a843] text-sm font-bold font-cinzel">{formatarModificador(mod)}</div>
                      </div>
                      <div>
                        <div className="text-[#8870a8] text-[9px] font-cinzel uppercase">{label}</div>
                        <input
                          type="number"
                          value={val}
                          onChange={e => atualizar(key, parseInt(e.target.value) || 10)}
                          className="w-12 input-dd text-center text-sm"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </PainelGrimorio>

            <PainelGrimorio titulo="Combate" compacto>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">CA</label>
                  <input type="number" value={dados.ca} onChange={e => atualizar('ca', parseInt(e.target.value) || 10)} className="w-full input-dd text-center" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Iniciativa</label>
                  <input type="number" value={dados.iniciativa} onChange={e => atualizar('iniciativa', parseInt(e.target.value) || 0)} className="w-full input-dd text-center" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Desl. (m)</label>
                  <input type="number" value={dados.deslocamento} onChange={e => atualizar('deslocamento', parseInt(e.target.value) || 9)} className="w-full input-dd text-center" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Prof. Bônus</label>
                  <input type="number" value={dados.bonus_proficiencia} onChange={e => atualizar('bonus_proficiencia', parseInt(e.target.value) || 2)} className="w-full input-dd text-center" />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">PV Máximo</label>
                <div className="flex gap-1">
                  <input type="number" value={dados.pv_atual} onChange={e => atualizar('pv_atual', parseInt(e.target.value) || 0)} className="flex-1 input-dd text-center" placeholder="Atual" />
                  <span className="text-[#4a3060] self-center">/</span>
                  <input type="number" value={dados.pv_maximo} onChange={e => atualizar('pv_maximo', parseInt(e.target.value) || 1)} className="flex-1 input-dd text-center" placeholder="Máx" />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">PV Temporários</label>
                <input type="number" value={dados.pv_temporarios} onChange={e => atualizar('pv_temporarios', parseInt(e.target.value) || 0)} className="w-full input-dd text-center" />
              </div>
            </PainelGrimorio>
          </div>

          {/* Coluna 2 - Info geral + Perícias */}
          <div className="space-y-3">
            <PainelGrimorio titulo="Informações" compacto>
              <div className="space-y-2">
                {[
                  { label: 'Nome', key: 'nome', type: 'text' },
                  { label: 'Jogador', key: 'jogador_nome', type: 'text' },
                  { label: 'Classe', key: 'classe', type: 'text' },
                  { label: 'Nível', key: 'nivel', type: 'number' },
                  { label: 'Raça', key: 'raca', type: 'text' },
                  { label: 'Antecedente', key: 'antecedente', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">{label}</label>
                    <input
                      type={type}
                      value={(dados[key as keyof Personagem] as string | number) ?? ''}
                      onChange={e => atualizar(key as keyof Personagem, type === 'number' ? parseInt(e.target.value) || 1 : e.target.value as never)}
                      className="w-full input-dd"
                    />
                  </div>
                ))}
              </div>
            </PainelGrimorio>

            <PainelGrimorio titulo="Ataques" compacto>
              <div className="space-y-1">
                {(dados.ataques ?? []).map((atq, i) => (
                  <div key={i} className="grid grid-cols-3 gap-1 text-xs">
                    <input value={atq.nome} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], nome: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="Nome" />
                    <input value={atq.bonus_ataque} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], bonus_ataque: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="+5" />
                    <input value={atq.dano} onChange={e => { const a = [...dados.ataques]; a[i] = { ...a[i], dano: e.target.value }; atualizar('ataques', a) }} className="input-dd" placeholder="1d8+3" />
                  </div>
                ))}
                <button
                  onClick={() => atualizar('ataques', [...dados.ataques, { nome: '', bonus_ataque: '', dano: '', tipo_dano: '', notas: '' }])}
                  className="text-xs text-[#9b59b6] hover:text-[#c39bd3] transition-colors mt-1"
                >
                  + Adicionar ataque
                </button>
              </div>
            </PainelGrimorio>
          </div>

          {/* Coluna 3 - Perícias + Traços */}
          <div className="space-y-3">
            <PainelGrimorio titulo="Perícias" compacto>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {PERICIAS.map(({ nome, atributo }) => {
                  const temProf = dados.pericias?.[nome] ?? false
                  const mod = mods[atributo as keyof typeof mods] + (temProf ? dados.bonus_proficiencia : 0)
                  return (
                    <div key={nome} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={temProf}
                        onChange={e => atualizar('pericias', { ...dados.pericias, [nome]: e.target.checked })}
                        className="w-3 h-3 accent-[#9b59b6]"
                      />
                      <span className="text-[#b8a8cc] text-xs flex-1 font-crimson">{nome}</span>
                      <span className="text-[#d4a843] text-xs font-cinzel w-6 text-right">{formatarModificador(mod)}</span>
                    </div>
                  )
                })}
              </div>
            </PainelGrimorio>

            <PainelGrimorio titulo="Traços de Personalidade" compacto>
              <div className="space-y-2">
                {[
                  { label: 'Traços', key: 'tracos_personalidade' },
                  { label: 'Ideais', key: 'ideais' },
                  { label: 'Vínculos', key: 'vinculos' },
                  { label: 'Fraquezas', key: 'fraquezas' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">{label}</label>
                    <textarea
                      value={(dados[key as keyof Personagem] as string) ?? ''}
                      onChange={e => atualizar(key as keyof Personagem, e.target.value as never)}
                      rows={2}
                      className="w-full input-dd resize-none text-xs"
                    />
                  </div>
                ))}
              </div>
            </PainelGrimorio>
          </div>
        </div>
      )}

      {pagina === 2 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <PainelGrimorio titulo="Aparência Física" compacto>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Idade', key: 'idade' },
                  { label: 'Altura', key: 'altura' },
                  { label: 'Peso', key: 'peso' },
                  { label: 'Olhos', key: 'cor_olhos' },
                  { label: 'Pele', key: 'cor_pele' },
                  { label: 'Cabelo', key: 'cor_cabelo' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">{label}</label>
                    <input type="text" value={(dados[key as keyof Personagem] as string) ?? ''} onChange={e => atualizar(key as keyof Personagem, e.target.value as never)} className="w-full input-dd text-sm" />
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Aparência</label>
                <textarea value={dados.aparencia ?? ''} onChange={e => atualizar('aparencia', e.target.value)} rows={3} className="w-full input-dd resize-none text-sm" />
              </div>
            </PainelGrimorio>

            <PainelGrimorio titulo="Aliados & Organizações" compacto>
              <textarea value={dados.aliados_organizacoes ?? ''} onChange={e => atualizar('aliados_organizacoes', e.target.value)} rows={4} className="w-full input-dd resize-none text-sm" />
            </PainelGrimorio>
          </div>

          <div className="space-y-3">
            <PainelGrimorio titulo="História do Personagem" compacto>
              <textarea value={dados.historia ?? ''} onChange={e => atualizar('historia', e.target.value)} rows={8} className="w-full input-dd resize-none text-sm" />
            </PainelGrimorio>

            <PainelGrimorio titulo="Características e Tesouros" compacto>
              <div className="space-y-2">
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Características & Talentos</label>
                  <textarea value={dados.caracteristicas_talentos ?? ''} onChange={e => atualizar('caracteristicas_talentos', e.target.value)} rows={3} className="w-full input-dd resize-none text-sm" />
                </div>
                <div>
                  <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Tesouros</label>
                  <textarea value={dados.tesouros ?? ''} onChange={e => atualizar('tesouros', e.target.value)} rows={3} className="w-full input-dd resize-none text-sm" />
                </div>
              </div>
            </PainelGrimorio>
          </div>
        </div>
      )}

      {pagina === 3 && (
        <PainelGrimorio titulo="Magias e Conjuração" ornamentado>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Classe Conjuradora</label>
              <input type="text" className="w-full input-dd" placeholder="Mago, Clérigo..." />
            </div>
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">Atributo de Conjuração</label>
              <input type="text" className="w-full input-dd" placeholder="Inteligência" />
            </div>
            <div>
              <label className="text-[#8870a8] text-[9px] font-cinzel uppercase">CD de Magia</label>
              <input type="number" className="w-full input-dd text-center" />
            </div>
          </div>
          <DivisorOrnamentado texto="Magias Conhecidas" />
          <p className="text-[#8870a8] text-sm font-crimson text-center py-4">
            Configure as magias na tela de Magias e vincule ao personagem.
          </p>
        </PainelGrimorio>
      )}
    </div>
  )
}
