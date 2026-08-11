import fs from "node:fs/promises";

const read=async path=>JSON.parse(await fs.readFile(path,"utf8"));
const [institutions,audits,units,systems,documents,ledger,reviews]=await Promise.all([
  read("data/isc/institutions.json"),read("data/audit/portal-audit.json"),read("data/units/catalog.json"),read("data/systems/catalog.json"),read("data/documents/catalog.json"),read("data/evidence/provenance-ledger.json"),read("data/evidence/research-review.json")
]);

const dimensions=["portalIdentity","organization","libraryDocuments","laboratories","industryTechnology","informationTechnology","systemsServices","documentsRegulations"];
const unitTypes={organization:new Set(["research","research-centers","ethics","publishing","library","laboratory","technology","industry","it"]),libraryDocuments:new Set(["library","publishing"]),laboratories:new Set(["laboratory"]),industryTechnology:new Set(["technology","industry"]),informationTechnology:new Set(["it"])};
const systemTypes={libraryDocuments:new Set(["library","publishing","journals"]),laboratories:new Set(["laboratory"]),industryTechnology:new Set(["industry","innovation"]),informationTechnology:new Set(["it"]),systemsServices:new Set(systems.map(item=>item.category))};
const labelPatterns={
  portalIdentity:/پرتال|معاونت|معرفی|صفحه رسمی|منبع رسمی|research|vice/i,
  organization:/ساختار|چارت|واحد|مدیریت|organizational|structure|unit/i,
  libraryDocuments:/کتابخانه|مرکز اسناد|نشر|مجلات|library|publication|journal/i,
  laboratories:/آزمایش|lab/i,
  industryTechnology:/صنعت|فناور|نوآور|مالکیت فکری|پارک|industry|innovation|technology|tto|ip/i,
  informationTechnology:/فناوری اطلاعات|اطلاعات و ارتباطات|\bict\b|\bit\b/i,
  systemsServices:/سامانه|خدمت|نشریات|system|service/i,
  documentsRegulations:/فرم|آیین|دستور|شیوه|مقررات|راهنما|form|regulation|document|guideline/i
};
const statusOutcome={verified:"evidence-confirmed","observed-reference":"reference-only",restricted:"access-restricted",unresolved:"no-public-evidence-resolved"};
const byUniversity=(items,slug)=>items.filter(item=>item.universitySlug===slug);
const urlOf=item=>item?.sourceUrl||item?.parentUrl||item?.url||null;
const validUrl=value=>{try{return new URL(value).protocol.startsWith("http")}catch{return false}};
const uniqueSources=sources=>[...sources.reduce((byUrl,source)=>{if(!byUrl.has(source.url))byUrl.set(source.url,source);return byUrl},new Map()).values()];
const records=[];

for(const institution of institutions){
  const slug=institution.slug;
  const audit=audits.find(item=>item.universitySlug===slug);
  const review=reviews.find(item=>item.universitySlug===slug);
  const universityUnits=byUniversity(units,slug);
  const universitySystems=byUniversity(systems,slug);
  const universityDocuments=byUniversity(documents,slug);
  const universityLedger=byUniversity(ledger,slug);
  for(const dimension of dimensions){
    const sources=[];
    const add=(url,kind,claim,id=null,extra={})=>{if(validUrl(url))sources.push({url,kind,claim,id,...extra})};
    if(dimension==="portalIdentity"){
      if(audit.researchUrl)add(audit.researchUrl,"portal-identity","official research/technology portal identity");
      for(const url of audit.evidenceUrls||[])add(url,"portal-identity","official portal identity evidence");
    }
    if(dimension==="organization"||unitTypes[dimension])for(const item of universityUnits)if(dimension==="organization"||unitTypes[dimension].has(item.type))add(urlOf(item),"unit",item.nameFa,item.id,{unitType:item.type,relationStatus:item.relationStatus||null,relationshipEvidenceUrl:item.relationshipEvidenceUrl||null});
    if(systemTypes[dimension])for(const item of universitySystems)if(systemTypes[dimension].has(item.category))add(urlOf(item),"system",item.nameFa,item.id,{systemCategory:item.category});
    if(dimension==="documentsRegulations")for(const item of universityDocuments)add(urlOf(item),"document",item.title,item.id);
    if(dimension==="libraryDocuments")for(const item of universityDocuments)if(/کتابخانه|مرکز اسناد|نشر|مجله|نشریه|library|publication|journal/i.test(item.title))add(urlOf(item),"document",item.title,item.id);
    if(dimension==="systemsServices")for(const item of universitySystems)add(urlOf(item),"system",item.nameFa,item.id,{systemCategory:item.category});
    for(const item of universityLedger){
      const matches=dimension==="portalIdentity"&&item.entityType==="portal-audit"||dimension==="systemsServices"&&item.entityType==="system"||dimension==="documentsRegulations"&&item.entityType==="document";
      if(matches)add(item.sourceUrl,"provenance",item.claim,item.id);
    }
    for(const source of review.officialSources||[])if(labelPatterns[dimension].test(`${source.label} ${source.url}`))add(source.url,"research-review-specific",source.label,null,{sourceLabel:source.label});

    let finalSources=uniqueSources(sources);
    const reportedStatus=review.reportedDimensions?.[dimension]||review.dimensions[dimension];
    if(reportedStatus==="restricted"){
      for(const url of audit.evidenceUrls||[])add(url,"restriction-reference","Official or institutional URL recorded during the restricted access attempt",null,{sourceSpecificity:"institution-access"});
      finalSources=uniqueSources(sources);
    }
    let status=reportedStatus;
    let publicationAdjustment=null;
    const itHasOrganizationalEvidence=dimension!=="informationTechnology"||finalSources.some(source=>source.kind==="unit"&&source.relationStatus==="organizationally-attributed"&&validUrl(source.relationshipEvidenceUrl));
    if(status==="verified"&&(!finalSources.length||!itHasOrganizationalEvidence)){
      status=review.officialSourceUrls.length?"observed-reference":"unresolved";
      publicationAdjustment=dimension==="informationTechnology"?"Downgraded until a source proving organizational IT dependency is registered.":"Downgraded because no dimension-specific public URL was registered.";
      if(status==="observed-reference")for(const source of review.officialSources||[])add(source.url,"research-review-reference",source.label,null,{sourceLabel:source.label,sourceSpecificity:"university-reference"});
      finalSources=uniqueSources(sources);
    }
    if(status==="restricted"&&!finalSources.length){status="unresolved";publicationAdjustment="Downgraded because no official attempted URL was registered for the restricted-access claim."}
    records.push({
      id:`${slug}:${dimension}`,
      universitySlug:slug,
      nameFa:institution.nameFa,
      iscCategory:institution.category,
      iscRank:institution.iscRank,
      dimension,
      status,
      reportedStatus,
      reviewOutcome:statusOutcome[status],
      reviewedAt:review.reviewedAt,
      sourceCount:finalSources.length,
      sources:finalSources,
      publicationAdjustment,
      verificationBasis:status==="verified"?"Dimension-specific evidence is registered on an official public surface.":status==="observed-reference"?(publicationAdjustment||"An official public reference was observed, but direct dimension attribution was not established."):status==="restricted"?"An attempted official or institutional URL is registered, but public verification was restricted or blocked.":"No sufficient public evidence was resolved in this snapshot; this is not proof of absence.",
      missingDataRule:"Unresolved is not absence and is never automatically scored as zero."
    });
  }
}

if(records.length!==institutions.length*dimensions.length)throw new Error(`Expected 920 dimension outcomes, got ${records.length}`);

const publicationReviews=reviews.map(review=>{
  const universityRecords=records.filter(record=>record.universitySlug===review.universitySlug);
  const publishedDimensions=Object.fromEntries(universityRecords.map(record=>[record.dimension,record.status]));
  const verified=universityRecords.filter(record=>record.status==="verified").length;
  const observed=universityRecords.filter(record=>record.status==="observed-reference").length;
  return{...review,dimensions:publishedDimensions,reportedEvidenceCoverage:review.reviewEvidenceCoverage,reviewEvidenceCoverage:Math.round(100*(verified+.5*observed)/8),publicationAdjustedOutcomes:universityRecords.filter(record=>record.publicationAdjustment).length};
});

await fs.writeFile("data/evidence/dimension-evidence.json",JSON.stringify(records,null,2)+"\n");
await fs.writeFile("data/evidence/research-review.json",JSON.stringify(publicationReviews,null,2)+"\n");
console.log(`dimension evidence register: ${records.length} outcomes / ${institutions.length} institutions / ${dimensions.length} dimensions / ${records.filter(record=>record.publicationAdjustment).length} publication downgrades`);
