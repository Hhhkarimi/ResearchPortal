import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [isc,audits,deep,rankings,units,systems,documents,dimensionEvidence]=await Promise.all([
  read('data/isc/institutions.json'),read('data/audit/portal-audit.json'),read('data/audit/deep-audit-matrix.json'),read('data/statistics/portal-ranking.json'),read('data/units/catalog.json'),read('data/systems/catalog.json'),read('data/documents/catalog.json'),read('data/evidence/dimension-evidence.json')
]);
const A=new Map(audits.map(x=>[x.universitySlug,x])),D=new Map(deep.map(x=>[x.universitySlug,x])),R=new Map(rankings.map(x=>[x.universitySlug,x]));
const snapshotDate=process.env.PIPELINE_SNAPSHOT_DATE||"2026-08-11",schemaVersion=process.env.PIPELINE_SCHEMA_VERSION||"10.0.0";
await fs.rm('data/audit/packets',{recursive:true,force:true});await fs.mkdir('data/audit/packets',{recursive:true});
await fs.rm('public/datasets/audit-packets',{recursive:true,force:true});await fs.mkdir('public/datasets/audit-packets',{recursive:true});
const index=[];
for(const inst of isc){
 const slug=inst.slug,a=A.get(slug),d=D.get(slug),r=R.get(slug)||null;
 const packet={schemaVersion,snapshotDate,institution:inst,portalAudit:a,deepAudit:d,dimensionEvidence:dimensionEvidence.filter(x=>x.universitySlug===slug),ranking:r,units:units.filter(x=>x.universitySlug===slug),systems:systems.filter(x=>x.universitySlug===slug),documents:documents.filter(x=>x.universitySlug===slug),interpretation:{iscRank:'ISC classification rank inside the ISC class; independent from RTPMI.',rtpmi:'Portal maturity/transparency only; not research performance.',missing:'unresolved/not-found evidence is not proof of absence and is not automatically scored zero.'}};
 const text=JSON.stringify(packet,null,2)+'\n';
 await fs.writeFile(`data/audit/packets/${slug}.json`,text);await fs.writeFile(`public/datasets/audit-packets/${slug}.json`,text);
 index.push({slug,nameFa:inst.nameFa,iscCategory:inst.category,iscRank:inst.iscRank,portalAuditStatus:a.portalAuditStatus,deepAuditStatus:d.deepAuditStatus,auditEvidenceCoverage:d.auditEvidenceCoverage,rank:r?.rank??null,score:r?.score??null,confidence:r?.confidence??null,url:`/datasets/audit-packets/${slug}.json`});
}
await fs.writeFile('data/audit/packets-index.json',JSON.stringify(index,null,2)+'\n');await fs.writeFile('public/datasets/audit-packets-index.json',JSON.stringify(index,null,2)+'\n');
console.log(`audit packets built: ${index.length}`);
