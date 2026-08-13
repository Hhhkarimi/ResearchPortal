import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {database,sha256Hex} from "./db-utils.mjs";

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const migrationsDir=path.join(projectRoot,"database/migrations");
const sql=database();

try{
  await sql.unsafe(`
    create schema if not exists research_portal;
    create table if not exists research_portal.schema_migrations(
      migration_name text primary key,
      checksum_sha256 text not null,
      applied_at timestamptz not null default now()
    )
  `);
  await sql`select pg_advisory_lock(hashtext('research_portal.schema_migrations'))`;
  const names=(await fs.readdir(migrationsDir)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
  for(const name of names){
    const body=await fs.readFile(path.join(migrationsDir,name),"utf8");
    const checksum=sha256Hex(body);
    const [existing]=await sql`select checksum_sha256 from research_portal.schema_migrations where migration_name=${name}`;
    if(existing){
      if(existing.checksum_sha256!==checksum)throw new Error(`Applied migration changed: ${name}`);
      console.log(`skip ${name}`);
      continue;
    }
    await sql.begin(async tx=>{
      await tx.unsafe(body);
      await tx`insert into research_portal.schema_migrations(migration_name,checksum_sha256) values(${name},${checksum})`;
    });
    console.log(`applied ${name}`);
  }
}finally{
  try{await sql`select pg_advisory_unlock(hashtext('research_portal.schema_migrations'))`;}catch{}
  await sql.end();
}
