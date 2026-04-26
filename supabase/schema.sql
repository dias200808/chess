create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null,
  city text default 'Unknown',
  avatar text,
  rating integer not null default 1200,
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
  mode text not null check (mode in ('local', 'bot', 'friend')),
  result text not null default '*',
  winner text,
  opponent text default 'Opponent',
  moves jsonb not null default '[]'::jsonb,
  pgn text not null default '',
  final_position text not null,
  white_accuracy integer,
  black_accuracy integer,
  analysis jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  white_user_id uuid references public.profiles(id),
  black_user_id uuid references public.profiles(id),
  current_position text not null default 'start',
  moves jsonb not null default '[]'::jsonb,
  status text not null default 'waiting',
  result text,
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

alter table public.games add column if not exists opponent text default 'Opponent';
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

create policy "Users can manage own puzzle progress"
  on public.puzzle_progress for all using (auth.uid() = user_id);

create policy "Users can read own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

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
  insert into public.profiles (id, email, username, avatar)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), 2))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
