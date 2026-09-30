-- Align legacy content columns with the Ocean MVP moments terminology.
do $$
begin
  if to_regclass('public.contents') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contents'
        and column_name = 'momentum_id'
    ) and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contents'
        and column_name = 'moment_id'
    ) then
      alter table public.contents rename column momentum_id to moment_id;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contents'
        and column_name = 'moment_id'
    ) then
      alter table public.contents add column moment_id uuid null;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contents'
        and column_name = 'momentum_id'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contents'
        and column_name = 'moment_id'
    ) then
      update public.contents
      set moment_id = coalesce(moment_id, momentum_id)
      where moment_id is null
        and momentum_id is not null;

      alter table public.contents drop column momentum_id;
    end if;
  end if;
end $$;
