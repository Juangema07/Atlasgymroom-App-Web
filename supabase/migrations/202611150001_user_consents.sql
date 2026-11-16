-- Constancia versionada de aceptación de términos y permisos asignados.
create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  terms_version text not null,
  terms_text text not null,
  permissions_snapshot jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now()
);

create index if not exists user_consents_user_accepted_idx
  on public.user_consents (user_id, accepted_at desc);

alter table public.user_consents enable row level security;

drop policy if exists user_consents_select_self_or_owner on public.user_consents;
create policy user_consents_select_self_or_owner
  on public.user_consents for select to authenticated
  using ((select auth.uid()) = user_id or public.is_owner());

drop policy if exists user_consents_insert_self on public.user_consents;
create policy user_consents_insert_self
  on public.user_consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.user_consents from anon, authenticated;
grant select, insert on public.user_consents to authenticated;
