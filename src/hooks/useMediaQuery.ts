'use client'

import { useEffect, useState } from 'react'

// Estado inicial false (igual no servidor e no primeiro render do cliente,
// sem erro de hidratação); o valor real entra no effect.
export function useMediaQuery(consulta: string): boolean {
  const [casa, setCasa] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(consulta)
    const atualizar = () => setCasa(mql.matches)
    atualizar()
    mql.addEventListener('change', atualizar)
    return () => mql.removeEventListener('change', atualizar)
  }, [consulta])

  return casa
}
