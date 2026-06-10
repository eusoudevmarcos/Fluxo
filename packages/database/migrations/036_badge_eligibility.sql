create or replace function public.calculate_user_engagement(target_user_id uuid)
returns table (
  user_id uuid,
  fans_count bigint,
  dahoras_received bigint,
  comments_received bigint,
  presences_received bigint,
  waves_received bigint,
  engagement_rate numeric
)
language sql
stable
set search_path = public
as $$
  with user_contents as (
    select id
    from public.contents
    where author_id = target_user_id
      and visibility = 'public'
  ),
  totals as (
    select
      target_user_id as user_id,
      coalesce((select count(*) from public.user_relationships where following_id = target_user_id), 0)::bigint as fans_count,
      coalesce((select count(*) from public.dahoras where content_id in (select id from user_contents)), 0)::bigint as dahoras_received,
      coalesce((select count(*) from public.comments where content_id in (select id from user_contents)), 0)::bigint as comments_received,
      coalesce((select count(*) from public.presences where content_id in (select id from user_contents)), 0)::bigint as presences_received,
      coalesce((select count(*) from public.waves where content_id in (select id from user_contents)), 0)::bigint as waves_received
  )
  select
    totals.user_id,
    totals.fans_count,
    totals.dahoras_received,
    totals.comments_received,
    totals.presences_received,
    totals.waves_received,
    round(
      (
        (totals.dahoras_received + totals.comments_received + totals.presences_received + totals.waves_received)::numeric
        / greatest(totals.fans_count, 1)
      ) * 100,
      2
    ) as engagement_rate
  from totals;
$$;

revoke execute on function public.calculate_user_engagement(uuid) from public;
grant execute on function public.calculate_user_engagement(uuid) to authenticated;

create or replace view public.user_verification_eligibility as
select
  profiles.user_id,
  engagement.fans_count,
  engagement.engagement_rate,
  (
    engagement.fans_count >= 100000
    and engagement.engagement_rate >= 30
  ) as eligible,
  case
    when engagement.fans_count < 100000 then 'Precisa alcançar 100K fãs.'
    when engagement.engagement_rate < 30 then 'Precisa manter pelo menos 30% de engagement médio.'
    else 'Elegível para análise de verificação.'
  end as reason
from public.profiles
cross join lateral public.calculate_user_engagement(profiles.user_id) as engagement;
