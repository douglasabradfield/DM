'use client'

import { Toaster } from 'react-hot-toast'

export function ProvedorSessao({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#261a2e',
            border: '1px solid #4a3060',
            color: '#e8dff0',
            fontFamily: 'Crimson Pro, serif',
          },
          success: {
            iconTheme: { primary: '#27ae60', secondary: '#e8dff0' },
          },
          error: {
            iconTheme: { primary: '#e74c3c', secondary: '#e8dff0' },
          },
        }}
      />
    </>
  )
}
