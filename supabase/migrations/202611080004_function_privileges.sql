-- Lock down callable database functions. Business RPCs remain available only
-- to authenticated staff; internal trigger functions are not directly callable.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

-- Authorization helpers used by RLS policies and the application.
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- Staff/owner business operations. Each SECURITY DEFINER function validates
-- the caller's role internally before changing data.
grant execute on function public.close_cash_session(uuid, numeric) to authenticated;
grant execute on function public.collect_payment_balance(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.complete_sale(jsonb, jsonb) to authenticated;
grant execute on function public.create_product(jsonb) to authenticated;
grant execute on function public.open_cash_session(jsonb) to authenticated;
grant execute on function public.receive_purchase(jsonb, jsonb) to authenticated;
grant execute on function public.record_expense(jsonb) to authenticated;
grant execute on function public.record_membership_payment(jsonb) to authenticated;
grant execute on function public.register_attendance(jsonb) to authenticated;
grant execute on function public.register_day_pass(jsonb) to authenticated;
grant execute on function public.reset_test_data() to authenticated;

-- Future functions default to no API execution until explicitly granted.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;