import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// 1. YENİ KULLANICI OLUŞTURMA (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, full_name, role, allowed_modules, allowed_companies } = body

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'E-posta, şifre ve ad soyad alanları zorunludur.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Şifre en az 6 karakter olmalıdır.' },
        { status: 400 }
      )
    }

    const adminClient = getSupabaseAdmin()

    if (!adminClient) {
      return NextResponse.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY tanımlanmamış. Doğrudan kullanıcı oluşturabilmek için lütfen projenin .env.local dosyasına SUPABASE_SERVICE_ROLE_KEY ekleyiniz (Supabase Dashboard -> Project Settings -> API -> service_role secret).',
        },
        { status: 500 }
      )
    }

    // 1. auth.users içinde kullanıcıyı oluştur
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true, // E-posta doğrulaması beklemeden anında aktif olsun
      user_metadata: {
        full_name,
        role: role || 'cashier',
        allowed_modules: allowed_modules || ['retail'],
        allowed_companies: allowed_companies || null,
      },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const userId = userData.user.id

    // 2. user_profiles tablosuna profil kaydı ekle/güncelle
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .upsert({
        id: userId,
        email: email.trim(),
        full_name: full_name.trim(),
        role: role || 'cashier',
        allowed_modules: allowed_modules || ['retail'],
        allowed_companies: allowed_companies || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('Profil tablosuna yazılamadı:', profileError)
      // Kullanıcı oluştu ama profil yazılamadıysa bile auth kaydı var
    }

    return NextResponse.json({ success: true, user: userData.user })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sunucu hatası oluştu.'
    console.error('Kullanıcı oluşturma hatası:', err)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// 2. KULLANICI SİLME (DELETE)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId parametresi zorunludur.' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()
    if (!adminClient) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY tanımlanmamış.' },
        { status: 500 }
      )
    }

    // auth.users üzerinden sil (on delete cascade ile profile da silinir)
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sunucu hatası oluştu.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// 3. ŞİFRE SIFIRLAMA / PROFİL GÜNCELLEME (PATCH)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, password, full_name, role, allowed_modules, allowed_companies, is_active } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId zorunludur.' }, { status: 400 })
    }

    const adminClient = getSupabaseAdmin()
    if (!adminClient) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY tanımlanmamış.' },
        { status: 500 }
      )
    }

    // Şifre güncellenmek isteniyorsa
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Şifre en az 6 karakter olmalıdır.' }, { status: 400 })
      }
      const { error: pwdError } = await adminClient.auth.admin.updateUserById(userId, {
        password: password.trim(),
      })
      if (pwdError) {
        return NextResponse.json({ error: pwdError.message }, { status: 400 })
      }
    }

    // Profil alanları güncellenmek isteniyorsa
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (full_name !== undefined) updatePayload.full_name = full_name
    if (role !== undefined) updatePayload.role = role
    if (allowed_modules !== undefined) updatePayload.allowed_modules = allowed_modules
    if (allowed_companies !== undefined) updatePayload.allowed_companies = allowed_companies
    if (is_active !== undefined) updatePayload.is_active = is_active

    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sunucu hatası oluştu.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
