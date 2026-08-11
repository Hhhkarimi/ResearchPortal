import fs from "node:fs";
import path from "node:path";

const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const isc=read("data/isc/institutions.json");
const source=read("data/isc/source.json");
const audits=read("data/audit/portal-audit.json");
const deepAudits=read("data/audit/deep-audit-matrix.json");
const rankings=read("data/statistics/portal-ranking.json");
const units=read("data/units/catalog.json");
const systems=read("data/systems/catalog.json");
const documents=read("data/documents/catalog.json");
const packets=read("data/audit/packets-index.json");
const ledger=read("data/evidence/provenance-ledger.json");
const reviews=read("data/evidence/research-review.json");
const dimensionEvidence=read("data/evidence/dimension-evidence.json");
const portalDocumentReaudit=read("data/evidence/portal-document-reaudit.json");
const categories={جامع:69,صنعتی:24,"علوم کشاورزی":4,هنر:4,زیرنظام:4,"دستگاه اجرایی":10};
const dimensions=["portalIdentity","organization","libraryDocuments","laboratories","industryTechnology","informationTechnology","systemsServices","documentsRegulations"];
const statuses=["verified","observed-reference","restricted","unresolved"];
const canonicalUrl=value=>{const url=new URL(value);url.hash="";url.hostname=url.hostname.toLowerCase();if(url.pathname.length>1)url.pathname=url.pathname.replace(/\/+$/,"");return url.toString()};

if(isc.length!==115)throw new Error(`ISC scope must be 115, got ${isc.length}`);
if(source.publicInstitutions!==115)throw new Error("ISC source metadata count mismatch");
for(const [category,expected] of Object.entries(categories)){
  const actual=isc.filter(item=>item.category===category).length;
  if(actual!==expected)throw new Error(`${category}: ${actual} != ${expected}`);
  if(source.categories?.[category]!==expected)throw new Error(`Source category ${category} mismatch`);
}

const validSlugs=new Set(isc.map(item=>item.slug));
if(validSlugs.size!==115)throw new Error("Duplicate ISC slug");
for(const [name,collection] of [["Audit",audits],["Deep audit",deepAudits],["Packet index",packets]])if(collection.length!==115||new Set(collection.map(item=>item.universitySlug??item.slug)).size!==115)throw new Error(`${name} must cover unique 115 ISC institutions`);
for(const collection of [audits,deepAudits,units,systems,documents])for(const item of collection)if(!validSlugs.has(item.universitySlug))throw new Error(`Record outside ISC: ${item.universitySlug}`);
if(audits.some(item=>item.portalAuditStatus==="unresolved-public-portal"))throw new Error("A portal-resolution outcome is still missing");

const packetDirectory="data/audit/packets";
const packetFiles=fs.readdirSync(packetDirectory).filter(file=>file.endsWith(".json"));
if(packetFiles.length!==115)throw new Error(`Expected 115 packet files, got ${packetFiles.length}`);
for(const slug of validSlugs)if(!fs.existsSync(path.join(packetDirectory,`${slug}.json`)))throw new Error(`Missing audit packet: ${slug}`);

const auditsBySlug=new Map(audits.map(item=>[item.universitySlug,item]));
const deepBySlug=new Map(deepAudits.map(item=>[item.universitySlug,item]));
for(const ranking of rankings){
  if(!validSlugs.has(ranking.universitySlug))throw new Error(`Rank outside ISC: ${ranking.universitySlug}`);
  if(auditsBySlug.get(ranking.universitySlug)?.portalAuditStatus!=="direct-official")throw new Error(`Rank without direct portal: ${ranking.universitySlug}`);
  if((deepBySlug.get(ranking.universitySlug)?.auditEvidenceCoverage??0)<75)throw new Error(`Rank below audit coverage gate: ${ranking.universitySlug}`);
  if(ranking.confidence<65)throw new Error(`Low-confidence numeric rank: ${ranking.universitySlug}`);
  if(!Number.isFinite(ranking.score)||ranking.score<0||ranking.score>100)throw new Error(`Invalid RTPMI: ${ranking.universitySlug}`);
}

for(const item of [...units,...systems,...documents])if(["verified","verified-basic"].includes(item.evidence)&&!item.sourceUrl&&!item.parentUrl&&!item.url)throw new Error(`Evidence record without provenance URL: ${item.id}`);
const catalogIds=[...units,...systems,...documents].map(item=>item.id);
if(new Set(catalogIds).size!==catalogIds.length)throw new Error("Duplicate entity id across catalogs");
for(const item of ledger){if(!validSlugs.has(item.universitySlug))throw new Error(`Provenance outside ISC: ${item.universitySlug}`);if(!item.sourceUrl)throw new Error(`Provenance without sourceUrl: ${item.id}`)}

if(dimensionEvidence.length!==920)throw new Error(`Dimension evidence must cover 920 outcomes, got ${dimensionEvidence.length}`);
if(new Set(dimensionEvidence.map(item=>item.id)).size!==920)throw new Error("Duplicate dimension evidence id");
if(reviews.length!==115||new Set(reviews.map(item=>item.universitySlug)).size!==115)throw new Error("Research review must cover unique 115 ISC institutions");
if(portalDocumentReaudit.length!==115||new Set(portalDocumentReaudit.map(item=>item.slug)).size!==115)throw new Error("Portal/document re-audit must cover unique 115 ISC institutions");
if(portalDocumentReaudit.find(item=>item.slug==="bojnord")?.portalUrls?.[0]!=="https://vr.ub.ac.ir/")throw new Error("University of Bojnord official R&T portal correction is missing");
for(const row of portalDocumentReaudit)for(const url of [row.portalUrls,row.organizationUrls,row.libraryUrls,row.laboratoryUrls,row.industryTechnologyUrls,row.informationTechnologyUrls,row.systemsUrls,row.documentIndexUrls,row.directDocuments?.map(item=>item.url)].flat(2).filter(Boolean))try{new URL(url)}catch{throw new Error(`Invalid re-audit URL ${row.slug}: ${url}`)}
for(const row of portalDocumentReaudit){
  const review=reviews.find(item=>item.universitySlug===row.slug);const roots=new Set(row.portalUrls.map(canonicalUrl));
  const checks={organization:"organizationUrls",libraryDocuments:"libraryUrls",laboratories:"laboratoryUrls",industryTechnology:"industryTechnologyUrls",systemsServices:"systemsUrls"};
  for(const [dimension,key] of Object.entries(checks))if(row[key].length&&row[key].every(url=>roots.has(canonicalUrl(url)))&&review.dimensions[dimension]==="verified")throw new Error(`Portal root incorrectly promoted to verified ${row.slug}:${dimension}`);
  const itOutcome=dimensionEvidence.find(item=>item.id===`${row.slug}:informationTechnology`);
  if(review.dimensions.informationTechnology==="verified"&&!itOutcome?.sources.some(source=>source.kind==="unit"&&source.relationStatus==="organizationally-attributed"&&source.relationshipEvidenceUrl))throw new Error(`Re-audit IT cannot be verified without separately modeled organizational evidence: ${row.slug}`);
}
for(const document of documents)if(!document.topic)throw new Error(`Document without topic classification: ${document.id}`);

for(const slug of validSlugs){
  const rows=dimensionEvidence.filter(item=>item.universitySlug===slug);
  const review=reviews.find(item=>item.universitySlug===slug);
  if(rows.length!==8||new Set(rows.map(item=>item.dimension)).size!==8)throw new Error(`Dimension evidence incomplete for ${slug}`);
  if(!review||Object.keys(review.dimensions||{}).length!==8||review.reviewCompletion!==100)throw new Error(`Review incomplete for ${slug}`);
  for(const row of rows){
    if(!dimensions.includes(row.dimension))throw new Error(`Invalid dimension ${row.id}`);
    if(!statuses.includes(row.status)||!statuses.includes(row.reportedStatus))throw new Error(`Invalid evidence status ${row.id}`);
    if(review.dimensions[row.dimension]!==row.status)throw new Error(`Review/register status mismatch ${row.id}`);
    if(row.sourceCount!==row.sources.length)throw new Error(`Source count mismatch ${row.id}`);
    for(const item of row.sources)try{new URL(item.url)}catch{throw new Error(`Invalid dimension evidence URL ${row.id}`)}
    if(row.status==="verified"&&!row.sources.some(item=>item.kind!=="research-review-reference"))throw new Error(`Verified dimension without dimension-specific source ${row.id}`);
    if(row.status==="verified"&&row.publicationAdjustment)throw new Error(`Adjusted outcome cannot remain verified ${row.id}`);
    if(row.dimension==="informationTechnology"&&row.status==="verified"&&!row.sources.some(item=>item.kind==="unit"&&item.relationStatus==="organizationally-attributed"&&item.relationshipEvidenceUrl))throw new Error(`Verified IT without independently recorded organizational relation ${row.id}`);
    if(row.status==="restricted"&&!row.sources.length)throw new Error(`Restricted outcome without attempted official URL ${row.id}`);
  }
  const verified=rows.filter(item=>item.status==="verified").length;
  const observed=rows.filter(item=>item.status==="observed-reference").length;
  const expectedCoverage=Math.round(100*(verified+.5*observed)/8);
  if(review.reviewEvidenceCoverage!==expectedCoverage)throw new Error(`Evidence coverage mismatch ${slug}`);
}

const requiredCsv=["data/isc/institutions.csv","data/audit/portal-audit.csv","data/audit/deep-audit-matrix.csv","data/audit/packets-index.csv","data/statistics/portal-ranking.csv","data/units/catalog.csv","data/systems/catalog.csv","data/documents/catalog.csv","data/evidence/dimension-evidence.csv"];
for(const file of requiredCsv)if(!fs.existsSync(file))throw new Error(`Missing CSV export: ${file}`);
const statusCounts=Object.fromEntries(statuses.map(status=>[status,dimensionEvidence.filter(item=>item.status===status).length]));
console.log(`ISC 115/115 | research review 115/115 | dimension outcomes 920/920 | evidence ${JSON.stringify(statusCounts)} | packets 115/115 | ranked ${rankings.length} | unranked ${115-rankings.length} | units ${units.length} | systems ${systems.length} | docs ${documents.length} | provenance ${ledger.length}`);
