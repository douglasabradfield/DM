import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const TETO_GRID = 100

type Acao = 'ativar' | 'desativar' | 'revelar' | 'ocultar' | 'revelar_tudo' | 'ocultar_tudo'

interface FogPayload {
  acao: Acao
  imagemId: string
  colunas?: number
  linhas?: number
  celulas?: number[]
}

// Toda escrita em mapa_fog passa por aqui com o service role — a tabela não
// tem policy de INSERT/UPDATE/DELETE para authenticated (ver migration
// 20260819_fog_of_war.sql), justamente para que revelar/ocultar sempre
// apliquem a operação de conjunto no servidor em vez de aceitar o array
// completo do cliente (dois DMs, ou duas abas, não se sobrescrevem).
export async function POST(req: NextRequest) {
  const payload = (await req.json()) as Partial<FogPayload>
  const { acao, imagemId } = payload

  if (!acao || !imagemId) {
    return Response.json({ erro: 'Payload inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ erro: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const { data: imagem } = await admin
    .from('imagens')
    .select('id, campanha_id')
    .eq('id', imagemId)
    .maybeSingle()
  if (!imagem) return Response.json({ erro: 'Imagem não encontrada' }, { status: 403 })

  const { data: campanha } = await admin
    .from('campanhas')
    .select('dm_id')
    .eq('id', imagem.campanha_id)
    .maybeSingle()
  if (!campanha || campanha.dm_id !== user.id) {
    return Response.json({ erro: 'Apenas o mestre da campanha pode gerenciar o fog of war.' }, { status: 403 })
  }

  switch (acao) {
    case 'ativar': {
      const colunas = Math.min(TETO_GRID, Math.max(1, Math.floor(payload.colunas ?? 0)))
      const linhas = Math.min(TETO_GRID, Math.max(1, Math.floor(payload.linhas ?? 0)))
      if (!colunas || !linhas) {
        return Response.json({ erro: 'Informe colunas e linhas do grid' }, { status: 400 })
      }

      const { data, error } = await admin
        .from('mapa_fog')
        .upsert({
          imagem_id: imagemId,
          campanha_id: imagem.campanha_id,
          ativo: true,
          colunas,
          linhas,
          reveladas: [],
          atualizado_em: new Date().toISOString(),
          atualizado_por: user.id,
        }, { onConflict: 'imagem_id' })
        .select()
        .single()
      if (error) {
        console.error('Erro ao ativar fog of war:', error)
        return Response.json({ erro: 'Erro ao ativar o fog of war' }, { status: 500 })
      }
      return Response.json({ ok: true, fog: data })
    }

    case 'desativar': {
      const { data, error } = await admin
        .from('mapa_fog')
        .update({ ativo: false, atualizado_em: new Date().toISOString(), atualizado_por: user.id })
        .eq('imagem_id', imagemId)
        .select()
        .maybeSingle()
      if (error) {
        console.error('Erro ao desativar fog of war:', error)
        return Response.json({ erro: 'Erro ao desativar o fog of war' }, { status: 500 })
      }
      if (!data) return Response.json({ erro: 'Fog of war não está configurado para este mapa' }, { status: 404 })
      return Response.json({ ok: true, fog: data })
    }

    case 'revelar':
    case 'ocultar': {
      const celulas = Array.isArray(payload.celulas) ? payload.celulas : []
      const { data: fog } = await admin.from('mapa_fog').select('*').eq('imagem_id', imagemId).maybeSingle()
      if (!fog) return Response.json({ erro: 'Fog of war não está configurado para este mapa' }, { status: 404 })

      const totalCelulas = fog.colunas * fog.linhas
      const celulasValidas = new Set(
        celulas.filter(i => Number.isInteger(i) && i >= 0 && i < totalCelulas)
      )
      const atuais = new Set<number>(fog.reveladas ?? [])

      if (acao === 'revelar') {
        for (const i of celulasValidas) atuais.add(i)
      } else {
        for (const i of celulasValidas) atuais.delete(i)
      }

      const { data, error } = await admin
        .from('mapa_fog')
        .update({
          reveladas: [...atuais],
          atualizado_em: new Date().toISOString(),
          atualizado_por: user.id,
        })
        .eq('imagem_id', imagemId)
        .select()
        .single()
      if (error) {
        console.error('Erro ao atualizar células do fog of war:', error)
        return Response.json({ erro: 'Erro ao atualizar o fog of war' }, { status: 500 })
      }
      return Response.json({ ok: true, fog: data })
    }

    case 'revelar_tudo':
    case 'ocultar_tudo': {
      const { data: fog } = await admin.from('mapa_fog').select('*').eq('imagem_id', imagemId).maybeSingle()
      if (!fog) return Response.json({ erro: 'Fog of war não está configurado para este mapa' }, { status: 404 })

      const totalCelulas = fog.colunas * fog.linhas
      const reveladas = acao === 'revelar_tudo'
        ? Array.from({ length: totalCelulas }, (_, i) => i)
        : []

      const { data, error } = await admin
        .from('mapa_fog')
        .update({ reveladas, atualizado_em: new Date().toISOString(), atualizado_por: user.id })
        .eq('imagem_id', imagemId)
        .select()
        .single()
      if (error) {
        console.error('Erro ao atualizar células do fog of war:', error)
        return Response.json({ erro: 'Erro ao atualizar o fog of war' }, { status: 500 })
      }
      return Response.json({ ok: true, fog: data })
    }

    default:
      return Response.json({ erro: 'Ação inválida' }, { status: 400 })
  }
}
