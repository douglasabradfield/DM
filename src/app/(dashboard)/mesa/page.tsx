import { AcCombatentesProvider } from '@/components/batalha/AcCombatentesContext'
import { MesaCliente } from '@/components/mesa/MesaCliente'

export const metadata = { title: 'Mesa — Dungeon Desk' }

export default function MesaPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <AcCombatentesProvider>
        <MesaCliente />
      </AcCombatentesProvider>
    </div>
  )
}
