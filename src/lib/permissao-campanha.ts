// "DM" nas telas da mesa/mapas significa SOMENTE o dono da campanha ativa
// (campanhas.dm_id). Admin, plano (dm_supremo, guild_master) ou qualquer outro
// papel global NÃO dá visão de DM. Sem campanha ou sem usuário => não é DM.
export function ehDmDaCampanha(
  campanha: { dm_id?: string | null } | null | undefined,
  userId: string | null | undefined,
): boolean {
  return !!campanha?.dm_id && !!userId && campanha.dm_id === userId
}
