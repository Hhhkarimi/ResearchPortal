import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  canonicalUrl,database,insertChunks,jsonFile,manifestHash,normalizeFa,sha256,
} from "./db-utils.mjs";

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const files={
  institutions:"data/isc/institutions.json",
  portalAudits:"data/audit/portal-audit.json",
  deepAudits:"data/audit/deep-audit-matrix.json",
  reviews:"data/evidence/research-review.json",
  dimensions:"data/evidence/dimension-evidence.json",
  provenance:"data/evidence/provenance-ledger.json",
  rankings:"data/statistics/portal-ranking.json",
  weights:"data/statistics/rtpmi-weights.json",
};
const releaseKey=process.env.SNAPSHOT_RELEASE_KEY;
const asOfDate=process.env.SNAPSHOT_AS_OF_DATE;
if(!releaseKey||!asOfDate)throw new Error("SNAPSHOT_RELEASE_KEY and SNAPSHOT_AS_OF_DATE are required.");
if(!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate))throw new Error("SNAPSHOT_AS_OF_DATE must be YYYY-MM-DD.");

const data=Object.fromEntries(await Promise.all(Object.entries(files).map(async([key,file])=>[key,await jsonFile(projectRoot,file)])));
const manifest=await manifestHash(projectRoot,Object.values(files));
const sql=database();

const maxDate=(rows,key)=>rows.map(row=>row[key]).filter(Boolean).sort().at(-1);
const booleanFlag=(value,positive)=>value===true||value===positive;
const safeCanonical=value=>{try{return canonicalUrl(value);}catch{return null;}};

try{
  await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext('research_portal.import_snapshot'))`;
    const existing=await tx`select snapshot_id from research_portal.snapshots where release_key=${releaseKey}`;
    if(existing.length)throw new Error(`Snapshot release_key already exists: ${releaseKey}`);

    const [snapshot]=await tx`
      insert into research_portal.snapshots(release_key,as_of_date,source_manifest_sha256,metadata)
      values(${releaseKey},${asOfDate},${manifest},${tx.json({sourceFiles:Object.values(files),importer:"db-import-snapshot.mjs"})})
      returning snapshot_id
    `;
    const snapshotId=snapshot.snapshot_id;

    for(const category of [...new Set(data.institutions.map(row=>row.category))]){
      await tx`insert into research_portal.university_categories(code,name_fa)
        values(${normalizeFa(category).replace(/\s+/g,"-")},${category}) on conflict do nothing`;
    }
    const categoryRows=await tx`select category_id,name_fa from research_portal.university_categories`;
    const categoryByName=new Map(categoryRows.map(row=>[row.name_fa,row.category_id]));
    const universityBySlug=new Map();
    for(const row of data.institutions){
      const [university]=await tx`
        insert into research_portal.universities(slug,canonical_name_fa,search_name_fa)
        values(${row.slug},${row.nameFa},${normalizeFa(row.nameFa)})
        on conflict(slug) do update set canonical_name_fa=excluded.canonical_name_fa,search_name_fa=excluded.search_name_fa
        returning university_id
      `;
      universityBySlug.set(row.slug,university.university_id);
      await tx`
        insert into research_portal.university_snapshots(
          snapshot_id,university_id,category_id,name_fa,isc_rank,official_website,alternate_website,
          parent_website,website_scope,website_verification,needs_iran_runner_check,note
        ) values(
          ${snapshotId},${university.university_id},${categoryByName.get(row.category)},${row.nameFa},${row.iscRank},
          ${row.officialWebsite},${row.alternateWebsite??null},${row.parentWebsite??null},${row.websiteScope},
          ${row.websiteVerification},${Boolean(row.needsIranRunnerCheck)},${row.note??null}
        )
      `;
    }

    const runSpecs=[
      ["portal","PORTAL-AUDIT-2026-08",maxDate(data.portalAudits,"auditDate")],
      ["deep","DEEP-AUDIT-2026-08",maxDate(data.deepAudits,"auditDate")],
      ["review","PUBLIC-EVIDENCE-4.2",maxDate(data.reviews,"reviewedAt")],
    ];
    const runByKind=new Map();
    for(const [kind,methodology,effectiveDate] of runSpecs){
      const [run]=await tx`
        insert into research_portal.audit_runs(
          snapshot_id,methodology_code,kind,source_effective_date,source_manifest_sha256,completed_at
        ) values(${snapshotId},${methodology},${kind},${effectiveDate},${manifest},now()) returning audit_run_id
      `;
      runByKind.set(kind,run.audit_run_id);
    }

    for(const row of data.portalAudits){
      await tx`insert into research_portal.university_audits(
        audit_run_id,snapshot_id,university_id,portal_status,research_url,score_eligible,note,crawler_metadata
      ) values(
        ${runByKind.get("portal")},${snapshotId},${universityBySlug.get(row.universitySlug)},${row.portalAuditStatus},
        ${row.researchUrl??null},${booleanFlag(row.scoreEligibility,"eligible")},${row.note??null},
        ${tx.json({discoveryCrawler:row.discoveryCrawler??null,observedSignals:row.observedSignals??[]})}
      )`;
    }
    for(const row of data.deepAudits){
      await tx`insert into research_portal.university_audits(
        audit_run_id,snapshot_id,university_id,portal_status,deep_status,research_url,ranking_eligible,
        evidence_coverage,units_found,systems_found,documents_found,interpretation
      ) values(
        ${runByKind.get("deep")},${snapshotId},${universityBySlug.get(row.universitySlug)},${row.portalAuditStatus},
        ${row.deepAuditStatus},${row.researchUrl??null},${booleanFlag(row.rankingEligibility,"candidate")},
        ${row.auditEvidenceCoverage},${row.unitsFound},${row.systemsFound},${row.documentsFound},${row.interpretation}
      )`;
    }
    for(const row of data.reviews){
      await tx`insert into research_portal.university_audits(
        audit_run_id,snapshot_id,university_id,evidence_coverage,interpretation,note,crawler_metadata
      ) values(
        ${runByKind.get("review")},${snapshotId},${universityBySlug.get(row.universitySlug)},
        ${row.reviewEvidenceCoverage},${row.reviewOutcome},${row.reviewNote??null},
        ${tx.json({reviewCompletion:row.reviewCompletion,reportedEvidenceCoverage:row.reportedEvidenceCoverage??null})}
      )`;
    }

    const dimensionIds=new Map((await tx`select dimension_id,code from research_portal.audit_dimensions`).map(row=>[row.code,row.dimension_id]));
    const reviewAudits=new Map((await tx`
      select u.slug,a.audit_id from research_portal.university_audits a
      join research_portal.audit_runs ar using(audit_run_id)
      join research_portal.universities u using(university_id)
      where a.snapshot_id=${snapshotId} and ar.kind='review'
    `).map(row=>[row.slug,row.audit_id]));
    for(const row of data.dimensions){
      await tx`insert into research_portal.audit_dimension_results(
        audit_id,snapshot_id,university_id,dimension_id,reported_status,published_status,review_outcome,
        reviewed_at,publication_adjustment,verification_basis,missing_data_rule
      ) values(
        ${reviewAudits.get(row.universitySlug)},${snapshotId},${universityBySlug.get(row.universitySlug)},
        ${dimensionIds.get(row.dimension)},${row.reportedStatus},${row.status},${row.reviewOutcome},${row.reviewedAt},
        ${row.publicationAdjustment??null},${row.verificationBasis},${row.missingDataRule}
      )`;
    }

    const evidenceItems=[];
    for(const row of data.provenance){
      const url=safeCanonical(row.sourceUrl);
      if(url)evidenceItems.push({slug:row.universitySlug,externalId:`ledger:${row.id}`,url,entityType:row.entityType,
        claim:row.claim,evidenceLevel:row.evidenceLevel,lastVerified:row.lastVerified,raw:row,dimensionId:null,ordinal:0});
    }
    for(const row of data.dimensions){
      (row.sources??[]).forEach((source,index)=>{
        const url=safeCanonical(source.url);
        if(url)evidenceItems.push({slug:row.universitySlug,externalId:`dimension:${row.id}:${index}`,url,
          entityType:"dimension-evidence",claim:source.claim||source.kind||"dimension evidence",
          evidenceLevel:row.status,lastVerified:row.reviewedAt,raw:source,dimensionId:row.id,ordinal:index});
      });
    }
    for(const row of data.portalAudits){
      (row.evidenceUrls??[]).forEach((item,index)=>{
        const url=safeCanonical(item);
        if(url)evidenceItems.push({slug:row.universitySlug,externalId:`portal:${row.universitySlug}:${index}`,url,
          entityType:"portal-audit",claim:row.portalAuditStatus,evidenceLevel:row.portalAuditStatus==="direct-official"?"direct-official":"reference",
          lastVerified:row.auditDate,raw:{url:item},portalAudit:true,ordinal:index});
      });
    }

    const sourceByHash=new Map();
    for(const item of evidenceItems){
      const hash=sha256(item.url).toString("hex");
      const existing=sourceByHash.get(hash);
      if(existing&&existing.url!==item.url)throw new Error(`SHA-256 collision between evidence URLs: ${existing.url} / ${item.url}`);
      if(!existing||item.lastVerified>existing.lastVerified)sourceByHash.set(hash,{url:item.url,lastVerified:item.lastVerified});
      item.urlHash=hash;
    }
    await insertChunks(tx,"research_portal.evidence_sources",[...sourceByHash.entries()].map(([hash,item])=>({
      canonical_url:item.url,url_sha256:Buffer.from(hash,"hex"),first_seen_at:item.lastVerified,last_seen_at:item.lastVerified,
    })),["canonical_url","url_sha256","first_seen_at","last_seen_at"]);
    const sourceIds=new Map((await tx`select source_id,encode(url_sha256,'hex') hash from research_portal.evidence_sources`)
      .map(row=>[row.hash,row.source_id]));
    await insertChunks(tx,"research_portal.evidence_records",evidenceItems.map(item=>({
      snapshot_id:snapshotId,university_id:universityBySlug.get(item.slug),source_id:sourceIds.get(item.urlHash),
      external_id:item.externalId,entity_type:item.entityType,claim:item.claim,evidence_level:item.evidenceLevel,
      last_verified_at:item.lastVerified,raw_payload:tx.json(item.raw),
    })),["snapshot_id","university_id","source_id","external_id","entity_type","claim","evidence_level","last_verified_at","raw_payload"]);

    const evidenceIds=new Map((await tx`
      select e.evidence_id,u.slug,e.external_id from research_portal.evidence_records e
      join research_portal.universities u using(university_id) where e.snapshot_id=${snapshotId}
    `).map(row=>[`${row.slug}|${row.external_id}`,row.evidence_id]));
    const dimensionResultIds=new Map((await tx`
      select u.slug,d.code,r.dimension_result_id from research_portal.audit_dimension_results r
      join research_portal.universities u using(university_id)
      join research_portal.audit_dimensions d using(dimension_id) where r.snapshot_id=${snapshotId}
    `).map(row=>[`${row.slug}:${row.code}`,row.dimension_result_id]));
    const portalAuditIds=new Map((await tx`
      select u.slug,a.audit_id from research_portal.university_audits a
      join research_portal.audit_runs ar using(audit_run_id)
      join research_portal.universities u using(university_id)
      where a.snapshot_id=${snapshotId} and ar.kind='portal'
    `).map(row=>[row.slug,row.audit_id]));
    const dimensionLinks=[];const auditLinks=[];
    for(const item of evidenceItems){
      const evidenceId=evidenceIds.get(`${item.slug}|${item.externalId}`);
      if(item.dimensionId)dimensionLinks.push({dimension_result_id:dimensionResultIds.get(item.dimensionId),evidence_id:evidenceId,
        snapshot_id:snapshotId,source_kind:item.entityType,claim_override:null,ordinal:item.ordinal});
      if(item.portalAudit)auditLinks.push({audit_id:portalAuditIds.get(item.slug),evidence_id:evidenceId,snapshot_id:snapshotId,
        purpose:"portal-identity",ordinal:item.ordinal});
    }
    await insertChunks(tx,"research_portal.dimension_result_evidence",dimensionLinks,
      ["dimension_result_id","evidence_id","snapshot_id","source_kind","claim_override","ordinal"]);
    await insertChunks(tx,"research_portal.audit_evidence",auditLinks,["audit_id","evidence_id","snapshot_id","purpose","ordinal"]);

    const [rankingRun]=await tx`insert into research_portal.ranking_runs(
      snapshot_id,methodology_code,source_effective_date,eligibility_rule,generated_at,source_manifest_sha256
    ) values(${snapshotId},${data.weights.methodologyVersion},${maxDate(data.rankings,"snapshotDate")},
      ${tx.json(data.weights.rankingGate)},${maxDate(data.rankings,"snapshotDate")},${manifest}) returning ranking_run_id`;
    const metricIds=new Map((await tx`select metric_id,code from research_portal.ranking_metrics`).map(row=>[row.code,row.metric_id]));
    for(const row of data.rankings){
      const [result]=await tx`insert into research_portal.ranking_results(
        ranking_run_id,snapshot_id,university_id,category_id,score,confidence,evidence_coverage,active_weight,
        global_rank,class_rank,class_size,unit_count,system_count,document_count
      ) values(${rankingRun.ranking_run_id},${snapshotId},${universityBySlug.get(row.universitySlug)},
        ${categoryByName.get(row.iscCategory)},${row.score},${row.confidence},${row.evidenceCoverage},${row.activeWeight},
        ${row.rank},${row.portalRankWithinISCClass},${row.rankedPortalsInISCClass},${row.units},${row.systems},${row.documents})
        returning ranking_result_id`;
      for(const [code,score] of Object.entries(row.metrics))await tx`
        insert into research_portal.ranking_metric_scores(ranking_result_id,metric_id,snapshot_id,score)
        values(${result.ranking_result_id},${metricIds.get(code)},${snapshotId},${score})`;
    }

    await tx`select research_portal.validate_snapshot(${snapshotId})`;
    console.log(JSON.stringify({snapshotId:String(snapshotId),releaseKey,published:false,
      universities:data.institutions.length,dimensionResults:data.dimensions.length,evidenceRecords:evidenceItems.length,
      rankingResults:data.rankings.length},null,2));
  });
}finally{
  await sql.end();
}
