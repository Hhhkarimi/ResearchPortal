import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const esc=v=>{if(v===null||v===undefined)return '';const s=Array.isArray(v)?v.join(' | '):typeof v==='object'?JSON.stringify(v):String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};
const csv=(rows,cols)=>[cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n')+'\n';
const [isc,audit,deep,ranking,units,systems,docs,packets,dimensionEvidence]=await Promise.all([
 read('data/isc/institutions.json'),read('data/audit/portal-audit.json'),read('data/audit/deep-audit-matrix.json'),read('data/statistics/portal-ranking.json'),read('data/units/catalog.json'),read('data/systems/catalog.json'),read('data/documents/catalog.json'),read('data/audit/packets-index.json'),read('data/evidence/dimension-evidence.json')
]);
const flatDeep=deep.map(x=>({...x,...Object.fromEntries(Object.entries(x.dimensions||{}).map(([k,v])=>[`dimension_${k}`,v]))}));
const flatRank=ranking.map(x=>({...x,...Object.fromEntries(Object.entries(x.metrics||{}).map(([k,v])=>[`metric_${k}`,v]))}));
const defs=[
 ['data/isc/institutions.csv',isc,['slug','nameFa','category','iscRank']],
 ['data/audit/portal-audit.csv',audit,['universitySlug','nameFa','iscCategory','iscRank','auditDate','portalAuditStatus','researchUrl','evidenceUrls','note','scoreEligibility']],
 ['data/audit/deep-audit-matrix.csv',flatDeep,['universitySlug','nameFa','iscCategory','iscRank','portalAuditStatus','deepAuditStatus','auditEvidenceCoverage','unitsFound','systemsFound','documentsFound','rankingEligibility','dimension_portalIdentity','dimension_organization','dimension_libraryDocuments','dimension_laboratories','dimension_industryTechnology','dimension_informationTechnology','dimension_systemsServices','dimension_documentsRegulations']],
 ['data/statistics/portal-ranking.csv',flatRank,['rank','universitySlug','nameFa','iscCategory','iscRank','score','confidence','evidenceCoverage','activeWeight','portalRankWithinISCClass','rankedPortalsInISCClass','metric_documents','metric_organization','metric_library','metric_laboratories','metric_digital','metric_industryTech','metric_dataQuality','metric_findability']],
 ['data/units/catalog.csv',units,['id','universitySlug','nameFa','type','parentUnitId','relationStatus','url','sourceUrl','evidence','lastVerified']],
 ['data/systems/catalog.csv',systems,['id','universitySlug','nameFa','category','url','relation','sourceUrl','evidence','lastVerified']],
 ['data/documents/catalog.csv',docs,['id','universitySlug','title','type','topic','url','parentUrl','format','status','evidence','publishedDate','lastVerified','publisherUnit','approvalAuthority']],
 ['data/audit/packets-index.csv',packets,['slug','nameFa','iscCategory','iscRank','portalAuditStatus','deepAuditStatus','auditEvidenceCoverage','rank','score','confidence','url']]
 ,['data/evidence/dimension-evidence.csv',dimensionEvidence.map(x=>({...x,sourceUrls:x.sources.map(y=>y.url),sourceKinds:x.sources.map(y=>y.kind)})),['id','universitySlug','nameFa','iscCategory','iscRank','dimension','status','reportedStatus','publicationAdjustment','reviewOutcome','reviewedAt','sourceCount','sourceKinds','sourceUrls','verificationBasis','missingDataRule']]
];
await fs.mkdir('public/datasets',{recursive:true});
for(const [path,rows,cols] of defs){const content=csv(rows,cols);await fs.writeFile(path,content);await fs.writeFile(`public/datasets/${path.split('/').slice(1).join('-')}`,content)}
console.log(`CSV exports built: ${defs.length}`);
