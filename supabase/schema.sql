-- 인공와우 합주실 연구 데이터 스키마.
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 한 번 실행한다(다시 실행해도 안전).
-- 참여자는 익명 로그인(auth.uid)으로만 구분한다. 이름·연락처·이메일은 받지 않는다.
-- 행 수준 보안(RLS): 각 참여자는 자기 행만 쓰고 읽고 지울 수 있다. 연구팀은 대시보드(서비스 역할)로 전체를 본다.

-- ───────── 참여자: 동의 + 배경 설문 ─────────
create table if not exists public.participants (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  consent_version text not null,
  consented_at timestamptz not null,
  -- 나이대·착용 형태·착용 기간·청력 손실 시기·제조사·음악 경험·듣는 방법 (모두 선택)
  survey jsonb not null default '{}'::jsonb,
  app_version text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── 최신 상태: 프로필(처음 설정 결과), 단서 질문 응답 ─────────
create table if not exists public.participant_state (
  participant_id uuid not null default auth.uid() references public.participants (id) on delete cascade,
  kind text not null check (kind in ('profile', 'probe')),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (participant_id, kind)
);

-- ───────── 행동 로그: 합주실에서 누른 기록 ─────────
create table if not exists public.events (
  id bigint generated always as identity primary key,
  participant_id uuid not null default auth.uid() references public.participants (id) on delete cascade,
  client_t timestamptz not null,
  type text not null,
  song text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  -- 같은 이벤트를 두 번 보내도 한 번만 남는다
  unique (participant_id, client_t, type)
);
create index if not exists events_participant_t on public.events (participant_id, client_t);

-- ───────── 권한 ─────────
alter table public.participants enable row level security;
alter table public.participant_state enable row level security;
alter table public.events enable row level security;

revoke all on public.participants, public.participant_state, public.events from anon;
grant select, insert, update, delete on public.participants, public.participant_state, public.events to authenticated;

drop policy if exists "own participant" on public.participants;
create policy "own participant" on public.participants
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "own state" on public.participant_state;
create policy "own state" on public.participant_state
  for all to authenticated
  using (participant_id = (select auth.uid()))
  with check (participant_id = (select auth.uid()));

drop policy if exists "own events" on public.events;
create policy "own events" on public.events
  for all to authenticated
  using (participant_id = (select auth.uid()))
  with check (participant_id = (select auth.uid()));

-- ───────── 분석용 보기(연구팀 전용, 대시보드에서 조회) ─────────
-- "어떤 사람이 어떻게 듣는지": 배경 설문 + 처음 설정 결과 + 행동 요약을 한 줄로.
create or replace view public.participant_overview
with (security_invoker = true) as
select
  p.id,
  p.consented_at,
  p.survey ->> 'ageGroup' as age_group,
  p.survey ->> 'wearing' as wearing,
  p.survey ->> 'ciYears' as ci_years,
  p.survey ->> 'onset' as onset,
  p.survey ->> 'maker' as maker,
  p.survey ->> 'music' as music,
  p.survey ->> 'route' as route,
  s.payload -> 'instGainDb' as inst_gain_db,
  s.payload ->> 'bassAssist' as bass_assist,
  s.payload ->> 'eqLowDb' as eq_low_db,
  s.payload ->> 'eqMidDb' as eq_mid_db,
  (select count(*) from public.events e where e.participant_id = p.id) as event_count,
  (select count(*) from public.events e where e.participant_id = p.id and e.type = 'solo') as solo_count,
  (select max(e.client_t) from public.events e where e.participant_id = p.id) as last_active
from public.participants p
left join public.participant_state s on s.participant_id = p.id and s.kind = 'profile';
revoke all on public.participant_overview from anon, authenticated;

-- ───────── 관리자 문구 수정(#/admin) ─────────
-- 관리자: 화면에서는 이름 + 비밀번호로 로그인한다. 이름마다 정해진 이메일 계정이 있다(src/screens/admin/adminApi.ts의 ADMINS).
-- 계정은 저장소 밖의 '관리자_계정_만들기.sql'로 만든다(비밀번호가 들어 있어 공개 저장소에 올리지 않는다).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- 수정 기록에 남길 이름
alter table public.admins add column if not exists name text;
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
drop policy if exists "see own admin row" on public.admins;
create policy "see own admin row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 고친 한국어 문구. key = 코드에 적힌 원래 문구(변수 자리는 {0}, {1} …), value = 바꾼 문구.
-- 방문자 누구나 읽고(로그인 없이), admins에 있는 계정만 쓴다. 참여자 익명 계정도 authenticated라서 역할이 아니라 admins로 막는다.
create table if not exists public.text_overrides (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);
alter table public.text_overrides enable row level security;
revoke all on public.text_overrides from anon, authenticated;
grant select on public.text_overrides to anon, authenticated;
grant insert, update, delete on public.text_overrides to authenticated;
drop policy if exists "anyone reads overrides" on public.text_overrides;
create policy "anyone reads overrides" on public.text_overrides
  for select to anon, authenticated
  using (true);
drop policy if exists "admins write overrides" on public.text_overrides;
create policy "admins write overrides" on public.text_overrides
  for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- 수정 기록: 누가 어떤 문구를 무엇에서 무엇으로 바꿨는지. text_overrides가 바뀔 때마다 트리거가 남긴다.
-- old_value가 null이면 원래 문구에서 바꾼 것, new_value가 null이면 원래 문구로 되돌린 것.
create table if not exists public.text_override_history (
  id bigint generated always as identity primary key,
  key text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users (id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now()
);
create index if not exists text_override_history_key on public.text_override_history (key, changed_at desc);
alter table public.text_override_history enable row level security;
revoke all on public.text_override_history from anon, authenticated;
grant select on public.text_override_history to authenticated;
drop policy if exists "admins read history" on public.text_override_history;
create policy "admins read history" on public.text_override_history
  for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- 기록은 트리거만 쓴다(관리자도 직접 고치거나 지울 수 없다)
create or replace function public.log_text_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  who_name text := (select a.name from public.admins a where a.user_id = auth.uid());
begin
  if tg_op = 'DELETE' then
    insert into public.text_override_history (key, old_value, new_value, changed_by, changed_by_name)
    values (old.key, old.value, null, who, who_name);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.value is not distinct from old.value then
    return new;
  end if;
  insert into public.text_override_history (key, old_value, new_value, changed_by, changed_by_name)
  values (new.key, case when tg_op = 'UPDATE' then old.value end, new.value, who, who_name);
  return new;
end;
$$;
drop trigger if exists text_overrides_history on public.text_overrides;
create trigger text_overrides_history
  after insert or update or delete on public.text_overrides
  for each row execute function public.log_text_override();
