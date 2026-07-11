-- Global LLM load circuit breaker. Run after 0009.
--
-- Per-user and per-IP limits (0009) don't stop a DISTRIBUTED burst: 500 IPs each doing one
-- request all pass, yet together they drain the LLM budget. This adds a global cap across ALL
-- users/IPs in the window. When tripped, callers get 'saturated' (surfaced as HTTP 503) and no
-- LLM call is made. Controlled by the p_global_limit arg (0 = disabled).

-- Global count scans by time only; give it a dedicated index.
create index if not exists api_request_log_created_idx
  on public.api_request_log (created_at desc);

-- Return type changes boolean -> text, so drop the old signature first.
drop function if exists public.try_log_llm_request(text, text, int, int, int);

create or replace function public.try_log_llm_request(
  p_route text,
  p_ip text,
  p_user_limit int default 8,
  p_ip_limit int default 20,
  p_window_seconds int default 60,
  p_global_limit int default 0
) returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  since timestamptz := now() - make_interval(secs => greatest(p_window_seconds, 1));
  user_count int;
  ip_count int;
  global_count int;
  normalized_ip text := coalesce(nullif(trim(p_ip), ''), 'unknown');
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_route is null or length(trim(p_route)) = 0 then
    raise exception 'route required';
  end if;

  -- Global breaker first, so saturation is reported as such (not as a per-user rate limit).
  if p_global_limit > 0 then
    select count(*) into global_count
      from public.api_request_log
      where created_at >= since;
    if global_count >= p_global_limit then
      return 'saturated';
    end if;
  end if;

  select count(*) into user_count
    from public.api_request_log
    where user_id = uid and route = p_route and created_at >= since;
  if user_count >= greatest(p_user_limit, 1) then
    return 'rate_limited';
  end if;

  select count(*) into ip_count
    from public.api_request_log
    where ip = normalized_ip and route = p_route and created_at >= since;
  if ip_count >= greatest(p_ip_limit, 1) then
    return 'rate_limited';
  end if;

  insert into public.api_request_log (user_id, ip, route)
    values (uid, normalized_ip, p_route);

  return 'ok';
end $$;
