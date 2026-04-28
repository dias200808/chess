create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  full_name text,
  role text not null default 'student',
  school_name text,
  age integer,
  teacher_verification text not null default 'unverified',
  city text default 'Unknown',
  country text default 'Unknown',
  avatar text,
  rating integer not null default 1200,
  bullet_rating integer not null default 1200,
  blitz_rating integer not null default 1200,
  rapid_rating integer not null default 1200,
  classical_rating integer not null default 1200,
  puzzle_rating integer not null default 1200,
  games_count integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  white_user_id uuid references public.profiles(id),
  black_user_id uuid references public.profiles(id),
  white_guest_key text,
  black_guest_key text,
  white_player text not null default 'White',
  black_player text not null default 'Black',
  mode text not null check (mode in ('local', 'bot', 'friend', 'online')),
  match_type text,
  result text not null default '*',
  winner text,
  end_reason text default 'Unknown',
  opponent text default 'Opponent',
  moves jsonb not null default '[]'::jsonb,
  pgn text not null default '',
  final_position text not null,
  time_control text,
  game_type text default 'casual',
  rated boolean not null default false,
  rating_type text,
  rating_before integer,
  rating_after integer,
  rating_change integer,
  white_rating_before integer,
  white_rating_after integer,
  white_rating_change integer,
  black_rating_before integer,
  black_rating_after integer,
  black_rating_change integer,
  white_accuracy integer,
  black_accuracy integer,
  analysis jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  white_user_id uuid references public.profiles(id),
  black_user_id uuid references public.profiles(id),
  white_player text not null default 'White',
  black_player text not null default 'Black',
  white_player_type text not null default 'guest',
  black_player_type text not null default 'guest',
  white_rating integer,
  black_rating integer,
  current_position text not null default 'start',
  moves jsonb not null default '[]'::jsonb,
  status text not null default 'waiting',
  result text,
  game_type text not null default 'casual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.puzzle_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_id text not null,
  solved boolean not null default false,
  attempts integer not null default 0,
  score integer not null default 0,
  best_rush_score integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  puzzle_rating integer not null default 800,
  best_puzzle_rating integer not null default 800,
  last_solved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, puzzle_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  code text not null unique,
  description text not null default '',
  level text not null default 'mixed',
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_memberships (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.classroom_join_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.classroom_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  lesson_id text,
  title text not null,
  description text not null default '',
  type text not null,
  due_date timestamptz,
  target_count integer,
  theme text,
  opening text,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open',
  completion_percent integer not null default 0,
  completed_count integer not null default 0,
  accuracy integer,
  notes text,
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.teacher_comments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  move_number integer,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  related_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  details text,
  related_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null,
  started boolean not null default false,
  completed boolean not null default false,
  attempts integer not null default 0,
  quiz_passed boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  time_spent_ms integer not null default 0,
  unique (user_id, lesson_id)
);

alter table public.games add column if not exists opponent text default 'Opponent';
alter table public.games add column if not exists white_player text not null default 'White';
alter table public.games add column if not exists black_player text not null default 'Black';
alter table public.games add column if not exists white_guest_key text;
alter table public.games add column if not exists black_guest_key text;
alter table public.games add column if not exists match_type text;
alter table public.games add column if not exists end_reason text default 'Unknown';
alter table public.games add column if not exists time_control text;
alter table public.games add column if not exists game_type text default 'casual';
alter table public.games add column if not exists rated boolean not null default false;
alter table public.games add column if not exists rating_type text;
alter table public.games add column if not exists rating_before integer;
alter table public.games add column if not exists rating_after integer;
alter table public.games add column if not exists rating_change integer;
alter table public.games add column if not exists white_rating_before integer;
alter table public.games add column if not exists white_rating_after integer;
alter table public.games add column if not exists white_rating_change integer;
alter table public.games add column if not exists black_rating_before integer;
alter table public.games add column if not exists black_rating_after integer;
alter table public.games add column if not exists black_rating_change integer;
alter table public.rooms add column if not exists white_player text not null default 'White';
alter table public.rooms add column if not exists black_player text not null default 'Black';
alter table public.rooms add column if not exists white_player_type text not null default 'guest';
alter table public.rooms add column if not exists black_player_type text not null default 'guest';
alter table public.rooms add column if not exists white_rating integer;
alter table public.rooms add column if not exists black_rating integer;
alter table public.rooms add column if not exists time_control text default '10-0';
alter table public.rooms add column if not exists match_type text not null default 'invite';
alter table public.rooms add column if not exists game_type text not null default 'casual';
alter table public.rooms add column if not exists host_key text;
alter table public.rooms add column if not exists guest_key text;
alter table public.rooms add column if not exists host_rating integer;
alter table public.rooms add column if not exists guest_rating integer;
alter table public.rooms add column if not exists white_time_ms integer;
alter table public.rooms add column if not exists black_time_ms integer;
alter table public.rooms add column if not exists increment_seconds integer not null default 0;
alter table public.rooms add column if not exists ready_at timestamptz;
alter table public.rooms add column if not exists last_move_at timestamptz;
alter table public.rooms add column if not exists connect_deadline_at timestamptz;
alter table public.rooms add column if not exists first_move_deadline_at timestamptz;
alter table public.rooms add column if not exists white_connected_at timestamptz;
alter table public.rooms add column if not exists black_connected_at timestamptz;
alter table public.rooms add column if not exists draw_offered_by text;
alter table public.rooms add column if not exists draw_offer_ply integer;
alter table public.rooms add column if not exists white_draw_blocked_until_ply integer;
alter table public.rooms add column if not exists black_draw_blocked_until_ply integer;
alter table public.rooms add column if not exists rematch_requested_by text;
alter table public.rooms add column if not exists rematch_room_id uuid references public.rooms(id);
alter table public.rooms add column if not exists end_reason text;
alter table public.rooms add column if not exists rated boolean not null default false;
alter table public.profiles add column if not exists country text default 'Unknown';
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists school_name text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists teacher_verification text not null default 'unverified';
alter table public.profiles add column if not exists bullet_rating integer not null default 1200;
alter table public.profiles add column if not exists blitz_rating integer not null default 1200;
alter table public.profiles add column if not exists rapid_rating integer not null default 1200;
alter table public.profiles add column if not exists classical_rating integer not null default 1200;
alter table public.profiles add column if not exists puzzle_rating integer not null default 1200;
alter table public.assignments add column if not exists student_id uuid references public.profiles(id) on delete cascade;
alter table public.assignments add column if not exists lesson_id text;
alter table public.assignments add column if not exists theme text;
alter table public.assignments add column if not exists opening text;
alter table public.puzzle_progress add column if not exists score integer not null default 0;
alter table public.puzzle_progress add column if not exists best_rush_score integer not null default 0;
alter table public.puzzle_progress add column if not exists current_streak integer not null default 0;
alter table public.puzzle_progress add column if not exists best_streak integer not null default 0;
alter table public.puzzle_progress add column if not exists puzzle_rating integer not null default 800;
alter table public.puzzle_progress add column if not exists best_puzzle_rating integer not null default 800;
alter table public.puzzle_progress add column if not exists last_solved_at timestamptz;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.rooms enable row level security;
alter table public.puzzle_progress enable row level security;
alter table public.subscriptions enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_memberships enable row level security;
alter table public.classroom_join_requests enable row level security;
alter table public.classroom_invitations enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_progress enable row level security;
alter table public.teacher_comments enable row level security;
alter table public.classroom_notifications enable row level security;
alter table public.student_activities enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "Users can read public profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can read their games" on public.games;
drop policy if exists "Users can insert their games" on public.games;
drop policy if exists "Users can update their games" on public.games;
drop policy if exists "Room players can read rooms" on public.rooms;
drop policy if exists "Room owner can create rooms" on public.rooms;
drop policy if exists "Room players can update rooms" on public.rooms;
drop policy if exists "Anyone can read rooms" on public.rooms;
drop policy if exists "Anyone can create guest rooms" on public.rooms;
drop policy if exists "Anyone can update guest rooms" on public.rooms;
drop policy if exists "Users can manage own puzzle progress" on public.puzzle_progress;
drop policy if exists "Users can read own subscription" on public.subscriptions;
drop policy if exists "Teachers and students can read classrooms" on public.classrooms;
drop policy if exists "Teachers can create classrooms" on public.classrooms;
drop policy if exists "Teachers can update classrooms" on public.classrooms;
drop policy if exists "Teachers and students can read memberships" on public.classroom_memberships;
drop policy if exists "Teachers can manage memberships" on public.classroom_memberships;
drop policy if exists "Teachers and students can read join requests" on public.classroom_join_requests;
drop policy if exists "Students can create join requests" on public.classroom_join_requests;
drop policy if exists "Teachers can update join requests" on public.classroom_join_requests;
drop policy if exists "Teachers and students can read invitations" on public.classroom_invitations;
drop policy if exists "Teachers can create invitations" on public.classroom_invitations;
drop policy if exists "Students can update invitations" on public.classroom_invitations;
drop policy if exists "Teachers and students can read assignments" on public.assignments;
drop policy if exists "Teachers can create assignments" on public.assignments;
drop policy if exists "Teachers can update assignments" on public.assignments;
drop policy if exists "Teachers and students can read assignment progress" on public.assignment_progress;
drop policy if exists "Teachers can create assignment progress" on public.assignment_progress;
drop policy if exists "Students can update own assignment progress" on public.assignment_progress;
drop policy if exists "Teachers and students can read teacher comments" on public.teacher_comments;
drop policy if exists "Teachers can create comments" on public.teacher_comments;
drop policy if exists "Users can read own classroom notifications" on public.classroom_notifications;
drop policy if exists "Users can update own classroom notifications" on public.classroom_notifications;
drop policy if exists "System can insert classroom notifications" on public.classroom_notifications;
drop policy if exists "Teachers can read student activities" on public.student_activities;
drop policy if exists "Users can create own activities" on public.student_activities;
drop policy if exists "Teachers can read lesson progress" on public.lesson_progress;
drop policy if exists "Users can manage own lesson progress" on public.lesson_progress;

create policy "Users can read public profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can read their games"
  on public.games for select
  using (auth.uid() = white_user_id or auth.uid() = black_user_id);

create policy "Users can insert their games"
  on public.games for insert
  with check (auth.uid() = white_user_id or auth.uid() = black_user_id);

create policy "Users can update their games"
  on public.games for update
  using (auth.uid() = white_user_id or auth.uid() = black_user_id);

create policy "Room players can read rooms"
  on public.rooms for select
  using (auth.uid() = white_user_id or auth.uid() = black_user_id or black_user_id is null);

create policy "Room owner can create rooms"
  on public.rooms for insert with check (auth.uid() = white_user_id);

create policy "Room players can update rooms"
  on public.rooms for update
  using (auth.uid() = white_user_id or auth.uid() = black_user_id);

drop policy if exists "Anyone can read rooms" on public.rooms;
create policy "Anyone can read rooms"
  on public.rooms for select using (true);

drop policy if exists "Anyone can create guest rooms" on public.rooms;
create policy "Anyone can create guest rooms"
  on public.rooms for insert
  with check (white_user_id is null and black_user_id is null);

drop policy if exists "Anyone can update guest rooms" on public.rooms;
create policy "Anyone can update guest rooms"
  on public.rooms for update
  using (white_user_id is null and black_user_id is null)
  with check (white_user_id is null and black_user_id is null);

create or replace function public.prevent_unsafe_room_client_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.moves is distinct from old.moves
    or new.current_position is distinct from old.current_position
    or new.result is distinct from old.result
    or new.end_reason is distinct from old.end_reason
    or new.white_time_ms is distinct from old.white_time_ms
    or new.black_time_ms is distinct from old.black_time_ms
    or new.draw_offered_by is distinct from old.draw_offered_by
    or new.draw_offer_ply is distinct from old.draw_offer_ply
    or new.ready_at is distinct from old.ready_at
    or new.connect_deadline_at is distinct from old.connect_deadline_at
    or new.first_move_deadline_at is distinct from old.first_move_deadline_at
    or new.white_draw_blocked_until_ply is distinct from old.white_draw_blocked_until_ply
    or new.black_draw_blocked_until_ply is distinct from old.black_draw_blocked_until_ply then
    raise exception 'Room gameplay updates must go through the server API';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_unsafe_room_client_update on public.rooms;
create trigger prevent_unsafe_room_client_update
  before update on public.rooms
  for each row execute function public.prevent_unsafe_room_client_update();

create policy "Users can manage own puzzle progress"
  on public.puzzle_progress for all using (auth.uid() = user_id);

create policy "Users can read own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

create policy "Teachers and students can read classrooms"
  on public.classrooms for select using (true);

create policy "Teachers can create classrooms"
  on public.classrooms for insert with check (auth.uid() = teacher_id);

create policy "Teachers can update classrooms"
  on public.classrooms for update using (auth.uid() = teacher_id);

create policy "Teachers and students can read memberships"
  on public.classroom_memberships for select using (auth.uid() = teacher_id or auth.uid() = student_id);

create policy "Teachers can manage memberships"
  on public.classroom_memberships for all using (auth.uid() = teacher_id);

create policy "Teachers and students can read join requests"
  on public.classroom_join_requests for select using (auth.uid() = teacher_id or auth.uid() = student_id);

create policy "Students can create join requests"
  on public.classroom_join_requests for insert with check (auth.uid() = student_id);

create policy "Teachers can update join requests"
  on public.classroom_join_requests for update using (auth.uid() = teacher_id);

create policy "Teachers and students can read invitations"
  on public.classroom_invitations for select using (auth.uid() = teacher_id or auth.uid() = student_id);

create policy "Teachers can create invitations"
  on public.classroom_invitations for insert with check (auth.uid() = teacher_id);

create policy "Students can update invitations"
  on public.classroom_invitations for update using (auth.uid() = student_id);

create policy "Teachers and students can read assignments"
  on public.assignments for select using (true);

create policy "Teachers can create assignments"
  on public.assignments for insert with check (auth.uid() = teacher_id);

create policy "Teachers can update assignments"
  on public.assignments for update using (auth.uid() = teacher_id);

create policy "Teachers and students can read assignment progress"
  on public.assignment_progress for select using (auth.uid() = student_id or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid()));

create policy "Teachers can create assignment progress"
  on public.assignment_progress for insert with check (exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid()));

create policy "Students can update own assignment progress"
  on public.assignment_progress for update using (auth.uid() = student_id);

create policy "Teachers and students can read teacher comments"
  on public.teacher_comments for select using (auth.uid() = teacher_id or auth.uid() = student_id);

create policy "Teachers can create comments"
  on public.teacher_comments for insert with check (auth.uid() = teacher_id);

create policy "Users can read own classroom notifications"
  on public.classroom_notifications for select using (auth.uid() = user_id);

create policy "Users can update own classroom notifications"
  on public.classroom_notifications for update using (auth.uid() = user_id);

create policy "System can insert classroom notifications"
  on public.classroom_notifications for insert with check (auth.uid() = user_id);

create policy "Teachers can read student activities"
  on public.student_activities for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.classroom_memberships m
      where m.student_id = user_id
        and m.teacher_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "Users can create own activities"
  on public.student_activities for insert with check (auth.uid() = user_id);

create policy "Teachers can read lesson progress"
  on public.lesson_progress for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.classroom_memberships m
      where m.student_id = user_id
        and m.teacher_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "Users can manage own lesson progress"
  on public.lesson_progress for all using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    username,
    full_name,
    role,
    school_name,
    age,
    teacher_verification,
    city,
    country,
    avatar,
    rating,
    bullet_rating,
    blitz_rating,
    rapid_rating,
    classical_rating,
    puzzle_rating
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'student'),
    new.raw_user_meta_data ->> 'school_name',
    nullif(new.raw_user_meta_data ->> 'age', '')::integer,
    case when coalesce(new.raw_user_meta_data ->> 'role', 'student') = 'teacher' then 'pending' else 'unverified' end,
    coalesce(new.raw_user_meta_data ->> 'city', 'Unknown'),
    coalesce(new.raw_user_meta_data ->> 'country', 'Unknown'),
    upper(left(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), 2)),
    1200,
    1200,
    1200,
    1200,
    1200,
    1200
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
