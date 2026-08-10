// Service worker do Dungeon Desk — cacheia SOMENTE o shell estático
// (ícones, manifest, JS/CSS versionados por hash, fontes do Google
// Fonts). Nunca intercepta /api/*, nunca intercepta chamadas ao Supabase
// (origem diferente) e nunca cacheia HTML de navegação — só usa o cache
// como fallback quando a rede falha.
//
// Bump manual do sufixo -vN sempre que a lista de regras abaixo mudar,
// pra forçar a limpeza dos caches antigos no próximo activate.
const SHELL_CACHE = 'dd-shell-v1'
const FONT_CACHE = 'dd-fonts-v1'
const CACHES_ATUAIS = [SHELL_CACHE, FONT_CACHE]

const OFFLINE_URL = '/offline'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Ativa o novo SW imediatamente, sem esperar as abas antigas
      // fecharem — combinado com clients.claim() no activate, é assim
      // que o app se atualiza sozinho após um deploy.
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((nome) => !CACHES_ATUAIS.includes(nome)).map((nome) => caches.delete(nome))
      ))
      .then(() => self.clients.claim())
  )
})

function ehFonteGoogle(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
}

function ehShellEstatico(url) {
  if (url.origin !== self.location.origin) return false
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/icon' ||
    url.pathname === '/apple-icon'
  )
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const emCache = await cache.match(request)
  if (emCache) return emCache
  const resposta = await fetch(request)
  if (resposta.ok) cache.put(request, resposta.clone())
  return resposta
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Nunca intercepta escritas — só GET passa pelas regras abaixo.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Navegação de página inteira: sempre tenta a rede primeiro (dados
  // vivos, nunca servidos do cache); só cai pro fallback offline se a
  // rede falhar de verdade.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // /api/* e qualquer origem diferente (Supabase, etc.) — passthrough
  // total, o SW nem participa da requisição.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return
  if (url.origin !== self.location.origin && !ehFonteGoogle(url)) return

  if (ehFonteGoogle(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE))
    return
  }

  if (ehShellEstatico(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  // Qualquer outro GET same-origin (RSC payloads, prefetch de rota etc.)
  // — deixa o navegador tratar normalmente, sem cache.
})
