-- ==============================================================================
-- CTC MASTER LEDGER - KİMLİK / RLS SERTLEŞTİRME (2026-11-24)
-- ==============================================================================
-- Kapatılan açıklar (docs/AUDIT-2026-09-16.md S-10, S-11):
--   1. Herkese açık kayıt (signUp) ile gelen kullanıcı trigger tarafından 'admin'
--      yapılıyor ve 'authenticated' rolüyle tüm tablolara tam CRUD alıyordu.
--   2. user_profiles politikası herkesin kendi rolünü 'admin' yapmasına izin veriyordu.
--
-- Veri silmez / değiştirmez. Yalnız fonksiyon, trigger ve RLS politikalarını değiştirir.
-- Tek DO bloğu içinde atomik çalışır. İdempotenttir (tekrar çalıştırılabilir).
-- Supabase Dashboard -> SQL Editor alanına yapıştırıp "RUN" ile çalıştırın.
-- ==============================================================================

-- 1. Yardımcı fonksiyonlar (security definer: user_profiles RLS'ine takılmadan kontrol eder)
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_active = true and role = 'admin'
  );
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 2. Yeni auth kullanıcısı trigger'ı: kullanıcının gönderdiği metadata'ya (rol/modül) GÜVENME.
--    Profil PASİF ve yetkisiz açılır; /api/admin/users service role ile hemen ardından
--    yöneticinin seçtiği rol/modülleri yazar ve aktif eder.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id, email, full_name, role, allowed_modules, allowed_companies, is_active
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'custom',
    array[]::text[],
    null,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Politikalar
do $$
declare
  tbl text;
  pol record;
begin
  -- 3a. user_profiles: herkes yalnız kendi satırını okur; yazma yalnız admin.
  alter table public.user_profiles enable row level security;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_profiles' loop
    execute format('drop policy %I on public.user_profiles', pol.policyname);
  end loop;
  create policy user_profiles_select_self_or_admin on public.user_profiles
    for select to authenticated
    using (id = auth.uid() or public.is_admin());
  create policy user_profiles_admin_write on public.user_profiles
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

  -- 3b. audit_logs: aktif kullanıcı okur ve ekler; güncelleme/silme yok (AUDIT S-3).
  alter table public.audit_logs enable row level security;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_logs' loop
    execute format('drop policy %I on public.audit_logs', pol.policyname);
  end loop;
  create policy audit_logs_active_select on public.audit_logs
    for select to authenticated using (public.is_active_user());
  create policy audit_logs_active_insert on public.audit_logs
    for insert to authenticated with check (public.is_active_user());

  -- 3c. Diğer tüm public tablolar: yalnız user_profiles'ta AKTİF profili olan kullanıcı.
  for tbl in
    select tablename from pg_tables
    where schemaname = 'public' and tablename not in ('user_profiles', 'audit_logs')
  loop
    execute format('alter table public.%I enable row level security', tbl);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
      execute format('drop policy %I on public.%I', pol.policyname, tbl);
    end loop;
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_active_user()) with check (public.is_active_user())',
      tbl || '_active_users', tbl
    );
  end loop;
end $$;

-- 4. Doğrulama
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
