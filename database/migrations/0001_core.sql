create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create schema if not exists research_portal;

create table research_portal.methodology_versions(
  methodology_code text primary key,
  methodology_kind text not null check(methodology_kind in('audit','ranking','publication')),
  title text not null,
  missing_data_rule text not null,
  config jsonb not null default '{}'::jsonb,
  published_at timestamptz not null
);

create table research_portal.snapshots(
  snapshot_id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid() unique,
  release_key text not null unique,
  as_of_date date not null,
  state text not null default 'draft' check(state in('draft','published','superseded','failed')),
  supersedes_snapshot_id bigint references research_portal.snapshots(snapshot_id),
  source_manifest_sha256 bytea not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  is_current boolean not null default false,
  check(not is_current or state='published'),
  check(state in('draft','failed') or published_at is not null)
);

create unique index snapshots_one_current_idx
  on research_portal.snapshots((true)) where is_current;

create table research_portal.university_categories(
  category_id smallint generated always as identity primary key,
  code text not null unique,
  name_fa text not null unique
);

create table research_portal.universities(
  university_id bigint generated always as identity primary key,
  slug text not null unique check(slug~'^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  canonical_name_fa text not null check(btrim(canonical_name_fa)<>''),
  search_name_fa text not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create table research_portal.university_snapshots(
  snapshot_id bigint not null references research_portal.snapshots(snapshot_id),
  university_id bigint not null references research_portal.universities(university_id),
  category_id smallint not null references research_portal.university_categories(category_id),
  name_fa text not null check(btrim(name_fa)<>''),
  isc_rank integer not null check(isc_rank>0),
  official_website text not null,
  alternate_website text,
  parent_website text,
  website_scope text not null,
  website_verification text not null,
  needs_iran_runner_check boolean not null default false,
  note text,
  primary key(snapshot_id,university_id),
  unique(snapshot_id,university_id,category_id)
);

create table research_portal.audit_dimensions(
  dimension_id smallint generated always as identity primary key,
  code text not null unique,
  name_fa text not null,
  description text
);

create table research_portal.methodology_dimensions(
  methodology_code text not null references research_portal.methodology_versions(methodology_code),
  dimension_id smallint not null references research_portal.audit_dimensions(dimension_id),
  is_public boolean not null default true,
  sort_order smallint not null check(sort_order>0),
  primary key(methodology_code,dimension_id),
  unique(methodology_code,sort_order)
);

create table research_portal.dimension_statuses(
  status_code text primary key,
  sort_order smallint not null unique,
  is_resolved boolean not null
);

create table research_portal.portal_statuses(status_code text primary key);
create table research_portal.deep_audit_statuses(status_code text primary key);
create table research_portal.evidence_levels(level_code text primary key);

insert into research_portal.methodology_versions
  (methodology_code,methodology_kind,title,missing_data_rule,published_at)
values
  ('PORTAL-AUDIT-2026-08','audit','Portal identity audit','Unresolved is not absence and is never automatically scored as zero.','2026-08-12'),
  ('DEEP-AUDIT-2026-08','audit','Deep portal audit','Unresolved is not absence and is never automatically scored as zero.','2026-08-11'),
  ('PUBLIC-EVIDENCE-4.2','publication','Public seven-dimension evidence policy','Unresolved is not absence and is never automatically scored as zero.','2026-08-12'),
  ('RTPMI-4.1-ISC','ranking','RTPMI 4.1 ISC','Unresolved dimensions are excluded from the weighted denominator.','2026-08-11')
on conflict do nothing;

insert into research_portal.dimension_statuses(status_code,sort_order,is_resolved) values
  ('verified',1,true),('observed-reference',2,true),('unresolved',3,false),('restricted',4,false)
on conflict do nothing;

insert into research_portal.portal_statuses(status_code) values
  ('direct-official'),('official-channel-reference'),('secondary-reference'),
  ('false-positive-blocked'),('official-reference'),('restricted-public'),
  ('institutional-reference'),('legacy-restricted')
on conflict do nothing;

insert into research_portal.deep_audit_statuses(status_code) values
  ('deep-audited'),('identity-verified-deep-pending'),('reference-resolved-deep-pending'),
  ('portal-resolution-pending'),('blocked-needs-alternative-discovery'),('restricted-closed')
on conflict do nothing;

insert into research_portal.evidence_levels(level_code) values
  ('direct-official'),('official-reference'),('reference'),('observed-reference'),('secondary-reference'),
  ('restricted'),('unresolved'),('verified')
on conflict do nothing;

insert into research_portal.audit_dimensions(code,name_fa) values
  ('portalIdentity','هویت پرتال'),('organization','ساختار سازمانی'),
  ('libraryDocuments','کتابخانه و اسناد'),('laboratories','آزمایشگاه‌ها'),
  ('industryTechnology','صنعت و فناوری'),('informationTechnology','فناوری اطلاعات'),
  ('systemsServices','سامانه‌ها و خدمات'),('documentsRegulations','اسناد و مقررات')
on conflict do nothing;

insert into research_portal.methodology_dimensions(methodology_code,dimension_id,is_public,sort_order)
select 'PUBLIC-EVIDENCE-4.2',dimension_id,code<>'informationTechnology',
  case code when 'portalIdentity' then 1 when 'organization' then 2 when 'libraryDocuments' then 3
    when 'laboratories' then 4 when 'industryTechnology' then 5 when 'informationTechnology' then 6
    when 'systemsServices' then 7 else 8 end
from research_portal.audit_dimensions
on conflict do nothing;
