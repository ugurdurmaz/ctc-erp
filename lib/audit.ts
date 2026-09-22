import { supabase } from './supabase'

let cachedProfiles: Record<string, { full_name: string; email: string; role: string }> = {}

/**
 * Sistemdeki tüm yazma işlemlerini audit_logs tablosuna o anki kullanıcı bilgisiyle kaydeder.
 */
export async function logActivity(
  module: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'ROLLBACK' | string,
  description: string,
  recordId: string | null = null,
  amount: number = 0,
  currency: string = '',
  oldData: any = null,
  newData: any = null,
  companyId: string | null = null,
  customUser?: { id?: string; email?: string; full_name?: string; role?: string } | null
) {
  try {
    let userInfo = customUser || null

    if (!userInfo) {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const authUser = authData?.user
        if (authUser) {
          if (cachedProfiles[authUser.id]) {
            userInfo = { id: authUser.id, ...cachedProfiles[authUser.id] }
          } else {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('full_name, email, role')
              .eq('id', authUser.id)
              .maybeSingle()

            if (profile) {
              cachedProfiles[authUser.id] = profile
              userInfo = { id: authUser.id, ...profile }
            } else {
              userInfo = {
                id: authUser.id,
                email: authUser.email || '',
                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Kullanıcı',
                role: 'user'
              }
            }
          }
        }
      } catch (authErr) {
        console.warn('Audit log kullanıcı tespiti yapılamadı:', authErr)
      }
    }

    let payloadNewData: any = newData
    if (userInfo) {
      if (typeof newData === 'object' && newData !== null && !Array.isArray(newData)) {
        payloadNewData = { ...newData, _user: userInfo }
      } else {
        payloadNewData = { data: newData, _user: userInfo }
      }
    }

    let payloadOldData: any = oldData
    if (userInfo && action === 'DELETE') {
      if (typeof oldData === 'object' && oldData !== null && !Array.isArray(oldData)) {
        payloadOldData = { ...oldData, _user: userInfo }
      } else {
        payloadOldData = { data: oldData, _user: userInfo }
      }
    }

    await supabase.from('audit_logs').insert([{
      module,
      action,
      description,
      record_id: recordId,
      amount: amount || 0,
      currency: currency || '',
      old_data: payloadOldData,
      new_data: payloadNewData,
      company_id: companyId
    }])
  } catch (err) {
    console.error("Log kaydı atılamadı:", err)
  }
}
