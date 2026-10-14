create extension if not exists "pgcrypto";

create table if not exists public.businesses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  domain text not null,
  business_name text not null,
  industry text,
  services text[] default '{}',
  source_urls text[] default '{}',
  knowledge_text text,
  scan_method text default 'html',
  scan_warnings text[] default '{}',
  assistant_instructions text default '',
  service_area text,
  phone text,
  email text,
  hours text,
  description text,
  key_info text,
  agent_type text default 'support',
  system_prompt text not null,
  accent_color text default '#1a6b4a',
  status text default 'draft',
  is_deployed boolean default false,
  platform text,
  plan text,
  billing_interval text,
  draft_token_hash text,
  draft_expires_at timestamptz,
  claimed_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.businesses add column if not exists source_urls text[] default '{}';
alter table public.businesses add column if not exists knowledge_text text;
alter table public.businesses add column if not exists scan_method text default 'html';
alter table public.businesses add column if not exists scan_warnings text[] default '{}';
alter table public.businesses add column if not exists assistant_instructions text default '';

create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  visitor_id text not null,
  messages jsonb default '[]'::jsonb,
  lead_captured boolean default false,
  lead_name text,
  lead_phone text,
  lead_email text,
  lead_details text,
  notification_sent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.businesses enable row level security;
alter table public.conversations enable row level security;

drop policy if exists "Businesses owned by user" on public.businesses;
create policy "Businesses owned by user"
on public.businesses
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Conversations for owned businesses" on public.conversations;
create policy "Conversations for owned businesses"
on public.conversations
for select
using (
  exists (
    select 1
    from public.businesses
    where public.businesses.id = public.conversations.business_id
      and public.businesses.user_id = auth.uid()
  )
);

create index if not exists businesses_user_id_idx on public.businesses(user_id);
create index if not exists businesses_status_idx on public.businesses(status);
create index if not exists businesses_stripe_subscription_id_idx
  on public.businesses(stripe_subscription_id);
create index if not exists conversations_business_id_idx on public.conversations(business_id);
create index if not exists conversations_business_visitor_idx
  on public.conversations(business_id, visitor_id);
