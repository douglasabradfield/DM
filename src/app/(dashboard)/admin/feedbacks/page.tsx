import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verificarAdmin } from '@/lib/admin/verificar-admin'
import { PainelFeedbacks } from '@/components/admin/PainelFeedbacks'
import type { FeedbackAdmin } from '@/components/admin/PainelFeedbacks'

export const metadata = { title: 'Feedbacks — Admin Dungeon Desk' }

export default async function AdminFeedbacksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await verificarAdmin(user.id)
  if (!isAdmin) redirect('/')

  const admin = createAdminClient()

  // Buscar feedbacks + email dos usuários
  const [feedbacksRes, perfisRes] = await Promise.all([
    admin
      .from('feedbacks')
      .select('*')
      .order('criado_em', { ascending: false }),
    admin
      .from('profiles')
      .select('id, email'),
  ])

  const feedbacks = (feedbacksRes.data ?? []) as FeedbackAdmin[]
  const emailPorId = new Map<string, string>()
  for (const p of (perfisRes.data ?? [])) {
    emailPorId.set(p.id, p.email)
  }

  const feedbacksComEmail: FeedbackAdmin[] = feedbacks.map(f => ({
    ...f,
    email: f.user_id ? (emailPorId.get(f.user_id) ?? null) : null,
  }))

  return <PainelFeedbacks feedbacks={feedbacksComEmail} />
}
