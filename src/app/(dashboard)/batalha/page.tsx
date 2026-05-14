import { TabelaCombate } from '@/components/batalha/TabelaCombate'

export const metadata = { title: 'Tracker de Batalha — Dungeon Desk' }

export default function BatalhaPage() {
  return (
    <div className="h-full flex flex-col">
      <TabelaCombate />
    </div>
  )
}
