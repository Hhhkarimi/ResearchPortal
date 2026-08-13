import {database} from "./db-utils.mjs";

const sql=database();
try{
  const [snapshot]=await sql`
    select snapshot_id,release_key,state,is_current from research_portal.snapshots
    where is_current or state='draft' order by is_current desc,created_at desc limit 1
  `;
  if(!snapshot)throw new Error("No draft or current snapshot exists.");
  await sql`select research_portal.validate_snapshot(${snapshot.snapshot_id})`;
  const [counts]=await sql`
    select
      (select count(*)::int from research_portal.university_snapshots where snapshot_id=${snapshot.snapshot_id}) universities,
      (select count(*)::int from research_portal.audit_dimension_results where snapshot_id=${snapshot.snapshot_id}) dimension_results,
      (select count(*)::int from research_portal.evidence_records where snapshot_id=${snapshot.snapshot_id}) evidence_records,
      (select count(*)::int from research_portal.ranking_results where snapshot_id=${snapshot.snapshot_id}) ranking_results
  `;
  console.log(JSON.stringify({snapshot,counts,valid:true},null,2));
}finally{
  await sql.end();
}
