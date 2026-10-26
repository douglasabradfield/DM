// Teclado numérico grande — NUNCA pede o resultado do d20, só o total já
// resolvido (dano ou cura) que o jogador rolou fisicamente ou no app de dados.
export function TecladoNumerico({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C']
  function tocar(tecla: string) {
    if (tecla === '⌫') { onChange(valor.slice(0, -1)); return }
    if (tecla === 'C') { onChange(''); return }
    if (valor.length >= 4) return
    onChange(valor === '0' ? tecla : valor + tecla)
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {teclas.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => tocar(t)}
          className="min-h-[52px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-cinzel text-lg font-bold active:bg-[var(--bg3)]"
        >
          {t}
        </button>
      ))}
    </div>
  )
}
