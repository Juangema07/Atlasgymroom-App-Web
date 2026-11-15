create policy "owner_insert_products"
on public.products
for insert
to authenticated
with check (is_owner() and created_by = auth.uid());

create policy "staff_insert_stock_movements"
on public.stock_movements
for insert
to authenticated
with check (is_staff() and created_by = auth.uid());
