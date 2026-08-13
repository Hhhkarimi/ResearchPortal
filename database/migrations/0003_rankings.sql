create table research_portal.ranking_metrics(
  metric_id smallint generated always as identity primary key,
  code text not null unique,
  name_fa text not null
);

create table research_portal.methodology_metric_weights(
  methodology_code text not null references research_portal.methodology_versions(methodology_code),
  metric_id smallint not null references research_portal.ranking_metrics(metric_id),
  weight numeric(8,7) not null check(weight>0 and weight<=1),
  primary key(methodology_code,metric_id)
);

create table research_portal.ranking_runs(
  ranking_run_id bigint generated always as identity primary key,
  snapshot_id bigint not null references research_portal.snapshots(snapshot_id),
  methodology_code text not null references research_portal.methodology_versions(methodology_code),
  source_effective_date date not null,
  eligibility_rule jsonb not null,
  generated_at timestamptz not null,
  source_manifest_sha256 bytea not null,
  unique(snapshot_id,methodology_code),
  unique(ranking_run_id,snapshot_id)
);

create table research_portal.ranking_results(
  ranking_result_id bigint generated always as identity primary key,
  ranking_run_id bigint not null,
  snapshot_id bigint not null,
  university_id bigint not null,
  category_id smallint not null,
  score numeric(5,2) not null check(score between 0 and 100),
  confidence numeric(5,2) not null check(confidence between 0 and 100),
  evidence_coverage numeric(5,2) not null check(evidence_coverage between 0 and 100),
  active_weight numeric(5,2) not null check(active_weight between 0 and 100),
  global_rank integer not null check(global_rank>0),
  class_rank integer not null check(class_rank>0),
  class_size integer not null check(class_size>=class_rank),
  unit_count integer not null check(unit_count>=0),
  system_count integer not null check(system_count>=0),
  document_count integer not null check(document_count>=0),
  foreign key(ranking_run_id,snapshot_id) references research_portal.ranking_runs(ranking_run_id,snapshot_id),
  foreign key(snapshot_id,university_id,category_id)
    references research_portal.university_snapshots(snapshot_id,university_id,category_id),
  unique(ranking_run_id,university_id),
  unique(ranking_result_id,snapshot_id)
);

create table research_portal.ranking_metric_scores(
  ranking_result_id bigint not null,
  metric_id smallint not null references research_portal.ranking_metrics(metric_id),
  snapshot_id bigint not null,
  score numeric(5,2) not null check(score between 0 and 100),
  foreign key(ranking_result_id,snapshot_id)
    references research_portal.ranking_results(ranking_result_id,snapshot_id),
  primary key(ranking_result_id,metric_id)
);

insert into research_portal.ranking_metrics(code,name_fa) values
  ('documents','اسناد'),('organization','ساختار سازمانی'),('library','کتابخانه'),
  ('laboratories','آزمایشگاه‌ها'),('digital','خدمات دیجیتال'),
  ('industryTech','صنعت و فناوری'),('dataQuality','کیفیت داده'),('findability','یافت‌پذیری')
on conflict do nothing;

insert into research_portal.methodology_metric_weights(methodology_code,metric_id,weight)
select 'RTPMI-4.1-ISC',metric_id,
  case code when 'documents' then .20 when 'organization' then .12 when 'library' then .10
    when 'laboratories' then .12 when 'digital' then .12 when 'industryTech' then .12
    when 'dataQuality' then .12 else .10 end
from research_portal.ranking_metrics
on conflict do nothing;
