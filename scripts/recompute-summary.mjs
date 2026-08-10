import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [isc,audit,deep,rank,units,systems,documents,ledger]=await Promise.all([
 read('data/isc/institutions.json'),read('data/audit/portal-audit.json'),read('data/audit/deep-audit-matrix.json'),read('data/statistics/portal-ranking.json'),read('data/units/catalog.json'),read('data/systems/catalog.json'),read('data/documents/catalog.json'),read('data/evidence/provenance-ledger.json')
]);
const count=xs=>Object.fromEntries([...new Set(xs)].map(k=>[k,xs.filter(x=>x===k).length]));const cats=[...new Set(isc.map(x=>x.category))];
const summary={
 iscScope:isc.length,categoryCounts:count(isc.map(x=>x.category)),portalStatusCounts:count(audit.map(x=>x.portalAuditStatus)),directOfficialPortals:audit.filter(x=>x.portalAuditStatus==='direct-official').length,portalResolutionOutcomes:audit.length,unresolvedPublicPortal:audit.filter(x=>x.portalAuditStatus==='unresolved-public-portal').length,
 ranked:rank.length,unranked:isc.length-rank.length,rankedByISCCategory:Object.fromEntries(cats.map(c=>[c,rank.filter(x=>x.iscCategory===c).length])),
 deepAuditStatusCounts:count(deep.map(x=>x.deepAuditStatus)),deepAuditedByISCCategory:Object.fromEntries(cats.map(c=>[c,deep.filter(x=>x.iscCategory===c&&x.deepAuditStatus==='deep-audited').length])),
 evidenceCoverage:{average:Math.round(10*deep.reduce((s,x)=>s+x.auditEvidenceCoverage,0)/deep.length)/10,complete100:deep.filter(x=>x.auditEvidenceCoverage===100).length,gte75:deep.filter(x=>x.auditEvidenceCoverage>=75).length,gte50:deep.filter(x=>x.auditEvidenceCoverage>=50).length},
 dimensions:Object.fromEntries(['portalIdentity','organization','libraryDocuments','laboratories','industryTechnology','informationTechnology','systemsServices','documentsRegulations'].map(k=>[k,count(deep.map(x=>x.dimensions[k]))])),
 units:units.length,systems:systems.length,documents:documents.length,provenanceRecords:ledger.length,auditPackets:isc.length,
 snapshotDate:'2026-08-10',methodologyVersion:'RTPMI-4.1-ISC',disclaimer:'RTPMI evaluates public Research & Technology portal maturity, not university research performance. Missing evidence is not scored as zero.'
};
await fs.writeFile('data/statistics/summary.json',JSON.stringify(summary,null,2)+'\n');console.log(summary);
