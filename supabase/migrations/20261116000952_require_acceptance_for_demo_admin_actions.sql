CREATE OR REPLACE FUNCTION public.reset_demo_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_module_permission('settings','update') then raise exception 'Debes aceptar los términos y ser administrador para limpiar los datos de demostración'; end if;
  delete from public.sale_items where sale_id in (select id from public.sales where notes like '[ATLAS_DEMO]%');
  delete from public.purchase_items where purchase_id in (select id from public.purchases where notes like '[ATLAS_DEMO]%');
  delete from public.stock_movements where notes like '[ATLAS_DEMO]%';
  delete from public.cash_movements where description like '[ATLAS_DEMO]%';
  delete from public.attendance where notes like '[ATLAS_DEMO]%';
  delete from public.day_passes where notes like '[ATLAS_DEMO]%';
  delete from public.sales where notes like '[ATLAS_DEMO]%';
  delete from public.payments where notes like '[ATLAS_DEMO]%';
  delete from public.purchase_items where purchase_id in (select id from public.purchases where notes like '[ATLAS_DEMO]%');
  delete from public.purchases where notes like '[ATLAS_DEMO]%';
  delete from public.expenses where notes like '[ATLAS_DEMO]%';
  delete from public.cash_sessions where notes like '[ATLAS_DEMO]%';
  delete from public.members where notes like '[ATLAS_DEMO]%';
  delete from public.products where sku like 'DEMO-%';
  delete from public.gym_records where notes like '[ATLAS_DEMO]%';
  return jsonb_build_object('ok',true,'message','Datos de demostración eliminados; datos reales conservados');
end $function$
;

CREATE OR REPLACE FUNCTION public.seed_demo_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan uuid;
  v_member1 uuid := 'd3000000-0000-4000-8000-000000000001';
  v_member2 uuid := 'd3000000-0000-4000-8000-000000000002';
  v_product1 uuid := 'd3000000-0000-4000-8000-000000000011';
  v_product2 uuid := 'd3000000-0000-4000-8000-000000000012';
  v_sale uuid := 'd3000000-0000-4000-8000-000000000021';
  v_purchase uuid := 'd3000000-0000-4000-8000-000000000031';
  v_cash uuid := 'd3000000-0000-4000-8000-000000000041';
  v_now timestamptz := now();
begin
  if not public.has_module_permission('settings','update') then raise exception 'Debes aceptar los términos y ser administrador para cargar datos de demostración'; end if;
  if exists(select 1 from public.members where notes like '[ATLAS_DEMO]%')
     or exists(select 1 from public.products where sku like 'DEMO-%')
     or exists(select 1 from public.cash_sessions where notes like '[ATLAS_DEMO]%') then
    raise exception 'Ya hay datos de demostración. Límpialos antes de volver a cargarlos.';
  end if;

  select id into v_plan from public.plans where active=true order by created_at limit 1;
  if v_plan is null then
    insert into public.plans(name,plan_type,duration_days,ticket_quantity,price,active,created_by)
    values('Plan demostración','normal',30,0,50000,true,auth.uid()) returning id into v_plan;
  end if;

  insert into public.members(id,full_name,document,phone,status,current_plan_id,start_date,end_date,notes,created_by)
  values
   (v_member1,'Cliente Demo Uno','DEMO-1001','3000000001','active',v_plan,current_date,current_date+30,'[ATLAS_DEMO] Registro ficticio',auth.uid()),
   (v_member2,'Cliente Demo Dos','DEMO-1002','3000000002','debt',v_plan,current_date-30,current_date-1,'[ATLAS_DEMO] Registro ficticio',auth.uid());

  insert into public.payments(member_id,plan_id,amount,amount_paid,method,status,paid_at,notes,created_by)
  values(v_member1,v_plan,50000,50000,'cash','paid',v_now,'[ATLAS_DEMO] Pago ficticio',auth.uid()),
        (v_member2,v_plan,50000,20000,'transfer','partial',v_now,'[ATLAS_DEMO] Abono ficticio',auth.uid());

  insert into public.attendance(member_id,entry_type,entered_at,notes,created_by)
  values(v_member1,'member',v_now,'[ATLAS_DEMO] Asistencia ficticia',auth.uid()),
        (null,'day_pass',v_now,'[ATLAS_DEMO] Entrada ficticia',auth.uid());
  insert into public.day_passes(visitor_name,amount,method,visited_at,notes,created_by)
  values('Visitante Demo',8000,'cash',v_now,'[ATLAS_DEMO] Pase ficticio',auth.uid());

  insert into public.products(id,name,sku,description,cost,price,stock,min_stock,active,category,created_by)
  values(v_product1,'Agua Demo','DEMO-AGUA','Producto ficticio',1500,3000,20,5,true,'Bebidas',auth.uid()),
        (v_product2,'Barra Proteica Demo','DEMO-BARRA','Producto ficticio',4000,6500,12,3,true,'Snacks',auth.uid());

  insert into public.sales(id,member_id,total,amount_paid,method,status,sold_at,notes,created_by)
  values(v_sale,v_member1,6000,6000,'cash','paid',v_now,'[ATLAS_DEMO] Venta ficticia',auth.uid());
  insert into public.sale_items(sale_id,product_id,quantity,unit_price,line_total)
  values(v_sale,v_product1,2,3000,6000);
  insert into public.stock_movements(product_id,movement_type,quantity,reference_id,notes,created_by)
  values(v_product1,'sale',-2,v_sale,'[ATLAS_DEMO] Salida por venta ficticia',auth.uid());

  insert into public.purchases(id,supplier,description,total_amount,amount_paid,purchased_at,notes,created_by)
  values(v_purchase,'Proveedor Demo','Compra ficticia de inventario',80000,80000,v_now,'[ATLAS_DEMO] Compra ficticia',auth.uid());
  insert into public.purchase_items(purchase_id,product_id,quantity,unit_cost)
  values(v_purchase,v_product2,20,4000);
  insert into public.stock_movements(product_id,movement_type,quantity,reference_id,notes,created_by)
  values(v_product2,'purchase',20,v_purchase,'[ATLAS_DEMO] Entrada por compra ficticia',auth.uid());

  insert into public.expenses(category,description,amount,method,expense_date,notes,created_by)
  values('Servicios','Gasto demo de servicios',15000,'cash',current_date,'[ATLAS_DEMO] Gasto ficticio',auth.uid());

  insert into public.cash_sessions(id,opened_by,opened_at,initial_cash,expected_cash,status,notes)
  values(v_cash,auth.uid(),v_now,100000,100000,'open','[ATLAS_DEMO] Caja ficticia');
  insert into public.cash_movements(cash_session_id,direction,amount,method,description,created_by)
  values(v_cash,'income',8000,'cash','[ATLAS_DEMO] Ingreso demo',auth.uid()),
        (v_cash,'expense',15000,'cash','[ATLAS_DEMO] Egreso demo',auth.uid());

  insert into public.gym_records(record_type,title,person_name,record_date,amount,status,notes,created_by)
  values('note','Registro de demostración','Persona Demo',current_date,0,'active','[ATLAS_DEMO] Registro auxiliar ficticio',auth.uid());

  return jsonb_build_object('ok',true,'message','Datos ficticios cargados');
end $function$
;