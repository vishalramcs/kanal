-- ADAPT schema for Supabase (PostgreSQL + pgvector). Safe to run more than once.
-- Every user-owned table: user_id -> auth.users, Row Level Security, and an institutional-domain check.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Configuration. The allowed email domain is written here by scripts/db-migrate.mjs
-- from ALLOWED_EMAIL_DOMAIN, so the app and the database share one setting.
-- No policies: not readable through the API; only the security-definer function below reads it.
-- ---------------------------------------------------------------------------
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;

-- True only for a signed-in user whose email is on the allowed domain (case-insensitive).
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.uid() is not null
    and lower(auth.jwt() ->> 'email') like '%_@_%'
    and lower(split_part(auth.jwt() ->> 'email', '@', 2)) = (select lower(value) from public.app_config where key = 'allowed_email_domain')
    and array_length(string_to_array(auth.jwt() ->> 'email', '@'), 1) = 2,
    false
  );
$$;
revoke all on function public.is_allowed_user() from public, anon;
grant execute on function public.is_allowed_user() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subjects keep the planner's own string ids ("dm", "s-…"); topics stay nested as JSON, as the planner uses them.
create table if not exists public.subjects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  name text not null check (char_length(name) between 1 and 100),
  color text not null default '#ffd12b',
  exam_date date not null,
  difficulty int not null check (difficulty between 1 and 5),
  topics jsonb not null default '[]'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Everything else the planner stores (profile, plan, history, session, crunch, strategy).
create table if not exists public.planner_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  filename text not null,
  file_type text not null,
  mime_type text,
  file_size int not null,
  storage_path text not null,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error text,
  location_kind text,
  location_count int,
  chunk_count int not null default 0,
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, subject_id) references public.subjects (user_id, id) on delete cascade,
  unique (user_id, subject_id, id)
);
create index if not exists materials_owner_idx on public.materials (user_id, subject_id, created_at desc);

-- Chunk -> material -> subject -> user: the composite key makes cross-user / cross-subject rows impossible.
create table if not exists public.material_chunks (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  subject_id text not null,
  material_id uuid not null,
  chunk_index int not null,
  content text not null,
  page int,
  slide int,
  section text,
  embedding extensions.vector not null,
  embedding_model text not null,
  foreign key (user_id, subject_id, material_id) references public.materials (user_id, subject_id, id) on delete cascade
);
create index if not exists material_chunks_filter_idx on public.material_chunks (user_id, subject_id, material_id, embedding_model);

create table if not exists public.notebook_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, subject_id) references public.subjects (user_id, id) on delete cascade,
  unique (user_id, subject_id, id)
);
create index if not exists notebook_conversations_owner_idx on public.notebook_conversations (user_id, subject_id, updated_at desc);

create table if not exists public.notebook_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  subject_id text not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  mode text,
  relevant boolean,
  created_at timestamptz not null default now(),
  foreign key (user_id, subject_id, conversation_id) references public.notebook_conversations (user_id, subject_id, id) on delete cascade
);
create index if not exists notebook_messages_conversation_idx on public.notebook_messages (conversation_id, id);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner + allowed domain, for every user-owned table.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'subjects', 'planner_state', 'materials', 'material_chunks', 'notebook_conversations', 'notebook_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner access" on public.%I', t);
    execute format(
      'create policy "owner access" on public.%I for all to authenticated using (user_id = auth.uid() and public.is_allowed_user()) with check (user_id = auth.uid() and public.is_allowed_user())',
      t
    );
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Subject-scoped vector search. SECURITY INVOKER: RLS still applies on top of the explicit filters.
-- ---------------------------------------------------------------------------
create or replace function public.match_material_chunks(
  p_subject_id text,
  p_material_ids uuid[],
  p_embedding extensions.vector,
  p_model text,
  p_count int default 6
)
returns table (
  chunk_id bigint,
  material_id uuid,
  filename text,
  file_type text,
  chunk_index int,
  content text,
  page int,
  slide int,
  section text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select c.id, c.material_id, m.filename, m.file_type, c.chunk_index, c.content, c.page, c.slide, c.section,
         1 - (c.embedding <=> p_embedding) as similarity
  from public.material_chunks c
  join public.materials m on m.id = c.material_id and m.user_id = c.user_id and m.subject_id = c.subject_id
  where c.user_id = auth.uid()
    and c.subject_id = p_subject_id
    and c.embedding_model = p_model
    and m.status = 'ready'
    and (p_material_ids is null or cardinality(p_material_ids) = 0 or c.material_id = any (p_material_ids))
  order by c.embedding <=> p_embedding
  limit least(greatest(p_count, 1), 20);
$$;
revoke all on function public.match_material_chunks(text, uuid[], extensions.vector, text, int) from public, anon;
grant execute on function public.match_material_chunks(text, uuid[], extensions.vector, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, one folder per user: <user_id>/<subject_id>/<material_id>/<filename>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "materials: owner read" on storage.objects;
drop policy if exists "materials: owner insert" on storage.objects;
drop policy if exists "materials: owner update" on storage.objects;
drop policy if exists "materials: owner delete" on storage.objects;

create policy "materials: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text and public.is_allowed_user());
create policy "materials: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text and public.is_allowed_user());
create policy "materials: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text and public.is_allowed_user());
create policy "materials: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text and public.is_allowed_user());
