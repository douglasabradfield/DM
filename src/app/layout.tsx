import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ProvedorSessao } from '@/components/layout/ProvedorSessao'

export const metadata: Metadata = {
  title: 'Dungeon Desk — Sua mesa, seu mundo, sua aventura',
  description: 'Plataforma completa para Dungeon Masters de RPG de mesa. Gerencie batalhas, personagens, aventuras e muito mais.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dungeon Desk',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0810',
  colorScheme: 'dark light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplicar tema (e a cor da status bar do PWA) antes do primeiro
            paint para evitar flash — mesma lógica de src/lib/tema.ts,
            duplicada aqui pois roda antes de qualquer JS ser carregado. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{
            var CORES={grimorio:'#0a0810',medieval:'#f5edd8',dragao:'#0e0808',elfico:'#f0f4f8'};
            var t=localStorage.getItem('dd-tema')||'grimorio';
            if(t&&t!=='grimorio'){document.documentElement.classList.add('tema-'+t);}
            var meta=document.querySelector('meta[name="theme-color"]');
            if(!meta){meta=document.createElement('meta');meta.setAttribute('name','theme-color');document.head.appendChild(meta);}
            meta.setAttribute('content', CORES[t]||CORES.grimorio);
          }catch(e){}})()
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
