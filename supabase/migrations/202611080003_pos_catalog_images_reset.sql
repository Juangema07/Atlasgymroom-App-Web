-- Catálogo visual de productos, entrada rápida sin identidad y reinicio seguro del entorno de pruebas.
-- Ejecutar después de 202611080001_initial_schema.sql y 202611080002_gym_records.sql.

alter table public.products add column if not exists category text not null default 'Otros';
alter table public.products add column if not exists image_url text;
alter table public.day_passes alter column visitor_name drop not null;

-- Bucket público solo para fotos de productos; no subir documentos personales ni fotos de clientes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,2097152,array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public=true, file_size_limit=2097152, allowed_mime_types=array['image/webp','image/jpeg','image/png'];

drop policy if exists atlas_staff_upload_product_images on storage.objects;
create policy atlas_staff_upload_product_images on storage.objects
for insert to authenticated
with check (bucket_id='product-images' and public.is_staff());

drop policy if exists atlas_staff_update_product_images on storage.objects;
create policy atlas_staff_update_product_images on storage.objects
for update to authenticated
using (bucket_id='product-images' and public.is_staff())
with check (bucket_id='product-images' and public.is_staff());

create or replace function public.create_product(p_product jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare pid uuid := (p_product->>'id')::uuid; initial_stock integer := coalesce((p_product->>'stock')::integer,0);
begin
  if not public.is_owner() then raise exception 'Solo el propietario puede crear productos'; end if;
  if exists(select 1 from public.products where id=pid) then return pid; end if;
  if initial_stock < 0 then raise exception 'Las existencias iniciales no pueden ser negativas'; end if;
  insert into public.products(id,name,sku,description,category,image_url,cost,price,stock,min_stock,active,created_by)
  values(pid,p_product->>'name',nullif(p_product->>'sku',''),p_product->>'description',
    coalesce(nullif(p_product->>'category',''),'Otros'),p_product->>'image_url',
    coalesce((p_product->>'cost')::numeric,0),coalesce((p_product->>'price')::numeric,0),
    initial_stock,coalesce((p_product->>'min_stock')::integer,0),
    coalesce((p_product->>'active')::boolean,true),auth.uid());
  if initial_stock > 0 then
    insert into public.stock_movements(id,product_id,movement_type,quantity,notes,created_by)
    values(coalesce(nullif(p_product->>'stock_movement_id','')::uuid,gen_random_uuid()),pid,
      'adjustment',initial_stock,'Existencias iniciales',auth.uid());
  end if;
  return pid;
end $$;

create or replace function public.register_day_pass(p_day_pass jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  did uuid := (p_day_pass->>'id')::uuid;
  visitor text := coalesce(nullif(trim(p_day_pass->>'visitor_name'),''),'Entrada general');
  amt numeric := coalesce((p_day_pass->>'amount')::numeric,0);
  method_name text := coalesce(p_day_pass->>'method','cash');
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  if exists(select 1 from public.day_passes where id=did) then return did; end if;
  if amt<=0 then raise exception 'El valor de la entrada debe ser mayor que cero'; end if;
  insert into public.day_passes(id,visitor_name,amount,method,notes,created_by)
  values(did,visitor,amt,method_name,p_day_pass->>'notes',auth.uid());
  insert into public.attendance(id,member_id,visitor_name,entry_type,created_by)
  values(coalesce(nullif(p_day_pass->>'attendance_id','')::uuid,gen_random_uuid()),null,visitor,'day_pass',auth.uid());
  insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
  values(coalesce(nullif(p_day_pass->>'cash_movement_id','')::uuid,gen_random_uuid()),
    (select id from public.cash_sessions where status='open' limit 1),'income',amt,method_name,'Entrada general',did,auth.uid());
  return did;
end $$;

-- El reinicio es explícito y solo lo puede ejecutar un propietario autenticado.
-- Conserva perfiles/usuarios y tarifas; borra los registros operativos de prueba.
create or replace function public.reset_test_data()
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Solo el propietario puede reiniciar los datos'; end if;

  delete from public.sale_items;
  delete from public.purchase_items;
  delete from public.stock_movements;
  delete from public.cash_movements;
  delete from public.attendance;
  delete from public.day_passes;
  delete from public.sales;
  delete from public.payments;
  delete from public.purchases;
  delete from public.expenses;
  delete from public.cash_sessions;
  delete from public.members;
  delete from public.products;
  delete from public.gym_records;
  delete from public.audit_logs;
  delete from storage.objects where bucket_id='product-images';

  return jsonb_build_object('ok',true,'reset_at',now(),'preserved',jsonb_build_array('profiles','plans'));
end $$;

revoke all on function public.create_product(jsonb) from public;
revoke all on function public.register_day_pass(jsonb) from public;
revoke all on function public.reset_test_data() from public;
grant execute on function public.create_product(jsonb) to authenticated;
grant execute on function public.register_day_pass(jsonb) to authenticated;
grant execute on function public.reset_test_data() to authenticated;
