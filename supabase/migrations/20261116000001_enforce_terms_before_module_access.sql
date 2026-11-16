-- Enforce current terms acceptance in every permission check, including RPC/RLS paths.
create or replace function public.has_module_permission(p_module text,p_action text)
returns boolean language sql stable set search_path=''
as $$
select coalesce((
 select p.active=true
 and exists(
   select 1 from public.app_terms_versions t
   join public.user_terms_acceptances a on a.terms_version=t.version
   where t.active=true and a.user_id=p.id and a.permissions_version=p.permissions_version
 )
 and (
   p.role='owner'
   or (
    coalesce((p.permissions -> p_module ->> 'view')::boolean,false)
    and coalesce((p.permissions -> p_module ->> p_action)::boolean,false)
   )
 )
 from public.profiles p where p.id=(select auth.uid())
),false);
$$;
revoke all on function public.has_module_permission(text,text) from public,anon;
grant execute on function public.has_module_permission(text,text) to authenticated;
