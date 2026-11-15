
alter table public.profiles add column if not exists permissions_version integer not null default 1;
alter table public.user_terms_acceptances add column if not exists permissions_version integer not null default 1;
alter table public.user_terms_acceptances drop constraint if exists user_terms_acceptances_user_id_terms_version_key;
create unique index if not exists user_terms_acceptances_versioned_unique on public.user_terms_acceptances(user_id,terms_version,permissions_version);
create table if not exists public.user_permission_history(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 changed_by uuid references auth.users(id) on delete set null,
 previous_permissions jsonb not null default '{}'::jsonb,
 new_permissions jsonb not null default '{}'::jsonb,
 permissions_version integer not null,
 changed_at timestamptz not null default now()
);
create index if not exists user_permission_history_user_idx on public.user_permission_history(user_id,changed_at desc);
alter table public.user_permission_history enable row level security;
drop policy if exists permission_history_read_self_or_owner on public.user_permission_history;
create policy permission_history_read_self_or_owner on public.user_permission_history for select to authenticated using(user_id=(select auth.uid()) or public.is_owner());
grant select on public.user_permission_history to authenticated;
revoke insert,update,delete on public.user_permission_history from authenticated,anon;
revoke update on public.profiles from authenticated;
grant update(active) on public.profiles to authenticated;
create or replace function public.has_module_permission(p_module text,p_action text)
returns boolean language sql stable set search_path=''
as $$
 select coalesce((select p.active=true and (p.role='owner' or (coalesce((p.permissions -> p_module ->> 'view')::boolean,false) and coalesce((p.permissions -> p_module ->> p_action)::boolean,false))) from public.profiles p where p.id=(select auth.uid())),false);
$$;
revoke all on function public.has_module_permission(text,text) from public,anon;
grant execute on function public.has_module_permission(text,text) to authenticated;
create or replace function public.update_user_permissions(p_user_id uuid,p_permissions jsonb,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare target public.profiles%rowtype; next_version integer;
begin
 if not public.is_owner() then raise exception 'Solo un administrador puede cambiar permisos'; end if;
 if p_user_id is null or p_permissions is null or jsonb_typeof(p_permissions)<>'object' then raise exception 'La configuración de permisos no es válida'; end if;
 if exists(select 1 from jsonb_each(p_permissions) as modules(key,value)
 where modules.key not in ('dashboard','members','plans','attendance','day_pass','payments','sales','sales_adjustments','receivables_sales','price_lists','evolutions','routines','exercises','suppliers','employees','purchases','payables_purchases','supporting_documents','purchase_adjustments','expense_types','expenses','receivables_adjustments','product_categories','products','inventory_adjustments','inventory_counts','inventory_ledger','booking_settings','classes','reservations','branch','navigation','roles','users','email_settings','email_templates','notifications','email_history','cash','reports','audit','settings')
 or jsonb_typeof(modules.value)<>'object'
 or exists(select 1 from jsonb_each(modules.value) as actions(key,value) where actions.key not in ('view','create','update','close') or jsonb_typeof(actions.value)<>'boolean'))
 then raise exception 'Hay módulos o acciones no reconocidos'; end if;
 select * into target from public.profiles where id=p_user_id and role='cashier' for update;
 if not found then raise exception 'No se encontró un usuario trabajador editable'; end if;
 if p_expected_version is null or target.permissions_version<>p_expected_version then raise exception 'Los permisos cambiaron desde que abriste el editor. Actualiza la lista e inténtalo de nuevo'; end if;
 next_version:=target.permissions_version+1;
 update public.profiles set permissions=p_permissions,permissions_version=next_version,updated_at=now() where id=p_user_id;
 insert into public.user_permission_history(user_id,changed_by,previous_permissions,new_permissions,permissions_version)
 values(p_user_id,auth.uid(),coalesce(target.permissions,'{}'::jsonb),p_permissions,next_version);
 return jsonb_build_object('user_id',p_user_id,'permissions_version',next_version);
end $$;
revoke all on function public.update_user_permissions(uuid,jsonb,integer) from public,anon;
grant execute on function public.update_user_permissions(uuid,jsonb,integer) to authenticated;
