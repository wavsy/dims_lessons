-- Live studio schema. Create the Supabase project in an EU region.
-- Do not import data/lessons.db. The studio starts empty.
-- The teacher profile is created on first sign-in when the email matches TEACHER_EMAIL.
-- Student PIN sessions stay on the server. They never receive a database role
-- that can read payments or feedback.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'parent')),
  name text not null,
  email text not null unique,
  phone text not null default '',
  social text not null default '',
  occupation text not null default '',
  currency text not null default 'EUR',
  locale text not null default 'en',
  public_code text,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  kind text not null default 'student' check (kind in ('student', 'parent')),
  subject_default text not null default 'math',
  platform_default text not null default 'paper',
  location_default text not null default 'in_person',
  price_cents integer not null default 0,
  billing_mode text not null default 'per_lesson' check (billing_mode in ('per_lesson', 'per_hour', 'prepaid')),
  school text not null default '',
  grade text not null default '',
  interests text not null default '',
  ambitions text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  public_code text,
  portrait text not null default 'girl' check (portrait in ('girl', 'boy')),
  pays_self boolean not null default false,
  created_at timestamptz not null default now()
);

create table client_parents (
  client_id uuid not null references clients (id) on delete cascade,
  parent_id uuid not null references profiles (id) on delete cascade,
  primary key (client_id, parent_id)
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  occurred_on date not null,
  subject text not null,
  platform text not null,
  location text not null,
  materials text not null default '',
  homework text not null default '',
  duration_hours double precision not null default 1,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  paid_on date not null,
  amount_cents integer not null,
  lessons_added integer not null default 0,
  hours_added double precision not null default 0,
  created_at timestamptz not null default now()
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  parent_email text not null,
  parent_phone text not null default '',
  parent_social text not null default '',
  parent_occupation text not null default '',
  child_name text not null,
  school text not null default '',
  grade text not null default '',
  interests text not null default '',
  ambitions text not null default '',
  subject text not null default 'math',
  portrait text not null default 'girl' check (portrait in ('girl', 'boy')),
  pays_self boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create table feedback_notes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles (id) on delete cascade,
  client_id uuid references clients (id) on delete cascade,
  lesson_id uuid references lessons (id) on delete set null,
  body text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table feedback_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles (id) on delete cascade,
  client_id uuid references clients (id) on delete cascade,
  teacher_id uuid not null references profiles (id) on delete cascade,
  open_question text not null,
  status text not null default 'open' check (status in ('open', 'answered')),
  pace integer,
  following_score integer,
  homework_score integer,
  overall integer,
  open_answer text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table parent_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  name text not null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create table student_pins (
  client_id uuid primary key references clients (id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null
);

create table student_sessions (
  id text primary key,
  client_id uuid not null references clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index profiles_public_code on profiles (public_code) where public_code is not null and public_code <> '';
create unique index clients_public_code on clients (public_code) where public_code is not null and public_code <> '';
create index lessons_client on lessons (client_id, occurred_on desc);
create index payments_client on payments (client_id, paid_on desc);
create index client_parents_parent on client_parents (parent_id);
create unique index parent_requests_pending on parent_requests (client_id, lower(email)) where status = 'pending';

create or replace function prevent_profile_tamper()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role is fixed';
  end if;
  if new.id is distinct from old.id then
    raise exception 'id is fixed';
  end if;
  if old.public_code is not null and new.public_code is distinct from old.public_code then
    raise exception 'code is fixed';
  end if;
  return new;
end;
$$;

create trigger profiles_no_tamper
  before update on profiles
  for each row execute function prevent_profile_tamper();

create or replace function is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

create or replace function is_parent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'parent'
  );
$$;

create or replace function is_parent_of(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from client_parents
    where client_id = target and parent_id = auth.uid()
  );
$$;

create or replace function email_is_taken(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where lower(email) = lower(target))
    or exists (
      select 1 from registrations
      where lower(parent_email) = lower(target) and status = 'pending'
    )
    or exists (
      select 1 from parent_requests
      where lower(email) = lower(target) and status = 'pending'
    );
$$;

create or replace function submit_registration(
  p_code text,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_parent_social text,
  p_parent_occupation text,
  p_child_name text,
  p_school text,
  p_grade text,
  p_interests text,
  p_ambitions text,
  p_subject text,
  p_portrait text,
  p_pays_self boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  clean_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
begin
  if not exists (select 1 from profiles where role = 'teacher' and public_code = clean_code) then
    raise exception 'unknown_code';
  end if;
  if coalesce(p_parent_name, '') = '' or coalesce(p_child_name, '') = '' or coalesce(p_parent_email, '') = '' then
    raise exception 'invalid';
  end if;
  if p_subject not in ('math', 'english', 'informatics', 'conditioning') then
    raise exception 'invalid';
  end if;
  if email_is_taken(p_parent_email) then
    raise exception 'email_taken';
  end if;
  insert into registrations (
    parent_name, parent_email, parent_phone, parent_social, parent_occupation,
    child_name, school, grade, interests, ambitions, subject, portrait, pays_self, status
  ) values (
    p_parent_name, lower(p_parent_email), coalesce(p_parent_phone, ''), coalesce(p_parent_social, ''),
    coalesce(p_parent_occupation, ''), p_child_name, coalesce(p_school, ''), coalesce(p_grade, ''),
    coalesce(p_interests, ''), coalesce(p_ambitions, ''), p_subject,
    case when p_portrait = 'boy' then 'boy' else 'girl' end,
    coalesce(p_pays_self, false), 'pending'
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function request_parent_link(p_code text, p_name text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  clean_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
begin
  if coalesce(p_name, '') = '' or coalesce(p_email, '') = '' then
    raise exception 'invalid';
  end if;
  select id into cid from clients where public_code = clean_code and status = 'active';
  if cid is null then
    raise exception 'unknown_code';
  end if;
  if email_is_taken(p_email) then
    raise exception 'email_taken';
  end if;
  insert into parent_requests (client_id, name, email)
  values (cid, p_name, lower(p_email));
end;
$$;

alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_parents enable row level security;
alter table lessons enable row level security;
alter table payments enable row level security;
alter table registrations enable row level security;
alter table feedback_notes enable row level security;
alter table feedback_requests enable row level security;
alter table parent_requests enable row level security;
alter table student_pins enable row level security;
alter table student_sessions enable row level security;

revoke all on student_pins from anon, authenticated;
revoke all on student_sessions from anon, authenticated;

create policy "read own profile" on profiles
  for select using (id = auth.uid());

create policy "parent reads teacher" on profiles
  for select using (role = 'teacher' and is_parent());

create policy "teacher reads linked parents" on profiles
  for select using (
    is_teacher()
    and role = 'parent'
    and exists (
      select 1 from client_parents cp
      join clients c on c.id = cp.client_id
      where cp.parent_id = profiles.id and c.teacher_id = auth.uid()
    )
  );

create policy "update own profile" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "teacher manages clients" on clients
  for all using (is_teacher() and teacher_id = auth.uid())
  with check (is_teacher() and teacher_id = auth.uid());

create policy "parent reads own children" on clients
  for select using (is_parent_of(id));

create policy "teacher manages links" on client_parents
  for all using (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  );

create policy "parent reads own links" on client_parents
  for select using (parent_id = auth.uid());

create policy "teacher manages lessons" on lessons
  for all using (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  );

create policy "parent reads lessons" on lessons
  for select using (is_parent_of(client_id));

create policy "teacher manages payments" on payments
  for all using (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  );

create policy "parent reads payments" on payments
  for select using (is_parent_of(client_id));

create policy "teacher reads registrations" on registrations
  for select using (is_teacher());

create policy "teacher updates registrations" on registrations
  for update using (is_teacher())
  with check (is_teacher());

create policy "parent writes notes" on feedback_notes
  for insert with check (
    parent_id = auth.uid()
    and (client_id is null or is_parent_of(client_id))
  );

create policy "parent reads own notes" on feedback_notes
  for select using (parent_id = auth.uid());

create policy "teacher reads notes" on feedback_notes
  for select using (
    is_teacher() and (
      exists (select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid())
      or (
        client_id is null and exists (
          select 1 from client_parents cp
          join clients c on c.id = cp.client_id
          where cp.parent_id = feedback_notes.parent_id and c.teacher_id = auth.uid()
        )
      )
    )
  );

create policy "teacher archives notes" on feedback_notes
  for update using (
    is_teacher() and (
      exists (select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid())
      or (
        client_id is null and exists (
          select 1 from client_parents cp
          join clients c on c.id = cp.client_id
          where cp.parent_id = feedback_notes.parent_id and c.teacher_id = auth.uid()
        )
      )
    )
  );

create policy "teacher manages requests" on feedback_requests
  for all using (is_teacher() and teacher_id = auth.uid())
  with check (is_teacher() and teacher_id = auth.uid());

create policy "parent reads own requests" on feedback_requests
  for select using (parent_id = auth.uid());

create policy "parent answers own requests" on feedback_requests
  for update using (parent_id = auth.uid() and status = 'open')
  with check (parent_id = auth.uid());

create policy "teacher reads parent requests" on parent_requests
  for select using (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  );

create policy "teacher updates parent requests" on parent_requests
  for update using (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    is_teacher() and exists (
      select 1 from clients c where c.id = client_id and c.teacher_id = auth.uid()
    )
  );

revoke all on function public.is_teacher() from public;
revoke all on function public.is_parent() from public;
revoke all on function public.is_parent_of(uuid) from public;
revoke all on function public.email_is_taken(text) from public;
revoke all on function public.submit_registration(text, text, text, text, text, text, text, text, text, text, text, text, text, boolean) from public;
revoke all on function public.request_parent_link(text, text, text) from public;

grant execute on function public.is_teacher() to authenticated, service_role;
grant execute on function public.is_parent() to authenticated, service_role;
grant execute on function public.is_parent_of(uuid) to authenticated, service_role;
grant execute on function public.email_is_taken(text) to service_role;
grant execute on function public.submit_registration(text, text, text, text, text, text, text, text, text, text, text, text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.request_parent_link(text, text, text) to anon, authenticated, service_role;

grant select, insert, update, delete on profiles, clients, client_parents, lessons, payments, registrations, feedback_notes, feedback_requests, parent_requests to anon, authenticated, service_role;
grant all on student_pins, student_sessions to service_role;
revoke all on student_pins, student_sessions from anon, authenticated;
