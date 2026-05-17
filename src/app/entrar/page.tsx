import { createClient, createAdminClient } from '@/lib/supabase/server'
import { EntrarCampanha } from '@/components/convite/EntrarCampanha'

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c: token } = await searchParams

  if (!token) {
    return <PaginaErro titulo="Link Inválido" mensagem="Este link de entrada não é válido." />
  }

  const admin = createAdminClient()
  const { data: campanha } = await admin
    .from('campanhas')
    .select('id, nome, ativa, link_token')
    .eq('link_token', token)
    .single()

  if (!campanha || !campanha.link_token) {
    return <PaginaErro titulo="Link Inválido" mensagem="Este link foi revogado ou não existe." />
  }

  if (!campanha.ativa) {
    return <PaginaErro titulo="Campanha Encerrada" mensagem="Esta campanha foi encerrada e não aceita novos membros." />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
            <span className="text-[var(--accent2)] font-bold">{campanha.nome}</span>.
          </p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <EntrarCampanha linkToken={token} autenticado={!!user} />
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
