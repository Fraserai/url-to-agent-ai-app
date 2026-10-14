create table ingestion_jobs (
  id uuid primary key,
  user_id uuid not null,
  submitted_url text not null,
  normalized_url text,
  canonical_key text,
  status text not null,
  progress_percent int not null default 0,
  current_step text,
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table crawled_pages (
  id uuid primary key,
  ingestion_job_id uuid not null references ingestion_jobs(id),
  url text not null,
  final_url text,
  status_code int,
  fetch_mode text not null,
  was_rendered boolean not null default false,
  title text,
  meta_description text,
  raw_html_path text,
  text_content text,
  extracted_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table business_profiles (
  id uuid primary key,
  user_id uuid not null,
  ingestion_job_id uuid not null references ingestion_jobs(id),
  canonical_key text not null,
  business_context jsonb not null,
  agent_recommendation jsonb not null,
  deployment_package jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
