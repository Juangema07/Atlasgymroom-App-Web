-- Atlasgymroom: registros operativos auxiliares para los módulos de gestión.
-- Estos registros son operativos; no sustituyen libros contables ni servicios externos.
create table if not exists public.gym_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  title text,
  person_name text,
  phone text,
  email text,
  record_date date,
  date_start date,
  date_end date,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  status text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_records_type_date_idx on public.gym_records(record_type, record_date desc);
create index if not exists gym_records_person_idx on public.gym_records(person_name);
alter table public.gym_records enable row level security;
drop policy if exists gym_records_staff_select on public.gym_records;
create policy gym_records_staff_select on public.gym_records for select to authenticated using (public.is_staff());
drop policy if exists gym_records_staff_insert on public.gym_records;
create policy gym_records_staff_insert on public.gym_records for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
drop policy if exists gym_records_staff_update on public.gym_records;
create policy gym_records_staff_update on public.gym_records for update to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, insert, update on public.gym_records to authenticated;
revoke delete on public.gym_records from authenticated;
