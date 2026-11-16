
drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
for update to authenticated
using (public.has_module_permission('users','update'))
with check (public.has_module_permission('users','update'));

create or replace function public.update_user_permissions(
 p_user_id uuid,p_permissions jsonb,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare target public.profiles%rowtype; next_version integer;
begin
 if not public.has_module_permission('users','update') then raise exception 'Debes aceptar los términos y ser administrador para cambiar permisos'; end if;
 if p_user_id is null or p_permissions is null or jsonb_typeof(p_permissions)<>'object' then raise exception 'La configuración de permisos no es válida'; end if;
 if exists(select 1 from jsonb_each(p_permissions) as modules(key,value)
 where modules.key not in ('dashboard','members','plans','attendance','day_pass','payments','sales','sales_adjustments','receivables_sales','price_lists','evolutions','routines','exercises','suppliers','employees','purchases','payables_purchases','supporting_documents','purchase_adjustments','expense_types','expenses','receivables_adjustments','product_categories','products','inventory_adjustments','inventory_counts','inventory_ledger','booking_settings','classes','reservations','branch','navigation','roles','users','email_settings','email_templates','notifications','email_history','cash','reports','audit','settings')
 or jsonb_typeof(modules.value)<>'object'
 or exists(select 1 from jsonb_each(modules.value) as actions(key,value) where actions.key not in ('view','create','update','close') or jsonb_typeof(actions.value)<>'boolean'))
 then raise exception 'Hay módulos o acciones no reconocidos'; end if;
 if exists(select 1 from jsonb_each(p_permissions) as modules(key,value)
 where exists(select 1 from jsonb_each(modules.value) as actions(key,value) where actions.key<>'view' and actions.value='true'::jsonb)
 and coalesce((modules.value ->> 'view')::boolean,false)=false
 ) then raise exception 'Cada acción requiere también permiso de consulta'; end if;
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
