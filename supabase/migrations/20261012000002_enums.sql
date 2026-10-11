create type public.user_role as enum ('rider', 'college_admin', 'super_admin');
create type public.profile_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.pass_status as enum ('pending', 'ready', 'riding', 'overdue', 'suspended');
create type public.bike_status as enum ('available', 'borrowed', 'maintenance', 'missing', 'retired');
create type public.ride_status as enum ('active', 'returned', 'force_returned');
create type public.issue_status as enum ('open', 'in_progress', 'resolved');
create type public.issue_type as enum (
  'flat_tyre', 'brakes', 'chain', 'damaged_qr', 'bike_missing', 'accident', 'ride_close_request', 'other'
);
create type public.photo_check as enum ('pending', 'ok', 'unclear', 'failed', 'skipped');
create type public.notification_kind as enum (
  'approval', 'rejection', 'ride_reminder', 'ride_overdue', 'ride_closed', 'strike', 'suspension',
  'reinstated', 'issue_update', 'password_reset', 'admin_alert', 'torq'
);
create type public.ai_agent as enum ('orchestrator', 'ride', 'inspector', 'ops', 'triage');
create type public.ai_run_status as enum ('running', 'done', 'failed', 'stopped_by_guardrail', 'over_budget');
create type public.ai_action_status as enum ('proposed', 'confirmed', 'done', 'cancelled', 'expired', 'failed');
create type public.ai_step_kind as enum ('context', 'model_call', 'tool_call', 'guardrail', 'router_fallback');
create type public.ai_insight_kind as enum ('digest', 'forecast', 'rebalancing', 'issue_group');
create type public.ai_insight_status as enum ('active', 'accepted', 'dismissed', 'expired');
create type public.ai_trigger as enum (
  'chat', 'console', 'photo_check', 'id_check', 'issue_suggest', 'issue_triage', 'morning', 'eval'
);
