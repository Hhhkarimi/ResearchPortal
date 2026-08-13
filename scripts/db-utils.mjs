import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

export function database(){
  if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
  return postgres(process.env.DATABASE_URL,{
    max:Number(process.env.DATABASE_MAX_CONNECTIONS||5),
    idle_timeout:Number(process.env.DATABASE_IDLE_TIMEOUT_SECONDS||20),
    connect_timeout:Number(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS||10),
    ssl:process.env.DATABASE_SSL==="true"?"require":false,
    prepare:false,
    connection:{application_name:"research-portal-maintenance",statement_timeout:"0",lock_timeout:"5000"},
  });
}

export const sha256=value=>crypto.createHash("sha256").update(value).digest();
export const sha256Hex=value=>sha256(value).toString("hex");

export async function jsonFile(projectRoot,relativePath){
  return JSON.parse(await fs.readFile(path.join(projectRoot,relativePath),"utf8"));
}

export async function manifestHash(projectRoot,relativePaths){
  const hash=crypto.createHash("sha256");
  for(const relativePath of [...relativePaths].sort()){
    hash.update(relativePath);
    hash.update(await fs.readFile(path.join(projectRoot,relativePath)));
  }
  return hash.digest();
}

export function normalizeFa(value){
  return String(value??"").toLowerCase().replace(/\u200c/g," ").replace(/[يى]/g,"ی")
    .replace(/ك/g,"ک").replace(/\s+/g," ").trim();
}

export function canonicalUrl(value){
  const url=new URL(String(value));
  if(!["http:","https:"].includes(url.protocol))throw new Error(`Unsupported evidence URL: ${value}`);
  url.hash="";
  url.hostname=url.hostname.toLowerCase().replace(/^www\./,"");
  if(url.pathname.length>1)url.pathname=url.pathname.replace(/\/+$/,"");
  const params=[...url.searchParams.entries()]
    .filter(([key])=>!key.toLowerCase().startsWith("utm_")&&!["fbclid","gclid","yclid","mc_cid","mc_eid"].includes(key.toLowerCase()))
    .sort(([ak,av],[bk,bv])=>ak.localeCompare(bk)||av.localeCompare(bv));
  url.search="";
  for(const [key,item] of params)url.searchParams.append(key,item);
  return url.toString();
}

export async function insertChunks(sql,table,rows,columns,size=500){
  if(!rows.length)return;
  for(let index=0;index<rows.length;index+=size){
    const chunk=rows.slice(index,index+size);
    await sql`insert into ${sql(table)} ${sql(chunk,columns)} on conflict do nothing`;
  }
}
