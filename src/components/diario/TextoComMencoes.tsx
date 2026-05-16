interface TextoComMencoesProps {
  texto: string
  className?: string
}

export function TextoComMencoes({ texto, className }: TextoComMencoesProps) {
  const partes = texto.split(/(@\w[\w\s]*(?=\s|$|[,.!?;:]))/g)

  return (
    <span className={className}>
      {partes.map((parte, i) => {
        if (parte.startsWith('@')) {
          return (
            <span
              key={i}
              className="px-1 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent2)] font-semibold font-cinzel text-[0.85em]"
            >
              {parte}
            </span>
          )
        }
        return <span key={i}>{parte}</span>
      })}
    </span>
  )
}
