import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));const write=async(p,x)=>fs.writeFile(p,JSON.stringify(x,null,2)+'\n');
const [isc,audits,units,systems,documents]=await Promise.all([read('data/isc/institutions.json'),read('data/audit/portal-audit.json'),read('data/units/catalog.json'),read('data/systems/catalog.json'),read('data/documents/catalog.json')]);
const A=new Map(audits.map(x=>[x.universitySlug,x]));const by=(xs,s)=>xs.filter(x=>x.universitySlug===s);const verified=x=>['verified','verified-basic'].includes(x.evidence);
const stat=(ok,observed,restricted)=>restricted?'restricted':ok?'verified':observed?'observed-reference':'unresolved';
const matrix=[];
for(const inst of isc){const slug=inst.slug,a=A.get(slug),us=by(units,slug).filter(verified),ss=by(systems,slug).filter(verified),ds=by(documents,slug).filter(verified),sig=new Set(a?.observedSignals||[]);const types=new Set(us.map(x=>x.type)),restricted=['restricted-public','restricted-official-reference','legacy-restricted'].includes(a.portalAuditStatus);
 const dims={
  portalIdentity:a.portalAuditStatus==='direct-official'?'verified':restricted?'restricted':!['secondary-reference','false-positive-blocked'].includes(a.portalAuditStatus)?'observed-reference':'unresolved',
  organization:stat(types.size>0,sig.has('research')||sig.has('structure'),restricted),
  libraryDocuments:stat(types.has('library'),sig.has('library'),restricted),
  laboratories:stat(types.has('laboratory'),sig.has('laboratory'),restricted),
  industryTechnology:stat(types.has('industry')||types.has('technology'),sig.has('industry')||sig.has('technology'),restricted),
  informationTechnology:stat(types.has('it'),sig.has('it')||sig.has('it-related'),restricted),
  systemsServices:stat(ss.length>0,['postdoc','journals','forms','systems'].some(x=>sig.has(x)),restricted),
  documentsRegulations:stat(ds.length>0,sig.has('forms')||sig.has('documents'),restricted)
 };
 const resolved=Object.values(dims).filter(x=>['verified','restricted'].includes(x)).length,observed=Object.values(dims).filter(x=>x==='observed-reference').length;const coverage=Math.round(100*(resolved+.5*observed)/8);
 const deep=a.portalAuditStatus==='direct-official'?(coverage>=75?'deep-audited':'identity-verified-deep-pending'):restricted?'restricted-closed':a.portalAuditStatus==='false-positive-blocked'?'blocked-needs-alternative-discovery':['secondary-reference'].includes(a.portalAuditStatus)?'portal-resolution-pending':'reference-resolved-deep-pending';
 matrix.push({universitySlug:slug,nameFa:inst.nameFa,iscCategory:inst.category,iscRank:inst.iscRank,auditDate:'2026-08-11',portalAuditStatus:a.portalAuditStatus,researchUrl:a.researchUrl||null,evidenceUrls:a.evidenceUrls||[],deepAuditStatus:deep,dimensions:dims,auditEvidenceCoverage:coverage,unitsFound:us.length,systemsFound:ss.length,documentsFound:ds.length,rankingEligibility:a.portalAuditStatus==='direct-official'&&coverage>=75?'candidate':'unranked-evidence-insufficient',interpretation:'Audit coverage measures evidence resolution, not portal quality. Missing/unresolved is not scored as zero.'});
}
await write('data/audit/deep-audit-matrix.json',matrix);console.log(`deep audit matrix: ${matrix.length}; deep=${matrix.filter(x=>x.deepAuditStatus==='deep-audited').length}`);
