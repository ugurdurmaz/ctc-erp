import type { PostgrestError } from '@supabase/supabase-js'

// Supabase (PostgREST) tek istekte en fazla 1000 satır döndürür (max_rows); fazlası SESSİZCE kesilir.
// Tüm tabloyu okuyan her sorgu bu yardımcıyla sayfa sayfa çekilmelidir. Sayfalar arası kayma
// olmaması için kurucu sorgu kararlı bir sıralama içermelidir (en sona .order('id') ekleyin).
export const PAGE_SIZE = 1000
const MAX_PAGES = 200

type PageResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PageResult<T>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('fetchAllRows sayfa hatası:', error)
      return { data: rows, error }
    }
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return { data: rows, error: null }
}
