-- Runs the PolyTrade bot runner every minute from Supabase itself (free).
--
-- Paste into Supabase → SQL Editor, replace the two placeholders, and run.
-- Each call also writes the runner heartbeat, which is the database activity
-- that keeps a free Supabase project from pausing.
--
--   <APP_URL>      your deployment, e.g. https://polytrade.fi
--   <CRON_SECRET>  the same value as the CRON_SECRET environment variable

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running this script replaces the job instead of adding a second one.
select cron.unschedule('polytrade-runner')
where exists (select 1 from cron.job where jobname = 'polytrade-runner');

select cron.schedule(
  'polytrade-runner',
  '* * * * *',
  $$
  select net.http_get(
    url := '<APP_URL>/api/runner/tick',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 55000
  );
  $$
);

-- Check it is running (a new row every minute):
--   select status, return_message, start_time from cron.job_run_details
--   order by start_time desc limit 5;
