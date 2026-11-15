-- Foreign-key indexes for common joins and delete/update checks.
create index if not exists attendance_created_by_idx on public.attendance(created_by);
create index if not exists attendance_member_id_idx on public.attendance(member_id);
create index if not exists cash_movements_cash_session_id_idx on public.cash_movements(cash_session_id);
create index if not exists cash_movements_created_by_idx on public.cash_movements(created_by);
create index if not exists cash_sessions_opened_by_idx on public.cash_sessions(opened_by);
create index if not exists day_passes_created_by_idx on public.day_passes(created_by);
create index if not exists expenses_created_by_idx on public.expenses(created_by);
create index if not exists gym_records_created_by_idx on public.gym_records(created_by);
create index if not exists members_created_by_idx on public.members(created_by);
create index if not exists members_current_plan_id_idx on public.members(current_plan_id);
create index if not exists payments_created_by_idx on public.payments(created_by);
create index if not exists payments_member_id_idx on public.payments(member_id);
create index if not exists payments_plan_id_idx on public.payments(plan_id);
create index if not exists plans_created_by_idx on public.plans(created_by);
create index if not exists products_created_by_idx on public.products(created_by);
create index if not exists purchase_items_product_id_idx on public.purchase_items(product_id);
create index if not exists purchase_items_purchase_id_idx on public.purchase_items(purchase_id);
create index if not exists purchases_created_by_idx on public.purchases(created_by);
create index if not exists sale_items_product_id_idx on public.sale_items(product_id);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists sales_created_by_idx on public.sales(created_by);
create index if not exists sales_member_id_idx on public.sales(member_id);
create index if not exists stock_movements_created_by_idx on public.stock_movements(created_by);
create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id);

-- Cache auth context once per statement in RLS policy expressions.
alter policy profiles_read_self_or_owner on public.profiles
  using ((id = (select auth.uid())) or (select public.is_owner()));

alter policy staff_insert_members on public.members
  with check ((select public.is_staff()) and created_by = (select auth.uid()));

alter policy staff_insert_attendance on public.attendance
  with check ((select public.is_staff()) and created_by = (select auth.uid()));

alter policy gym_records_staff_insert on public.gym_records
  with check ((select public.is_staff()) and created_by = (select auth.uid()));
alter policy gym_records_staff_select on public.gym_records
  using ((select public.is_staff()));
alter policy gym_records_staff_update on public.gym_records
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

alter policy owner_insert_plans on public.plans
  with check ((select public.is_owner()) and created_by = (select auth.uid()));

alter policy owner_insert_products on public.products
  with check ((select public.is_owner()) and created_by = (select auth.uid()));

alter policy staff_insert_stock_movements on public.stock_movements
  with check ((select public.is_staff()) and created_by = (select auth.uid()));

alter policy staff_read_members on public.members using ((select public.is_staff()));
alter policy staff_update_members on public.members
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
alter policy staff_read_attendance on public.attendance using ((select public.is_staff()));
alter policy staff_read_payments on public.payments using ((select public.is_staff()));
alter policy staff_read_plans on public.plans using ((select public.is_staff()));
alter policy staff_read_products on public.products using ((select public.is_staff()));
alter policy staff_read_stock_movements on public.stock_movements using ((select public.is_staff()));
alter policy staff_read_cash_sessions on public.cash_sessions using ((select public.is_staff()));
alter policy staff_read_cash_movements on public.cash_movements using ((select public.is_staff()));
alter policy staff_read_day_passes on public.day_passes using ((select public.is_staff()));
alter policy staff_read_expenses on public.expenses using ((select public.is_staff()));
alter policy staff_read_purchases on public.purchases using ((select public.is_staff()));
alter policy staff_read_purchase_items on public.purchase_items using ((select public.is_staff()));
alter policy staff_read_sales on public.sales using ((select public.is_staff()));
alter policy staff_read_sale_items on public.sale_items using ((select public.is_staff()));
alter policy owner_read_audit on public.audit_logs using ((select public.is_owner()));
alter policy profiles_update_owner on public.profiles
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
alter policy owner_update_plans on public.plans
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
alter policy owner_update_products on public.products
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
