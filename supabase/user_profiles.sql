-- ==============================================================================
-- CTC MASTER LEDGER - KULLANICI & YETKİLENDİRME (RBAC) ŞEMASI
-- ==============================================================================
-- Bu SQL scriptini Supabase Dashboard -> SQL Editor alanında çalıştırın.
-- ==============================================================================

-- 1. user_profiles Tablosu
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('admin', 'finance', 'cashier', 'warehouse', 'custom')) default 'admin',
  allowed_modules text[] not null default array[
    'dashboard', 'retail', 'cash-registers', 'bank-accounts', 'credit-cards',
    'stocks', 'services', 'suppliers', 'customers', 'expenses',
    'subscriptions', 'reports', 'companies', 'activity', 'users'
  ],
  allowed_companies text[] default null, -- null ise tüm masraf merkezlerini görür
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. RLS Politikaları
alter table public.user_profiles enable row level security;

-- Mevcut politikaları temizle (idempotent)
drop policy if exists "Authenticated users can read profiles" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;
drop policy if exists "Admins can do everything on profiles" on public.user_profiles;
drop policy if exists "Allow full access to authenticated users during setup" on public.user_profiles;
drop policy if exists "user_profiles_select_policy" on public.user_profiles;
drop policy if exists "user_profiles_all_policy" on public.user_profiles;

-- Giriş yapmış kullanıcılar profilleri okuyabilir (sonsuz döngüyü önlemek için direkt true)
create policy "user_profiles_select_policy"
  on public.user_profiles
  for select
  to authenticated
  using (true);

-- Kullanıcılar profil ekleyebilir / güncelleyebilir
create policy "user_profiles_all_policy"
  on public.user_profiles
  for all
  to authenticated
  using (true)
  with check (true);

-- 3. Otomatik Profil Oluşturma Trigger'ı
-- Supabase Auth üzerinde yeni kullanıcı açıldığında otomatik olarak user_profiles tablosuna yazar
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role text;
  raw_mods jsonb;
  mods_array text[];
begin
  default_role := coalesce(new.raw_user_meta_data->>'role', 'admin');
  raw_mods := new.raw_user_meta_data->'allowed_modules';

  if raw_mods is not null and jsonb_typeof(raw_mods) = 'array' then
    select array_agg(x) into mods_array from jsonb_array_elements_text(raw_mods) as x;
  else
    -- Rol bazlı varsayılan modüller
    if default_role = 'cashier' then
      mods_array := array['retail', 'services'];
    elsif default_role = 'warehouse' then
      mods_array := array['stocks', 'services'];
    elsif default_role = 'finance' then
      mods_array := array[
        'dashboard', 'cash-registers', 'bank-accounts', 'credit-cards',
        'stocks', 'services', 'suppliers', 'customers', 'expenses',
        'subscriptions', 'reports'
      ];
    else
      -- admin ve diğerleri
      mods_array := array[
        'dashboard', 'retail', 'cash-registers', 'bank-accounts', 'credit-cards',
        'stocks', 'services', 'suppliers', 'customers', 'expenses',
        'subscriptions', 'reports', 'companies', 'activity', 'users'
      ];
    end if;
  end if;

  insert into public.user_profiles (
    id,
    email,
    full_name,
    role,
    allowed_modules,
    allowed_companies,
    is_active
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    default_role,
    mods_array,
    null,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

-- Trigger'ı bağla
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Mevcut auth.users varsa onları da user_profiles'a aktar (varsa)
insert into public.user_profiles (id, email, full_name, role, allowed_modules, is_active)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data->>'role', 'admin'),
  array[
    'dashboard', 'retail', 'cash-registers', 'bank-accounts', 'credit-cards',
    'stocks', 'services', 'suppliers', 'customers', 'expenses',
    'subscriptions', 'reports', 'companies', 'activity', 'users'
  ],
  true
from auth.users
on conflict (id) do nothing;
