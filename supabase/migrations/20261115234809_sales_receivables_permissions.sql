
drop policy if exists module_read_sales on public.sales;
create policy module_read_sales on public.sales for select to authenticated
using (public.has_module_permission('sales','view') or public.has_module_permission('receivables_sales','view'));
drop policy if exists module_read_products on public.products;
create policy module_read_products on public.products for select to authenticated
using (public.has_module_permission('products','view') or public.has_module_permission('inventory_adjustments','create') or public.has_module_permission('inventory_counts','view'));
create or replace function public.collect_sales_balance(p_sale_id uuid,p_amount numeric,p_method text,p_cash_movement_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.sales%rowtype; next_paid numeric;
begin
 if not (public.has_module_permission('sales','update') or public.has_module_permission('receivables_sales','update')) then raise exception 'No tienes permiso para cobrar saldos de ventas'; end if;
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
revoke all on function public.collect_sales_balance(uuid,numeric,text,uuid) from public,anon;
grant execute on function public.collect_sales_balance(uuid,numeric,text,uuid) to authenticated;
