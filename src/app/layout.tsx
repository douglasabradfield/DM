import type { Metadata } from 'next'
import './globals.css'
import { ProvedorSessao } from '@/components/layout/ProvedorSessao'

export const metadata: Metadata = {
  title: 'Dungeon Desk — Sua mesa, seu mundo, sua aventura',
  description: 'Plataforma completa para Dungeon Masters de RPG de mesa. Gerencie batalhas, personagens, aventuras e muito mais.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplicar tema antes do primeiro paint para evitar flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{var t=localStorage.getItem('dd-tema');if(t&&t!=='grimorio'){document.documentElement.classList.add('tema-'+t);}}catch(e){}})()
        ` }} />
      </head>
      <body className="antialiased">
        <ProvedorSessao>
          {children}
        </ProvedorSessao>
      </body>
    </html>
  )
}
