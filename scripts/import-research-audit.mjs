import fs from "node:fs/promises";

const institutions=JSON.parse(await fs.readFile("data/isc/institutions.json","utf8"));
const report=await fs.readFile("docs/EVIDENCE_AUDIT_115.md","utf8");
const dimensions=["portalIdentity","organization","libraryDocuments","laboratories","industryTechnology","informationTechnology","systemsServices","documentsRegulations"];
const codeStatus={"ت":"verified","م":"observed-reference","ن":"unresolved","د":"restricted"};
const snapshotDate=process.env.PIPELINE_SNAPSHOT_DATE||"2026-08-11";
const fromFa=value=>Number(String(value).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
const rows=report.split("\n").filter(line=>/^\|\s*[۰-۹]+\s*\|/.test(line));

if(rows.length!==115)throw new Error(`Research report must contain 115 institution rows, got ${rows.length}`);

const reviews=rows.map(line=>{
  const cells=line.split("|").slice(1,-1).map(value=>value.trim());
  const institution=institutions[fromFa(cells[0])-1];
  if(!institution)throw new Error(`Invalid research row ${cells[0]}`);
  const codes=cells[3].split("/").map(value=>value.trim());
  if(codes.length!==8||codes.some(code=>!codeStatus[code]))throw new Error(`Invalid dimension codes for ${institution.slug}`);
  const reportedDimensions=Object.fromEntries(dimensions.map((key,index)=>[key,codeStatus[codes[index]]]));
  const officialSources=[...cells[4].matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(match=>({label:match[1],url:match[2]}));
  const statuses=Object.values(reportedDimensions);
  const verified=statuses.filter(status=>status==="verified").length;
  const observed=statuses.filter(status=>status==="observed-reference").length;
  return{
    universitySlug:institution.slug,
    nameFa:institution.nameFa,
    reportNameFa:cells[1],
    iscCategory:institution.category,
    iscRank:institution.iscRank,
    reviewedAt:snapshotDate,
    reviewOutcome:cells[2],
    dimensions:reportedDimensions,
    reportedDimensions,
    reviewCompletion:100,
    reviewEvidenceCoverage:Math.round(100*(verified+.5*observed)/8),
    officialSources,
    officialSourceUrls:officialSources.map(source=>source.url),
    reviewNote:cells[4].replace(/\[([^\]]+)\]\([^)]+\)/g,"$1")
  };
});

await fs.writeFile("data/evidence/research-review.json",JSON.stringify(reviews,null,2)+"\n");
console.log(`research review imported: ${reviews.length} institutions / ${reviews.length*8} reported outcomes / ${reviews.reduce((count,row)=>count+row.officialSources.length,0)} official URL references`);
