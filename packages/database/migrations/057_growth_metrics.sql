-- Painel de metricas do motor de crescimento (so contas oficiais). Tudo calculado na hora a partir
-- das tabelas existentes; suficiente para o volume do beta.
create or replace function public.get_growth_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  week_start timestamptz := today_start - interval '6 days';
begin
  if not public.is_official_account(auth.uid()) then
    raise exception 'Acesso restrito às contas oficiais da Fluxo.';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'completed_signup', (select count(*) from public.profiles where profile_required_completed),
      'new_today', (select count(*) from public.profiles where created_at >= today_start),
      'new_7d', (select count(*) from public.profiles where created_at >= week_start),
      'active_today', (
        select count(distinct user_id) from public.mission_event_log
        where event_type = 'daily_active' and created_at >= today_start
      ),
      'active_7d', (
        select count(distinct user_id) from public.mission_event_log
        where event_type = 'daily_active' and created_at >= week_start
      ),
      'teens', (
        select count(*) from public.user_age_records
        where extract(year from age(current_date, birth_date)) < 18
      ),
      'nearby_enabled', (select count(*) from public.profiles where nearby_visible)
    ),
    'invites', jsonb_build_object(
      'accepted_total', (select count(*) from public.invite_redemptions),
      'accepted_7d', (select count(*) from public.invite_redemptions where created_at >= week_start),
      'inviters_total', (select count(distinct inviter_id) from public.invite_redemptions),
      'signups_via_invite_pct', (
        select case when count(*) = 0 then 0
          else round(100.0 * (select count(*) from public.invite_redemptions) / count(*), 1) end
        from public.profiles where profile_required_completed
      )
    ),
    'missions', jsonb_build_object(
      'completed_today', (
        select count(*) from public.user_mission_progress where completed_at >= today_start
      ),
      'completed_7d', (
        select count(*) from public.user_mission_progress where completed_at >= week_start
      ),
      'users_completing_7d', (
        select count(distinct user_id) from public.user_mission_progress where completed_at >= week_start
      )
    ),
    'content', jsonb_build_object(
      'posts_today', (select count(*) from public.contents where created_at >= today_start),
      'posts_7d', (select count(*) from public.contents where created_at >= week_start),
      'comments_7d', (select count(*) from public.comments where created_at >= week_start),
      'waves_7d', (select count(*) from public.waves where created_at >= week_start),
      'follows_7d', (select count(*) from public.user_relationships where created_at >= week_start)
    ),
    'seal_campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', slug, 'title', title, 'granted', granted_count, 'max', max_grants, 'active', is_active
      ) order by slug), '[]'::jsonb)
      from public.seal_campaigns
    ),
    'safety', jsonb_build_object(
      'open_reports', (select count(*) from public.reports where status = 'open'),
      'hidden_contents', (select count(*) from public.contents where visibility = 'removed'),
      'blocks_7d', (select count(*) from public.user_blocks where created_at >= week_start),
      'feedback_7d', (select count(*) from public.app_feedback where kind <> 'crash' and created_at >= week_start),
      'crashes_7d', (select count(*) from public.app_feedback where kind = 'crash' and created_at >= week_start)
    ),
    'creators', jsonb_build_object(
      'pending', (select count(*) from public.creator_applications where status = 'pending'),
      'approved', (select count(*) from public.creator_applications where status = 'approved')
    )
  );
end;
$$;

revoke execute on function public.get_growth_metrics() from public;
revoke execute on function public.get_growth_metrics() from anon;
grant execute on function public.get_growth_metrics() to authenticated;
