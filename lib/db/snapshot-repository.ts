import "server-only";

import {getDatabase} from "@/lib/db/client";

export type SnapshotReference={
  snapshotId:string;
  publicId:string;
  releaseKey:string;
  asOfDate:string;
};

export async function getCurrentSnapshot():Promise<SnapshotReference|null>{
  const sql=getDatabase();
  const rows=await sql<SnapshotReference[]>`
    select
      snapshot_id::text as "snapshotId",
      public_id::text as "publicId",
      release_key as "releaseKey",
      as_of_date::text as "asOfDate"
    from research_portal.snapshots
    where is_current and state='published'
    limit 1
  `;
  return rows[0]??null;
}

export async function validateDatabaseConnection(){
  const sql=getDatabase();
  const [result]=await sql<{serverTime:string;currentSnapshot:string|null}[]>`
    select
      clock_timestamp()::text as "serverTime",
      (select release_key from research_portal.snapshots where is_current) as "currentSnapshot"
  `;
  return result;
}
