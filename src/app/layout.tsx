import type { Metadata } from 'next'
import './globals.css'
import { ProvedorSessao } from '@/components/layout/ProvedorSessao'

export const metadata: Metadata = {
  title: 'Dungeon Desk — Sua mesa, seu mundo, sua aventura',
  description: 'Plataforma completa para Dungeon Masters de RPG de mesa. Gerencie batalhas, personagens, aventuras e muito mais.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ProvedorSessao>
          {children}
        </ProvedorSessao>
      </body>
    </html>
  )
}
