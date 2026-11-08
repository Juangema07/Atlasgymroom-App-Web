-- Atlasgymroom: esquema inicial. Ejecutar completo en Supabase SQL Editor.
-- No contiene credenciales ni usuarios reales.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('owner', 'cashier');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Usuario',
  role public.app_role not null default 'cashier',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active = true limit 1 $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() in ('owner','cashier'), false) $$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() = 'owner', false) $$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_days integer not null check (duration_days > 0),
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  document text unique,
  phone text,
  email text,
  birth_date date,
  status text not null default 'active' check (status in ('active','inactive','expired','debt')),
  current_plan_id uuid references public.plans(id),
  start_date date,
  end_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  plan_id uuid references public.plans(id),
  amount numeric(12,2) not null check (amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  method text not null default 'cash' check (method in ('cash','transfer','nequi','card','other')),
  status text not null default 'paid' check (status in ('paid','partial','pending','voided')),
  paid_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  visitor_name text,
  entry_type text not null default 'member' check (entry_type in ('member','day_pass')),
  entered_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_person_check check (member_id is not null or visitor_name is not null)
);

create table if not exists public.day_passes (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  method text not null default 'cash' check (method in ('cash','transfer','nequi','card','other')),
  visited_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  description text,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  total numeric(12,2) not null check (total >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  method text not null default 'cash' check (method in ('cash','transfer','nequi','card','other')),
  status text not null default 'paid' check (status in ('paid','partial','pending','voided')),
  sold_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in ('purchase','sale','adjustment','return')),
  quantity integer not null check (quantity <> 0),
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier text,
  description text not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  purchased_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id),
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash','transfer','nequi','card','other')),
  expense_date timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  initial_cash numeric(12,2) not null default 0 check (initial_cash >= 0),
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  difference numeric(12,2),
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_open_cash_session on public.cash_sessions ((status)) where status = 'open';

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid references public.cash_sessions(id),
  direction text not null check (direction in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash','transfer','nequi','card','other')),
  description text not null,
  reference_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

-- Trigger para crear el perfil inicial de cada usuario nuevo.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), 'cashier')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Auditoría de cambios; los movimientos financieros se conservan y se corrigen con registros compensatorios.
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public
as $$
declare old_json jsonb; new_json jsonb; row_id uuid;
begin
  if TG_OP <> 'INSERT' then old_json := to_jsonb(OLD); row_id := (old_json->>'id')::uuid; end if;
  if TG_OP <> 'DELETE' then new_json := to_jsonb(NEW); row_id := (new_json->>'id')::uuid; end if;
  insert into public.audit_logs(entity_table, entity_id, action, before_data, after_data, changed_by)
  values (TG_TABLE_NAME, row_id, TG_OP, old_json, new_json, auth.uid());
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end $$;

drop policy if exists staff_insert_plans on public.plans;
drop policy if exists owner_insert_plans on public.plans;
create policy owner_insert_plans on public.plans for insert to authenticated with check (public.is_owner());

do $
declare t text;
begin
  foreach t in array array['profiles','plans','members','payments','attendance','day_passes','products','sales','sale_items','stock_movements','purchases','purchase_items','expenses','cash_sessions','cash_movements'] loop
    execute format('drop trigger if exists audit_%I on public.%I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute procedure public.write_audit_log()', t, t);
  end loop;
  foreach t in array array['profiles','plans','members','payments','products','sales','purchases','expenses','cash_sessions'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format('create trigger touch_%I before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  end loop;
end $$;

-- Operaciones transaccionales: IDs UUID idempotentes para evitar duplicados al reconectar.
create or replace function public.create_product(p_product jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare pid uuid := (p_product->>'id')::uuid; initial_stock integer := coalesce((p_product->>'stock')::integer,0);
begin
  if not public.is_owner() then raise exception 'Solo el propietario puede crear productos'; end if;
  if exists(select 1 from public.products where id=pid) then return pid; end if;
  if initial_stock < 0 then raise exception 'Las existencias iniciales no pueden ser negativas'; end if;
  insert into public.products(id,name,sku,description,cost,price,stock,min_stock,active,created_by)
  values(pid,p_product->>'name',nullif(p_product->>'sku',''),p_product->>'description',
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

create or replace function public.record_membership_payment(p_payment jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare pid uuid := (p_payment->>'id')::uuid; mid uuid := (p_payment->>'member_id')::uuid;
  plid uuid := nullif(p_payment->>'plan_id','')::uuid; amt numeric := coalesce((p_payment->>'amount')::numeric,0);
  paid numeric := coalesce((p_payment->>'amount_paid')::numeric,0); method_name text := coalesce(p_payment->>'method','cash');
  plan_days integer; start_on date; inserted integer;
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  if exists(select 1 from public.payments where id=pid) then return pid; end if;
  if amt < 0 or paid < 0 or paid > amt then raise exception 'Valor de pago inválido'; end if;
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
    select duration_days into plan_days from public.plans where id=plid;
    if plan_days is null then raise exception 'Plan no encontrado'; end if;
    select case when end_date >= timezone('America/Bogota', now())::date then end_date + 1 else timezone('America/Bogota', now())::date end
      into start_on from public.members where id=mid for update;
    update public.members set current_plan_id=plid, start_date=start_on,
      end_date=start_on + plan_days - 1, status='active', updated_at=now() where id=mid;
  end if;
  return pid;
end $$;

create or replace function public.complete_sale(p_sale jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
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
  if not public.is_staff() then raise exception 'No autorizado'; end if;
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
end $$;

create or replace function public.register_day_pass(p_day_pass jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare did uuid := (p_day_pass->>'id')::uuid; visitor text := p_day_pass->>'visitor_name';
  amt numeric := coalesce((p_day_pass->>'amount')::numeric,0); method_name text := coalesce(p_day_pass->>'method','cash');
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  if exists(select 1 from public.day_passes where id=did) then return did; end if;
  insert into public.day_passes(id,visitor_name,amount,method,notes,created_by)
  values(did,visitor,amt,method_name,p_day_pass->>'notes',auth.uid());
  insert into public.attendance(id,member_id,visitor_name,entry_type,created_by)
  values(coalesce(nullif(p_day_pass->>'attendance_id','')::uuid,gen_random_uuid()),null,visitor,'day_pass',auth.uid());
  if amt>0 then
    insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
    values(coalesce(nullif(p_day_pass->>'cash_movement_id','')::uuid,gen_random_uuid()),(select id from public.cash_sessions where status='open' limit 1),'income',amt,method_name,'Pase diario',did,auth.uid());
  end if;
  return did;
end $$;

create or replace function public.record_expense(p_expense jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare eid uuid := (p_expense->>'id')::uuid; amt numeric := (p_expense->>'amount')::numeric;
  method_name text := coalesce(p_expense->>'method','cash');
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  if exists(select 1 from public.expenses where id=eid) then return eid; end if;
  if amt<=0 then raise exception 'El gasto debe ser mayor que cero'; end if;
  insert into public.expenses(id,category,description,amount,method,notes,created_by)
  values(eid,p_expense->>'category',p_expense->>'description',amt,method_name,p_expense->>'notes',auth.uid());
  insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
  values(coalesce(nullif(p_expense->>'cash_movement_id','')::uuid,gen_random_uuid()),(select id from public.cash_sessions where status='open' limit 1),'expense',amt,method_name,p_expense->>'description',eid,auth.uid());
  return eid;
end $$;

create or replace function public.receive_purchase(p_purchase jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  purid uuid := (p_purchase->>'id')::uuid;
  item jsonb;
  pid uuid;
  qty integer;
  line_cost numeric;
  calculated_total numeric := 0;
  paid numeric := coalesce((p_purchase->>'amount_paid')::numeric,0);
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
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
end $$;

create or replace function public.open_cash_session(p_session jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare sid uuid := (p_session->>'id')::uuid; cash numeric := coalesce((p_session->>'initial_cash')::numeric,0);
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  if exists(select 1 from public.cash_sessions where id=sid) then return sid; end if;
  if exists(select 1 from public.cash_sessions where status='open') then raise exception 'Ya existe una caja abierta'; end if;
  insert into public.cash_sessions(id,opened_by,initial_cash,notes,status)
  values(sid,auth.uid(),cash,p_session->>'notes','open');
  return sid;
end $$;

create or replace function public.close_cash_session(p_session_id uuid, p_counted_cash numeric)
returns jsonb language plpgsql security definer set search_path = public
as $
declare sess public.cash_sessions%rowtype; expected numeric; diff numeric;
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  select * into sess from public.cash_sessions where id=p_session_id for update;
  if not found then raise exception 'No se encontró la sesión de caja'; end if;
  if not (public.is_owner() or sess.opened_by=auth.uid()) then raise exception 'Solo quien abrió la caja o el dueño puede cerrarla'; end if;
  if sess.status = 'closed' then
    return jsonb_build_object('expected_cash',sess.expected_cash,'counted_cash',sess.counted_cash,'difference',sess.difference);
  end if;
  select sess.initial_cash + coalesce(sum(case when direction='income' then amount else -amount end),0)
    into expected from public.cash_movements
    where cash_session_id=p_session_id and method='cash';
  diff := p_counted_cash - expected;
  update public.cash_sessions set expected_cash=expected,counted_cash=p_counted_cash,difference=diff,
    status='closed',closed_at=now(),updated_at=now() where id=p_session_id;
  return jsonb_build_object('expected_cash',expected,'counted_cash',p_counted_cash,'difference',diff);
end $$;

-- RLS: el cliente nunca recibe privilegios administrativos por tener la publishable key.
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;
alter table public.day_passes enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_read_self_or_owner on public.profiles;
create policy profiles_read_self_or_owner on public.profiles for select to authenticated
using (id=auth.uid() or public.is_owner());
drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles for update to authenticated
using (public.is_owner()) with check (public.is_owner());

do $$
declare t text;
begin
  foreach t in array array['plans','members','payments','attendance','day_passes','products','sales','sale_items','stock_movements','purchases','purchase_items','expenses','cash_sessions','cash_movements'] loop
    execute format('drop policy if exists staff_read_%I on public.%I',t,t);
    execute format('create policy staff_read_%I on public.%I for select to authenticated using (public.is_staff())',t,t);
    execute format('drop policy if exists staff_insert_%I on public.%I',t,t);
  end loop;
end $$;

-- Escrituras directas limitadas a fichas básicas. Los movimientos económicos y el stock
-- solo se crean mediante funciones transaccionales SECURITY DEFINER.
drop policy if exists staff_insert_members on public.members;
create policy staff_insert_members on public.members for insert to authenticated
with check (public.is_staff() and created_by = auth.uid());
drop policy if exists staff_insert_attendance on public.attendance;
create policy staff_insert_attendance on public.attendance for insert to authenticated
with check (public.is_staff() and created_by = auth.uid());

drop policy if exists owner_insert_plans on public.plans;
create policy owner_insert_plans on public.plans for insert to authenticated
with check (public.is_owner() and created_by = auth.uid());
drop policy if exists owner_update_products on public.products;
drop policy if exists staff_update_products on public.products;
create policy owner_update_products on public.products for update to authenticated
using (public.is_owner()) with check (public.is_owner());

revoke insert on public.profiles, public.payments, public.day_passes, public.products,
  public.sales, public.sale_items, public.stock_movements, public.purchases,
  public.purchase_items, public.expenses, public.cash_sessions, public.cash_movements,
  public.audit_logs from authenticated;

-- Edición de fichas: el personal actualiza socios; el dueño administra planes y productos.
drop policy if exists staff_update_members on public.members;
create policy staff_update_members on public.members for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists owner_update_plans on public.plans;
create policy owner_update_plans on public.plans for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists owner_update_cash_sessions on public.cash_sessions;
revoke update on public.cash_sessions from authenticated;
drop policy if exists owner_read_audit on public.audit_logs;
create policy owner_read_audit on public.audit_logs for select to authenticated using (public.is_owner());

-- Sin políticas DELETE deliberadamente: los movimientos contables no se eliminan desde la app.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles, public.plans, public.members, public.payments,
  public.attendance, public.day_passes, public.products, public.sales, public.sale_items,
  public.stock_movements, public.purchases, public.purchase_items, public.expenses,
  public.cash_sessions, public.cash_movements, public.audit_logs to authenticated;
revoke insert, update, delete on public.payments, public.day_passes, public.sales,
  public.sale_items, public.stock_movements, public.purchases, public.purchase_items,
  public.expenses, public.cash_sessions, public.cash_movements, public.audit_logs
  from authenticated;
revoke insert, delete on public.products from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke delete on public.plans, public.members, public.attendance from authenticated;
grant select on public.payments, public.day_passes, public.sales, public.sale_items,
  public.stock_movements, public.purchases, public.purchase_items, public.expenses,
  public.cash_sessions, public.cash_movements, public.audit_logs to authenticated;

revoke all on function public.create_product(jsonb) from public;
revoke all on function public.record_membership_payment(jsonb) from public;
revoke all on function public.complete_sale(jsonb,jsonb) from public;
revoke all on function public.register_day_pass(jsonb) from public;
revoke all on function public.record_expense(jsonb) from public;
revoke all on function public.receive_purchase(jsonb,jsonb) from public;
revoke all on function public.open_cash_session(jsonb) from public;
revoke all on function public.close_cash_session(uuid,numeric) from public;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.create_product(jsonb) to authenticated;
grant execute on function public.record_membership_payment(jsonb) to authenticated;
grant execute on function public.complete_sale(jsonb,jsonb) to authenticated;
grant execute on function public.register_day_pass(jsonb) to authenticated;
grant execute on function public.record_expense(jsonb) to authenticated;
grant execute on function public.receive_purchase(jsonb,jsonb) to authenticated;
grant execute on function public.open_cash_session(jsonb) to authenticated;
grant execute on function public.close_cash_session(uuid,numeric) to authenticated;

-- IMPORTANTE: después de crear el primer usuario, promover su perfil a owner desde SQL Editor:
-- update public.profiles set role='owner' where id = (select id from auth.users where email='TU_CORREO');
