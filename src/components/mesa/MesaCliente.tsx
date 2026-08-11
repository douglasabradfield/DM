'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useBatalha } from '@/store/batalha'
import { useCampanha } from '@/store/campanha'
import { usePermissao } from '@/hooks/usePermissao'
import { useOnline } from '@/hooks/useOnline'
import { createClient } from '@/lib/supabase/client'
import { pvVisivelParaJogador, ESTADO_VAGO_INFO, type ModoRevelacao } from '@/lib/batalha/visibilidade-pv'
import { vantagemDerivada } from '@/lib/batalha/vantagem-por-condicao'
import { getCondicao, TODAS_CONDICOES } from '@/lib/dados-dnd/condicoes'
import { TIPOS_DANO } from '@/lib/dados-dnd/tipos-dano'
import { BarraVida } from '@/components/batalha/BarraVida'
import type { ArmaEmpunhada, Combatente, EntradaLog, TipoCondicao, EspacosMagiaBatalha, TipoEntradaLog } from '@/types/batalha'
import type { InventarioItemDb, Personagem, Spell, TipoDano } from '@/types/dnd'
import { cn } from '@/lib/utils'
import { Swords, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// =============================================================================
// Ação do jogador — sempre via API árbitro, nunca escrita direta (exceto arma)
// =============================================================================

interface AlvoSelecionado {
  id: string
  nome: string
}

interface AcaoPendente {
  tipo: TipoEntradaLog
  nomeAcao: string
  efeito: 'dano' | 'cura' | 'nenhum'
  precisaAlvo: boolean
  precisaValor: boolean
  tipoDanoPadrao: TipoDano | null
  nivelMagia?: number
  marcarEfeitoAtivo?: string
}

interface ResultadoAcao {
  ok: boolean
  erro?: string
}

interface ResultadoAcaoSessao extends ResultadoAcao {
  personagem?: Personagem
}

async function chamarAcaoApi(payload: {
  batalhaId: string
  combatenteId: string
  tipo: TipoEntradaLog
  alvos: { combatenteId: string; valor: number; tipoDano?: TipoDano }[]
  nivelMagia?: number
  nomeAcao?: string
  vantagem?: 'vantagem' | 'desvantagem' | null
  descricao?: string
  marcarEfeitoAtivo?: string
  encerrarEfeitoAtivo?: string
}): Promise<ResultadoAcao> {
  try {
    const resp = await fetch('/api/mesa/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const dados = await resp.json().catch(() => null)
    if (!resp.ok) {
      return { ok: false, erro: dados?.erro ?? 'Erro ao registrar ação' }
    }
    return { ok: true }
  } catch {
    return { ok: false, erro: 'Sem conexão — tente novamente' }
  }
}

// Ação fora de combate — sempre sobre o próprio personagem (ou o que o DM
// está operando), nunca "alvos" de ataque. Mesma rota do modo combate,
// discriminada pela ausência de batalhaId.
// ajuste_ouro não está aqui — vive só em TipoAcaoInventario/chamarAcaoInventario
// (ModalOuro sempre manda `moedas` em lote, ver route.ts).
type TipoAcaoSessao =
  | 'dano' | 'cura' | 'pv_temporarios'
  | 'condicao_aplicada' | 'condicao_removida'
  | 'usar_espaco' | 'recuperar_espaco'
  | 'usar_inspiracao'
  | 'descanso_longo' | 'descanso_curto'

async function chamarAcaoSessaoApi(payload: {
  sessaoId: string
  personagemId: string
  tipo: TipoAcaoSessao
  valor?: number
  tipoDano?: TipoDano
  condicao?: TipoCondicao
  nivelMagia?: number
  dadosGastos?: number
  curaInformada?: number
  nomeAcao?: string
  descricao?: string
}): Promise<ResultadoAcaoSessao> {
  try {
    const resp = await fetch('/api/mesa/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const dados = await resp.json().catch(() => null)
    if (!resp.ok) {
      return { ok: false, erro: dados?.erro ?? 'Erro ao registrar ação' }
    }
    return { ok: true, personagem: dados.personagem }
  } catch {
    return { ok: false, erro: 'Sem conexão — tente novamente' }
  }
}

// Inventário — mesma rota /api/mesa/acao, discriminada pelo `tipo` (não pela
// presença de batalhaId/sessaoId): funciona a partir de sessão, de batalha
// ou (para adicionar_item/definir_item, usados pela ficha) só com
// personagemId, sem sessão nem batalha ativa.
type TipoAcaoInventario =
  | 'usar_item' | 'equipar_item' | 'descartar_item' | 'adicionar_item' | 'definir_item'
  | 'transferir_item' | 'transferir_moeda' | 'ajuste_ouro' | 'distribuir' | 'conceder_inspiracao'

interface ItemDistribuidoPayload {
  nome: string
  tipo?: string | null
  raridade?: string | null
  descricao?: string | null
  quantidade: number
  itemRef?: string | null
}

interface AcaoInventarioParams {
  batalhaId?: string
  combatenteId?: string
  sessaoId?: string
  personagemId?: string
  tipo: TipoAcaoInventario
  itemId?: string
  itemRef?: string | null
  nome?: string
  tipoItem?: string | null
  raridade?: string | null
  descricaoItem?: string | null
  quantidade?: number
  equipado?: boolean
  remover?: boolean
  valorCura?: number
  paraPersonagemId?: string
  moeda?: 'pc' | 'pp' | 'pe' | 'po' | 'pl'
  valor?: number
  moedas?: Partial<Record<'pc' | 'pp' | 'pe' | 'po' | 'pl', number>>
  paraPersonagemIds?: string[]
  itens?: ItemDistribuidoPayload[]
}

interface ResultadoAcaoInventario extends ResultadoAcao {
  descricao?: string
}

async function chamarAcaoInventario(payload: AcaoInventarioParams): Promise<ResultadoAcaoInventario> {
  try {
    const resp = await fetch('/api/mesa/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const dados = await resp.json().catch(() => null)
    if (!resp.ok) {
      return { ok: false, erro: dados?.erro ?? 'Erro ao registrar ação' }
    }
    return { ok: true, descricao: dados?.descricao }
  } catch {
    return { ok: false, erro: 'Sem conexão — tente novamente' }
  }
}

// Ícone por tipo de item — mesmo vocabulário de `tipo` usado no compêndio da
// ficha (arma/armadura/magico/equipamento).
function iconeItem(tipo: string | null): string {
  switch (tipo) {
    case 'arma': return '⚔️'
    case 'armadura': return '🛡️'
    case 'magico': return '✨'
    case 'equipamento': return '🎒'
    default: return '📦'
  }
}

interface Destinatario {
  id: string
  nome: string
  imagemUrl?: string | null
}

// Select compacto de tipo de dano — usado quando a ação não já traz um
// tipo predeterminado (arma/magia sem damage_type cadastrado).
function SeletorTipoDano({ valor, onChange }: { valor: TipoDano; onChange: (t: TipoDano) => void }) {
  return (
    <select
      value={valor}
      onChange={e => onChange(e.target.value as TipoDano)}
      className="input-dd text-sm py-2"
    >
      {TIPOS_DANO.map(t => (
        <option key={t.id} value={t.id}>{t.icone} {t.nome}</option>
      ))}
    </select>
  )
}

interface InfoPersonagem {
  imagem_url: string | null
  classe: string | null
  nivel: number | null
  deslocamento: number | null
  user_id: string | null
}

interface AtaqueDisponivel {
  nome: string
  bonus: string
  dano: string
  tipo_dano?: string
}

interface MagiaExibida {
  id: string
  nome: string
  nivel: number
  preparada: boolean
  danoDice: string | null
  tipoDano: TipoDano | null
  curaDice: string | null
  concentracao: boolean
  saveAbility: string | null
}

// Classificação da magia para o fluxo de conjuração: dano/cura pedem alvo e
// valor; utilitária só registra no log; concentração ganha a opção extra de
// marcar como efeito ativo (não é exclusiva das outras três).
function classificarMagia(m: MagiaExibida): { efeito: 'dano' | 'cura' | 'nenhum' } {
  if (m.danoDice) return { efeito: 'dano' }
  if (m.curaDice) return { efeito: 'cura' }
  return { efeito: 'nenhum' }
}

function ordenarPorNome(combatentes: Combatente[]): Combatente[] {
  return [...combatentes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// Jogadores têm ataques em dados_personagem.ataques; monstros/NPCs do
// bestiário trazem ataques_estruturados (MonsterAction[]) — formatos
// diferentes, mesmo uso nos slots de arma / lista de ataque. Só entram os
// que têm dado de dano (o resto — traços, lendárias sem dano — não cabe
// no modelo "nome/bônus/dano" desses controles.
function ataquesDoCombatente(c: Combatente): AtaqueDisponivel[] {
  if (c.dados_personagem?.ataques) return c.dados_personagem.ataques
  if (c.ataques_estruturados) {
    return c.ataques_estruturados
      .filter(a => a.damage_dice)
      .map(a => ({
        nome: a.name_pt,
        bonus: a.attack_bonus != null ? (a.attack_bonus >= 0 ? `+${a.attack_bonus}` : `${a.attack_bonus}`) : '',
        dano: a.damage_dice ?? '',
        tipo_dano: a.damage_type_pt ?? undefined,
      }))
  }
  return []
}

function mensagemToast(entrada: EntradaLog): string | null {
  if (entrada.tipo === 'dano' && entrada.valor != null) {
    return `⚔️ ${entrada.origem} causou ${entrada.valor} em ${entrada.alvo}`
  }
  if (entrada.tipo === 'cura' && entrada.valor != null) {
    return `💚 ${entrada.origem} curou ${entrada.valor} em ${entrada.alvo}`
  }
  if (entrada.tipo === 'morte') {
    return `💀 ${entrada.alvo} caiu!`
  }
  return null
}

// Degradação graciosa: prioriza magias preparadas; se nenhuma estiver
// marcada como preparada (caso comum hoje — a ficha ainda não expõe esse
// toggle), mostra todas com um aviso em vez de uma lista vazia enganosa.
function selecionarMagiasExibidas(magias: MagiaExibida[]): { magias: MagiaExibida[]; aviso: string | null } {
  if (magias.length === 0) return { magias: [], aviso: null }
  const preparadas = magias.filter(m => m.preparada)
  if (preparadas.length > 0) return { magias: preparadas, aviso: null }
  return { magias, aviso: 'Nenhuma magia marcada como preparada na ficha' }
}

function Avatar({ nome, imagemUrl, tamanho = 44 }: { nome: string; imagemUrl?: string | null; tamanho?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 relative"
      style={{ width: tamanho, height: tamanho, backgroundColor: 'var(--surface2)' }}
    >
      <span
        className="text-[var(--text2)] font-cinzel font-bold absolute inset-0 flex items-center justify-center"
        style={{ fontSize: tamanho * 0.4 }}
      >
        {nome.charAt(0).toUpperCase()}
      </span>
      {imagemUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagemUrl}
          alt={nome}
          className="w-full h-full object-cover relative"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
    </div>
  )
}

function EspacosMagiaLeitura({ espacos }: { espacos: EspacosMagiaBatalha }) {
  const niveis = Object.entries(espacos)
    .filter(([, e]) => e.total > 0)
    .map(([n, e]) => ({ nivel: parseInt(n), ...e }))
    .sort((a, b) => a.nivel - b.nivel)

  if (niveis.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]">
      {niveis.map(({ nivel, total, utilizados }) => (
        <div key={nivel} className="flex items-center gap-0.5">
          <span className="text-[var(--text3)] font-cinzel">N{nivel}</span>
          <span style={{ color: 'var(--accent2)' }}>
            {'●'.repeat(Math.max(0, total - utilizados))}{'○'.repeat(Math.min(total, utilizados))}
          </span>
        </div>
      ))}
    </div>
  )
}

// Teclado numérico grande — NUNCA pede o resultado do d20, só o total já
// resolvido (dano ou cura) que o jogador rolou fisicamente ou no app de dados.
function TecladoNumerico({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C']
  function tocar(tecla: string) {
    if (tecla === '⌫') { onChange(valor.slice(0, -1)); return }
    if (tecla === 'C') { onChange(''); return }
    if (valor.length >= 4) return
    onChange(valor === '0' ? tecla : valor + tecla)
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {teclas.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => tocar(t)}
          className="min-h-[52px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-cinzel text-lg font-bold active:bg-[var(--bg3)]"
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// Passo final de qualquer ação que precise de um número — dano ou cura já
// resolvidos. Tipo de dano só aparece quando a ação não já traz um fixo
// (arma/magia sem damage_type cadastrado).
function ModalValorAcao({
  acao, alvosNomes, enviando, onConfirmar, onFechar,
}: {
  acao: AcaoPendente
  alvosNomes: string[]
  enviando: boolean
  onConfirmar: (valor: number, tipoDano: TipoDano | null) => void
  onFechar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [tipoDano, setTipoDano] = useState<TipoDano>(acao.tipoDanoPadrao ?? 'cortante')
  const precisaTipoDano = acao.efeito === 'dano' && !acao.tipoDanoPadrao
  const valorNumerico = parseInt(texto) || 0

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">{acao.nomeAcao}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {alvosNomes.length > 0 && (
          <p className="text-[var(--text3)] text-xs font-crimson mb-2 truncate">→ {alvosNomes.join(', ')}</p>
        )}

        <div className="text-center py-2 mb-2 rounded-lg bg-[var(--bg2)] border border-[var(--border)]">
          <span className="font-cinzel font-bold text-3xl text-[var(--text)]">{texto || '0'}</span>
          <span className="text-[var(--text3)] text-xs ml-1.5">{acao.efeito === 'cura' ? 'PV de cura' : 'de dano'}</span>
        </div>

        {precisaTipoDano && (
          <div className="mb-2">
            <SeletorTipoDano valor={tipoDano} onChange={setTipoDano} />
          </div>
        )}

        <TecladoNumerico valor={texto} onChange={setTexto} />

        <button
          onClick={() => onConfirmar(valorNumerico, acao.efeito === 'dano' ? tipoDano : null)}
          disabled={valorNumerico <= 0 || enviando}
          className={cn(
            'w-full mt-3 py-3 rounded-lg font-cinzel text-sm font-bold min-h-[48px] flex items-center justify-center gap-2',
            'bg-[var(--gold)] text-[var(--bg)] disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirmar ${acao.efeito === 'cura' ? 'cura' : 'dano'}`}
        </button>
      </div>
    </div>,
    document.body
  )
}

// Bandeja flutuante de seleção de alvo — fixed, fora do fluxo da tela
// principal (não pode empurrar layout / criar scroll vertical). Aparece
// enquanto há uma ação pendente que precisa de alvo.
function BandejaAlvos({
  acao, alvos, enviando, onConfirmar, onCancelar,
}: {
  acao: AcaoPendente
  alvos: AlvoSelecionado[]
  enviando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return createPortal(
    <div className="fixed left-0 right-0 bottom-0 z-[9997] flex justify-center px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-[var(--bg3)] border border-[var(--gold)]/60 rounded-xl shadow-2xl p-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[var(--gold)] text-xs font-cinzel font-bold truncate">{acao.nomeAcao}</p>
          <p className="text-[var(--text3)] text-[11px] font-crimson truncate">
            {alvos.length === 0 ? 'Toque um alvo na barra acima' : alvos.map(a => a.nome).join(', ')}
          </p>
        </div>
        <button
          onClick={onCancelar}
          className="flex-shrink-0 px-2.5 py-2 rounded-lg border border-[var(--border)] text-[var(--text3)] text-xs font-cinzel min-h-[40px]"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={alvos.length === 0 || enviando}
          className="flex-shrink-0 px-3 py-2 rounded-lg bg-[var(--gold)] text-[var(--bg)] text-xs font-cinzel font-bold min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Confirmar ({alvos.length})
        </button>
      </div>
    </div>,
    document.body
  )
}

function ModalCondicao({ condicao, onFechar }: { condicao: TipoCondicao; onFechar: () => void }) {
  const info = getCondicao(condicao)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-lg shadow-2xl max-w-sm w-full p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-cinzel text-[var(--accent2)] font-bold text-base flex items-center gap-2">
            <span>{info?.icone}</span> {condicao}
          </h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        {info ? (
          <>
            <p className="text-[var(--text2)] text-sm font-crimson mb-3">{info.descricao}</p>
            {info.efeitos.length > 0 && (
              <ul className="list-disc list-inside space-y-1 mb-3">
                {info.efeitos.map((ef, i) => (
                  <li key={i} className="text-[var(--text3)] text-xs font-crimson">{ef}</li>
                ))}
              </ul>
            )}
            {info.como_sair && (
              <p className="text-[var(--text3)] text-xs font-crimson italic">Como sair: {info.como_sair}</p>
            )}
          </>
        ) : (
          <p className="text-[var(--text3)] text-sm font-crimson">Sem descrição disponível.</p>
        )}
      </div>
    </div>,
    document.body
  )
}

// Popup de combatente — substitui as antigas listas de Aliados/Inimigos.
// Fase 2: só leitura. Fase 3 reaproveita este mesmo popup como seletor de alvo.
function PopupCombatente({
  combatente: c, info, revelacaoPv, ehDM, selecionandoAlvo, alvoJaSelecionado, onSelecionarAlvo, onFechar,
}: {
  combatente: Combatente
  info: InfoPersonagem | undefined
  revelacaoPv: ModoRevelacao
  ehDM: boolean
  selecionandoAlvo?: boolean
  alvoJaSelecionado?: boolean
  onSelecionarAlvo?: () => void
  onFechar: () => void
}) {
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const estaMorto = c.morto || c.pv_atual <= 0
  const visibilidade = ehDM ? { modo: 'exato' as const } : pvVisivelParaJogador(c, revelacaoPv)

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={48} />
          <div className="min-w-0 flex-1">
            <p className="font-cinzel text-[var(--gold)] font-bold text-base truncate">{c.nome}{estaMorto ? ' 💀' : ''}</p>
            {c.ausente && <p className="text-[var(--text3)] text-xs font-crimson">Ausente</p>}
          </div>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          {visibilidade.modo === 'exato' && (
            <>
              <span className="text-[var(--text2)] text-sm font-cinzel">PV {c.pv_atual}/{c.pv_maximo}</span>
              <span className="text-[var(--text2)] text-sm font-cinzel">CA {c.ca}</span>
            </>
          )}
          {visibilidade.modo === 'vago' && visibilidade.estado && (
            <span
              className="px-2 py-0.5 rounded border text-xs font-cinzel font-bold"
              style={{ color: ESTADO_VAGO_INFO[visibilidade.estado].cor, borderColor: ESTADO_VAGO_INFO[visibilidade.estado].cor }}
            >
              {ESTADO_VAGO_INFO[visibilidade.estado].label}
            </span>
          )}
          {visibilidade.modo === 'oculto' && (
            <span className="text-[var(--text3)] text-xs font-crimson italic">PV desconhecido</span>
          )}
        </div>

        {c.condicoes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {c.condicoes.map(cond => (
              <button
                key={cond}
                onClick={() => setCondicaoAberta(cond)}
                className="px-2.5 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-xs font-crimson flex items-center gap-1 min-h-[36px]"
              >
                <span>{getCondicao(cond)?.icone}</span>{cond}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text3)] text-xs font-crimson italic">Sem condições ativas</p>
        )}

        {selecionandoAlvo && (
          <button
            onClick={onSelecionarAlvo}
            className={cn(
              'w-full mt-3 py-2.5 rounded-lg font-cinzel text-sm font-bold min-h-[44px] border transition-colors',
              alvoJaSelecionado
                ? 'bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]'
            )}
          >
            {alvoJaSelecionado ? '✓ Alvo selecionado — toque para remover' : '🎯 Selecionar como alvo'}
          </button>
        )}

        {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
      </div>
    </div>,
    document.body
  )
}

// Barra de participantes — NUNCA em ordem de iniciativa/ordem de turno (a
// mesa sorteia por cartas a cada rodada; vazar a ordem deixaria os
// jogadores planejarem sabendo quem vem depois). O segredo é a ORDEM, não a
// EXISTÊNCIA dos inimigos — eles estão fisicamente na mesa, todo mundo os
// vê. Por isso: fora do modo de seleção de alvo, o jogador só vê os PJs
// (não precisa saber quem mais o DM colocou na cena ainda); ao entrar em
// modo de alvo, os inimigos aparecem, sempre em ordem ALFABÉTICA dentro de
// cada grupo — nunca pela ordem de turno. O único indício de sequência
// permitido é o anel de quem age AGORA (isso já é público via StatusRodada).
// Tocar um avatar abre o popup de detalhes; alvos já escolhidos ganham um
// destaque próprio para não precisar reabrir o popup para conferir.
function BarraParticipantes({
  aliados, inimigos, turnoCombatenteId, ativa, infoPersonagens, meuCombatenteIds, alvosSelecionadosIds, onTocar,
}: {
  aliados: Combatente[]
  inimigos: Combatente[]
  turnoCombatenteId: string | null
  ativa: boolean
  infoPersonagens: Record<string, InfoPersonagem>
  meuCombatenteIds: Set<string>
  alvosSelecionadosIds: Set<string>
  onTocar: (id: string) => void
}) {
  function avatarDe(c: Combatente, ehInimigo: boolean) {
    const info = c.personagem_id ? infoPersonagens[c.personagem_id] : undefined
    const estaAtivo = ativa && c.id === turnoCombatenteId
    const estaMorto = c.morto || c.pv_atual <= 0
    const ehMeu = meuCombatenteIds.has(c.id)
    const selecionado = alvosSelecionadosIds.has(c.id)
    const anel = selecionado
      ? '0 0 0 3px var(--gold)'
      : estaAtivo
        ? '0 0 0 2px var(--gold)'
        : ehMeu
          ? '0 0 0 2px var(--accent2)'
          : ehInimigo
            ? '0 0 0 1px var(--red2)'
            : '0 0 0 1px var(--border)'
    return (
      <button
        key={c.id}
        onClick={() => onTocar(c.id)}
        className={cn('flex-shrink-0 flex flex-col items-center gap-0.5 w-14', (estaMorto || c.ausente) && 'opacity-40')}
      >
        <div className="rounded-full p-0.5" style={{ boxShadow: anel }}>
          <div className="relative">
            <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={44} />
            {c.condicoes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--red2)] border border-[var(--bg2)]" />
            )}
            {selecionado && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--gold)] border border-[var(--bg2)] flex items-center justify-center text-[9px] leading-none">
                🎯
              </span>
            )}
          </div>
        </div>
        <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{c.nome}</span>
      </button>
    )
  }

  return (
    <div className="flex-shrink-0 flex items-stretch gap-2 overflow-x-auto px-3 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
      {aliados.map(c => avatarDe(c, false))}
      {inimigos.length > 0 && (
        <>
          <div className="w-px bg-[var(--border)] flex-shrink-0 my-1" />
          {inimigos.map(c => avatarDe(c, true))}
        </>
      )}
    </div>
  )
}

function StatusRodada({
  ativa, statusBatalha, rodadaAtual, combatenteDoTurno, ehMeuTurno,
}: {
  ativa: boolean
  statusBatalha: string
  rodadaAtual: number
  combatenteDoTurno: Combatente | null
  ehMeuTurno: boolean
}) {
  if (statusBatalha === 'pausada') {
    return (
      <div className="flex-shrink-0 py-1.5 text-center">
        <span className="text-[var(--gold)] text-xs font-cinzel animate-pulse">⏸ Pausada</span>
      </div>
    )
  }
  if (!ativa) {
    return (
      <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
        Rodada {rodadaAtual}
      </div>
    )
  }
  // Motivo do bloqueio sempre visível na tela, não só no tooltip dos
  // botões desabilitados — bloqueio silencioso vira "o app não funciona".
  if (!combatenteDoTurno) {
    return (
      <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
        ⏳ O mestre ainda não definiu de quem é a vez · Rodada {rodadaAtual}
      </div>
    )
  }
  if (ehMeuTurno) {
    return (
      <div className="flex-shrink-0 py-1.5 bg-[var(--gold)] text-[var(--bg)] text-center font-cinzel font-bold text-xs">
        ⚔️ É a sua vez! · Rodada {rodadaAtual}
      </div>
    )
  }
  return (
    <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
      Aguarde sua vez — quem age agora é {combatenteDoTurno.nome} · Rodada {rodadaAtual}
    </div>
  )
}

// Cartão central — único elemento que pode encolher. Sem scroll: quando o
// conteúdo aperta, a densidade (fonte/espaçamento) cede, nunca overflow.
function CartaoPersonagem({
  combatente: c, info, opcoesSelecao, mostrarSeletorSempre, rotuloSeletor, selecionadoId, onSelecionar, onEncerrarEfeito,
}: {
  combatente: Combatente
  info: InfoPersonagem | undefined
  opcoesSelecao: Combatente[]
  mostrarSeletorSempre?: boolean
  rotuloSeletor?: string
  selecionadoId: string | null
  onSelecionar: (id: string) => void
  onEncerrarEfeito?: (nome: string) => void
}) {
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const estaMorto = c.morto || c.pv_atual <= 0
  const subtitulo = [info?.classe, info?.nivel ? `Nv${info.nivel}` : null].filter(Boolean).join(' · ')
  const derivada = useMemo(() => vantagemDerivada(c.condicoes), [c.condicoes])

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden rounded-xl bg-[var(--bg2)] border border-[var(--gold)]/40 shadow-lg p-3">
      {(mostrarSeletorSempre ? opcoesSelecao.length > 0 : opcoesSelecao.length > 1) && (
        <div className="flex-shrink-0">
          {rotuloSeletor && <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase mb-0.5">{rotuloSeletor}</p>}
          <select
            value={selecionadoId ?? ''}
            onChange={e => onSelecionar(e.target.value)}
            className="input-dd w-full text-xs py-1"
          >
            {opcoesSelecao.map(mc => <option key={mc.id} value={mc.id}>{mc.nome}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        <Avatar nome={c.nome} imagemUrl={info?.imagem_url} tamanho={44} />
        <div className="min-w-0 flex-1">
          <h2 className="font-cinzel text-[var(--gold)] text-sm font-bold truncate leading-tight">{c.nome}{estaMorto ? ' 💀' : ''}</h2>
          {subtitulo && <p className="text-[var(--text3)] text-[10px] font-crimson leading-tight">{subtitulo}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-cinzel font-bold text-[var(--text)] leading-none">
            {c.pv_atual}<span className="text-[var(--text3)] text-xs">/{c.pv_maximo}</span>
          </p>
          {c.pv_temporarios > 0 && <p className="text-[var(--accent2)] text-[10px] font-cinzel leading-tight">+{c.pv_temporarios} temp</p>}
        </div>
      </div>

      <BarraVida atual={c.pv_atual} maximo={c.pv_maximo} temporarios={c.pv_temporarios} className="flex-shrink-0" />

      <div className="flex items-center gap-3 flex-shrink-0 text-xs font-cinzel text-[var(--text2)]">
        <span>CA <b className="text-[var(--text)]">{c.ca}</b></span>
        <span>Desloc. <b className="text-[var(--text)]">{info?.deslocamento ? `${info.deslocamento}m` : '—'}</b></span>
      </div>

      {c.condicoes.length > 0 && (
        <div className="flex flex-wrap gap-1 flex-shrink-0">
          {c.condicoes.map(cond => (
            <button
              key={cond}
              onClick={() => setCondicaoAberta(cond)}
              className="px-2 py-1 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-[10px] font-crimson flex items-center gap-1"
            >
              <span>{getCondicao(cond)?.icone}</span>{cond}
            </button>
          ))}
        </div>
      )}

      {derivada.motivos.length > 0 && (
        <div className="flex-shrink-0 space-y-0.5 overflow-hidden">
          {derivada.motivos.map((m, i) => (
            <p key={i} className="text-[var(--gold)] text-[10px] font-crimson leading-tight truncate">⚠️ {m}</p>
          ))}
        </div>
      )}

      {Object.keys(c.espacos_magia).length > 0 && (
        <div className="flex-shrink-0">
          <EspacosMagiaLeitura espacos={c.espacos_magia} />
        </div>
      )}

      {/* Lembrete, não automação — o app não tem grid posicional para saber
          quem entrou no raio. O conjurador (ou o DM operando por ele)
          encerra manualmente quando o efeito acabar. */}
      {c.efeitos_ativos.length > 0 && (
        <div className="flex flex-wrap gap-1 flex-shrink-0">
          {c.efeitos_ativos.map(ef => (
            <button
              key={ef.nome}
              onClick={() => onEncerrarEfeito?.(ef.nome)}
              disabled={!onEncerrarEfeito}
              title={onEncerrarEfeito ? 'Toque para encerrar o efeito' : undefined}
              className="px-2 py-1 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/50 text-[var(--gold)] text-[10px] font-crimson flex items-center gap-1"
            >
              ✨ {ef.nome} · R{ef.rodada_inicio}
            </button>
          ))}
        </div>
      )}

      {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
    </div>
  )
}

// Toggle de três estados — persiste no combatente via API (nenhuma escrita
// direta) e acompanha a próxima ação enviada. O aviso derivado das condições
// (FaixaVantagem é renderizada logo abaixo do cartão que já mostra os
// motivos) continua só informativo: quem decide é sempre a mesa.
function FaixaVantagem({
  valor, podeAgir, enviando, onEscolher,
}: {
  valor: 'vantagem' | 'desvantagem' | null
  podeAgir: boolean
  enviando: boolean
  onEscolher: (v: 'vantagem' | 'desvantagem' | null) => void
}) {
  const opcoes = [
    { valor: 'desvantagem' as const, label: '▼ Desvantagem', corAtiva: 'var(--red2)' },
    { valor: null, label: 'Normal', corAtiva: 'var(--surface2)' },
    { valor: 'vantagem' as const, label: '▲ Vantagem', corAtiva: 'var(--green2)' },
  ]

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5">
      <div className="flex items-center rounded-lg overflow-hidden border border-[var(--border)]">
        {opcoes.map(opt => {
          const ativa = valor === opt.valor
          return (
            <button
              key={opt.label}
              onClick={() => onEscolher(opt.valor)}
              disabled={!podeAgir || enviando}
              title={podeAgir ? undefined : 'Aguarde sua vez'}
              className={cn(
                'flex-1 text-center py-2 text-[11px] font-cinzel transition-colors min-h-[38px]',
                (!podeAgir || enviando) && 'cursor-not-allowed opacity-60',
                ativa ? 'text-[var(--text)]' : 'text-[var(--text3)]'
              )}
              style={ativa ? { backgroundColor: opt.corAtiva } : undefined}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModalEscolherArma({
  ataques, armaAtual, onEscolher, onLimpar, onFechar,
}: {
  ataques: AtaqueDisponivel[]
  armaAtual: ArmaEmpunhada | null | undefined
  onEscolher: (arma: ArmaEmpunhada) => void
  onLimpar: () => void
  onFechar: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">Empunhar arma</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {ataques.map((a, i) => (
            <button
              key={i}
              onClick={() => onEscolher(a)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
            >
              <span className="text-[var(--text)] text-sm font-crimson truncate">{a.nome}</span>
              <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">{a.bonus} · {a.dano}</span>
            </button>
          ))}
        </div>
        {armaAtual && (
          <button
            onClick={onLimpar}
            className="w-full mt-3 py-2.5 rounded-lg border border-[var(--red2)]/50 text-[var(--red2)] text-xs font-cinzel min-h-[44px]"
          >
            ✕ Desempunhar
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

// Slot de arma empunhada. Empunhar/trocar continua sendo a única escrita
// direta (preferência de UI, não ação de jogo — arma_esquerda/direita têm
// policy própria). Tocar um slot preenchido ataca com aquela arma, pulando
// direto para a seleção de alvo; só o ícone ⇄ abre o seletor de novo.
function SlotArma({
  arma, ataquesDisponiveis, podeAgir, onEscolher, onLimpar, onAtacar,
}: {
  arma: ArmaEmpunhada | null | undefined
  ataquesDisponiveis: AtaqueDisponivel[]
  podeAgir: boolean
  onEscolher: (arma: ArmaEmpunhada) => void
  onLimpar: () => void
  onAtacar: (arma: ArmaEmpunhada) => void
}) {
  const [abrindoPicker, setAbrindoPicker] = useState(false)

  if (!arma && ataquesDisponiveis.length === 0) {
    return (
      <div className="flex-shrink-0 w-16 min-h-[56px] flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[var(--text3)] text-[9px] font-crimson text-center px-1 leading-tight">
        Sem ataques na ficha
      </div>
    )
  }

  if (!arma) {
    return (
      <>
        <button
          onClick={() => setAbrindoPicker(true)}
          className="flex-shrink-0 w-16 min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[var(--accent2)]/60 text-[var(--accent2)] text-[10px] font-cinzel"
        >
          <span className="text-base leading-none">+</span>
          Empunhar
        </button>
        {abrindoPicker && (
          <ModalEscolherArma
            ataques={ataquesDisponiveis}
            armaAtual={null}
            onEscolher={a => { onEscolher(a); setAbrindoPicker(false) }}
            onLimpar={() => setAbrindoPicker(false)}
            onFechar={() => setAbrindoPicker(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={podeAgir ? 0 : -1}
        onClick={() => podeAgir && onAtacar(arma)}
        onKeyDown={e => { if (podeAgir && e.key === 'Enter') onAtacar(arma) }}
        title={podeAgir ? `Atacar com ${arma.nome}` : 'Aguarde sua vez'}
        className={cn(
          'relative flex-shrink-0 w-16 min-h-[56px] rounded-lg border border-[var(--border)] bg-[var(--surface)]',
          'flex flex-col items-center justify-center px-1 text-center transition-opacity',
          podeAgir ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
        )}
      >
        <p className="text-[var(--text)] text-[11px] font-cinzel font-bold truncate w-full leading-tight">{arma.nome}</p>
        <p className="text-[var(--text3)] text-[10px] font-crimson leading-tight">{arma.dano}</p>
        <button
          onClick={e => { e.stopPropagation(); setAbrindoPicker(true) }}
          title="Trocar arma"
          aria-label="Trocar arma"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--bg3)] border border-[var(--border)] text-[var(--text3)] flex items-center justify-center text-[10px]"
        >
          ⇄
        </button>
      </div>
      {abrindoPicker && (
        <ModalEscolherArma
          ataques={ataquesDisponiveis}
          armaAtual={arma}
          onEscolher={a => { onEscolher(a); setAbrindoPicker(false) }}
          onLimpar={() => { onLimpar(); setAbrindoPicker(false) }}
          onFechar={() => setAbrindoPicker(false)}
        />
      )}
    </>
  )
}

// ⚔️ Ataque — lista completa (não só o que está empunhado): ataques da
// ficha + desarmado + improvisado, para o que não está nos slots.
function ModalListaAtaques({
  ataques, onEscolher, onFechar,
}: {
  ataques: AtaqueDisponivel[]
  onEscolher: (a: AtaqueDisponivel) => void
  onFechar: () => void
}) {
  const opcoesExtra: AtaqueDisponivel[] = [
    { nome: 'Ataque desarmado', bonus: '', dano: '', tipo_dano: 'contundente' },
    { nome: 'Improvisado', bonus: '', dano: '', tipo_dano: undefined },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">⚔️ Escolher ataque</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {[...ataques, ...opcoesExtra].map((a, i) => (
            <button
              key={`${a.nome}-${i}`}
              onClick={() => onEscolher(a)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
            >
              <span className="text-[var(--text)] text-sm font-crimson truncate">{a.nome}</span>
              {(a.bonus || a.dano) && (
                <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0">{[a.bonus, a.dano].filter(Boolean).join(' · ')}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

interface ConjuracaoEscolhida {
  magia: MagiaExibida
  nivelConjurado: number | null // null = truque, sem gasto de espaço
  efeitoAtivo: boolean
}

// Só níveis com espaço realmente disponível — o mínimo é o da magia (regra
// 5e: não dá para conjurar abaixo do nível base), o teto é 9.
function niveisDisponiveisParaMagia(
  nivelBase: number,
  espacosMagia: EspacosMagiaBatalha
): { nivel: number; disponivel: number; total: number }[] {
  return Array.from({ length: 9 - nivelBase + 1 }, (_, i) => nivelBase + i)
    .map(nivel => {
      const espaco = espacosMagia[nivel]
      return espaco ? { nivel, disponivel: espaco.total - espaco.utilizados, total: espaco.total } : null
    })
    .filter((x): x is { nivel: number; disponivel: number; total: number } => !!x && x.disponivel > 0)
}

// ✨ Magia — lista com degradação graciosa (Fase 2). Ao escolher uma magia
// de nível > 0, abre o passo de nível de conjuração (permite conjurar em
// nível superior); o espaço em si só é consumido pela API, nunca aqui.
function ModalMagias({
  personagemId, personagemNome, espacosMagia, onConjurar, onFechar,
}: {
  personagemId: string
  personagemNome: string
  espacosMagia: EspacosMagiaBatalha
  onConjurar: (escolha: ConjuracaoEscolhida) => void
  onFechar: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [magias, setMagias] = useState<MagiaExibida[]>([])
  const [magiaEscolhida, setMagiaEscolhida] = useState<MagiaExibida | null>(null)
  const [nivelEscolhido, setNivelEscolhido] = useState<number>(0)
  const [efeitoAtivo, setEfeitoAtivo] = useState(false)

  useEffect(() => {
    let cancelado = false
    createClient()
      .from('magias_personagem')
      .select(`
        id, preparada, nivel,
        spell:spells!spell_id(name_pt, damage_dice, damage_type_pt, heal_dice, concentration, save_ability, save_effect)
      `)
      .eq('personagem_id', personagemId)
      .order('nivel')
      .then(({ data }) => {
        if (cancelado) return
        type LinhaMagia = {
          id: string; preparada: boolean; nivel: number
          spell: Pick<Spell, 'name_pt' | 'damage_dice' | 'damage_type_pt' | 'heal_dice' | 'concentration' | 'save_ability' | 'save_effect'> | null
        }
        const linhas = (data ?? []) as unknown as LinhaMagia[]
        setMagias(linhas.map(m => ({
          id: m.id,
          nome: m.spell?.name_pt ?? '(sem nome)',
          nivel: m.nivel,
          preparada: m.preparada,
          danoDice: m.spell?.damage_dice ?? null,
          tipoDano: (m.spell?.damage_type_pt as TipoDano | undefined) ?? null,
          curaDice: m.spell?.heal_dice ?? null,
          concentracao: m.spell?.concentration ?? false,
          saveAbility: m.spell?.save_ability ?? null,
        })))
        setCarregando(false)
      })
    return () => { cancelado = true }
  }, [personagemId])

  const { magias: exibidas, aviso } = selecionarMagiasExibidas(magias)

  function escolherMagia(m: MagiaExibida) {
    setMagiaEscolhida(m)
    setNivelEscolhido(niveisDisponiveisParaMagia(m.nivel, espacosMagia)[0]?.nivel ?? m.nivel)
    setEfeitoAtivo(false)
  }

  const niveisDisponiveis = magiaEscolhida && magiaEscolhida.nivel > 0
    ? niveisDisponiveisParaMagia(magiaEscolhida.nivel, espacosMagia)
    : []
  const semNivelDisponivel = !!magiaEscolhida && magiaEscolhida.nivel > 0 && niveisDisponiveis.length === 0

  function confirmar() {
    if (!magiaEscolhida || semNivelDisponivel) return
    onConjurar({
      magia: magiaEscolhida,
      nivelConjurado: magiaEscolhida.nivel > 0 ? nivelEscolhido : null,
      efeitoAtivo,
    })
  }

  const { efeito } = magiaEscolhida ? classificarMagia(magiaEscolhida) : { efeito: 'nenhum' as const }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {!magiaEscolhida ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate">✨ Magias — {personagemNome}</h3>
              <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {carregando ? (
              <p className="text-[var(--text3)] text-xs font-crimson text-center py-4">Carregando...</p>
            ) : magias.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-[var(--text3)] text-xs font-crimson">Nenhuma magia na ficha</p>
                <Link href={`/personagens/${personagemId}`} className="text-[var(--accent2)] text-xs font-cinzel hover:underline">
                  Ver ficha do personagem →
                </Link>
              </div>
            ) : (
              <>
                {aviso && <p className="text-[var(--gold)] text-[11px] font-crimson italic mb-2">⚠️ {aviso}</p>}
                <div className="space-y-1">
                  {exibidas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => escolherMagia(m)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-left min-h-[44px] transition-colors"
                    >
                      <span className="text-[var(--text)] text-sm font-crimson truncate">{m.nome}</span>
                      <span className="text-[var(--text3)] text-xs font-cinzel flex-shrink-0 ml-2">{m.nivel === 0 ? 'Truque' : `N${m.nivel}`}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setMagiaEscolhida(null)} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">
                ←
              </button>
              <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm truncate flex-1">{magiaEscolhida.nome}</h3>
              <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[var(--text3)] text-xs font-crimson mb-3">
              {efeito === 'dano' && `Causa dano${magiaEscolhida.tipoDano ? ` (${magiaEscolhida.tipoDano})` : ''}`}
              {efeito === 'cura' && 'Causa cura'}
              {efeito === 'nenhum' && 'Utilitária — registra no log, sem valor'}
              {magiaEscolhida.saveAbility && ` · Salvaguarda: ${magiaEscolhida.saveAbility}`}
            </p>

            {magiaEscolhida.nivel > 0 && (
              <div className="mb-3">
                <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Nível de conjuração</p>
                {niveisDisponiveis.length === 0 ? (
                  <p className="text-[var(--red2)] text-xs font-crimson">
                    Sem espaços de magia disponíveis para conjurar esta magia
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {niveisDisponiveis.map(({ nivel: n, disponivel, total }) => (
                      <button
                        key={n}
                        onClick={() => setNivelEscolhido(n)}
                        className={cn(
                          'px-3 py-2 rounded-lg border text-xs font-cinzel min-h-[40px]',
                          nivelEscolhido === n
                            ? 'bg-[var(--gold)] border-[var(--gold)] text-[var(--bg)] font-bold'
                            : 'border-[var(--border)] text-[var(--text2)]'
                        )}
                      >
                        N{n} ({disponivel}/{total})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {magiaEscolhida.concentracao && (
              <label className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={efeitoAtivo}
                  onChange={e => setEfeitoAtivo(e.target.checked)}
                  className="w-4 h-4 accent-[var(--gold)]"
                />
                <span className="text-[var(--text2)] text-xs font-crimson">🔮 Manter como efeito ativo (concentração)</span>
              </label>
            )}

            <button
              onClick={confirmar}
              disabled={semNivelDisponivel}
              className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {efeito === 'nenhum' ? 'Registrar' : 'Continuar'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// 🎒 Item — lista do inventário. Fase 3: só registra o uso no log e aplica
// cura se o jogador informar um valor (poção). Sem decremento de
// quantidade nem transferência — isso é Fase 4.
type ContextoAcao = { sessaoId: string } | { batalhaId: string; combatenteId: string }

function ModalItem({
  personagemId, contexto, destinatarios, onFechar,
}: {
  personagemId: string
  contexto: ContextoAcao
  destinatarios: Destinatario[]
  onFechar: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [itens, setItens] = useState<InventarioItemDb[]>([])
  const [itemEscolhido, setItemEscolhido] = useState<InventarioItemDb | null>(null)
  const [vista, setVista] = useState<'detalhe' | 'usar' | 'dar'>('detalhe')
  const [cura, setCura] = useState('')
  const [enviando, setEnviando] = useState(false)

  const carregarItens = useCallback(() => {
    createClient()
      .from('inventario_itens')
      .select('*')
      .eq('personagem_id', personagemId)
      .order('nome')
      .then(({ data }) => {
        setItens((data as InventarioItemDb[]) ?? [])
        setCarregando(false)
      })
  }, [personagemId])

  useEffect(() => { carregarItens() }, [carregarItens])

  // Realtime — reflete o que a API muda (inclusive itens recebidos por
  // transferência de outro jogador enquanto o modal está aberto).
  useEffect(() => {
    const supabase = createClient()
    const canal = supabase
      .channel(`modal-item-${personagemId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario_itens', filter: `personagem_id=eq.${personagemId}` },
        carregarItens
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [personagemId, carregarItens])

  async function executar(payload: Omit<AcaoInventarioParams, 'sessaoId' | 'personagemId' | 'batalhaId' | 'combatenteId'>) {
    if (enviando) return
    setEnviando(true)
    const resultado = await chamarAcaoInventario({
      ...('sessaoId' in contexto ? { sessaoId: contexto.sessaoId, personagemId } : { batalhaId: contexto.batalhaId, combatenteId: contexto.combatenteId }),
      ...payload,
    })
    setEnviando(false)
    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao registrar ação')
      return false
    }
    if (resultado.descricao) toast.success(resultado.descricao)
    return true
  }

  async function usar() {
    if (!itemEscolhido) return
    const ok = await executar({ tipo: 'usar_item', itemId: itemEscolhido.id, valorCura: parseInt(cura) || 0 })
    if (ok) { setItemEscolhido(null); carregarItens() }
  }

  async function darPara(destino: Destinatario) {
    if (!itemEscolhido) return
    const ok = await executar({ tipo: 'transferir_item', itemId: itemEscolhido.id, quantidade: 1, paraPersonagemId: destino.id })
    if (ok) { setItemEscolhido(null); carregarItens() }
  }

  async function equipar(equipado: boolean) {
    if (!itemEscolhido) return
    const ok = await executar({ tipo: 'equipar_item', itemId: itemEscolhido.id, equipado })
    if (ok) setItemEscolhido(prev => prev ? { ...prev, equipado } : prev)
  }

  async function descartar() {
    if (!itemEscolhido) return
    if (!window.confirm(`Descartar ${itemEscolhido.quantidade}x ${itemEscolhido.nome}?`)) return
    const ok = await executar({ tipo: 'descartar_item', itemId: itemEscolhido.id, quantidade: itemEscolhido.quantidade })
    if (ok) { setItemEscolhido(null); carregarItens() }
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

const OPCOES_REACAO = [
  { tipo: 'ataque_oportunidade' as const, label: 'Ataque de oportunidade', precisaAlvo: true, precisaValor: true },
  { tipo: 'contra_magia' as const, label: 'Contra-mágica', precisaAlvo: true, precisaValor: false },
  { tipo: 'escudo' as const, label: 'Escudo', precisaAlvo: false, precisaValor: false },
  { tipo: 'absorver_elementos' as const, label: 'Absorver elementos', precisaAlvo: false, precisaValor: false },
]

// ⚡ Reação — sempre disponível (dentro ou fora do turno), uma por rodada.
// "Outra reação" tem texto livre e vai direto pro log, sem alvo/valor.
function ModalReacao({
  onEscolher, onEnviarLivre, onFechar,
}: {
  onEscolher: (opt: typeof OPCOES_REACAO[number]) => void
  onEnviarLivre: (descricao: string) => void
  onFechar: () => void
}) {
  const [textoLivre, setTextoLivre] = useState<string | null>(null)
  const [texto, setTexto] = useState('')

  if (textoLivre !== null) {
    return createPortal(
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
        <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setTextoLivre(null)} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
            <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm flex-1">Outra reação</h3>
          </div>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={3}
            placeholder="Descreva a reação..."
            className="input-dd w-full text-sm mb-3 resize-none"
            autoFocus
          />
          <button
            onClick={() => onEnviarLivre(texto.trim())}
            disabled={!texto.trim()}
            className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Registrar reação
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">⚡ Reação</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {OPCOES_REACAO.map(opt => (
            <button
              key={opt.tipo}
              onClick={() => onEscolher(opt)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors"
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setTextoLivre('')}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors"
          >
            Outra reação
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Rodapé fixo — alcance do polegar. Fase 2 reserva o espaço e valida a
// ergonomia: Ataque, Magia e Item central desabilitam fora do turno; Reação
// fica sempre ativa (dentro ou fora do turno) até ser usada na rodada.
// Armas empunhadas continuam sendo a única escrita direta.
function BarraAcoes({
  combatente, ehMeuTurno, onDefinirArma, onAtacarComArma, onAbrirAtaque, onAbrirMagia, onAbrirItem, onAbrirReacao,
}: {
  combatente: Combatente
  ehMeuTurno: boolean
  onDefinirArma: (lado: 'esquerda' | 'direita', arma: ArmaEmpunhada | null) => void
  onAtacarComArma: (arma: ArmaEmpunhada) => void
  onAbrirAtaque: () => void
  onAbrirMagia: () => void
  onAbrirItem: () => void
  onAbrirReacao: () => void
}) {
  const ataquesDisponiveis = ataquesDoCombatente(combatente)
  const reacaoDisponivel = !combatente.reacao_usada
  // Magia e Item são conceitos de ficha (magias_personagem / inventário) —
  // não existem para monstros/NPCs sem personagem_id vinculado.
  const temFicha = !!combatente.personagem_id

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-2 py-1.5 space-y-1">
      <div className="flex items-stretch gap-1.5">
        <SlotArma
          arma={combatente.arma_esquerda}
          ataquesDisponiveis={ataquesDisponiveis}
          podeAgir={ehMeuTurno}
          onEscolher={a => onDefinirArma('esquerda', a)}
          onLimpar={() => onDefinirArma('esquerda', null)}
          onAtacar={onAtacarComArma}
        />

        <div className="flex-1 grid grid-cols-3 gap-1.5">
          <button
            onClick={onAbrirAtaque}
            disabled={!ehMeuTurno}
            aria-label="Atacar"
            title={ehMeuTurno ? 'Atacar' : 'Aguarde sua vez'}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] transition-opacity',
              !ehMeuTurno && 'opacity-40 cursor-not-allowed'
            )}
          >
            <span className="text-base leading-none">⚔️</span>
            Ataque
          </button>
          <button
            onClick={onAbrirMagia}
            disabled={!ehMeuTurno || !temFicha}
            aria-label="Conjurar magia"
            title={!temFicha ? 'Sem ficha vinculada' : ehMeuTurno ? 'Conjurar magia' : 'Aguarde sua vez'}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] transition-opacity',
              (!ehMeuTurno || !temFicha) && 'opacity-40 cursor-not-allowed'
            )}
          >
            <span className="text-base leading-none">✨</span>
            Magia
          </button>
          <button
            onClick={onAbrirItem}
            disabled={!ehMeuTurno || !temFicha}
            aria-label="Usar item"
            title={!temFicha ? 'Sem ficha vinculada' : ehMeuTurno ? 'Usar item' : 'Aguarde sua vez'}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[10px] min-h-[56px] transition-opacity',
              (!ehMeuTurno || !temFicha) && 'opacity-40 cursor-not-allowed'
            )}
          >
            <span className="text-base leading-none">🎒</span>
            Item
          </button>
        </div>

        <SlotArma
          arma={combatente.arma_direita}
          ataquesDisponiveis={ataquesDisponiveis}
          podeAgir={ehMeuTurno}
          onEscolher={a => onDefinirArma('direita', a)}
          onLimpar={() => onDefinirArma('direita', null)}
          onAtacar={onAtacarComArma}
        />
      </div>

      <button
        onClick={onAbrirReacao}
        disabled={!reacaoDisponivel}
        title={reacaoDisponivel ? 'Reação — disponível dentro ou fora do turno' : 'Reação já usada nesta rodada'}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 rounded-lg border font-cinzel text-xs py-1 min-h-[30px]',
          reacaoDisponivel
            ? 'border-[var(--accent2)]/50 bg-[var(--surface)] text-[var(--accent2)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text3)] opacity-50 cursor-not-allowed'
        )}
      >
        <span className="text-sm leading-none">⚡</span> {reacaoDisponivel ? 'Reação' : 'Reação usada'}
      </button>
    </div>
  )
}

// =============================================================================
// Modo sessão — fora de combate. Cartão do PJ editável (PV, PV temp,
// condições, inspiração, espaços de magia) e rodapé com ✨ Magia · 🎒 Item ·
// 💰 Ouro · 🛏️ Descanso, tudo via /api/mesa/acao (sem alvo, sem turno).
// =============================================================================

function BarraParticipantesSessao({
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

function EspacosMagiaSessao({
  slotsMagia, podeEditar, onUsar, onRecuperar,
}: {
  slotsMagia: Record<string, { total: number; usados: number }> | null
  podeEditar: boolean
  onUsar: (nivel: number) => void
  onRecuperar: (nivel: number) => void
}) {
  const niveis = Object.entries(slotsMagia ?? {})
    .filter(([, e]) => e.total > 0)
    .map(([n, e]) => ({ nivel: parseInt(n), ...e }))
    .sort((a, b) => a.nivel - b.nivel)

  if (niveis.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]">
      {niveis.map(({ nivel, total, usados }) => (
        <div key={nivel} className="flex items-center gap-1">
          <span className="text-[var(--text3)] font-cinzel">N{nivel}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => {
              const usado = i < usados
              return (
                <button
                  key={i}
                  disabled={!podeEditar}
                  onClick={() => usado ? onRecuperar(nivel) : onUsar(nivel)}
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border transition-all',
                    usado ? 'bg-transparent border-[var(--border)]' : 'bg-[var(--accent2)] border-[var(--accent2)]',
                    podeEditar ? 'hover:scale-125' : 'opacity-60 cursor-not-allowed'
                  )}
                  title={`Nível ${nivel}: ${total - usados}/${total} disponíveis`}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function CartaoPersonagemSessao({
  personagem, podeEditar, enviando,
  opcoesSelecao, mostrarSeletorSempre, rotuloSeletor, selecionadoId, onSelecionar,
  onAjustarPV, onDefinirPVTemp, onAdicionarCondicao, onRemoverCondicao, onUsarInspiracao,
  onUsarEspaco, onRecuperarEspaco,
}: {
  personagem: Personagem
  podeEditar: boolean
  enviando: boolean
  opcoesSelecao: Personagem[]
  mostrarSeletorSempre?: boolean
  rotuloSeletor?: string
  selecionadoId: string | null
  onSelecionar: (id: string) => void
  onAjustarPV: (delta: number) => void
  onDefinirPVTemp: (novoValor: number) => void
  onAdicionarCondicao: (c: TipoCondicao) => void
  onRemoverCondicao: (c: TipoCondicao) => void
  onUsarInspiracao: () => void
  onUsarEspaco: (nivel: number) => void
  onRecuperarEspaco: (nivel: number) => void
}) {
  const [condicaoAberta, setCondicaoAberta] = useState<TipoCondicao | null>(null)
  const [escolhendoCondicao, setEscolhendoCondicao] = useState(false)
  const subtitulo = [personagem.classe, personagem.nivel ? `Nv${personagem.nivel}` : null].filter(Boolean).join(' · ')
  const condicoesAtuais = (personagem.condicoes ?? []) as TipoCondicao[]

  return (
    <div className="h-full flex flex-col gap-1.5 overflow-hidden rounded-xl bg-[var(--bg2)] border border-[var(--gold)]/40 shadow-lg p-3">
      {(mostrarSeletorSempre ? opcoesSelecao.length > 0 : opcoesSelecao.length > 1) && (
        <div className="flex-shrink-0">
          {rotuloSeletor && <p className="text-[var(--text3)] text-[9px] font-cinzel uppercase mb-0.5">{rotuloSeletor}</p>}
          <select
            value={selecionadoId ?? ''}
            onChange={e => onSelecionar(e.target.value)}
            className="input-dd w-full text-xs py-1"
          >
            {opcoesSelecao.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        <Avatar nome={personagem.nome} imagemUrl={personagem.imagem_url} tamanho={44} />
        <div className="min-w-0 flex-1">
          <h2 className="font-cinzel text-[var(--gold)] text-sm font-bold truncate leading-tight">{personagem.nome}</h2>
          {subtitulo && <p className="text-[var(--text3)] text-[10px] font-crimson leading-tight">{subtitulo}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-cinzel font-bold text-[var(--text)] leading-none">
            {personagem.pv_atual}<span className="text-[var(--text3)] text-xs">/{personagem.pv_maximo}</span>
          </p>
          {personagem.pv_temporarios > 0 && <p className="text-[var(--accent2)] text-[10px] font-cinzel leading-tight">+{personagem.pv_temporarios} temp</p>}
        </div>
      </div>

      <BarraVida atual={personagem.pv_atual} maximo={personagem.pv_maximo} temporarios={personagem.pv_temporarios} className="flex-shrink-0" />

      {podeEditar && (
        <div className="flex-shrink-0 flex items-center gap-1">
          {[-5, -1, 1, 5].map(delta => (
            <button
              key={delta}
              disabled={enviando}
              onClick={() => onAjustarPV(delta)}
              className={cn(
                'flex-1 py-1.5 rounded border text-xs font-cinzel font-bold min-h-[30px] disabled:opacity-40',
                delta < 0 ? 'border-[var(--red2)]/50 text-[var(--red2)]' : 'border-[var(--green2)]/50 text-[var(--green2)]'
              )}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
          <button
            disabled={enviando}
            onClick={() => onDefinirPVTemp(personagem.pv_temporarios + 1)}
            title="+1 PV temporário"
            className="flex-1 py-1.5 rounded border border-[var(--accent2)]/50 text-[var(--accent2)] text-xs font-cinzel font-bold min-h-[30px] disabled:opacity-40"
          >
            +1 temp
          </button>
          {personagem.pv_temporarios > 0 && (
            <button
              disabled={enviando}
              onClick={() => onDefinirPVTemp(0)}
              title="Zerar PV temporários"
              className="flex-1 py-1.5 rounded border border-[var(--border)] text-[var(--text3)] text-xs font-cinzel min-h-[30px] disabled:opacity-40"
            >
              0 temp
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-shrink-0 text-xs font-cinzel text-[var(--text2)]">
        <span>CA <b className="text-[var(--text)]">{personagem.ca}</b></span>
        <span>Desloc. <b className="text-[var(--text)]">{personagem.deslocamento ? `${personagem.deslocamento}m` : '—'}</b></span>
        {typeof personagem.inspiracao === 'number' && personagem.inspiracao > 0 && (
          <button
            disabled={!podeEditar || enviando}
            onClick={onUsarInspiracao}
            className="ml-auto px-2 py-1 rounded border border-[var(--gold)]/50 text-[var(--gold)] text-[10px] font-cinzel disabled:opacity-40"
          >
            ⭐ Usar inspiração ({personagem.inspiracao})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 flex-shrink-0 items-center">
        {condicoesAtuais.map(cond => (
          <button
            key={cond}
            onClick={() => setCondicaoAberta(cond)}
            className="px-2 py-1 rounded-full bg-[var(--surface)] border border-[var(--accent2)]/50 text-[var(--accent2)] text-[10px] font-crimson flex items-center gap-1"
          >
            <span>{getCondicao(cond)?.icone}</span>{cond}
            {podeEditar && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); onRemoverCondicao(cond) }}
                className="ml-0.5 text-[var(--text3)] hover:text-[var(--red2)]"
              >
                ×
              </span>
            )}
          </button>
        ))}
        {podeEditar && (
          escolhendoCondicao ? (
            <select
              autoFocus
              value=""
              onChange={e => { if (e.target.value) onAdicionarCondicao(e.target.value as TipoCondicao); setEscolhendoCondicao(false) }}
              onBlur={() => setEscolhendoCondicao(false)}
              className="input-dd text-[10px] py-1"
            >
              <option value="">— Condição —</option>
              {TODAS_CONDICOES.filter(c => !condicoesAtuais.includes(c as TipoCondicao)).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEscolhendoCondicao(true)}
              className="px-2 py-1 rounded-full border border-dashed border-[var(--border)] text-[var(--text3)] text-[10px] font-crimson"
            >
              + Condição
            </button>
          )
        )}
      </div>

      {Object.keys(personagem.slots_magia ?? {}).length > 0 && (
        <div className="flex-shrink-0">
          <EspacosMagiaSessao
            slotsMagia={personagem.slots_magia}
            podeEditar={podeEditar}
            onUsar={onUsarEspaco}
            onRecuperar={onRecuperarEspaco}
          />
        </div>
      )}

      {condicaoAberta && <ModalCondicao condicao={condicaoAberta} onFechar={() => setCondicaoAberta(null)} />}
    </div>
  )
}

function BarraAcoesSessao({
  podeAgir, onAbrirMagia, onAbrirItem, onAbrirOuro, onAbrirDescanso, botoesDM,
}: {
  podeAgir: boolean
  onAbrirMagia: () => void
  onAbrirItem: () => void
  onAbrirOuro: () => void
  onAbrirDescanso: () => void
  botoesDM?: { label: string; onClick: () => void }[]
}) {
  const botoes = [
    { label: '✨ Magia', onClick: onAbrirMagia },
    { label: '🎒 Item', onClick: onAbrirItem },
    { label: '💰 Ouro', onClick: onAbrirOuro },
    { label: '🛏️ Descanso', onClick: onAbrirDescanso },
    ...(botoesDM ?? []),
  ]
  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg2)] px-2 py-1.5">
      <div className={cn('grid gap-1.5', botoes.length > 4 ? 'grid-cols-3' : 'grid-cols-4')}>
        {botoes.map(b => (
          <button
            key={b.label}
            onClick={b.onClick}
            disabled={!podeAgir}
            className={cn(
              'flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]',
              'text-[var(--text2)] font-cinzel text-[11px] min-h-[44px] transition-opacity',
              !podeAgir && 'opacity-40 cursor-not-allowed'
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Ordem de exibição pedida: platina primeiro (maior valor), cobre por
// último — não é a ordem de gravação no banco (pc/pp/pe/po/pl), só a leitura.
//
// BACKLOG: personagens.moedas.custom e campanhas.moeda_custom_nome existem
// e já são usados na ficha (FichaPersonagem.tsx), mas ModalOuro e
// ModalDistribuirTesouro não expõem essa moeda — Ganhar/Perder/Dar/
// Distribuir não sabem mexer em 'custom' hoje. Baixa prioridade.
const MOEDAS: { id: 'pl' | 'po' | 'pe' | 'pp' | 'pc'; label: string }[] = [
  { id: 'pl', label: 'Platina (pl)' },
  { id: 'po', label: 'Ouro (po)' },
  { id: 'pe', label: 'Electro (pe)' },
  { id: 'pp', label: 'Prata (pp)' },
  { id: 'pc', label: 'Cobre (pc)' },
]

// Taxas de conversão padrão de D&D 5e para peças de ouro (po): 1 pl = 10po,
// 1 pe = 0,5po, 1 pp = 0,1po, 1 pc = 0,01po.
const TAXA_PARA_PO: Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number> = { pl: 10, po: 1, pe: 0.5, pp: 0.1, pc: 0.01 }

function totalEmPO(moedas: Partial<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number>> | null | undefined): number {
  if (!moedas) return 0
  return MOEDAS.reduce((soma, m) => soma + (moedas[m.id] ?? 0) * TAXA_PARA_PO[m.id], 0)
}

function ModalOuro({
  personagem, sessaoId, destinatarios, onFechar,
}: {
  personagem: Personagem
  sessaoId: string
  destinatarios: Destinatario[]
  onFechar: () => void
}) {
  const [valores, setValores] = useState<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', string>>({ pl: '', po: '', pe: '', pp: '', pc: '' })
  const [vista, setVista] = useState<'principal' | 'dar'>('principal')
  const [enviando, setEnviando] = useState(false)

  const deltas = useMemo(() => {
    const d: Partial<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number>> = {}
    for (const m of MOEDAS) {
      const v = parseInt(valores[m.id]) || 0
      if (v !== 0) d[m.id] = v
    }
    return d
  }, [valores])
  const temValor = Object.keys(deltas).length > 0

  function limpar() { setValores({ pl: '', po: '', pe: '', pp: '', pc: '' }) }

  async function aplicar(sinal: 1 | -1) {
    if (!temValor || enviando) return
    setEnviando(true)
    const moedasEnvio = Object.fromEntries(Object.entries(deltas).map(([m, v]) => [m, v! * sinal]))
    const resultado = await chamarAcaoInventario({
      sessaoId, personagemId: personagem.id, tipo: 'ajuste_ouro', moedas: moedasEnvio,
    })
    setEnviando(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao ajustar moedas'); return }
    toast.success(resultado.descricao ?? 'Moedas ajustadas')
    limpar()
    onFechar()
  }

  async function darPara(destino: Destinatario) {
    if (!temValor || enviando) return
    setEnviando(true)
    const resultado = await chamarAcaoInventario({
      sessaoId, personagemId: personagem.id, tipo: 'transferir_moeda', moedas: deltas, paraPersonagemId: destino.id,
    })
    setEnviando(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao transferir moedas'); return }
    toast.success(resultado.descricao ?? 'Moedas transferidas')
    limpar()
    onFechar()
  }

  if (vista === 'dar') {
    return createPortal(
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
        <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setVista('principal')} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
            <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm flex-1">Dar moedas</h3>
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
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">💰 Ouro — {personagem.nome}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center py-2 mb-3 rounded-lg bg-[var(--bg2)] border border-[var(--border)]">
          <span className="font-cinzel font-bold text-2xl text-[var(--gold)]">{totalEmPO(personagem.moedas).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
          <span className="text-[var(--text3)] text-xs ml-1.5">PO (total convertido)</span>
        </div>

        <div className="grid grid-cols-5 gap-1 mb-3">
          {MOEDAS.map(m => (
            <div key={m.id}>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase block text-center">{m.id.toUpperCase()}</label>
              <p className="text-[var(--text2)] text-[10px] font-crimson text-center mb-0.5">{personagem.moedas?.[m.id] ?? 0}</p>
              <input
                type="number"
                inputMode="numeric"
                value={valores[m.id]}
                onChange={e => setValores(prev => ({ ...prev, [m.id]: e.target.value }))}
                placeholder="0"
                className="input-dd w-full text-center text-sm py-1.5"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-2">
          <button
            onClick={() => aplicar(-1)}
            disabled={!temValor || enviando}
            className="flex-1 py-2.5 rounded-lg border border-[var(--red2)]/50 text-[var(--red2)] font-cinzel text-sm min-h-[44px] disabled:opacity-40"
          >
            − Perder
          </button>
          <button
            onClick={() => aplicar(1)}
            disabled={!temValor || enviando}
            className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel font-bold text-sm min-h-[44px] disabled:opacity-40"
          >
            + Ganhar
          </button>
        </div>
        <button
          onClick={() => setVista('dar')}
          disabled={!temValor || enviando}
          className="w-full py-2.5 rounded-lg border border-[var(--accent2)]/50 text-[var(--accent2)] font-cinzel text-sm min-h-[44px] disabled:opacity-40"
        >
          Dar a outro jogador
        </button>
      </div>
    </div>,
    document.body
  )
}

// DM only — cria itens/credita moedas do zero para um ou mais personagens
// de uma vez (loot pós-batalha, presente da história etc.). Não parte do
// inventário de ninguém, por isso não usa o gesto de "toque no avatar
// confirma" do Dar — aqui há uma lista de destinatários a compor antes de
// aplicar tudo junto.
function ModalDistribuirTesouro({
  sessaoId, campanhaId, personagens, onFechar,
}: {
  sessaoId: string
  campanhaId: string
  personagens: Personagem[]
  onFechar: () => void
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [itens, setItens] = useState<ItemDistribuidoPayload[]>([])
  const [abaCompendio, setAbaCompendio] = useState<'magicos' | 'armas' | 'armaduras' | 'gear'>('gear')
  const [buscaItem, setBuscaItem] = useState('')
  const [resultadosItem, setResultadosItem] = useState<Record<string, unknown>[]>([])
  const [buscandoItem, setBuscandoItem] = useState(false)
  const [nomeAvulso, setNomeAvulso] = useState('')
  const [valores, setValores] = useState<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', string>>({ pl: '', po: '', pe: '', pp: '', pc: '' })
  const [dividirIgualmente, setDividirIgualmente] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const buscarItens = useCallback(async (termo: string, aba: string) => {
    if (!termo.trim()) { setResultadosItem([]); return }
    setBuscandoItem(true)
    try {
      const tabelas: Record<string, { tabela: string; campos: string }> = {
        magicos:   { tabela: 'magic_items',      campos: 'slug,name_pt,name_en,category,rarity,description_pt' },
        armas:     { tabela: 'equipment_weapons', campos: 'slug,name_pt,name_en,damage_dice,damage_type_pt,properties_pt' },
        armaduras: { tabela: 'equipment_armor',   campos: 'slug,name_pt,name_en,base_ac_formula_pt,category_pt' },
        gear:      { tabela: 'equipment_gear',    campos: 'slug,name_pt,name_en,category_pt,description_pt' },
      }
      const { tabela, campos } = tabelas[aba] ?? tabelas.gear
      // Modal só abre para o DM (ver render em MesaCliente), então itens
      // custom da campanha sempre aparecem, independente de visivel_jogadores.
      const { data } = await createClient()
        .from(tabela)
        .select(campos)
        .or(`name_pt.ilike.%${termo}%,name_en.ilike.%${termo}%`)
        .or(`criado_por.is.null,campanha_id.eq.${campanhaId}`)
        .limit(10)
      setResultadosItem((data ?? []) as unknown as Record<string, unknown>[])
    } finally {
      setBuscandoItem(false)
    }
  }, [campanhaId])

  useEffect(() => {
    const t = setTimeout(() => buscarItens(buscaItem, abaCompendio), 300)
    return () => clearTimeout(t)
  }, [buscaItem, abaCompendio, buscarItens])

  function alternarDestinatario(id: string) {
    setSelecionados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  function adicionarDoCompendio(item: Record<string, unknown>) {
    const namePt = item.name_pt as string
    let tipo = 'equipamento'
    let raridade: string | null = null
    let descricao = ''
    if (abaCompendio === 'magicos') { tipo = 'magico'; raridade = (item.rarity as string) ?? null; descricao = (item.description_pt as string) || '' }
    else if (abaCompendio === 'armas') { tipo = 'arma'; descricao = `${item.damage_dice} ${item.damage_type_pt}` }
    else if (abaCompendio === 'armaduras') { tipo = 'armadura'; descricao = (item.base_ac_formula_pt as string) || '' }
    else { descricao = (item.description_pt as string) || '' }

    setItens(prev => [...prev, { nome: namePt, tipo, raridade, descricao, quantidade: 1, itemRef: item.slug as string }])
    setBuscaItem('')
    setResultadosItem([])
  }

  function adicionarAvulso() {
    if (!nomeAvulso.trim()) return
    setItens(prev => [...prev, { nome: nomeAvulso.trim(), quantidade: 1 }])
    setNomeAvulso('')
  }

  function removerItemDaLista(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  const moedasBase = useMemo(() => {
    const m: Partial<Record<'pl' | 'po' | 'pe' | 'pp' | 'pc', number>> = {}
    for (const [k, v] of Object.entries(valores)) {
      const n = parseInt(v) || 0
      if (n > 0) m[k as 'pl' | 'po' | 'pe' | 'pp' | 'pc'] = n
    }
    return m
  }, [valores])

  const podeAplicar = selecionados.size > 0 && (itens.length > 0 || Object.keys(moedasBase).length > 0)

  async function aplicar() {
    if (!podeAplicar || enviando) return
    setEnviando(true)
    const nDestinatarios = selecionados.size
    const moedasPorPessoa = dividirIgualmente
      ? Object.fromEntries(Object.entries(moedasBase).map(([m, v]) => [m, Math.floor((v ?? 0) / nDestinatarios)]))
      : moedasBase
    const resultado = await chamarAcaoInventario({
      sessaoId, tipo: 'distribuir', paraPersonagemIds: Array.from(selecionados), itens, moedas: moedasPorPessoa,
    })
    setEnviando(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao distribuir tesouro'); return }
    toast.success(resultado.descricao ?? 'Tesouro distribuído!')
    onFechar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div
        className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-sm p-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">🎁 Distribuir Tesouro</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Quem recebe</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {personagens.map(p => {
            const ativo = selecionados.has(p.id)
            return (
              <button key={p.id} onClick={() => alternarDestinatario(p.id)} className="flex flex-col items-center gap-0.5 w-14">
                <div className="rounded-full p-0.5" style={{ boxShadow: ativo ? '0 0 0 2px var(--gold)' : '0 0 0 1px var(--border)' }}>
                  <Avatar nome={p.nome} imagemUrl={p.imagem_url} tamanho={40} />
                </div>
                <span className="text-[9px] text-[var(--text3)] truncate w-full text-center font-crimson">{p.nome}</span>
              </button>
            )
          })}
        </div>

        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Itens</p>
        <div className="flex gap-1 mb-2">
          {(['gear', 'armas', 'armaduras', 'magicos'] as const).map(aba => (
            <button
              key={aba}
              onClick={() => setAbaCompendio(aba)}
              className={cn(
                'flex-1 py-1 rounded text-[10px] font-cinzel border',
                abaCompendio === aba ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--border)] text-[var(--text3)]'
              )}
            >
              {{ gear: 'Equip.', armas: 'Armas', armaduras: 'Armad.', magicos: 'Mágicos' }[aba]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={buscaItem}
          onChange={e => setBuscaItem(e.target.value)}
          placeholder="Buscar no compêndio..."
          className="input-dd w-full text-xs py-1.5 mb-1"
        />
        {buscandoItem && <p className="text-[var(--text3)] text-[10px] font-crimson py-1">Buscando...</p>}
        {resultadosItem.length > 0 && (
          <div className="space-y-0.5 mb-2 max-h-32 overflow-y-auto">
            {resultadosItem.map((item, i) => (
              <button
                key={i}
                onClick={() => adicionarDoCompendio(item)}
                className="w-full text-left px-2 py-1 rounded bg-[var(--bg3)] hover:bg-[var(--surface)] text-[var(--text)] text-xs font-crimson truncate"
              >
                + {item.name_pt as string}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            value={nomeAvulso}
            onChange={e => setNomeAvulso(e.target.value)}
            placeholder="Ou digite um item avulso..."
            className="input-dd flex-1 text-xs py-1.5"
          />
          <button onClick={adicionarAvulso} disabled={!nomeAvulso.trim()} className="px-3 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] text-xs font-cinzel disabled:opacity-40">
            + Add
          </button>
        </div>
        {itens.length > 0 && (
          <div className="space-y-1 mb-3">
            {itens.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-[var(--bg3)] rounded">
                <span className="text-[var(--text)] text-xs font-crimson flex-1 truncate">{item.nome}</span>
                <button onClick={() => removerItemDaLista(i)} className="text-[var(--border)] hover:text-[var(--red2)]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[var(--text3)] text-[10px] font-cinzel uppercase mb-1.5">Moedas (por destinatário)</p>
        <div className="grid grid-cols-5 gap-1 mb-2">
          {MOEDAS.map(m => (
            <div key={m.id}>
              <label className="text-[var(--text3)] text-[9px] font-cinzel uppercase block text-center">{m.id.toUpperCase()}</label>
              <input
                type="number"
                inputMode="numeric"
                value={valores[m.id]}
                onChange={e => setValores(prev => ({ ...prev, [m.id]: e.target.value }))}
                placeholder="0"
                className="input-dd w-full text-center text-sm py-1.5"
              />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-1.5 mb-3">
          <input type="checkbox" checked={dividirIgualmente} onChange={e => setDividirIgualmente(e.target.checked)} className="w-3.5 h-3.5 accent-[var(--accent)]" />
          <span className="text-[var(--text2)] text-xs font-crimson">Dividir moedas igualmente entre os escolhidos (em vez de dar o valor cheio a cada um)</span>
        </label>

        <button
          onClick={aplicar}
          disabled={!podeAplicar || enviando}
          className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40"
        >
          {enviando ? 'Distribuindo...' : `Distribuir para ${selecionados.size || 0}`}
        </button>
      </div>
    </div>,
    document.body
  )
}

function ModalDescanso({
  personagem, onLongo, onCurto, onFechar,
}: {
  personagem: Personagem
  onLongo: () => void
  onCurto: (dadosGastos: number, curaInformada: number) => void
  onFechar: () => void
}) {
  const [modo, setModo] = useState<'escolha' | 'curto'>('escolha')
  const [dadosGastos, setDadosGastos] = useState(1)
  const [curaTexto, setCuraTexto] = useState('')
  const total = personagem.dados_vida_total ?? personagem.nivel ?? 1
  const disponivel = Math.max(0, total - (personagem.dados_vida_usados ?? 0))

  if (modo === 'curto') {
    return createPortal(
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
        <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setModo('escolha')} className="text-[var(--text3)] hover:text-[var(--text)] p-1 -m-1 flex-shrink-0">←</button>
            <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm flex-1">🛏️ Descanso curto</h3>
            <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[var(--text3)] text-xs font-crimson mb-3">
            {disponivel} de {total} dado(s) de vida disponíveis. Role fisicamente e informe o total.
          </p>

          <label className="block mb-3">
            <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase block mb-1">Quantos dados gastar</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDadosGastos(d => Math.max(1, d - 1))}
                className="w-9 h-9 rounded border border-[var(--border)] text-[var(--text2)] font-cinzel"
              >
                −
              </button>
              <span className="flex-1 text-center font-cinzel text-lg text-[var(--text)]">{dadosGastos}</span>
              <button
                onClick={() => setDadosGastos(d => Math.min(disponivel, d + 1))}
                disabled={dadosGastos >= disponivel}
                className="w-9 h-9 rounded border border-[var(--border)] text-[var(--text2)] font-cinzel disabled:opacity-40"
              >
                +
              </button>
            </div>
          </label>

          <label className="block mb-3">
            <span className="text-[var(--text3)] text-[10px] font-cinzel uppercase block mb-1">Total de cura rolado</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={curaTexto}
              onChange={e => setCuraTexto(e.target.value)}
              placeholder="0"
              className="input-dd w-full text-center text-lg py-2"
            />
          </label>

          <button
            onClick={() => onCurto(dadosGastos, parseInt(curaTexto) || 0)}
            disabled={disponivel === 0 || dadosGastos < 1}
            className="w-full py-3 rounded-lg bg-[var(--gold)] text-[var(--bg)] font-cinzel text-sm font-bold min-h-[48px] disabled:opacity-40"
          >
            Confirmar descanso curto
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onFechar}>
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl shadow-2xl w-full max-w-xs p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-[var(--gold)] font-bold text-sm">🛏️ Descanso — {personagem.nome}</h3>
          <button onClick={onFechar} className="text-[var(--border)] hover:text-[var(--red2)] p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          <button
            onClick={onLongo}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors"
          >
            🌙 Descanso longo — recupera todo PV, espaços de magia e metade dos dados de vida
          </button>
          <button
            onClick={() => setModo('curto')}
            disabled={disponivel === 0}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--bg2)] border border-[var(--border)] text-[var(--text)] text-sm font-crimson min-h-[44px] transition-colors disabled:opacity-40"
          >
            ☕ Descanso curto — gasta dados de vida ({disponivel} disponíveis)
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function MesaCliente() {
  const {
    combatentes, log, rodadaAtual, turnoAtual, turnoCombatenteId, ativa,
    statusBatalha, batalhaId, revelacaoPv, carregarBatalhaAtiva, definirArmaEmpunhada,
  } = useBatalha()
  const { campanhaAtiva, sessaoAtiva, sessaoCarregando } = useCampanha()
  const { ehDM } = usePermissao()
  const online = useOnline()

  const [userId, setUserId] = useState<string | null>(null)
  const [infoPersonagens, setInfoPersonagens] = useState<Record<string, InfoPersonagem>>({})
  const [carregandoBatalha, setCarregandoBatalha] = useState(true)
  const [personagemSelecionadoId, setPersonagemSelecionadoId] = useState<string | null>(null)
  const [popupCombatenteId, setPopupCombatenteId] = useState<string | null>(null)

  // Modo sessão (fora de combate) — lista de PJs da campanha, independente
  // de batalha_combatentes (que só existe durante uma batalha).
  const [personagensSessao, setPersonagensSessao] = useState<Personagem[]>([])
  const [personagemOperadoIdSessao, setPersonagemOperadoIdSessao] = useState<string | null>(null)
  const [enviandoSessao, setEnviandoSessao] = useState(false)
  const [modalMagiaSessaoAberto, setModalMagiaSessaoAberto] = useState(false)
  const [modalItemSessaoAberto, setModalItemSessaoAberto] = useState(false)
  const [modalOuroAberto, setModalOuroAberto] = useState(false)
  const [modalDescansoAberto, setModalDescansoAberto] = useState(false)
  const [modalDistribuirAberto, setModalDistribuirAberto] = useState(false)
  const [concedendoInspiracao, setConcedendoInspiracao] = useState(false)

  // O notebook (TabelaCombate) continua o cockpit; a /mesa vira controle
  // remoto do DM andando pela mesa — opera monstros, NPCs e PJs ausentes
  // pelo mesmo fluxo/API do jogador, sem a checagem de "é a sua vez".
  const [dmControlandoId, setDmControlandoId] = useState<string | null>(null)

  // Modais "o quê" — abrem antes de entrar no fluxo de alvo/valor
  const [modalListaAtaqueAberto, setModalListaAtaqueAberto] = useState(false)
  const [modalMagiaAberto, setModalMagiaAberto] = useState(false)
  const [modalItemAberto, setModalItemAberto] = useState(false)
  const [modalReacaoAberto, setModalReacaoAberto] = useState(false)

  // Fluxo de ação em andamento — sempre resolvido via POST à API árbitro.
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente | null>(null)
  const [alvosSelecionados, setAlvosSelecionados] = useState<AlvoSelecionado[]>([])
  const [modalValorAberto, setModalValorAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [vantagemEscolhida, setVantagemEscolhida] = useState<'vantagem' | 'desvantagem' | null>(null)
  const [enviandoVantagem, setEnviandoVantagem] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    if (!campanhaAtiva?.id) { setCarregandoBatalha(false); return }
    let cancelado = false
    setCarregandoBatalha(true)
    carregarBatalhaAtiva(campanhaAtiva.id).finally(() => { if (!cancelado) setCarregandoBatalha(false) })
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaAtiva?.id])

  // Reaproveita a assinatura Realtime já mantida pelo store — não cria outro canal.
  useEffect(() => {
    if (!batalhaId) return
    useBatalha.getState().assinarRealtime()
    return () => { useBatalha.getState().encerrarRealtime() }
  }, [batalhaId])

  const personagemIdsKey = useMemo(
    () => Array.from(new Set(combatentes.map(c => c.personagem_id).filter((id): id is string => !!id))).sort().join(','),
    [combatentes]
  )

  useEffect(() => {
    const ids = personagemIdsKey ? personagemIdsKey.split(',') : []
    if (ids.length === 0) { setInfoPersonagens({}); return }
    let cancelado = false
    createClient()
      .from('personagens')
      .select('id, imagem_url, classe, nivel, deslocamento, user_id')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelado || !data) return
        const mapa: Record<string, InfoPersonagem> = {}
        data.forEach(p => { mapa[p.id] = p })
        setInfoPersonagens(mapa)
      })
    return () => { cancelado = true }
  }, [personagemIdsKey])

  // Toasts de ação — apenas para entradas novas de log, nunca para o histórico carregado.
  const logVistosRef = useRef<Set<string>>(new Set())
  const batalhaLogRef = useRef<string | null>(null)
  useEffect(() => {
    if (batalhaId !== batalhaLogRef.current) {
      batalhaLogRef.current = batalhaId
      logVistosRef.current = new Set(log.map(l => l.id))
      return
    }
    log.forEach(entrada => {
      if (logVistosRef.current.has(entrada.id)) return
      logVistosRef.current.add(entrada.id)
      const msg = mensagemToast(entrada)
      if (msg) toast(msg, { duration: 3000 })
    })
  }, [log, batalhaId])

  const meuCombatentes = useMemo(() => {
    if (!userId) return []
    return combatentes.filter(c => c.personagem_id && infoPersonagens[c.personagem_id]?.user_id === userId)
  }, [combatentes, infoPersonagens, userId])

  const meuCombatenteIds = useMemo(() => new Set(meuCombatentes.map(c => c.id)), [meuCombatentes])

  useEffect(() => {
    if (meuCombatentes.length === 0) { setPersonagemSelecionadoId(null); return }
    if (!personagemSelecionadoId || !meuCombatentes.some(c => c.id === personagemSelecionadoId)) {
      setPersonagemSelecionadoId(meuCombatentes[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuCombatentes])

  const combatenteSelecionado = meuCombatentes.find(c => c.id === personagemSelecionadoId) ?? null

  // Combatentes que o DM pode operar pela /mesa: monstros, NPCs e PJs de
  // jogadores ausentes. PJs presentes continuam controlados pelo próprio
  // jogador — o DM não precisa (nem deve) assumi-los por padrão.
  const combatentesControlaveisDM = useMemo(
    () => ordenarPorNome(combatentes.filter(c => c.tipo !== 'jogador' || c.ausente)),
    [combatentes]
  )

  useEffect(() => {
    if (!ehDM) return
    if (combatentesControlaveisDM.length === 0) { setDmControlandoId(null); return }
    if (!dmControlandoId || !combatentesControlaveisDM.some(c => c.id === dmControlandoId)) {
      setDmControlandoId(combatentesControlaveisDM[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehDM, combatentesControlaveisDM])

  // Combatente "operado" nesta tela — o próprio PJ do jogador, ou quem o DM
  // escolheu no seletor. Todo o resto do fluxo de ação usa só esta variável,
  // sem distinguir DM de jogador a partir daqui.
  const combatenteOperado = ehDM
    ? combatentesControlaveisDM.find(c => c.id === dmControlandoId) ?? null
    : combatenteSelecionado

  // Reflete o campo já persistido (seja pelo próprio toggle, seja pelo mestre).
  useEffect(() => {
    setVantagemEscolhida(combatenteOperado?.vantagem ?? null)
  }, [combatenteOperado?.id, combatenteOperado?.vantagem])

  // =====================================================================
  // Modo sessão — PJs da campanha direto de `personagens` (sem batalha).
  // =====================================================================

  const emModoSessao = !!sessaoAtiva && (!batalhaId || statusBatalha === 'inativa' || statusBatalha === 'concluida')

  useEffect(() => {
    if (!campanhaAtiva?.id) { setPersonagensSessao([]); return }
    let cancelado = false
    createClient()
      .from('personagens')
      .select('*')
      .eq('campanha_id', campanhaAtiva.id)
      .eq('tipo_personagem', 'jogador')
      .eq('ativo', true)
      .then(({ data }) => { if (!cancelado) setPersonagensSessao((data as Personagem[]) ?? []) })
    return () => { cancelado = true }
  }, [campanhaAtiva?.id])

  // Realtime — reflete edições feitas por outros clientes (DM ou outro
  // jogador) sem precisar recarregar a página.
  useEffect(() => {
    if (!campanhaAtiva?.id) return
    const supabase = createClient()
    const canal = supabase
      .channel(`mesa-personagens:${campanhaAtiva.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'personagens', filter: `campanha_id=eq.${campanhaAtiva.id}` },
        (payload: { new: Personagem }) => {
          setPersonagensSessao(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [campanhaAtiva?.id])

  const meusPersonagensSessao = useMemo(
    () => userId ? personagensSessao.filter(p => p.user_id === userId) : [],
    [personagensSessao, userId]
  )

  // Toast de "recebi algo" — via Realtime em `transferencias`, não pela
  // resposta síncrona da própria chamada (essa já mostra o toast de quem
  // deu). Guardado em ref porque o callback do canal é registrado uma vez
  // e não deve carregar um `meuCombatentes`/`meusPersonagensSessao` velho.
  const meusPersonagemIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const ids = new Set<string>()
    meusPersonagensSessao.forEach(p => ids.add(p.id))
    meuCombatentes.forEach(c => { if (c.personagem_id) ids.add(c.personagem_id) })
    meusPersonagemIdsRef.current = ids
  }, [meusPersonagensSessao, meuCombatentes])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const canal = supabase
      .channel(`mesa-transferencias:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transferencias' },
        (payload: { new: { para_personagem_id: string | null; de_nome: string | null; tipo: 'item' | 'moeda'; item_nome: string | null; quantidade: number | null; moedas: Record<string, number> | null; criado_por: string | null } }) => {
          const t = payload.new
          if (!t.para_personagem_id || !meusPersonagemIdsRef.current.has(t.para_personagem_id)) return
          if (t.criado_por === userId) return
          const remetente = t.de_nome ?? 'Alguém'
          const oQue = t.tipo === 'item'
            ? `${t.quantidade}x ${t.item_nome}`
            : Object.entries(t.moedas ?? {}).map(([m, v]) => `${v} ${m.toUpperCase()}`).join(', ')
          toast.success(`🎁 ${remetente} te deu ${oQue}`)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [userId])

  useEffect(() => {
    if (!ehDM) {
      if (meusPersonagensSessao.length === 0) { setPersonagemOperadoIdSessao(null); return }
      if (!personagemOperadoIdSessao || !meusPersonagensSessao.some(p => p.id === personagemOperadoIdSessao)) {
        setPersonagemOperadoIdSessao(meusPersonagensSessao[0].id)
      }
      return
    }
    if (personagensSessao.length === 0) { setPersonagemOperadoIdSessao(null); return }
    if (!personagemOperadoIdSessao || !personagensSessao.some(p => p.id === personagemOperadoIdSessao)) {
      setPersonagemOperadoIdSessao(personagensSessao[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehDM, meusPersonagensSessao, personagensSessao])

  const personagemOperadoSessao = ehDM
    ? personagensSessao.find(p => p.id === personagemOperadoIdSessao) ?? null
    : meusPersonagensSessao.find(p => p.id === personagemOperadoIdSessao) ?? null

  const meusPersonagemIdsSessao = useMemo(() => new Set(meusPersonagensSessao.map(p => p.id)), [meusPersonagensSessao])

  // Ponto único de escrita fora de combate — sempre /api/mesa/acao (sem
  // alvos, sem turno). Atualiza o estado local a partir da resposta do
  // servidor (fonte da verdade), sem esperar o Realtime.
  async function enviarAcaoSessao(payload: Omit<Parameters<typeof chamarAcaoSessaoApi>[0], 'sessaoId' | 'personagemId'>) {
    if (!sessaoAtiva || !personagemOperadoSessao || enviandoSessao) return
    setEnviandoSessao(true)
    const resultado = await chamarAcaoSessaoApi({
      sessaoId: sessaoAtiva.id,
      personagemId: personagemOperadoSessao.id,
      ...payload,
    })
    setEnviandoSessao(false)
    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao registrar ação')
      return
    }
    if (resultado.personagem) {
      const atualizado = resultado.personagem
      setPersonagensSessao(prev => prev.map(p => p.id === atualizado.id ? atualizado : p))
    }
  }

  function ajustarPVSessao(delta: number) {
    enviarAcaoSessao({ tipo: delta < 0 ? 'dano' : 'cura', valor: Math.abs(delta) })
  }

  function definirPVTempSessao(novoValor: number) {
    enviarAcaoSessao({ tipo: 'pv_temporarios', valor: Math.max(0, novoValor) })
  }

  function adicionarCondicaoSessao(condicao: TipoCondicao) {
    enviarAcaoSessao({ tipo: 'condicao_aplicada', condicao })
  }

  function removerCondicaoSessao(condicao: TipoCondicao) {
    enviarAcaoSessao({ tipo: 'condicao_removida', condicao })
  }

  function usarInspiracaoSessao() {
    enviarAcaoSessao({ tipo: 'usar_inspiracao' })
  }

  function usarEspacoSessao(nivel: number) {
    enviarAcaoSessao({ tipo: 'usar_espaco', nivelMagia: nivel })
  }

  function recuperarEspacoSessao(nivel: number) {
    enviarAcaoSessao({ tipo: 'recuperar_espaco', nivelMagia: nivel })
  }

  function conjurarMagiaSessao({ magia, nivelConjurado }: ConjuracaoEscolhida) {
    setModalMagiaSessaoAberto(false)
    const { efeito } = classificarMagia(magia)
    if (efeito === 'cura') {
      enviarAcaoSessao({
        tipo: 'cura', valor: 1, nivelMagia: nivelConjurado ?? undefined, nomeAcao: magia.nome,
      })
    } else {
      enviarAcaoSessao({ tipo: 'usar_espaco', nivelMagia: nivelConjurado ?? undefined, nomeAcao: magia.nome })
    }
  }

  function descansoLongoSessao() {
    setModalDescansoAberto(false)
    enviarAcaoSessao({ tipo: 'descanso_longo' })
  }

  function descansoCurtoSessao(dadosGastos: number, curaInformada: number) {
    setModalDescansoAberto(false)
    enviarAcaoSessao({ tipo: 'descanso_curto', dadosGastos, curaInformada })
  }

  // DM só — concede ao PJ que estiver operando no seletor da sessão (troque
  // o seletor "🎭 Operando" para escolher outro jogador antes de conceder).
  async function concederInspiracao() {
    if (!sessaoAtiva || !personagemOperadoSessao || concedendoInspiracao) return
    setConcedendoInspiracao(true)
    const resultado = await chamarAcaoInventario({
      sessaoId: sessaoAtiva.id, personagemId: personagemOperadoSessao.id, tipo: 'conceder_inspiracao',
    })
    setConcedendoInspiracao(false)
    if (!resultado.ok) { toast.error(resultado.erro ?? 'Erro ao conceder inspiração'); return }
    toast.success(resultado.descricao ?? 'Inspiração concedida!')
  }

  function cancelarAcao() {
    setAcaoPendente(null)
    setAlvosSelecionados([])
    setModalValorAberto(false)
  }

  // Ponto único de escrita de ações — sempre a API árbitro, nunca o Supabase
  // direto. `valor === null` cobre ações sem número (utilitária, reação sem
  // efeito): o alvo ainda vai junto via `descricao`, já que a API só inclui
  // um alvo no resultado quando o valor aplicado é > 0.
  async function enviarAcao(
    pending: AcaoPendente,
    alvos: AlvoSelecionado[],
    valor: number | null,
    tipoDano: TipoDano | null,
    descricaoExtra?: string,
  ) {
    if (!combatenteOperado || !batalhaId || enviando) return
    setEnviando(true)
    const descricaoAlvos = alvos.length > 0 && valor === null ? `Alvo: ${alvos.map(a => a.nome).join(', ')}` : undefined
    const descricaoFinal = [descricaoExtra, descricaoAlvos].filter(Boolean).join(' — ') || undefined

    const resultado = await chamarAcaoApi({
      batalhaId,
      combatenteId: combatenteOperado.id,
      tipo: pending.tipo,
      alvos: alvos.map(a => ({ combatenteId: a.id, valor: valor ?? 0, ...(tipoDano ? { tipoDano } : {}) })),
      nivelMagia: pending.nivelMagia,
      nomeAcao: pending.nomeAcao,
      vantagem: vantagemEscolhida,
      descricao: descricaoFinal,
      marcarEfeitoAtivo: pending.marcarEfeitoAtivo,
    })
    setEnviando(false)

    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao registrar ação')
      return
    }
    cancelarAcao()
  }

  function iniciarAcao(pending: AcaoPendente) {
    setAcaoPendente(pending)
    setAlvosSelecionados([])
    if (!pending.precisaAlvo) {
      if (pending.precisaValor) setModalValorAberto(true)
      else enviarAcao(pending, [], null, null)
    }
  }

  function alternarAlvo(id: string, nome: string) {
    setAlvosSelecionados(prev =>
      prev.some(a => a.id === id) ? prev.filter(a => a.id !== id) : [...prev, { id, nome }]
    )
    setPopupCombatenteId(null)
  }

  function avancarComAlvos() {
    if (!acaoPendente || alvosSelecionados.length === 0) return
    if (acaoPendente.precisaValor) setModalValorAberto(true)
    else enviarAcao(acaoPendente, alvosSelecionados, null, null)
  }

  function confirmarValor(valor: number, tipoDano: TipoDano | null) {
    if (!acaoPendente) return
    enviarAcao(acaoPendente, alvosSelecionados, valor, tipoDano)
  }

  function iniciarAtaqueArma(arma: ArmaEmpunhada) {
    iniciarAcao({
      tipo: 'ataque',
      nomeAcao: arma.nome,
      efeito: 'dano',
      precisaAlvo: true,
      precisaValor: true,
      tipoDanoPadrao: (arma.tipo_dano as TipoDano | undefined) ?? null,
    })
  }

  function escolherAtaqueLista(a: AtaqueDisponivel) {
    setModalListaAtaqueAberto(false)
    iniciarAcao({
      tipo: 'ataque',
      nomeAcao: a.nome,
      efeito: 'dano',
      precisaAlvo: true,
      precisaValor: true,
      tipoDanoPadrao: (a.tipo_dano as TipoDano | undefined) ?? null,
    })
  }

  function conjurarMagia({ magia, nivelConjurado, efeitoAtivo }: ConjuracaoEscolhida) {
    setModalMagiaAberto(false)
    const { efeito } = classificarMagia(magia)
    iniciarAcao({
      // A API decide dano/cura pelo `tipo` (TIPOS_CURA), não por um campo à
      // parte — magia de cura precisa do tipo 'cura' ou seria aplicada como
      // dano no alvo. O nome real da magia continua em nomeAcao.
      tipo: efeito === 'cura' ? 'cura' : 'magia',
      nomeAcao: magia.nome,
      efeito,
      precisaAlvo: efeito !== 'nenhum',
      precisaValor: efeito !== 'nenhum',
      tipoDanoPadrao: magia.tipoDano,
      nivelMagia: nivelConjurado ?? undefined,
      marcarEfeitoAtivo: efeitoAtivo ? magia.nome : undefined,
    })
  }

  function escolherReacao(opt: typeof OPCOES_REACAO[number]) {
    setModalReacaoAberto(false)
    iniciarAcao({
      tipo: opt.tipo,
      nomeAcao: opt.label,
      efeito: opt.precisaValor ? 'dano' : 'nenhum',
      precisaAlvo: opt.precisaAlvo,
      precisaValor: opt.precisaValor,
      tipoDanoPadrao: null,
    })
  }

  function enviarReacaoLivre(descricao: string) {
    setModalReacaoAberto(false)
    enviarAcao(
      { tipo: 'outra_reacao', nomeAcao: 'Outra reação', efeito: 'nenhum', precisaAlvo: false, precisaValor: false, tipoDanoPadrao: null },
      [], null, null, descricao
    )
  }

  async function escolherVantagem(v: 'vantagem' | 'desvantagem' | null) {
    if (!combatenteOperado || !batalhaId || enviandoVantagem) return
    const anterior = combatenteOperado.vantagem ?? null
    setVantagemEscolhida(v)
    setEnviandoVantagem(true)
    const nomeAcao = v === 'vantagem' ? 'Vantagem ativada' : v === 'desvantagem' ? 'Desvantagem ativada' : 'Vantagem removida'
    const resultado = await chamarAcaoApi({
      batalhaId,
      combatenteId: combatenteOperado.id,
      tipo: 'sistema',
      alvos: [],
      nomeAcao,
      vantagem: v,
    })
    setEnviandoVantagem(false)
    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao salvar vantagem')
      setVantagemEscolhida(anterior)
    }
  }

  // "A qualquer momento" — sem checagem de turno (a API trata como reação
  // para efeito de validação). O DM operando o combatente também pode.
  async function encerrarEfeito(nome: string) {
    if (!combatenteOperado || !batalhaId) return
    if (!window.confirm(`Encerrar "${nome}"?`)) return
    const resultado = await chamarAcaoApi({
      batalhaId,
      combatenteId: combatenteOperado.id,
      tipo: 'sistema',
      alvos: [],
      nomeAcao: `Efeito encerrado: ${nome}`,
      encerrarEfeitoAtivo: nome,
    })
    if (!resultado.ok) toast.error(resultado.erro ?? 'Erro ao encerrar efeito')
  }

  // Barra de participantes: NUNCA por iniciativa/ordem de turno, sempre
  // alfabética dentro de cada grupo. O DM sempre vê todos (é o cockpit); o
  // jogador só vê os PJs fora do modo de seleção de alvo — ao selecionar um
  // alvo, os inimigos entram na barra (o segredo é a ordem, não a
  // existência: eles já estão na mesa física, todo mundo os vê).
  const emSelecaoDeAlvo = !!acaoPendente?.precisaAlvo
  const { aliadosBarra, inimigosBarra } = useMemo(() => {
    const vivos = (lista: Combatente[]) => lista.filter(c => !c.morto && !c.ausente)
    if (ehDM || emSelecaoDeAlvo) {
      const base = ehDM ? combatentes : vivos(combatentes)
      return {
        aliadosBarra: ordenarPorNome(base.filter(c => c.tipo !== 'monstro')),
        inimigosBarra: ordenarPorNome(base.filter(c => c.tipo === 'monstro')),
      }
    }
    return { aliadosBarra: ordenarPorNome(combatentes.filter(c => c.tipo === 'jogador')), inimigosBarra: [] as Combatente[] }
  }, [combatentes, ehDM, emSelecaoDeAlvo])

  const alvosSelecionadosIds = useMemo(() => new Set(alvosSelecionados.map(a => a.id)), [alvosSelecionados])

  const ativosOrdenados = useMemo(
    () => [...combatentes].sort((a, b) => a.ordem - b.ordem).filter(c => !c.ausente && !c.morto),
    [combatentes]
  )
  // Sem turno_combatente_id, turnoAtual cai num índice de fallback (0) que
  // não representa ninguém de verdade — tratar como "ninguém na vez", não
  // assumir esse índice silenciosamente.
  const combatenteDoTurno = ativa && turnoCombatenteId ? ativosOrdenados[turnoAtual] ?? null : null
  const ehMeuTurno = !!combatenteDoTurno && meuCombatenteIds.has(combatenteDoTurno.id)
  // O DM não tem "vez" — pode agir por qualquer combatente que esteja
  // operando a qualquer momento (a API já trata isso na validação).
  const podeAgirOperado = (ehDM || ehMeuTurno) && online

  const combatentePopup = popupCombatenteId ? combatentes.find(c => c.id === popupCombatenteId) ?? null : null

  if (carregandoBatalha) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--text3)] font-cinzel text-sm">Carregando...</p>
      </div>
    )
  }

  if (!campanhaAtiva) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-8 text-center">
        <Swords className="w-10 h-10 text-[var(--border)]" />
        <p className="font-cinzel text-[var(--border)] text-lg">Selecione uma campanha</p>
        <p className="text-[var(--border)] text-sm font-crimson">Escolha uma campanha no menu para ver a mesa.</p>
      </div>
    )
  }

  if (sessaoCarregando) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--text3)] font-cinzel text-sm">Carregando...</p>
      </div>
    )
  }

  if (!sessaoAtiva) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-8 text-center">
        <Swords className="w-10 h-10 text-[var(--border)]" />
        <p className="font-cinzel text-[var(--border)] text-lg">Nenhuma sessão em andamento</p>
        <p className="text-[var(--border)] text-sm font-crimson max-w-xs">
          Aguarde o mestre iniciar a sessão.
        </p>
      </div>
    )
  }

  // Modo sessão — sem batalha ativa: cartão editável do PJ, sem turno.
  if (emModoSessao) {
    const espacosMagiaSessaoConvertidos: EspacosMagiaBatalha = {}
    if (personagemOperadoSessao?.slots_magia) {
      for (const [nivel, slot] of Object.entries(personagemOperadoSessao.slots_magia)) {
        espacosMagiaSessaoConvertidos[parseInt(nivel)] = { total: slot.total, utilizados: slot.usados }
      }
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <BarraParticipantesSessao
          personagens={personagensSessao}
          meuPersonagemIds={meusPersonagemIdsSessao}
          personagemOperadoId={personagemOperadoIdSessao}
        />

        <div className="flex-shrink-0 py-1.5 text-center text-[var(--text3)] text-xs font-crimson">
          🟢 Sessão {sessaoAtiva.numero ?? ''} em andamento — fora de combate
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-3 pb-2">
          {personagemOperadoSessao ? (
            <CartaoPersonagemSessao
              personagem={personagemOperadoSessao}
              podeEditar
              enviando={enviandoSessao}
              opcoesSelecao={ehDM ? personagensSessao : meusPersonagensSessao}
              mostrarSeletorSempre={ehDM}
              rotuloSeletor={ehDM ? '🎭 Operando' : undefined}
              selecionadoId={personagemOperadoIdSessao}
              onSelecionar={setPersonagemOperadoIdSessao}
              onAjustarPV={ajustarPVSessao}
              onDefinirPVTemp={definirPVTempSessao}
              onAdicionarCondicao={adicionarCondicaoSessao}
              onRemoverCondicao={removerCondicaoSessao}
              onUsarInspiracao={usarInspiracaoSessao}
              onUsarEspaco={usarEspacoSessao}
              onRecuperarEspaco={recuperarEspacoSessao}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center px-4">
              <p className="text-[var(--text3)] text-xs font-crimson">
                {ehDM
                  ? 'Nenhum PJ na campanha ainda.'
                  : 'Você não tem um personagem nesta campanha.'}
              </p>
            </div>
          )}
        </div>

        {personagemOperadoSessao && (
          <BarraAcoesSessao
            podeAgir={!enviandoSessao && online}
            onAbrirMagia={() => setModalMagiaSessaoAberto(true)}
            onAbrirItem={() => setModalItemSessaoAberto(true)}
            onAbrirOuro={() => setModalOuroAberto(true)}
            onAbrirDescanso={() => setModalDescansoAberto(true)}
            botoesDM={ehDM ? [
              { label: '🎁 Distribuir', onClick: () => setModalDistribuirAberto(true) },
              { label: '⭐ Inspiração', onClick: concederInspiracao },
            ] : undefined}
          />
        )}

        {modalMagiaSessaoAberto && personagemOperadoSessao && (
          <ModalMagias
            personagemId={personagemOperadoSessao.id}
            personagemNome={personagemOperadoSessao.nome}
            espacosMagia={espacosMagiaSessaoConvertidos}
            onConjurar={conjurarMagiaSessao}
            onFechar={() => setModalMagiaSessaoAberto(false)}
          />
        )}

        {modalItemSessaoAberto && personagemOperadoSessao && sessaoAtiva && (
          <ModalItem
            personagemId={personagemOperadoSessao.id}
            contexto={{ sessaoId: sessaoAtiva.id }}
            destinatarios={personagensSessao
              .filter(p => p.id !== personagemOperadoSessao.id)
              .map(p => ({ id: p.id, nome: p.nome, imagemUrl: p.imagem_url }))}
            onFechar={() => setModalItemSessaoAberto(false)}
          />
        )}

        {modalOuroAberto && personagemOperadoSessao && sessaoAtiva && (
          <ModalOuro
            personagem={personagemOperadoSessao}
            sessaoId={sessaoAtiva.id}
            destinatarios={personagensSessao
              .filter(p => p.id !== personagemOperadoSessao.id)
              .map(p => ({ id: p.id, nome: p.nome, imagemUrl: p.imagem_url }))}
            onFechar={() => setModalOuroAberto(false)}
          />
        )}

        {modalDescansoAberto && personagemOperadoSessao && (
          <ModalDescanso
            personagem={personagemOperadoSessao}
            onLongo={descansoLongoSessao}
            onCurto={descansoCurtoSessao}
            onFechar={() => setModalDescansoAberto(false)}
          />
        )}

        {modalDistribuirAberto && ehDM && sessaoAtiva && campanhaAtiva && (
          <ModalDistribuirTesouro
            sessaoId={sessaoAtiva.id}
            campanhaId={campanhaAtiva.id}
            personagens={personagensSessao}
            onFechar={() => setModalDistribuirAberto(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BarraParticipantes
        aliados={aliadosBarra}
        inimigos={inimigosBarra}
        turnoCombatenteId={turnoCombatenteId}
        ativa={ativa}
        infoPersonagens={infoPersonagens}
        meuCombatenteIds={meuCombatenteIds}
        alvosSelecionadosIds={alvosSelecionadosIds}
        onTocar={setPopupCombatenteId}
      />

      <StatusRodada
        ativa={ativa}
        statusBatalha={statusBatalha}
        rodadaAtual={rodadaAtual}
        combatenteDoTurno={combatenteDoTurno}
        ehMeuTurno={ehMeuTurno}
      />

      <div className="flex-1 min-h-0 overflow-hidden px-3 pb-2">
        {combatenteOperado ? (
          <CartaoPersonagem
            combatente={combatenteOperado}
            info={combatenteOperado.personagem_id ? infoPersonagens[combatenteOperado.personagem_id] : undefined}
            opcoesSelecao={ehDM ? combatentesControlaveisDM : meuCombatentes}
            mostrarSeletorSempre={ehDM}
            rotuloSeletor={ehDM ? '🎭 Operando' : undefined}
            selecionadoId={ehDM ? dmControlandoId : personagemSelecionadoId}
            onSelecionar={ehDM ? setDmControlandoId : setPersonagemSelecionadoId}
            onEncerrarEfeito={encerrarEfeito}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-center px-4">
            <p className="text-[var(--text3)] text-xs font-crimson">
              {ehDM
                ? 'Nenhum monstro, NPC ou PJ ausente para operar ainda.'
                : 'Você não está controlando nenhum personagem nesta batalha. Toque em um participante acima para ver detalhes.'}
            </p>
          </div>
        )}
      </div>

      {combatenteOperado && (
        <>
          <FaixaVantagem
            valor={vantagemEscolhida}
            podeAgir={podeAgirOperado}
            enviando={enviandoVantagem}
            onEscolher={escolherVantagem}
          />
          <BarraAcoes
            combatente={combatenteOperado}
            ehMeuTurno={podeAgirOperado}
            onDefinirArma={(lado, arma) => definirArmaEmpunhada(combatenteOperado.id, lado, arma)}
            onAtacarComArma={iniciarAtaqueArma}
            onAbrirAtaque={() => setModalListaAtaqueAberto(true)}
            onAbrirMagia={() => setModalMagiaAberto(true)}
            onAbrirItem={() => setModalItemAberto(true)}
            onAbrirReacao={() => setModalReacaoAberto(true)}
          />
        </>
      )}

      {combatentePopup && (
        <PopupCombatente
          combatente={combatentePopup}
          info={combatentePopup.personagem_id ? infoPersonagens[combatentePopup.personagem_id] : undefined}
          revelacaoPv={revelacaoPv}
          ehDM={ehDM}
          selecionandoAlvo={!!acaoPendente?.precisaAlvo}
          alvoJaSelecionado={alvosSelecionados.some(a => a.id === combatentePopup.id)}
          onSelecionarAlvo={() => alternarAlvo(combatentePopup.id, combatentePopup.nome)}
          onFechar={() => setPopupCombatenteId(null)}
        />
      )}

      {modalListaAtaqueAberto && combatenteOperado && (
        <ModalListaAtaques
          ataques={ataquesDoCombatente(combatenteOperado)}
          onEscolher={escolherAtaqueLista}
          onFechar={() => setModalListaAtaqueAberto(false)}
        />
      )}

      {modalMagiaAberto && combatenteOperado?.personagem_id && (
        <ModalMagias
          personagemId={combatenteOperado.personagem_id}
          personagemNome={combatenteOperado.nome}
          espacosMagia={combatenteOperado.espacos_magia}
          onConjurar={conjurarMagia}
          onFechar={() => setModalMagiaAberto(false)}
        />
      )}

      {modalItemAberto && combatenteOperado?.personagem_id && batalhaId && (
        <ModalItem
          personagemId={combatenteOperado.personagem_id}
          contexto={{ batalhaId, combatenteId: combatenteOperado.id }}
          destinatarios={combatentes
            .filter((c): c is typeof c & { personagem_id: string } => !!c.personagem_id && c.personagem_id !== combatenteOperado.personagem_id)
            .map(c => ({ id: c.personagem_id, nome: c.nome, imagemUrl: infoPersonagens[c.personagem_id]?.imagem_url }))}
          onFechar={() => setModalItemAberto(false)}
        />
      )}

      {modalReacaoAberto && (
        <ModalReacao
          onEscolher={escolherReacao}
          onEnviarLivre={enviarReacaoLivre}
          onFechar={() => setModalReacaoAberto(false)}
        />
      )}

      {acaoPendente?.precisaAlvo && !modalValorAberto && (
        <BandejaAlvos
          acao={acaoPendente}
          alvos={alvosSelecionados}
          enviando={enviando}
          onConfirmar={avancarComAlvos}
          onCancelar={cancelarAcao}
        />
      )}

      {acaoPendente && modalValorAberto && (
        <ModalValorAcao
          acao={acaoPendente}
          alvosNomes={alvosSelecionados.map(a => a.nome)}
          enviando={enviando}
          onConfirmar={confirmarValor}
          onFechar={() => { if (acaoPendente.precisaAlvo) setModalValorAberto(false); else cancelarAcao() }}
        />
      )}
    </div>
  )
}
