// Campos mecânicos de item (AC automático) no lado do servidor: leitura do
// catálogo, sanitização do que vem do cliente e troca de slot ao equipar.
// Só usado por rotas com createAdminClient().

import type { createAdminClient } from '@/lib/supabase/server'
import type { ModificadorItem } from '@/lib/dados-dnd/ca'

type Admin = ReturnType<typeof createAdminClient>

export interface MecanicaItem {
  categoria: 'armadura' | 'escudo' | 'arma' | 'outro' | null
  equipavel: boolean
  tipo_armadura: 'leve' | 'media' | 'pesada' | null
  ac_base: number | null
  max_des: number | null
  req_for: number | null
  desv_furtividade: boolean
  modificadores: ModificadorItem[]
}

const CATEGORIAS = new Set(['armadura', 'escudo', 'arma', 'outro'])
const TIPOS_ARMADURA = new Set(['leve', 'media', 'pesada'])

const inteiro = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isInteger(n) ? n : null
}

function sanitizarModificadores(raw: unknown): ModificadorItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((m): ModificadorItem[] => {
    if (!m || typeof m !== 'object') return []
    const { alvo, valor, tipo } = m as Record<string, unknown>
    const v = inteiro(valor)
    if (typeof alvo !== 'string' || !alvo.trim() || v === null) return []
    return [{ alvo: alvo.trim().slice(0, 40), valor: v, tipo: tipo === 'base' ? 'base' : 'soma' }]
  })
}

// Aceita lixo: devolve só campos válidos. Armadura/escudo são sempre equipáveis.
export function sanitizarMecanica(raw: unknown): MecanicaItem {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const categoria = typeof r.categoria === 'string' && CATEGORIAS.has(r.categoria)
    ? (r.categoria as MecanicaItem['categoria']) : null
  const modificadores = sanitizarModificadores(r.modificadores)
  const ehArmadura = categoria === 'armadura'
  return {
    categoria,
    equipavel: categoria === 'armadura' || categoria === 'escudo' || categoria === 'arma'
      || modificadores.length > 0 || r.equipavel === true,
    tipo_armadura: ehArmadura && typeof r.tipo_armadura === 'string' && TIPOS_ARMADURA.has(r.tipo_armadura)
      ? (r.tipo_armadura as MecanicaItem['tipo_armadura']) : null,
    ac_base: ehArmadura ? inteiro(r.ac_base) : null,
    max_des: ehArmadura ? inteiro(r.max_des) : null,
    req_for: ehArmadura ? inteiro(r.req_for) : null,
    desv_furtividade: ehArmadura && r.desv_furtividade === true,
    modificadores,
  }
}

// Copia os campos mecânicos de uma linha de inventário (transferência).
export function mecanicaDaLinha(linha: Record<string, unknown>): MecanicaItem {
  return sanitizarMecanica(linha)
}

// Procura o item no catálogo pelo slug (item_ref): armaduras/escudos primeiro,
// depois itens mágicos. Itens sem registro estruturado devolvem null.
export async function mecanicaDoCatalogo(admin: Admin, itemRef: string | null | undefined): Promise<MecanicaItem | null> {
  if (!itemRef) return null

  const { data: armadura } = await admin
    .from('equipment_armor')
    .select('categoria, tipo_armadura, ac_base, max_des, strength_requirement, stealth_disadvantage, modificadores')
    .eq('slug', itemRef).maybeSingle()
  if (armadura?.categoria) {
    return sanitizarMecanica({
      ...armadura, equipavel: true, req_for: armadura.strength_requirement, desv_furtividade: armadura.stealth_disadvantage,
    })
  }

  const { data: magico } = await admin
    .from('magic_items')
    .select('categoria, equipavel, modificadores')
    .eq('slug', itemRef).maybeSingle()
  if (magico?.categoria) return sanitizarMecanica(magico)

  return null
}

// Máximo 1 armadura e 1 escudo equipados: ao equipar um segundo do mesmo slot,
// desequipa o anterior (sem bloquear). Devolve os nomes desequipados, para aviso.
export async function desequiparMesmoSlot(
  admin: Admin,
  personagemId: string,
  item: { id: string; categoria?: string | null }
): Promise<string[]> {
  if (item.categoria !== 'armadura' && item.categoria !== 'escudo') return []
  const { data: anteriores } = await admin
    .from('inventario_itens')
    .select('id, nome')
    .eq('personagem_id', personagemId)
    .eq('categoria', item.categoria)
    .eq('equipado', true)
    .neq('id', item.id)
  if (!anteriores?.length) return []
  await admin.from('inventario_itens').update({ equipado: false }).in('id', anteriores.map(a => a.id))
  return anteriores.map(a => a.nome as string)
}
