import { MesaCliente } from '@/components/mesa/MesaCliente'

export const metadata = { title: 'Mesa — Dungeon Desk' }

export default function MesaPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <MesaCliente />
    </div>
  )
}
