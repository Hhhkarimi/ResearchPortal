import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [audit,units,systems,documents]=await Promise.all([read('data/audit/portal-audit.json'),read('data/units/catalog.json'),read('data/systems/catalog.json'),read('data/documents/catalog.json')]);
const rows=[];
for(const a of audit){for(const [i,sourceUrl] of (a.evidenceUrls||[]).entries())rows.push({id:`${a.universitySlug}-portal-evidence-${i+1}`,universitySlug:a.universitySlug,entityType:'portal-audit',claim:a.portalAuditStatus,sourceUrl,evidenceLevel:a.portalAuditStatus==='direct-official'?'direct-official':'reference',lastVerified:a.auditDate||'2026-08-11'});}
for(const [collection,entityType] of [[units,'unit'],[systems,'system'],[documents,'document']])for(const x of collection){const sourceUrl=x.sourceUrl||x.parentUrl||x.url;if(sourceUrl)rows.push({id:`${entityType}-${x.id}`,universitySlug:x.universitySlug,entityType,claim:x.nameFa||x.title||x.id,sourceUrl,evidenceLevel:x.evidence||'unknown',lastVerified:x.lastVerified||'2026-08-11'});}
const unique=[...new Map(rows.map(x=>[x.id,x])).values()];
await fs.mkdir('data/evidence',{recursive:true});await fs.writeFile('data/evidence/provenance-ledger.json',JSON.stringify(unique,null,2)+'\n');console.log(`provenance ledger: ${unique.length}`);
