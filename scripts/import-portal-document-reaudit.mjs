import fs from "node:fs/promises";

const read=async path=>JSON.parse(await fs.readFile(path,"utf8"));
const [institutions,audits,reviews,existingDocuments]=await Promise.all([
  read("data/isc/institutions.json"),read("data/audit/portal-audit.json"),read("data/evidence/research-review.json"),read("data/documents/catalog.json")
]);
const report=await fs.readFile("docs/PORTAL_DOCUMENT_REAUDIT_115.md","utf8");
const fromFa=value=>Number(String(value).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
const validUrl=value=>{try{return ["http:","https:"].includes(new URL(value).protocol)}catch{return false}};
const canonicalUrl=value=>{const url=new URL(value);url.hash="";url.hostname=url.hostname.toLowerCase();if(url.pathname.length>1)url.pathname=url.pathname.replace(/\/+$/,"");return url.toString()};
const clean=value=>String(value||"").trim().replace(/^`|`$/g,"");
const snapshotDate=process.env.PIPELINE_SNAPSHOT_DATE||"2026-08-11";
const parseUrls=value=>clean(value)==="—"?[]:clean(value).split(";").map(clean).map(item=>item.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/)?.[1]||item.match(/https?:\/\/\S+/)?.[0]).filter(validUrl);
const parseDocuments=value=>clean(value)==="—"?[]:clean(value).split(";").map(clean).map((item,index)=>{
  const markdown=item.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if(markdown)return{title:markdown[1],url:markdown[2],taxonomy:"other",index};
  const [title,...tail]=item.split("::");
  const url=tail.join("::").trim().match(/https?:\/\/\S+/)?.[0]||item.match(/https?:\/\/\S+/)?.[0];
  const rawTitle=tail.length?title.trim():`سند مستقیم ${index+1}`;
  const taxonomy=rawTitle.match(/^\[([^\]]+)\]/)?.[1]||"other";
  return{title:rawTitle.replace(/^\[[^\]]+\]\s*/,"").replace(/^\[PDF\]\s*/i,""),url,taxonomy,index};
}).filter(item=>validUrl(item.url));
const rows=report.split("\n").filter(line=>/^\|\s*[۰-۹0-9]+\s*\|/.test(line));
if(rows.length!==115)throw new Error(`Expected exactly 115 machine-readable rows, got ${rows.length}`);

const parsed=rows.map(line=>{
  const cells=line.split("|").slice(1,-1).map(clean);
  if(cells.length<12)throw new Error(`Expected 12 columns, got ${cells.length}: ${line.slice(0,120)}`);
  const [row,slug,nameFa,portal,organization,library,laboratory,industryTechnology,informationTechnology,systems,documentIndexes,directDocuments]=cells;
  const institution=institutions[fromFa(row)-1];
  if(!institution||institution.slug!==slug)throw new Error(`Roster mismatch at row ${row}: ${slug}`);
  return{
    row:fromFa(row),slug,nameFa,
    portalUrls:parseUrls(portal),organizationUrls:parseUrls(organization),libraryUrls:parseUrls(library),laboratoryUrls:parseUrls(laboratory),industryTechnologyUrls:parseUrls(industryTechnology),informationTechnologyUrls:parseUrls(informationTechnology),systemsUrls:parseUrls(systems),documentIndexUrls:parseUrls(documentIndexes),directDocuments:parseDocuments(directDocuments)
  };
});
if(new Set(parsed.map(row=>row.slug)).size!==115)throw new Error("Re-audit contains duplicate university slugs");

const allUrls=row=>[...new Set([row.portalUrls,row.organizationUrls,row.libraryUrls,row.laboratoryUrls,row.industryTechnologyUrls,row.informationTechnologyUrls,row.systemsUrls,row.documentIndexUrls,row.directDocuments.map(item=>item.url)].flat(2))];
const labelMap={portalUrls:"پرتال پژوهش و فناوری",organizationUrls:"ساختار معاونت",libraryUrls:"کتابخانه و مرکز اسناد",laboratoryUrls:"آزمایشگاه‌ها",industryTechnologyUrls:"صنعت و فناوری",informationTechnologyUrls:"فناوری اطلاعات وابسته",systemsUrls:"سامانه‌ها و خدمات",documentIndexUrls:"فرم‌ها، آیین‌نامه‌ها و دستورالعمل‌ها"};
const dimensionMap={portalIdentity:"portalUrls",organization:"organizationUrls",libraryDocuments:"libraryUrls",laboratories:"laboratoryUrls",industryTechnology:"industryTechnologyUrls",informationTechnology:"informationTechnologyUrls",systemsServices:"systemsUrls",documentsRegulations:"documentIndexUrls"};
const bySlug=new Map(parsed.map(row=>[row.slug,row]));

const nextAudits=audits.map(audit=>{
  const row=bySlug.get(audit.universitySlug);const sources=allUrls(row);
  if(!row.portalUrls.length)return{...audit,auditDate:snapshotDate,evidenceUrls:[...new Set([...(audit.evidenceUrls||[]),...sources])],note:`بازممیزی پرتال و اسناد در ۲۰ مرداد ۱۴۰۵ انجام شد. ${audit.note}`};
  return{...audit,auditDate:snapshotDate,portalAuditStatus:"direct-official",researchUrl:row.portalUrls[0],evidenceUrls:[...new Set([...(audit.evidenceUrls||[]),...sources])],note:"پرتال رسمی پژوهش و فناوری و مسیرهای قابل بازیابی آن در باز‌ممیزی ۲۰ مرداد ۱۴۰۵ ثبت شد؛ هر بُعد با شاهد اختصاصی خودش منتشر می‌شود.",scoreEligibility:audit.scoreEligibility||"unranked"};
});

const nextReviews=reviews.map(review=>{
  const row=bySlug.get(review.universitySlug);
  const preservedStatus=dimension=>review.dimensions?.[dimension]==="restricted"?"restricted":review.dimensions?.[dimension]==="observed-reference"&&review.officialSourceUrls?.length?"observed-reference":"unresolved";
  const dimensions=Object.fromEntries(Object.keys(dimensionMap).map(dimension=>[dimension,preservedStatus(dimension)]));
  const reportedDimensions={...dimensions};
  const portalRoots=new Set(row.portalUrls.map(canonicalUrl));
  for(const [dimension,key] of Object.entries(dimensionMap))if(row[key].length){
    const onlyPortalRoot=dimension!=="portalIdentity"&&row[key].every(url=>portalRoots.has(canonicalUrl(url)));
    const status=dimension==="informationTechnology"||onlyPortalRoot?"observed-reference":"verified";
    dimensions[dimension]=status;
    reportedDimensions[dimension]=status;
  }
  if(row.directDocuments.length){dimensions.documentsRegulations="verified";reportedDimensions.documentsRegulations="verified"}
  const additions=[];
  for(const [key,label] of Object.entries(labelMap))row[key].forEach((url,index)=>additions.push({label:`${label} ${index+1}`,url}));
  row.directDocuments.forEach(item=>additions.push({label:item.title,url:item.url}));
  const officialSources=[...(review.officialSources||[]),...additions].filter((source,index,array)=>array.findIndex(other=>other.url===source.url)===index);
  const statuses=Object.values(dimensions);const verified=statuses.filter(value=>value==="verified").length;const observed=statuses.filter(value=>value==="observed-reference").length;
  return{...review,reviewedAt:snapshotDate,reviewOutcome:officialSources.length?"بازممیزی مستقیم پرتال و مخازن اسناد انجام شد":"بازممیزی انجام شد؛ شاهد عمومی مستقیم تازه بازیابی نشد",dimensions,reportedDimensions,reviewEvidenceCoverage:Math.round(100*(verified+.5*observed)/8),officialSources,officialSourceUrls:officialSources.map(source=>source.url),reviewNote:`بازممیزی مستقل پرتال، ساختار، واحدها، سامانه‌ها و مخازن فرم/آیین‌نامه انجام شد؛ ${officialSources.length} URL رسمی ثبت است.`};
});

const typeOf=(title,taxonomy="")=>taxonomy==="regulation/bylaw"?"آیین‌نامه":taxonomy==="procedure/guideline"?"شیوه‌نامه/دستورالعمل":taxonomy==="form/template"?"فرم/الگو":taxonomy==="policy/circular"?"سیاست/بخشنامه":/آیین.?نامه/.test(title)?"آیین‌نامه":/شیوه.?نامه/.test(title)?"شیوه‌نامه":/دستورالعمل/.test(title)?"دستورالعمل":/فرم/.test(title)?"فرم":/بخشنامه|ابلاغ/.test(title)?"بخشنامه":/راهنما/.test(title)?"راهنما":/سیاست|ضابطه/.test(title)?"ضابطه":/فرآیند/.test(title)?"فرآیند":"سند";
const topicOf=(title,taxonomy="")=>taxonomy==="research ethics"?"اخلاق پژوهش":taxonomy==="grants/funding"?"حمایت و گرنت":taxonomy==="publications/journals"?"انتشارات و نشریات":taxonomy==="laboratory"?"آزمایشگاه":taxonomy==="industry/technology/IP"?"صنعت، فناوری و مالکیت فکری":taxonomy==="postgraduate/research affairs"?"تحصیلات تکمیلی و امور پژوهشی":/اخلاق|کمیته اخلاق/.test(title)?"اخلاق پژوهش":/گرنت|حمایت|پژوهانه|اعتبار/.test(title)?"حمایت و گرنت":/نشریه|مجله|انتشار|چاپ|کتاب/.test(title)?"انتشارات و نشریات":/آزمایش|آزمایشگاه/.test(title)?"آزمایشگاه":/صنعت|فناور|مالکیت فکری|اختراع|مرکز رشد/.test(title)?"صنعت، فناوری و مالکیت فکری":/پایان.?نامه|رساله|پروپوزال|تحصیلات تکمیلی/.test(title)?"تحصیلات تکمیلی و امور پژوهشی":"سایر";
const documents=existingDocuments.map(document=>({...document,topic:document.topic||topicOf(document.title),url:document.url||document.sourceUrl}));
const keys=new Set(documents.map(document=>`${document.universitySlug}|${document.url||document.sourceUrl}`));
for(const row of parsed){
  const candidates=[...row.documentIndexUrls.map((url,index)=>({title:`فهرست فرم‌ها، آیین‌نامه‌ها و دستورالعمل‌ها${row.documentIndexUrls.length>1?` ${index+1}`:""}`,url,type:"فهرست اسناد",topic:"سایر"})),...row.directDocuments.map(item=>({title:item.title,url:item.url,type:typeOf(item.title,item.taxonomy),topic:topicOf(item.title,item.taxonomy),taxonomy:item.taxonomy}))];
  for(const candidate of candidates){const key=`${row.slug}|${candidate.url}`;if(keys.has(key))continue;keys.add(key);documents.push({id:`${row.slug}-reaudit-doc-${documents.filter(item=>item.universitySlug===row.slug).length+1}`,universitySlug:row.slug,title:candidate.title,type:candidate.type,topic:candidate.topic,taxonomy:candidate.taxonomy||null,evidence:"verified",status:"active",lastVerified:snapshotDate,url:candidate.url,sourceUrl:candidate.url});}
}

await Promise.all([
  fs.writeFile("data/evidence/portal-document-reaudit.json",JSON.stringify(parsed,null,2)+"\n"),
  fs.writeFile("data/audit/portal-audit.json",JSON.stringify(nextAudits,null,2)+"\n"),
  fs.writeFile("data/evidence/research-review.json",JSON.stringify(nextReviews,null,2)+"\n"),
  fs.writeFile("data/documents/catalog.json",JSON.stringify(documents,null,2)+"\n")
]);
console.log(`imported ${parsed.length} universities / ${parsed.filter(row=>row.portalUrls.length).length} direct portals / ${documents.length} classified document records`);
