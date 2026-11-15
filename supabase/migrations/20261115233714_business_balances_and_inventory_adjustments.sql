
create or replace function public.collect_sales_balance(p_sale_id uuid,p_amount numeric,p_method text,p_cash_movement_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare s public.sales%rowtype; next_paid numeric;
begin
 if not public.has_module_permission('sales','update') then raise exception 'No tienes permiso para cobrar saldos de ventas'; end if;
 if not public.has_module_permission('cash','create') then raise exception 'No tienes permiso para registrar movimientos de caja'; end if;
 if p_cash_movement_id is null then raise exception 'Falta el identificador del movimiento'; end if;
 select * into s from public.sales where id=p_sale_id for update;
 if not found then raise exception 'No se encontró la venta'; end if;
 if exists(select 1 from public.cash_movements where id=p_cash_movement_id) then return jsonb_build_object('sale_id',s.id,'amount_paid',s.amount_paid,'status',s.status); end if;
 if s.status='voided' or p_amount is null or p_amount<=0 or p_amount>(s.total-s.amount_paid) then raise exception 'El abono no es válido o supera el saldo pendiente'; end if;
 next_paid:=s.amount_paid+p_amount;
 insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
 values(p_cash_movement_id,(select id from public.cash_sessions where status='open' limit 1),'income',p_amount,coalesce(p_method,'cash'),'Abono a cuenta por cobrar de venta',s.id,auth.uid());
 update public.sales set amount_paid=next_paid,status=case when next_paid>=total then 'paid' else 'partial' end,updated_at=now() where id=s.id;
 return jsonb_build_object('sale_id',s.id,'amount_paid',next_paid,'status',case when next_paid>=s.total then 'paid' else 'partial' end);
end $$;

create or replace function public.collect_purchase_balance(p_purchase_id uuid,p_amount numeric,p_method text,p_cash_movement_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare p public.purchases%rowtype; next_paid numeric;
begin
 if not public.has_module_permission('purchases','update') then raise exception 'No tienes permiso para pagar saldos de compras'; end if;
 if not public.has_module_permission('cash','create') then raise exception 'No tienes permiso para registrar movimientos de caja'; end if;
 if p_cash_movement_id is null then raise exception 'Falta el identificador del movimiento'; end if;
 select * into p from public.purchases where id=p_purchase_id for update;
 if not found then raise exception 'No se encontró la compra'; end if;
 if exists(select 1 from public.cash_movements where id=p_cash_movement_id) then return jsonb_build_object('purchase_id',p.id,'amount_paid',p.amount_paid); end if;
 if p_amount is null or p_amount<=0 or p_amount>(p.total_amount-p.amount_paid) then raise exception 'El pago no es válido o supera el saldo pendiente'; end if;
 next_paid:=p.amount_paid+p_amount;
 insert into public.cash_movements(id,cash_session_id,direction,amount,method,description,reference_id,created_by)
 values(p_cash_movement_id,(select id from public.cash_sessions where status='open' limit 1),'expense',p_amount,coalesce(p_method,'cash'),'Abono a cuenta por pagar de compra',p.id,auth.uid());
 update public.purchases set amount_paid=next_paid,updated_at=now() where id=p.id;
 return jsonb_build_object('purchase_id',p.id,'amount_paid',next_paid);
end $$;

create or replace function public.adjust_product_stock(p_product_id uuid,p_delta integer,p_reason text,p_movement_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare p public.products%rowtype; next_stock integer;
begin
 if not public.has_module_permission('inventory_adjustments','create') then raise exception 'No tienes permiso para ajustar inventario'; end if;
 if p_movement_id is null or p_delta is null or p_delta=0 then raise exception 'La cantidad de ajuste debe ser distinta de cero'; end if;
 if length(trim(coalesce(p_reason,'')))<4 then raise exception 'Escribe un motivo claro para el ajuste'; end if;
 select * into p from public.products where id=p_product_id for update;
 if not found then raise exception 'No se encontró el producto'; end if;
 if exists(select 1 from public.stock_movements where id=p_movement_id) then return jsonb_build_object('product_id',p.id,'stock',p.stock,'movement_id',p_movement_id); end if;
 next_stock:=p.stock+p_delta;
 if next_stock<0 then raise exception 'El ajuste dejaría las existencias en negativo'; end if;
 update public.products set stock=next_stock,updated_at=now() where id=p.id;
 insert into public.stock_movements(id,product_id,movement_type,quantity,notes,created_by) values(p_movement_id,p.id,'adjustment',p_delta,trim(p_reason),auth.uid());
 return jsonb_build_object('product_id',p.id,'stock',next_stock,'movement_id',p_movement_id);
end $$;

revoke all on function public.collect_sales_balance(uuid,numeric,text,uuid) from public,anon;
revoke all on function public.collect_purchase_balance(uuid,numeric,text,uuid) from public,anon;
revoke all on function public.adjust_product_stock(uuid,integer,text,uuid) from public,anon;
grant execute on function public.collect_sales_balance(uuid,numeric,text,uuid) to authenticated;
grant execute on function public.collect_purchase_balance(uuid,numeric,text,uuid) to authenticated;
grant execute on function public.adjust_product_stock(uuid,integer,text,uuid) to authenticated;
