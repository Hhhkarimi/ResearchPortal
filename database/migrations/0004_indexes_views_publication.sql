create index universities_search_name_trgm_idx
  on research_portal.universities using gin(search_name_fa gin_trgm_ops);
create index university_snapshots_browse_idx
  on research_portal.university_snapshots(snapshot_id,category_id,isc_rank,university_id);
create index university_audits_status_idx
  on research_portal.university_audits(snapshot_id,portal_status,university_id);
create index dimension_results_filter_idx
  on research_portal.audit_dimension_results
  (snapshot_id,dimension_id,published_status,university_id,dimension_result_id);
create index evidence_records_university_idx
  on research_portal.evidence_records(snapshot_id,university_id,last_verified_at desc,evidence_id);
create index evidence_records_source_idx on research_portal.evidence_records(source_id);
create index dimension_result_evidence_reverse_idx
  on research_portal.dimension_result_evidence(evidence_id,dimension_result_id);
create index ranking_results_global_idx
  on research_portal.ranking_results(ranking_run_id,global_rank,university_id)
  include(score,confidence,evidence_coverage);
create index ranking_results_class_idx
  on research_portal.ranking_results(ranking_run_id,category_id,class_rank,university_id)
  include(score,confidence);

create or replace view research_portal.current_snapshot as
select * from research_portal.snapshots where is_current and state='published';

create or replace view research_portal.current_universities as
select s.public_id,s.release_key,s.as_of_date,u.university_id,u.slug,us.name_fa,
  c.code as category_code,c.name_fa as category_name_fa,us.isc_rank,us.official_website
from research_portal.current_snapshot s
join research_portal.university_snapshots us using(snapshot_id)
join research_portal.universities u using(university_id)
join research_portal.university_categories c using(category_id);

create or replace view research_portal.current_evidence as
select s.public_id,s.release_key,s.as_of_date,u.slug,d.code as dimension,
  r.dimension_result_id,r.reported_status,r.published_status,r.review_outcome,r.reviewed_at,
  r.publication_adjustment,r.verification_basis,
  (select count(*)::integer from research_portal.dimension_result_evidence l
    where l.dimension_result_id=r.dimension_result_id) as source_count
from research_portal.current_snapshot s
join research_portal.audit_dimension_results r using(snapshot_id)
join research_portal.university_audits a on a.audit_id=r.audit_id
join research_portal.audit_runs ar on ar.audit_run_id=a.audit_run_id
join research_portal.universities u on u.university_id=r.university_id
join research_portal.audit_dimensions d on d.dimension_id=r.dimension_id
join research_portal.methodology_dimensions md
  on md.methodology_code=ar.methodology_code and md.dimension_id=r.dimension_id
where ar.kind='review' and md.is_public;

create or replace view research_portal.current_rankings as
select s.public_id,s.release_key,s.as_of_date,rr.methodology_code,rr.source_effective_date,
  u.slug,us.name_fa,c.name_fa as category_name_fa,r.score,r.confidence,r.evidence_coverage,
  r.active_weight,r.global_rank,r.class_rank,r.class_size,r.unit_count,r.system_count,r.document_count
from research_portal.current_snapshot s
join research_portal.ranking_runs rr using(snapshot_id)
join research_portal.ranking_results r on r.ranking_run_id=rr.ranking_run_id
join research_portal.universities u on u.university_id=r.university_id
join research_portal.university_snapshots us
  on us.snapshot_id=r.snapshot_id and us.university_id=r.university_id
join research_portal.university_categories c on c.category_id=r.category_id;

create or replace function research_portal.validate_snapshot(p_snapshot_id bigint)
returns void language plpgsql as $$
declare v_universities integer; v_bad_dimension_runs integer; v_bad_weights integer; v_bad_metrics integer;
begin
  select count(*) into v_universities from research_portal.university_snapshots where snapshot_id=p_snapshot_id;
  if v_universities=0 then raise exception 'Snapshot % has no universities',p_snapshot_id; end if;

  select count(*) into v_bad_dimension_runs from(
    select a.audit_id,count(dr.dimension_result_id) actual,count(md.dimension_id) expected
    from research_portal.university_audits a
    join research_portal.audit_runs ar using(audit_run_id)
    left join research_portal.audit_dimension_results dr on dr.audit_id=a.audit_id
    left join research_portal.methodology_dimensions md on md.methodology_code=ar.methodology_code
    where a.snapshot_id=p_snapshot_id and ar.kind='review'
    group by a.audit_id
    having count(distinct dr.dimension_result_id)<>count(distinct md.dimension_id)
  )x;
  if v_bad_dimension_runs>0 then raise exception 'Snapshot % has % incomplete dimension audits',p_snapshot_id,v_bad_dimension_runs; end if;

  select count(*) into v_bad_weights from(
    select rr.methodology_code
    from research_portal.ranking_runs rr
    join research_portal.methodology_metric_weights mw using(methodology_code)
    where rr.snapshot_id=p_snapshot_id group by rr.methodology_code
    having abs(sum(mw.weight)-1.0)>.000001
  )x;
  if v_bad_weights>0 then raise exception 'Snapshot % has invalid methodology weights',p_snapshot_id; end if;

  select count(*) into v_bad_metrics from(
    select r.ranking_result_id,count(ms.metric_id) actual,count(mw.metric_id) expected
    from research_portal.ranking_results r
    join research_portal.ranking_runs rr using(ranking_run_id)
    left join research_portal.ranking_metric_scores ms using(ranking_result_id)
    left join research_portal.methodology_metric_weights mw on mw.methodology_code=rr.methodology_code
    where r.snapshot_id=p_snapshot_id group by r.ranking_result_id
    having count(distinct ms.metric_id)<>count(distinct mw.metric_id)
  )x;
  if v_bad_metrics>0 then raise exception 'Snapshot % has % incomplete ranking results',p_snapshot_id,v_bad_metrics; end if;
end $$;

create or replace function research_portal.publish_snapshot(p_snapshot_id bigint)
returns void language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('research_portal.publish_snapshot'));
  perform research_portal.validate_snapshot(p_snapshot_id);
  if not exists(select 1 from research_portal.snapshots where snapshot_id=p_snapshot_id and state='draft') then
    raise exception 'Snapshot % is not draft',p_snapshot_id;
  end if;
  update research_portal.snapshots set is_current=false,state='superseded'
    where is_current and snapshot_id<>p_snapshot_id;
  update research_portal.snapshots set state='published',is_current=true,published_at=clock_timestamp()
    where snapshot_id=p_snapshot_id;
end $$;

create or replace function research_portal.reject_published_snapshot_mutation()
returns trigger language plpgsql as $$
declare v_snapshot_id bigint;
begin
  if tg_op='DELETE' then v_snapshot_id:=old.snapshot_id; else v_snapshot_id:=new.snapshot_id; end if;
  if exists(select 1 from research_portal.snapshots where snapshot_id=v_snapshot_id and state in('published','superseded')) then
    raise exception 'Published snapshot % is immutable',v_snapshot_id;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

create trigger university_snapshots_immutable before update or delete on research_portal.university_snapshots
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger audit_runs_immutable before update or delete on research_portal.audit_runs
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger university_audits_immutable before update or delete on research_portal.university_audits
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger dimension_results_immutable before update or delete on research_portal.audit_dimension_results
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger evidence_records_immutable before update or delete on research_portal.evidence_records
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger dimension_result_evidence_immutable before update or delete on research_portal.dimension_result_evidence
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger audit_evidence_immutable before update or delete on research_portal.audit_evidence
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger ranking_runs_immutable before update or delete on research_portal.ranking_runs
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger ranking_results_immutable before update or delete on research_portal.ranking_results
  for each row execute function research_portal.reject_published_snapshot_mutation();
create trigger ranking_metric_scores_immutable before update or delete on research_portal.ranking_metric_scores
  for each row execute function research_portal.reject_published_snapshot_mutation();
