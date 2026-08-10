'use client'

import { Shield, WifiOff } from 'lucide-react'

export const dynamic = 'force-static'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0a0e] p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Shield className="w-10 h-10 text-[#d4a843]" />
        </div>
        <h1 className="font-cinzel text-2xl text-[#d4a843] font-bold">Dungeon Desk</h1>

        <div className="mt-8 flex items-center justify-center gap-2 text-[#e74c3c]">
          <WifiOff className="w-5 h-5" />
          <p className="font-cinzel text-sm">Sem conexão</p>
        </div>
        <p className="text-[#8870a8] mt-2 font-crimson">
          Não foi possível carregar esta página sem internet. Verifique sua conexão e tente de novo.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full py-2.5 rounded-lg bg-[#d4a843]/10 border border-[#d4a843]/40 text-[#d4a843] font-cinzel text-sm hover:bg-[#d4a843]/20 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
