alter table public.cash_sessions
  add column if not exists closed_by uuid references auth.users(id) on delete set null;

create index if not exists cash_sessions_closed_by_idx
  on public.cash_sessions(closed_by);

create or replace function public.close_cash_session(
  p_session_id uuid,
  p_counted_cash numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  sess public.cash_sessions%rowtype;
  expected numeric;
  diff numeric;
begin
  if not public.is_staff() then raise exception 'No autorizado'; end if;
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'El efectivo contado debe ser un valor igual o mayor que cero';
  end if;
  select * into sess from public.cash_sessions where id = p_session_id for update;
  if not found then raise exception 'No se encontró la sesión de caja'; end if;
  if not (public.is_owner() or sess.opened_by = auth.uid()) then
    raise exception 'Solo quien abrió la caja o el administrador puede cerrarla';
  end if;
  if sess.status = 'closed' then
    return jsonb_build_object('expected_cash',sess.expected_cash,'counted_cash',sess.counted_cash,'difference',sess.difference);
  end if;
  select sess.initial_cash + coalesce(sum(case when direction='income' then amount else -amount end),0)
    into expected
    from public.cash_movements
    where cash_session_id=p_session_id and method='cash';
  diff := p_counted_cash - expected;
  update public.cash_sessions
    set expected_cash=expected,counted_cash=p_counted_cash,difference=diff,
        closed_by=auth.uid(),status='closed',closed_at=now(),updated_at=now()
    where id=p_session_id;
  return jsonb_build_object('expected_cash',expected,'counted_cash',p_counted_cash,'difference',diff);
end;
$function$;

revoke execute on function public.reset_test_data() from public, anon, authenticated;
grant execute on function public.reset_test_data() to service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.write_audit_log() from public, anon, authenticated;
