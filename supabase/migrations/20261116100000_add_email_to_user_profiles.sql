alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is distinct from u.email;

create unique index if not exists profiles_email_lower_uidx
  on public.profiles (lower(btrim(email)))
  where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles(id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    'cashier'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
