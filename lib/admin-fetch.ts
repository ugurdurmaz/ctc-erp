import { supabase } from './supabase'

// /api/admin/* uçları çağıranın oturum token'ını ister; token olmadan istek 401 döner.
export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(url, { ...init, headers })
}
