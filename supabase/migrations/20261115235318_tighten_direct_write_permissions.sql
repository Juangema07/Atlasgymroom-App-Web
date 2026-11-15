-- Reduce exposed privileges; audited writes go through permission-checked RPCs.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
revoke delete,truncate,references,trigger on all tables in schema public from authenticated;
revoke all privileges on all sequences in schema public from authenticated;
drop policy if exists staff_insert_attendance on public.attendance;
drop policy if exists staff_insert_stock_movements on public.stock_movements;
revoke insert on public.attendance from authenticated;
revoke insert on public.stock_movements from authenticated;
drop policy if exists module_read_audit_logs on public.audit_logs;
