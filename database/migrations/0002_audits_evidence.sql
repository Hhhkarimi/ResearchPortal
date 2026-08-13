create table research_portal.audit_runs(
  audit_run_id bigint generated always as identity primary key,
  snapshot_id bigint not null references research_portal.snapshots(snapshot_id),
  methodology_code text not null references research_portal.methodology_versions(methodology_code),
  kind text not null check(kind in('portal','deep','review')),
  source_effective_date date not null,
  crawler_version text,
  source_manifest_sha256 bytea not null,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(snapshot_id,kind,methodology_code),
  unique(audit_run_id,snapshot_id)
);

create table research_portal.university_audits(
  audit_id bigint generated always as identity primary key,
  audit_run_id bigint not null,
  snapshot_id bigint not null,
  university_id bigint not null,
  portal_status text references research_portal.portal_statuses(status_code),
  deep_status text references research_portal.deep_audit_statuses(status_code),
  research_url text,
  score_eligible boolean not null default false,
  ranking_eligible boolean not null default false,
  evidence_coverage numeric(5,2) check(evidence_coverage between 0 and 100),
  units_found integer check(units_found>=0),
  systems_found integer check(systems_found>=0),
  documents_found integer check(documents_found>=0),
  interpretation text,
  note text,
  crawler_metadata jsonb not null default '{}'::jsonb,
  foreign key(audit_run_id,snapshot_id) references research_portal.audit_runs(audit_run_id,snapshot_id),
  foreign key(snapshot_id,university_id) references research_portal.university_snapshots(snapshot_id,university_id),
  unique(audit_run_id,university_id),
  unique(audit_id,snapshot_id,university_id),
  unique(audit_id,snapshot_id)
);

create table research_portal.audit_dimension_results(
  dimension_result_id bigint generated always as identity primary key,
  audit_id bigint not null,
  snapshot_id bigint not null,
  university_id bigint not null,
  dimension_id smallint not null references research_portal.audit_dimensions(dimension_id),
  reported_status text not null references research_portal.dimension_statuses(status_code),
  published_status text not null references research_portal.dimension_statuses(status_code),
  review_outcome text not null,
  reviewed_at timestamptz not null,
  publication_adjustment text,
  verification_basis text not null,
  missing_data_rule text not null,
  foreign key(audit_id,snapshot_id,university_id)
    references research_portal.university_audits(audit_id,snapshot_id,university_id),
  unique(audit_id,dimension_id),
  unique(dimension_result_id,snapshot_id)
);

create table research_portal.evidence_sources(
  source_id bigint generated always as identity primary key,
  canonical_url text not null check(octet_length(canonical_url) between 1 and 16384),
  url_sha256 bytea not null unique,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  check(last_seen_at>=first_seen_at)
);

create table research_portal.evidence_records(
  evidence_id bigint generated always as identity primary key,
  snapshot_id bigint not null,
  university_id bigint not null,
  source_id bigint not null references research_portal.evidence_sources(source_id),
  external_id text not null,
  entity_type text not null,
  claim text not null,
  evidence_level text not null references research_portal.evidence_levels(level_code),
  last_verified_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  foreign key(snapshot_id,university_id)
    references research_portal.university_snapshots(snapshot_id,university_id),
  unique(snapshot_id,university_id,external_id),
  unique(evidence_id,snapshot_id)
);

create table research_portal.dimension_result_evidence(
  dimension_result_id bigint not null,
  evidence_id bigint not null,
  snapshot_id bigint not null,
  source_kind text not null,
  claim_override text,
  ordinal integer not null check(ordinal>=0),
  foreign key(dimension_result_id,snapshot_id)
    references research_portal.audit_dimension_results(dimension_result_id,snapshot_id),
  foreign key(evidence_id,snapshot_id)
    references research_portal.evidence_records(evidence_id,snapshot_id),
  primary key(dimension_result_id,evidence_id)
);

create table research_portal.audit_evidence(
  audit_id bigint not null,
  evidence_id bigint not null,
  snapshot_id bigint not null,
  purpose text not null,
  ordinal integer not null check(ordinal>=0),
  foreign key(audit_id,snapshot_id) references research_portal.university_audits(audit_id,snapshot_id),
  foreign key(evidence_id,snapshot_id) references research_portal.evidence_records(evidence_id,snapshot_id),
  primary key(audit_id,evidence_id)
);
