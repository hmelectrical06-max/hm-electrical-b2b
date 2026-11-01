-- Supabase's DDL event trigger is internal, never a browser RPC.
-- Keep its event-trigger behaviour unchanged; remove client execution only.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
