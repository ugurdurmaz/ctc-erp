import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

function deny(status: number, error: string): AdminCheck {
  return { ok: false, response: NextResponse.json({ error }, { status }) }
}

// Admin API'leri service role ile çalıştığı için RLS devre dışıdır; yetki kontrolü burada yapılmak zorunda.
export async function requireAdmin(req: NextRequest, adminClient: SupabaseClient): Promise<AdminCheck> {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return deny(401, 'Oturum bulunamadı. Lütfen tekrar giriş yapın.')

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData.user) return deny(401, 'Oturum geçersiz veya süresi dolmuş.')

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) return deny(500, 'Yetki kontrolü yapılamadı.')
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return deny(403, 'Bu işlem için yönetici yetkisi gereklidir.')
  }
  return { ok: true, userId: userData.user.id }
}
