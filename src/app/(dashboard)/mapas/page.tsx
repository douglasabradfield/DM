import { createClient } from '@/lib/supabase/server'
import { getPlano } from '@/lib/planos'
import { GaleriaImagens } from '@/components/galeria/GaleriaImagens'
import { BloqueioPlano } from '@/components/ui/BloqueioPlano'

export default async function MapasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('plano').eq('id', user?.id ?? '').single()
  const plano = getPlano(profile?.plano)

  if (!plano.limites.imagens_mapas) {
    return <BloqueioPlano recurso="Mapas" planoNecessario="Guilda" />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg2)]">
        <h1 className="font-cinzel text-[var(--gold)] text-lg font-bold">🗺️ Mapas</h1>
        <p className="text-[var(--text3)] text-xs font-crimson mt-0.5">Mapas do mundo, dungeons e localizações da campanha</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <GaleriaImagens tipo="mapa" />
      </div>
    </div>
  )
}
