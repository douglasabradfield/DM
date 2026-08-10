import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const SHIELD_D = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ background: '#0a0810', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="72%" height="72%" viewBox="0 0 24 24" fill="none" stroke="#e8a020" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d={SHIELD_D} />
        </svg>
      </div>
    ),
    { ...size }
  )
}
