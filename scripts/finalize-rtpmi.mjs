import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const write=async(p,x)=>fs.writeFile(p,JSON.stringify(x,null,2)+'\n');
const [isc,audit,matrix,units,systems,documents]=await Promise.all([
  read('data/isc/institutions.json'),read('data/audit/portal-audit.json'),read('data/audit/deep-audit-matrix.json'),read('data/units/catalog.json'),read('data/systems/catalog.json'),read('data/documents/catalog.json')
]);
const DATE='2026-08-10';
const weights={documents:.20,organization:.12,library:.10,laboratories:.12,digital:.12,industryTech:.12,dataQuality:.12,findability:.10};
const clamp=n=>Math.max(0,Math.min(100,Math.round(n*10)/10));
const ratio=(n,d)=>d?Math.min(1,n/d):0;
const by=(arr,slug)=>arr.filter(x=>x.universitySlug===slug);
const isVerified=x=>['verified','verified-basic','direct','official'].includes(x?.evidence);
function scorePortal(inst,m,a){
  const us=by(units,inst.slug).filter(isVerified),ss=by(systems,inst.slug).filter(isVerified),ds=by(documents,inst.slug).filter(isVerified);
  const ut=new Set(us.map(x=>x.type)),sc=new Set(ss.map(x=>x.category));
  const verifiedDim=k=>m.dimensions[k]==='verified';
  const metrics={};
  // Documents: diversity + depth + directly linked records. Missing documents are null, not zero.
  if(verifiedDim('documentsRegulations')){
    const kinds=new Set(ds.map(x=>x.type).filter(Boolean));
    const direct=ds.filter(x=>x.url).length;
    metrics.documents=clamp(45*ratio(kinds.size,5)+30*ratio(ds.length,8)+25*ratio(direct,ds.length));
  } else metrics.documents=null;
  // Organization: breadth of observable research-portal structure. IT is deliberately NOT required.
  if(verifiedDim('organization')){
    const core=['research','industry','technology','library','laboratory','publishing','research-centers','ethics'];
    const breadth=core.filter(x=>ut.has(x)).length;
    metrics.organization=clamp(45+55*ratio(breadth,6));
  } else metrics.organization=null;
  if(verifiedDim('libraryDocuments')) metrics.library=clamp((ut.has('library')?70:0)+(sc.has('library')?30:0)); else metrics.library=null;
  if(verifiedDim('laboratories')) metrics.laboratories=clamp((ut.has('laboratory')?70:0)+(sc.has('laboratory')?30:0)); else metrics.laboratories=null;
  // Digital maturity never requires IT to be subordinate to research. IT is one optional signal among system categories.
  if(verifiedDim('systemsServices')){
    const relevant=['research','journals','library','laboratory','innovation','industry','publishing','it'];
    const diversity=relevant.filter(x=>sc.has(x)).length;
    const directRelations=ss.filter(x=>['managed-by-portal','unit-service'].includes(x.relation)).length;
    metrics.digital=clamp(50*ratio(diversity,4)+30*ratio(ss.length,6)+20*ratio(directRelations,ss.length));
  } else metrics.digital=null;
  if(verifiedDim('industryTechnology')){
    const unitScore=(ut.has('industry')?45:0)+(ut.has('technology')?45:0);
    const sysScore=(sc.has('industry')||sc.has('innovation'))?10:0;
    metrics.industryTech=clamp(unitScore+sysScore);
  } else metrics.industryTech=null;
  // Data quality is about provenance/verification completeness, not institutional performance.
  const records=[...us,...ss,...ds];
  const withSource=records.filter(x=>x.sourceUrl||x.parentUrl||x.url).length;
  const withDate=records.filter(x=>x.lastVerified).length;
  metrics.dataQuality=clamp(30+(a.researchUrl?20:0)+25*ratio(withSource,records.length)+25*ratio(withDate,records.length));
  // Findability uses only evidence families that were actually resolved; unresolved families do not become zero.
  let findSum=a.researchUrl?35:0,findWeight=35;
  if(us.length){findSum+=25*ratio(us.filter(x=>x.url).length,us.length);findWeight+=25;}
  if(ss.length){findSum+=20*ratio(ss.filter(x=>x.url).length,ss.length);findWeight+=20;}
  if(verifiedDim('documentsRegulations')&&ds.length){findSum+=20*ratio(ds.filter(x=>x.url).length,ds.length);findWeight+=20;}
  metrics.findability=clamp(100*findSum/findWeight);
  const active=Object.entries(weights).filter(([k])=>metrics[k]!==null && Number.isFinite(metrics[k]));
  const totalWeight=active.reduce((s,[,w])=>s+w,0);
  const score=clamp(active.reduce((s,[k,w])=>s+metrics[k]*w,0)/totalWeight);
  const provenance=records.length?100*(.5*ratio(withSource,records.length)+.5*ratio(withDate,records.length)):50;
  const confidence=clamp(.72*m.auditEvidenceCoverage+.28*provenance);
  return {score,confidence,metrics,units:us.length,systems:ss.length,documents:ds.length,activeWeight:Math.round(totalWeight*100),evidenceCoverage:m.auditEvidenceCoverage};
}
const A=new Map(audit.map(x=>[x.universitySlug,x])),M=new Map(matrix.map(x=>[x.universitySlug,x]));
let candidates=[];
for(const inst of isc){const a=A.get(inst.slug),m=M.get(inst.slug);if(!a||!m)continue;if(a.portalAuditStatus!=='direct-official')continue;if(m.auditEvidenceCoverage<75)continue;const s=scorePortal(inst,m,a);if(s.confidence<65)continue;candidates.push({universitySlug:inst.slug,nameFa:inst.nameFa,iscCategory:inst.category,iscRank:inst.iscRank,...s,methodologyVersion:'RTPMI-4.1-ISC',snapshotDate:DATE});}
candidates.sort((a,b)=>b.score-a.score||b.confidence-a.confidence||a.iscRank-b.iscRank);
candidates.forEach((r,i)=>r.rank=i+1);
for(const cat of [...new Set(candidates.map(x=>x.iscCategory))]){const rows=candidates.filter(x=>x.iscCategory===cat);rows.forEach((r,i)=>{r.portalRankWithinISCClass=i+1;r.rankedPortalsInISCClass=rows.length;});}
await write('data/statistics/portal-ranking.json',candidates);
await write('data/statistics/rtpmi-weights.json',{methodologyVersion:'RTPMI-4.1-ISC',weights,missingDataRule:'unresolved dimensions are excluded from the weighted denominator; they reduce confidence/audit coverage rather than becoming zero',rankingGate:{portalAuditStatus:'direct-official',minimumAuditEvidenceCoverage:75,minimumConfidence:65}});
console.log(`RTPMI final: ranked ${candidates.length}/115; top=${candidates[0]?.nameFa??'none'} ${candidates[0]?.score??''}`);
