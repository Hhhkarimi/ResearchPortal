import {database} from "./db-utils.mjs";

const releaseKey=process.env.SNAPSHOT_RELEASE_KEY;
if(!releaseKey)throw new Error("SNAPSHOT_RELEASE_KEY is required.");

const sql=database();
try{
  await sql.begin(async tx=>{
    const [snapshot]=await tx`
      select snapshot_id,state from research_portal.snapshots
      where release_key=${releaseKey} for update
    `;
    if(!snapshot)throw new Error(`Snapshot was not found: ${releaseKey}`);
    if(snapshot.state!=="draft")throw new Error(`Snapshot must be draft; current state is ${snapshot.state}.`);
    await tx`select research_portal.publish_snapshot(${snapshot.snapshot_id})`;
    console.log(JSON.stringify({releaseKey,snapshotId:String(snapshot.snapshot_id),published:true},null,2));
  });
}finally{
  await sql.end();
}
