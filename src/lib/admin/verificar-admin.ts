import { createAdminClient } from '@/lib/supabase/server'

export async function verificarAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    if (error || !data) return false
    return data.is_admin === true
  } catch {
    return false
  }
}
