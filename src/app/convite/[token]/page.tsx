import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AceitarConviteEfetivo } from '@/components/convite/AceitarConviteEfetivo'
import Link from 'next/link'

export default async function PaginaConviteToken({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const admin = createAdminClient()
  const { data: convite } = await admin
    .from('campanha_membros')
    .select('*, campanhas(nome)')
    .eq('token_convite', token)
    .eq('status', 'convidado')
    .maybeSingle()

  if (!convite) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="font-cinzel text-[var(--gold)] text-2xl">Convite Inválido</h1>
          <p className="text-[var(--text3)] font-crimson">
            Este convite é inválido ou já foi utilizado.
          </p>
          <Link href="/login" className="inline-block text-sm text-[var(--accent)] hover:underline font-crimson">
            Ir para o início
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const nomeCampanha = (convite.campanhas as { nome: string } | null)?.nome ?? 'a campanha'

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-5xl">⚔️</div>
        <div>
          <h1 className="font-cinzel text-[var(--gold)] text-2xl font-bold mb-2">
            Convite para Aventura
          </h1>
          <p className="text-[var(--text2)] font-crimson text-lg">
            Você foi convidado para participar de{' '}
            <span className="text-[var(--accent2)] font-bold">{nomeCampanha}</span>.
          </p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <AceitarConviteEfetivo
            token={token}
            autenticado={!!user}
            campanhaId={convite.campanha_id}
          />
        </div>
      </div>
    </div>
  )
}
