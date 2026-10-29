import { AcCombatentesProvider } from '@/components/batalha/AcCombatentesContext'
import { TabelaCombate } from '@/components/batalha/TabelaCombate'

export const metadata = { title: 'Tracker de Batalha — Dungeon Desk' }

export default function BatalhaPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <AcCombatentesProvider>
        <TabelaCombate />
      </AcCombatentesProvider>
    </div>
  )
}
