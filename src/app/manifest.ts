import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dungeon Desk',
    short_name: 'Dungeon Desk',
    description: 'Mesa de D&D 5e em português',
    start_url: '/mesa',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0810',
    theme_color: '#0a0810',
    lang: 'pt-BR',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
