
-- Atlasgymrun: aceptación de términos, permisos por módulo y autorización de operaciones.
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.gym_records add column if not exists module_key text not null default 'misc', add column if not exists details jsonb not null default '{}'::jsonb;
update public.gym_records set module_key=case record_type
when 'Evoluciones' then 'evolutions' when 'Rutinas' then 'routines' when 'Ejercicios' then 'exercises'
when 'Proveedores' then 'suppliers' when 'Empleados' then 'employees' when 'Documento Soporte' then 'supporting_documents'
when 'Notas Débito' then 'sales_adjustments' when 'Notas Crédito' then 'sales_adjustments'
when 'Notas Ajuste' then 'purchase_adjustments' when 'Tipos de Gastos' then 'expense_types'
when 'Ajuste Cartera' then 'receivables_adjustments' when 'Categorías de Producto' then 'product_categories'
when 'Ajustes de Inventario' then 'inventory_adjustments' when 'Regularizaciones de Inventario' then 'inventory_counts'
when 'Configuración de Reservaciones' then 'booking_settings' when 'Clases' then 'classes' when 'Reservaciones' then 'reservations'
when 'Mi Sucursal' then 'branch' when 'Menú de Navegación' then 'navigation' when 'Configuración de Correos' then 'email_settings'
when 'Plantilla de Correos' then 'email_templates' when 'Notificaciones' then 'notifications' when 'Historial de Correos' then 'email_history'
else module_key end;
update public.profiles set permissions='{"dashboard":{"view":true},"members":{"view":true,"create":true,"update":true},"attendance":{"view":true,"create":true},"day_pass":{"view":true,"create":true},"payments":{"view":true,"create":true,"update":true},"sales":{"view":true,"create":true,"update":true},"products":{"view":true},"cash":{"view":true,"create":true,"close":true},"reports":{"view":true}}'::jsonb where role='cashier' and (permissions='{}'::jsonb or permissions is null);
create table if not exists public.app_terms_versions(version text primary key,title text not null,body text not null,published_at timestamptz not null default now(),active boolean not null default false);
create unique index if not exists app_terms_one_active_version on public.app_terms_versions(active) where active=true;
insert into public.app_terms_versions(version,title,body,active) values('2026-11-15.1','Términos de uso y autorización de acceso','USO INTERNO DE ATLASGYMRUN

1. Acceso personal. La cuenta es individual. La persona aceptada no debe compartir contraseñas, códigos de acceso ni sesiones con otras personas.
2. Uso autorizado. La cuenta solo podrá utilizar los módulos y acciones que el administrador le haya asignado. Tener acceso a un apartado no autoriza a realizar acciones que no estén habilitadas.
3. Manejo de información. La información de socios, pagos, ventas, inventario y operación debe consultarse únicamente para las actividades del gimnasio. No debe copiarse, divulgarse, descargarse ni compartirse fuera de los fines autorizados.
4. Exactitud y cuidado. Quien registra una operación debe revisar los datos antes de confirmarla. Los errores deben comunicarse al administrador para que se corrijan mediante los procedimientos disponibles; no se deben alterar registros para ocultar movimientos.
5. Seguridad. No se deben intentar superar permisos, acceder a cuentas ajenas, desactivar controles ni instalar extensiones o programas que interfieran con la aplicación. Cualquier acceso extraño, pérdida de dispositivo o incidente debe comunicarse al administrador.
6. Registro de actividad. Atlasgymrun puede conservar registros técnicos de acceso, cambios y operaciones para proteger la información y dar trazabilidad a la administración.
7. Vigencia de permisos. El administrador puede cambiar o retirar permisos. Los cambios no autorizan a seguir utilizando información o módulos que ya no estén habilitados.
8. Datos personales. Esta aceptación no reemplaza la política de tratamiento de datos personales ni otros avisos que el gimnasio deba proporcionar. Las consultas sobre el uso de datos deben dirigirse al responsable del gimnasio.
9. Aceptación digital. Al seleccionar “Aceptar y continuar”, la persona confirma que pudo leer esta versión, entiende el alcance de los permisos que se le muestran y acepta estas condiciones para utilizar su cuenta.
Versión: 2026-11-15.1',true)
on conflict(version) do update set title=excluded.title,body=excluded.body,active=true;
create table if not exists public.user_terms_acceptances(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,terms_version text not null references public.app_terms_versions(version),accepted_at timestamptz not null default now(),unique(user_id,terms_version));
create index if not exists user_terms_acceptances_user_idx on public.user_terms_acceptances(user_id,accepted_at desc);
alter table public.app_terms_versions enable row level security;
alter table public.user_terms_acceptances enable row level security;
drop policy if exists active_terms_read_authenticated on public.app_terms_versions;
create policy active_terms_read_authenticated on public.app_terms_versions for select to authenticated using(active=true or public.is_owner());
drop policy if exists terms_acceptance_read_self_or_owner on public.user_terms_acceptances;
create policy terms_acceptance_read_self_or_owner on public.user_terms_acceptances for select to authenticated using(user_id=(select auth.uid()) or public.is_owner());
drop policy if exists terms_acceptance_insert_self on public.user_terms_acceptances;
create policy terms_acceptance_insert_self on public.user_terms_acceptances for insert to authenticated with check(user_id=(select auth.uid()));
grant select on public.app_terms_versions to authenticated;
grant select,insert on public.user_terms_acceptances to authenticated;
revoke update,delete on public.user_terms_acceptances from authenticated,anon;
revoke insert,update,delete on public.app_terms_versions from authenticated,anon;
create or replace function public.has_module_permission(p_module text,p_action text) returns boolean language sql stable set search_path=''
as $$ select coalesce((select p.active=true and (p.role='owner' or coalesce((p.permissions -> p_module ->> p_action)::boolean,false)) from public.profiles p where p.id=(select auth.uid())),false); $$;
revoke all on function public.has_module_permission(text,text) from public,anon;
grant execute on function public.has_module_permission(text,text) to authenticated;
do $$ declare item record; begin
for item in select * from (values ('plans','plans'),('members','members'),('payments','payments'),('attendance','attendance'),('day_passes','day_pass'),('products','products'),('sales','sales'),('sale_items','sales'),('stock_movements','inventory_ledger'),('purchases','purchases'),('purchase_items','purchases'),('expenses','expenses'),('cash_sessions','cash'),('cash_movements','cash'),('audit_logs','audit')) as v(tablename,module_key) loop
execute format('drop policy if exists staff_read_%I on public.%I',item.tablename,item.tablename);
execute format('create policy module_read_%I on public.%I for select to authenticated using(public.has_module_permission(%L,%L))',item.tablename,item.tablename,item.module_key,'view');
end loop; end $$;
drop policy if exists staff_insert_members on public.members;
create policy staff_insert_members on public.members for insert to authenticated with check(public.has_module_permission('members','create') and created_by=(select auth.uid()));
drop policy if exists staff_update_members on public.members;
create policy staff_update_members on public.members for update to authenticated using(public.has_module_permission('members','update')) with check(public.has_module_permission('members','update'));
drop policy if exists owner_insert_plans on public.plans;
create policy plans_insert_by_permission on public.plans for insert to authenticated with check(public.has_module_permission('plans','create') and created_by=(select auth.uid()));
drop policy if exists owner_update_plans on public.plans;
create policy plans_update_by_permission on public.plans for update to authenticated using(public.has_module_permission('plans','update')) with check(public.has_module_permission('plans','update'));
drop policy if exists owner_update_products on public.products;
create policy products_update_by_permission on public.products for update to authenticated using(public.has_module_permission('products','update')) with check(public.has_module_permission('products','update'));
drop policy if exists owner_read_audit on public.audit_logs;
create policy module_read_audit on public.audit_logs for select to authenticated using(public.has_module_permission('audit','view'));
drop policy if exists gym_records_staff_select on public.gym_records;
create policy gym_records_permission_select on public.gym_records for select to authenticated using(public.has_module_permission(module_key,'view'));
drop policy if exists gym_records_staff_insert on public.gym_records;
create policy gym_records_permission_insert on public.gym_records for insert to authenticated with check(public.has_module_permission(module_key,'create') and created_by=(select auth.uid()));
drop policy if exists gym_records_staff_update on public.gym_records;
create policy gym_records_permission_update on public.gym_records for update to authenticated using(public.has_module_permission(module_key,'update')) with check(public.has_module_permission(module_key,'update'));
grant select,insert,update on public.gym_records to authenticated;
CREATE OR REPLACE FUNCTION public.close_cash_session(p_session_id uuid, p_counted_cash numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sess public.cash_sessions%rowtype;
  expected numeric;
  diff numeric;
begin
  if not public.has_module_permission('cash','close') then raise exception 'No tienes permiso para esta operación'; end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'El efectivo contado debe ser un valor igual o mayor que cero';
  end if;

  select * into sess
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'No se encontró la sesión de caja';
  end if;

  if not (public.is_owner() or sess.opened_by = auth.uid()) then
    raise exception 'Solo quien abrió la caja o el administrador puede cerrarla';
  end if;

  if sess.status = 'closed' then
    return jsonb_build_object(
      'expected_cash', sess.expected_cash,
      'counted_cash', sess.counted_cash,
      'difference', sess.difference
    );
  end if;

  select sess.initial_cash + coalesce(sum(
    case when direction = 'income' then amount else -amount end
  ), 0)
  into expected
  from public.cash_movements
  where cash_session_id = p_session_id
    and method = 'cash';

  diff := p_counted_cash - expected;

  update public.cash_sessions
  set expected_cash = expected,
      counted_cash = p_counted_cash,
      difference = diff,
      closed_by = auth.uid(),
      status = 'closed',
      closed_at = now(),
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'expected_cash', expected,
    'counted_cash', p_counted_cash,
    'difference', diff
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.collect_payment_balance(p_payment_id uuid, p_amount numeric, p_method text, p_cash_movement_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pay public.payments%rowtype; due numeric; next_paid numeric; plan_days integer; start_on date;
begin
  if not public.has_module_permission('payments','update') then raise exception 'No tienes permiso para esta operación'; end if;
  if p_cash_movement_id is null then raise exception 'Falta el identificador del movimiento'; end if;
  select * into pay from public.payments where id=p_payment_id for update;
  if not found then raise exception 'No se encontró la cuenta por cobrar'; end if;
  if exists(select 1 from public.cash_movements where id=p_cash_movement_id) then
    return jsonb_build_object('payment_id',pay.id,'amount_paid',pay.amount_paid,'status',pay.status);
  end if;
  due := pay.amount - pay.amount_paid;
  if pay.status='voided' or p_amount is null or p_amount<=0 or p_amount>due then
    raise exception 'El abono no es válido o supera el saldo pendiente';
  end if;
  next_paid := pay.amount_paid + p_amount;
  insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
  values(p_cash_movement_id,(select id from public.cash_sessions where status='open' limit 1),
    'income',p_amount,p_method,'Abono a cuenta por cobrar',pay.id,auth.uid());
  update public.payments set amount_paid=next_paid,
    status=case when next_paid>=amount then 'paid' else 'partial' end,
    paid_at=case when next_paid>=amount then now() else paid_at end,updated_at=now()
  where id=pay.id;
  if next_paid>=pay.amount and pay.plan_id is not null then
    select duration_days into plan_days from public.plans where id=pay.plan_id;
    if plan_days is null then raise exception 'No se encontró la tarifa asociada'; end if;
    select case when end_date >= timezone('America/Bogota',now())::date and status='active' and paused_at is null
      then end_date+1 else timezone('America/Bogota',now())::date end
    into start_on from public.members where id=pay.member_id for update;
    update public.members set current_plan_id=pay.plan_id,start_date=start_on,
      end_date=start_on+plan_days-1,status='active',paused_at=null,updated_at=now()
      where id=pay.member_id;
  end if;
  return jsonb_build_object('payment_id',pay.id,'amount_paid',next_paid,'status',case when next_paid>=pay.amount then 'paid' else 'partial' end);
end $function$
;

CREATE OR REPLACE FUNCTION public.complete_sale(p_sale jsonb, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sid uuid := (p_sale->>'id')::uuid;
  item jsonb;
  pid uuid;
  qty integer;
  price numeric;
  submitted_price numeric;
  stock_now integer;
  actual_total numeric := 0;
  paid numeric := coalesce((p_sale->>'amount_paid')::numeric,0);
  method_name text := coalesce(p_sale->>'method','cash');
  member uuid := nullif(p_sale->>'member_id','')::uuid;
begin
  if not public.has_module_permission('sales','create') then raise exception 'No tienes permiso para esta operación'; end if;
  if exists(select 1 from public.sales where id=sid) then return sid; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Agrega al menos un producto';
  end if;

  -- Bloquea productos y verifica los precios vigentes antes de aceptar el total enviado por el navegador.
  for item in select * from jsonb_array_elements(p_items) loop
    pid := (item->>'product_id')::uuid;
    qty := coalesce((item->>'quantity')::integer,0);
    submitted_price := coalesce((item->>'unit_price')::numeric,-1);
    if qty <= 0 then raise exception 'Cantidad inválida'; end if;
    select p.stock, p.price into stock_now, price
      from public.products p where p.id=pid for update;
    if not found then raise exception 'Producto no encontrado'; end if;
    if submitted_price <> price then raise exception 'El precio de un producto cambió. Actualiza el carrito'; end if;
    actual_total := actual_total + (qty * price);
  end loop;

  if round(coalesce((p_sale->>'total')::numeric,0),2) <> round(actual_total,2) then
    raise exception 'El total de la venta no coincide con los precios vigentes';
  end if;
  if paid < 0 or paid > actual_total then raise exception 'Valor recibido inválido'; end if;

  insert into public.sales(id,member_id,total,amount_paid,method,status,notes,created_by)
  values(sid,member,actual_total,paid,method_name,
    case when paid=0 then 'pending' when paid < actual_total then 'partial' else 'paid' end,
    p_sale->>'notes',auth.uid());

  -- Segunda pasada: aplica stock y detalle dentro de la misma transacción.
  for item in select * from jsonb_array_elements(p_items) loop
    pid := (item->>'product_id')::uuid;
    qty := coalesce((item->>'quantity')::integer,0);
    select p.stock, p.price into stock_now, price from public.products p where p.id=pid for update;
    if stock_now < qty then raise exception 'Existencia insuficiente para uno de los productos'; end if;
    update public.products as prod set stock=prod.stock-qty,updated_at=now() where prod.id=pid;
    insert into public.sale_items(id,sale_id,product_id,quantity,unit_price,line_total)
    values(coalesce(nullif(item->>'id','')::uuid,gen_random_uuid()),sid,pid,qty,price,qty*price);
    insert into public.stock_movements(id,product_id,movement_type,quantity,reference_id,created_by)
    values(coalesce(nullif(item->>'stock_movement_id','')::uuid,gen_random_uuid()),pid,'sale',-qty,sid,auth.uid());
  end loop;

  if paid>0 then
    insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
    values(coalesce(nullif(p_sale->>'cash_movement_id','')::uuid,gen_random_uuid()),
      (select id from public.cash_sessions where status='open' limit 1),
      'income',paid,method_name,'Venta de productos',sid,auth.uid());
  end if;
  return sid;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_product(p_product jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid uuid := (p_product->>'id')::uuid; initial_stock integer := coalesce((p_product->>'stock')::integer,0);
begin
  if not public.has_module_permission('products','create') then raise exception 'No tienes permiso para crear productos'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.open_cash_session(p_session jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid uuid := (p_session->>'id')::uuid; cash numeric := coalesce((p_session->>'initial_cash')::numeric,0);
begin
  if not public.has_module_permission('cash','create') then raise exception 'No tienes permiso para esta operación'; end if;
  if exists(select 1 from public.cash_sessions where id=sid) then return sid; end if;
  if exists(select 1 from public.cash_sessions where status='open') then raise exception 'Ya existe una caja abierta'; end if;
  insert into public.cash_sessions(id,opened_by,initial_cash,notes,status)
  values(sid,auth.uid(),cash,p_session->>'notes','open');
  return sid;
end $function$
;

CREATE OR REPLACE FUNCTION public.receive_purchase(p_purchase jsonb, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  purid uuid := (p_purchase->>'id')::uuid;
  item jsonb;
  pid uuid;
  qty integer;
  line_cost numeric;
  calculated_total numeric := 0;
  paid numeric := coalesce((p_purchase->>'amount_paid')::numeric,0);
begin
  if not public.has_module_permission('purchases','create') then raise exception 'No tienes permiso para esta operación'; end if;
  if exists(select 1 from public.purchases where id=purid) then return purid; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Agrega al menos un producto a la compra';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    pid := (item->>'product_id')::uuid;
    qty := coalesce((item->>'quantity')::integer,0);
    line_cost := coalesce((item->>'unit_cost')::numeric,-1);
    if qty <= 0 or line_cost < 0 then raise exception 'Cantidad o costo de compra inválido'; end if;
    if not exists(select 1 from public.products where id=pid) then
      raise exception 'Producto de compra no encontrado';
    end if;
    calculated_total := calculated_total + (qty * line_cost);
  end loop;

  if round(coalesce((p_purchase->>'total_amount')::numeric,0),2) <> round(calculated_total,2) then
    raise exception 'El total de compra no coincide con el detalle';
  end if;
  if paid < 0 or paid > calculated_total then raise exception 'Valor pagado de compra inválido'; end if;

  insert into public.purchases(id,supplier,description,total_amount,amount_paid,notes,created_by)
  values(purid,p_purchase->>'supplier',p_purchase->>'description',
    calculated_total,paid,p_purchase->>'notes',auth.uid());

  for item in select * from jsonb_array_elements(p_items) loop
    pid := (item->>'product_id')::uuid;
    qty := coalesce((item->>'quantity')::integer,0);
    line_cost := (item->>'unit_cost')::numeric;
    update public.products as prod set stock=prod.stock+qty,cost=line_cost,updated_at=now() where prod.id=pid;
    if not found then raise exception 'Producto de compra no encontrado'; end if;
    insert into public.purchase_items(id,purchase_id,product_id,quantity,unit_cost)
    values(coalesce(nullif(item->>'id','')::uuid,gen_random_uuid()),purid,pid,qty,line_cost);
    insert into public.stock_movements(id,product_id,movement_type,quantity,reference_id,created_by)
    values(coalesce(nullif(item->>'stock_movement_id','')::uuid,gen_random_uuid()),pid,'purchase',qty,purid,auth.uid());
  end loop;

  if paid>0 then
    insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
    values(coalesce(nullif(p_purchase->>'cash_movement_id','')::uuid,gen_random_uuid()),
      (select id from public.cash_sessions where status='open' limit 1),
      'expense',paid,coalesce(p_purchase->>'method','cash'),'Compra de inventario',purid,auth.uid());
  end if;
  return purid;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_expense(p_expense jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare eid uuid := (p_expense->>'id')::uuid; amt numeric := (p_expense->>'amount')::numeric;
  method_name text := coalesce(p_expense->>'method','cash');
begin
  if not public.has_module_permission('expenses','create') then raise exception 'No tienes permiso para esta operación'; end if;
  if exists(select 1 from public.expenses where id=eid) then return eid; end if;
  if amt<=0 then raise exception 'El gasto debe ser mayor que cero'; end if;
  insert into public.expenses(id,category,description,amount,method,notes,created_by)
  values(eid,p_expense->>'category',p_expense->>'description',amt,method_name,p_expense->>'notes',auth.uid());
  insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
  values(coalesce(nullif(p_expense->>'cash_movement_id','')::uuid,gen_random_uuid()),(select id from public.cash_sessions where status='open' limit 1),'expense',amt,method_name,p_expense->>'description',eid,auth.uid());
  return eid;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_membership_payment(p_payment jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid uuid := (p_payment->>'id')::uuid; mid uuid := (p_payment->>'member_id')::uuid;
  plid uuid := nullif(p_payment->>'plan_id','')::uuid; amt numeric := coalesce((p_payment->>'amount')::numeric,0);
  paid numeric := coalesce((p_payment->>'amount_paid')::numeric,0); method_name text := coalesce(p_payment->>'method','cash');
  plan_days integer; start_on date; inserted integer; plan_price numeric; price_editable boolean; plan_active boolean;
begin
  if not public.has_module_permission('payments','create') then raise exception 'No tienes permiso para esta operación'; end if;
  if exists(select 1 from public.payments where id=pid) then return pid; end if;
  if amt <= 0 or paid < 0 or paid > amt or plid is null then raise exception 'Selecciona una tarifa y verifica el valor del pago'; end if;
  select duration_days, price, allow_price_change, active
    into plan_days, plan_price, price_editable, plan_active
    from public.plans where id=plid;
  if plan_days is null or plan_active is not true then raise exception 'La tarifa no existe o está inactiva'; end if;
  if price_editable is false and amt <> plan_price then raise exception 'Esta tarifa no permite modificar su precio'; end if;
  insert into public.payments(id,member_id,plan_id,amount,amount_paid,method,status,paid_at,notes,created_by)
  values(pid,mid,plid,amt,paid,method_name,
    case when paid=0 then 'pending' when paid < amt then 'partial' else 'paid' end,
    case when paid>0 then coalesce(nullif(p_payment->>'paid_at','')::timestamptz,now()) else null end,
    p_payment->>'notes',auth.uid());
  if paid > 0 then
    insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
    values(coalesce(nullif(p_payment->>'cash_movement_id','')::uuid,gen_random_uuid()),(select id from public.cash_sessions where status='open' limit 1),'income',paid,method_name,'Pago de mensualidad',pid,auth.uid());
  end if;
  if paid >= amt and amt > 0 and plid is not null then
    if plan_days is null then raise exception 'Plan no encontrado'; end if;
    select case when end_date >= timezone('America/Bogota', now())::date and status='active' and paused_at is null then end_date + 1 else timezone('America/Bogota', now())::date end
      into start_on from public.members where id=mid for update;
    update public.members set current_plan_id=plid, start_date=start_on,
      end_date=start_on + plan_days - 1, status='active', paused_at=null, updated_at=now() where id=mid;
  end if;
  return pid;
end $function$
;

CREATE OR REPLACE FUNCTION public.register_attendance(p_attendance jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare aid uuid := (p_attendance->>'id')::uuid; mid uuid := nullif(p_attendance->>'member_id','')::uuid;
  visitor text := nullif(trim(p_attendance->>'visitor_name'),''); local_day date := timezone('America/Bogota',now())::date;
  m public.members%rowtype;
begin
  if not public.has_module_permission('attendance','create') then raise exception 'No tienes permiso para esta operación'; end if;
  if exists(select 1 from public.attendance where id=aid) then return aid; end if;
  if mid is not null then
    perform pg_advisory_xact_lock(hashtextextended(mid::text || ':' || local_day::text,0));
    select * into m from public.members where id=mid for share;
    if not found then raise exception 'No se encontró el cliente'; end if;
    if m.status <> 'active' or m.paused_at is not null or m.current_plan_id is null or m.end_date is null or m.end_date < local_day then
      raise exception 'El cliente no tiene una tarifa vigente o su actividad está pausada';
    end if;
    if exists(select 1 from public.attendance where member_id=mid and (entered_at at time zone 'America/Bogota')::date=local_day) then
      raise exception 'Este cliente ya tiene una entrada registrada hoy';
    end if;
    insert into public.attendance(id,member_id,visitor_name,entry_type,entered_at,notes,created_by)
    values(aid,mid,null,'member',coalesce(nullif(p_attendance->>'entered_at','')::timestamptz,now()),p_attendance->>'notes',auth.uid());
  else
    if visitor is null then raise exception 'Escribe el nombre del visitante'; end if;
    insert into public.attendance(id,member_id,visitor_name,entry_type,entered_at,notes,created_by)
    values(aid,null,visitor,'day_pass',coalesce(nullif(p_attendance->>'entered_at','')::timestamptz,now()),p_attendance->>'notes',auth.uid());
  end if;
  return aid;
end $function$
;

CREATE OR REPLACE FUNCTION public.register_day_pass(p_day_pass jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  did uuid := (p_day_pass->>'id')::uuid;
  visitor text := coalesce(nullif(trim(p_day_pass->>'visitor_name'),''),'Entrada general');
  amt numeric := coalesce((p_day_pass->>'amount')::numeric,0);
  method_name text := coalesce(p_day_pass->>'method','cash');
begin
  if not public.has_module_permission('day_pass','create') then raise exception 'No tienes permiso para esta operación'; end if;
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
end $function$
;
