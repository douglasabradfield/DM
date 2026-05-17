import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AceitarConvite } from '@/components/convite/AceitarConvite'

export default async function ConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <PaginaErro titulo="Link Inválido" mensagem="Este link de convite não é válido." />
  }

  const admin = createAdminClient()
  const { data: convite } = await admin
    .from('campaign_invites')
    .select('*, campanhas(nome)')
    .eq('token', token)
    .eq('usado', false)
    .single()

  if (!convite || new Date(convite.expires_at) < new Date()) {
    return <PaginaErro titulo="Convite Expirado" mensagem="Este convite já foi usado ou expirou. Peça um novo link ao seu DM." />
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
          <AceitarConvite token={token} autenticado={!!user} />
        </div>
      </div>
    </div>
  )
}

function PaginaErro({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h1 className="font-cinzel text-[var(--gold)] text-2xl">{titulo}</h1>
        <p className="text-[var(--text3)] font-crimson">{mensagem}</p>
        <a
          href="/personagens"
          className="inline-block text-sm text-[var(--accent)] hover:underline font-crimson"
        >
          Ir para o início
        </a>
      </div>
    </div>
  )
}
