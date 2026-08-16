import dns from "node:dns/promises";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const pendingRoot=path.join(projectRoot,"data/community-submissions/pending");
const acceptedRoot=path.join(projectRoot,"data/community-submissions/accepted");
const referenceRoot=path.join(projectRoot,"data/community-submissions/reference");
const rejectedRoot=path.join(projectRoot,"data/community-submissions/rejected");
const errorRoot=path.join(projectRoot,"data/community-submissions/error");
const evidenceFile=path.join(projectRoot,"data/generated/discovery-evidence.json");
const documentsFile=path.join(projectRoot,"data/generated/discovered-documents.json");
const reportFile=path.join(projectRoot,"data/generated/community-submission-report.json");

const SOCIAL_HOSTS=new Set([
  "t.me","telegram.me","telegram.org","instagram.com","facebook.com","fb.com",
  "x.com","twitter.com","linkedin.com","youtube.com","youtu.be",
]);

const DOCUMENT_EXTENSIONS=new Set([
  ".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".rtf",".odt",".ods",".odp",".csv",".txt",".zip",
]);

const DIMENSION_HINTS=new Set([
  "portalIdentity","organization","libraryDocuments","laboratories",
  "industryTechnology","systemsServices","documentsRegulations",
]);

const DIMENSION_RULES={
  portalIdentity:["معاونت پژوهش","پژوهش و فناوری","research office","research portal","vice chancellor research","research and technology"],
  organization:["ساختار","چارت","مدیریت پژوهش","اداره پژوهش","معاونت پژوهش","organization","research office","research management"],
  libraryDocuments:["کتابخانه","منابع علمی","پایگاه اطلاعات","library","digital library","repository","scientific resources"],
  laboratories:["آزمایشگاه","آزمایشگاهی","آزمایشگاه مرکزی","laboratory","laboratories","lab center","core facility"],
  industryTechnology:["صنعت","فناوری","نوآوری","مرکز رشد","پارک علم","مالکیت فکری","industry","technology","innovation","incubator","intellectual property"],
  systemsServices:["سامانه","خدمت پژوهشی","پژوهانه","گرنت","اخلاق پژوهش","نشریات","system","service","grant","ethics","journal portal"],
  documentsRegulations:["آیین نامه","آیین‌نامه","شیوه نامه","شیوه‌نامه","دستورالعمل","بخشنامه","فرم","regulation","bylaw","guideline","procedure","form","policy"],
};

const RESEARCH_TERMS=[
  "پژوهش","پژوهشی","تحقیق","فناوری","آزمایشگاه","آزمایشگاهی","پژوهانه","گرنت","اخلاق پژوهش",
  "نشریه","نشریات","پایان نامه","پایان‌نامه","رساله","پروپوزال","اختراع","صنعت","نوآوری",
  "research","researcher","technology","laboratory","grant","ethics","journal","thesis","dissertation","proposal","innovation","industry",
];

const TRANSIENT_HTTP=new Set([408,425,429,500,502,503,504]);

const readJson=async(file,fallback)=>{
  try{
    const raw=await fs.readFile(file,"utf8");
    if(!raw.trim())return fallback;
    return JSON.parse(raw);
  }catch{return fallback;}
};

const writeJson=async(file,value)=>{
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify(value,null,2)+"\n","utf8");
};

function normalizeText(value){
  return String(value??"").toLowerCase().replace(/\u200c/g," ").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ").trim();
}

function hostMatches(host,base){
  return host===base||host.endsWith(`.${base}`);
}

function isSocialHost(host){
  const normalized=host.toLowerCase().replace(/^www\./,"");
  return [...SOCIAL_HOSTS].some((blocked)=>hostMatches(normalized,blocked));
}

export function canonicalUrl(value){
  const url=new URL(String(value));
  if(!["http:","https:"].includes(url.protocol))throw new Error("unsupported-protocol");
  if(url.username||url.password)throw new Error("credentials-in-url");
  url.hash="";
  url.hostname=url.hostname.toLowerCase().replace(/^www\./,"");
  if(url.pathname.length>1)url.pathname=url.pathname.replace(/\/+$/,"");
  const params=[...url.searchParams.entries()]
    .filter(([key])=>!key.toLowerCase().startsWith("utm_")&&!["fbclid","gclid","yclid","mc_cid","mc_eid"].includes(key.toLowerCase()))
    .sort(([ak,av],[bk,bv])=>ak.localeCompare(bk)||av.localeCompare(bv));
  url.search="";
  for(const [key,item] of params)url.searchParams.append(key,item);
  return url.toString();
}

export function isBlockedIp(address){
  const version=net.isIP(address);
  if(version===4){
    const [a,b]=address.split(".").map(Number);
    return a===0||a===10||a===127||a>=224||
      (a===100&&b>=64&&b<=127)||
      (a===169&&b===254)||
      (a===172&&b>=16&&b<=31)||
      (a===192&&b===168)||
      (a===198&&(b===18||b===19));
  }
  if(version===6){
    const value=address.toLowerCase();
    return value==="::"||value==="::1"||value.startsWith("fc")||value.startsWith("fd")||
      value.startsWith("fe8")||value.startsWith("fe9")||value.startsWith("fea")||value.startsWith("feb")||
      value.startsWith("ff")||value.startsWith("::ffff:127.")||value.startsWith("::ffff:10.")||value.startsWith("::ffff:192.168.");
  }
  return true;
}

async function assertPublicDns(hostname){
  if(net.isIP(hostname)){
    if(isBlockedIp(hostname))throw new Error("private-address");
    return;
  }
  const rows=await dns.lookup(hostname,{all:true,verbatim:true});
  if(!rows.length)throw new Error("dns-empty");
  if(rows.some((row)=>isBlockedIp(row.address)))throw new Error("private-address");
}

function officialHostsFor(institution,audit){
  const hosts=[];
  for(const value of [institution?.officialWebsite,audit?.portalAuditStatus==="direct-official"?audit?.researchUrl:null]){
    if(!value)continue;
    try{hosts.push(new URL(value).hostname.toLowerCase().replace(/^www\./,""));}catch{}
  }
  return [...new Set(hosts)];
}

function isOfficialHost(host,allowedHosts){
  const normalized=host.toLowerCase().replace(/^www\./,"");
  return allowedHosts.some((allowed)=>hostMatches(normalized,allowed));
}

async function safeFetch(startUrl,{method="GET",allowedHosts,maxRedirects=5}={}){
  let current=canonicalUrl(startUrl);
  for(let redirect=0;redirect<=maxRedirects;redirect+=1){
    const url=new URL(current);
    if(isSocialHost(url.hostname))throw new Error("social-host");
    if(!isOfficialHost(url.hostname,allowedHosts||[]))throw new Error("left-official-domain");
    await assertPublicDns(url.hostname);

    const response=await fetch(current,{
      method,
      redirect:"manual",
      signal:AbortSignal.timeout(15000),
      headers:{
        "User-Agent":"ResearchPortalCommunityVerifier/1.0 (+https://github.com/Hhhkarimi/ResearchPortal)",
        Accept:method==="HEAD"?"*/*":"text/html,application/xhtml+xml,application/pdf,application/octet-stream;q=0.8,*/*;q=0.5",
        ...(method==="GET"?{"Range":"bytes=0-524287"}:{}),
      },
    });

    if(response.status>=300&&response.status<400){
      const location=response.headers.get("location");
      if(!location)throw new Error(`redirect-without-location-${response.status}`);
      current=canonicalUrl(new URL(location,current).toString());
      continue;
    }

    return {response,finalUrl:current};
  }
  throw new Error("too-many-redirects");
}

async function readBodyLimited(response,limit=524288){
  if(!response.body)return "";
  const reader=response.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:false});
  let total=0;
  let output="";
  try{
    while(total<limit){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      output+=decoder.decode(value,{stream:true});
      if(total>=limit)break;
    }
    output+=decoder.decode();
  }finally{
    try{await reader.cancel();}catch{}
  }
  return output;
}

function decodeHtml(value){
  return String(value||"")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Number.parseInt(n,16)));
}

function htmlTitle(html){
  const match=String(html||"").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match?decodeHtml(match[1]).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,240):"";
}

function htmlText(html){
  return decodeHtml(String(html||"")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," "))
    .replace(/\s+/g," ").trim().slice(0,30000);
}

function extensionFromUrl(value){
  try{return path.extname(decodeURIComponent(new URL(value).pathname)).toLowerCase();}catch{return "";}
}

function contentDispositionFilename(value){
  const raw=String(value||"");
  const utf=raw.match(/filename\*=UTF-8''([^;]+)/i);
  if(utf){try{return decodeURIComponent(utf[1].replace(/^"|"$/g,""));}catch{}}
  const plain=raw.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plain?plain[1].trim():"";
}

function basenameTitle(value){
  try{
    const name=decodeURIComponent(new URL(value).pathname.split("/").filter(Boolean).at(-1)||"");
    return name.replace(/\.(pdf|docx?|xlsx?|pptx?|rtf|odt|ods|odp|csv|txt|zip)$/i,"")
      .replace(/[_+]+/g," ").replace(/-{2,}/g," ").replace(/\s+/g," ").trim();
  }catch{return "";}
}

export function meaningfulTitle(value){
  const title=normalizeText(value);
  if(!title||title.length<4)return false;
  if(["download","file","document","attachment","دانلود","فایل","سند","سند پژوهشی","پیوست"].includes(title))return false;
  if(/^[\d._\-\s]+$/.test(title))return false;
  if(/^[a-f0-9-]{20,}$/i.test(title))return false;
  return true;
}

function countTerms(text,terms){
  const normalized=normalizeText(text);
  let score=0;
  for(const term of terms){if(normalized.includes(normalizeText(term)))score+=1;}
  return score;
}

export function inferDimension(hint,context){
  const scores=Object.fromEntries(Object.entries(DIMENSION_RULES).map(([dimension,terms])=>[dimension,countTerms(context,terms)]));
  if(DIMENSION_HINTS.has(hint)&&scores[hint]>0)return {dimension:hint,score:scores[hint]};
  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const [dimension,score]=sorted[0]||[null,0];
  return {dimension:score>0?dimension:null,score};
}

export function taxonomyFor(context){
  const text=normalizeText(context);
  if(/آیین ?نامه|bylaw|regulation/.test(text))return "regulation/bylaw";
  if(/شیوه ?نامه|دستورالعمل|guideline|procedure/.test(text))return "procedure/guideline";
  if(/فرم|الگو|template|form/.test(text))return "form/template";
  if(/بخشنامه|سیاست|policy|circular/.test(text))return "policy/circular";
  if(/اخلاق|ethics/.test(text))return "research ethics";
  if(/گرنت|پژوهانه|grant|funding/.test(text))return "grants/funding";
  if(/نشریه|مجله|journal|publication/.test(text))return "publications/journals";
  if(/آزمایشگاه|laboratory/.test(text))return "laboratory";
  if(/صنعت|فناوری|مالکیت فکری|اختراع|industry|technology|intellectual property/.test(text))return "industry/technology/IP";
  if(/پایان ?نامه|رساله|پروپوزال|thesis|dissertation|proposal/.test(text))return "postgraduate/research affairs";
  return "other";
}

function documentLike(url,contentType){
  const ext=extensionFromUrl(url);
  const mime=String(contentType||"").toLowerCase();
  return DOCUMENT_EXTENSIONS.has(ext)||/application\/(pdf|msword|vnd\.|rtf|zip)|text\/(csv|plain)/.test(mime);
}

function candidateConfidence(researchScore,dimensionScore,isDocument){
  return Number(Math.min(0.94,(isDocument?0.84:0.80)+Math.min(0.08,researchScore*0.015)+Math.min(0.04,dimensionScore*0.01)).toFixed(2));
}

async function verifySubmission(submission,institution,audit){
  let submittedUrl;
  try{submittedUrl=canonicalUrl(submission.url);}catch{return {disposition:"rejected",reason:"invalid-url"};}

  const allowedHosts=officialHostsFor(institution,audit);
  if(!allowedHosts.length)return {disposition:"reference",reason:"no-trusted-official-host"};

  const submittedHost=new URL(submittedUrl).hostname;
  if(isSocialHost(submittedHost))return {disposition:"rejected",reason:"social-host"};
  if(!isOfficialHost(submittedHost,allowedHosts))return {disposition:"reference",reason:"outside-official-domain",allowedHosts};

  let head;
  try{head=await safeFetch(submittedUrl,{method:"HEAD",allowedHosts});}
  catch(error){return {disposition:"retry",reason:error instanceof Error?error.message:"head-failed"};}

  if(TRANSIENT_HTTP.has(head.response.status))return {disposition:"retry",reason:`http-${head.response.status}`};
  if([401,403].includes(head.response.status))return {disposition:"reference",reason:`http-${head.response.status}`,finalUrl:head.finalUrl};
  if([404,410].includes(head.response.status))return {disposition:"rejected",reason:`http-${head.response.status}`,finalUrl:head.finalUrl};
  if(head.response.status<200||head.response.status>=400)return {disposition:"rejected",reason:`http-${head.response.status}`,finalUrl:head.finalUrl};

  const headType=head.response.headers.get("content-type")||"";
  const isDocument=documentLike(head.finalUrl,headType);

  if(isDocument){
    const dispositionName=contentDispositionFilename(head.response.headers.get("content-disposition"));
    const filename=dispositionName||decodeURIComponent(new URL(head.finalUrl).pathname.split("/").filter(Boolean).at(-1)||"");
    const titleCandidate=basenameTitle(dispositionName?new URL(encodeURI(dispositionName),"https://filename.invalid/").toString():head.finalUrl)||filename;
    const title=String(titleCandidate||"").replace(/\.(pdf|docx?|xlsx?|pptx?|rtf|odt|ods|odp|csv|txt|zip)$/i,"").replace(/[_+]+/g," ").replace(/\s+/g," ").trim();
    if(!meaningfulTitle(title))return {disposition:"reference",reason:"document-title-not-verifiable",finalUrl:head.finalUrl};

    const context=`${title} ${new URL(head.finalUrl).pathname}`;
    const researchScore=countTerms(context,RESEARCH_TERMS);
    if(researchScore<1)return {disposition:"reference",reason:"document-research-scope-not-verifiable",finalUrl:head.finalUrl};

    const taxonomy=taxonomyFor(context);
    const confidence=candidateConfidence(researchScore,1,true);
    return {
      disposition:"accepted",
      reason:"official-direct-document",
      finalUrl:head.finalUrl,
      candidate:{
        kind:"document",
        record:{
          universitySlug:submission.universitySlug,
          url:head.finalUrl,
          sourcePage:head.finalUrl,
          title:title.slice(0,240),
          anchorText:"",
          taxonomy,
          contentType:headType||null,
          fileName:filename||null,
          bytes:Number(head.response.headers.get("content-length"))||null,
          confidence,
          officialDomain:true,
          researchContext:true,
          discoveredBy:"community-submission",
          communitySubmissionId:submission.id,
        },
      },
      verification:{httpStatus:head.response.status,contentType:headType||null,officialDomain:true,researchScore,taxonomy,confidence},
    };
  }

  let page;
  try{page=await safeFetch(head.finalUrl,{method:"GET",allowedHosts});}
  catch(error){return {disposition:"retry",reason:error instanceof Error?error.message:"get-failed",finalUrl:head.finalUrl};}

  if(TRANSIENT_HTTP.has(page.response.status))return {disposition:"retry",reason:`http-${page.response.status}`,finalUrl:page.finalUrl};
  if([401,403].includes(page.response.status))return {disposition:"reference",reason:`http-${page.response.status}`,finalUrl:page.finalUrl};
  if([404,410].includes(page.response.status))return {disposition:"rejected",reason:`http-${page.response.status}`,finalUrl:page.finalUrl};
  if(page.response.status<200||page.response.status>=400)return {disposition:"rejected",reason:`http-${page.response.status}`,finalUrl:page.finalUrl};

  const contentType=page.response.headers.get("content-type")||"";
  if(!/text\/html|application\/xhtml\+xml/i.test(contentType))return {disposition:"reference",reason:"unsupported-content-type",finalUrl:page.finalUrl,contentType};

  const html=await readBodyLimited(page.response);
  const title=htmlTitle(html);
  const visibleText=htmlText(html);
  const context=`${title} ${new URL(page.finalUrl).pathname} ${visibleText}`;
  const researchScore=countTerms(context,RESEARCH_TERMS);
  const inferred=inferDimension(submission.categoryHint,context);

  if(researchScore<2||!inferred.dimension||inferred.score<1){
    return {disposition:"reference",reason:"research-scope-not-strong-enough",finalUrl:page.finalUrl,verification:{researchScore,dimension:inferred.dimension,dimensionScore:inferred.score}};
  }

  if(!meaningfulTitle(title))return {disposition:"reference",reason:"page-title-not-verifiable",finalUrl:page.finalUrl};

  const confidence=candidateConfidence(researchScore,inferred.score,false);
  const record={
    universitySlug:submission.universitySlug,
    url:page.finalUrl,
    sourcePage:page.finalUrl,
    title:title.slice(0,240),
    anchorText:"",
    dimension:inferred.dimension,
    confidence,
    score:Math.min(20,4+researchScore+inferred.score),
    officialDomain:true,
    researchContext:true,
    discoveredBy:"community-submission",
    communitySubmissionId:submission.id,
  };

  return {
    disposition:"accepted",
    reason:"official-research-page",
    finalUrl:page.finalUrl,
    candidate:{kind:inferred.dimension==="portalIdentity"?"portal":"evidence",record},
    verification:{httpStatus:page.response.status,contentType,officialDomain:true,researchScore,dimension:inferred.dimension,dimensionScore:inferred.score,confidence},
  };
}

async function listJsonFiles(root){
  const output=[];
  async function walk(dir){
    let entries=[];
    try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{return;}
    for(const entry of entries){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())await walk(full);
      else if(entry.isFile()&&entry.name.endsWith(".json"))output.push(full);
    }
  }
  await walk(root);
  return output.sort();
}

function evidenceKey(record){
  try{return `${record.universitySlug}|${record.dimension}|${canonicalUrl(record.url)}`;}catch{return null;}
}
function portalKey(record){
  try{return `${record.universitySlug}|${canonicalUrl(record.url)}`;}catch{return null;}
}
function documentKey(record){
  try{return `${record.universitySlug}|${canonicalUrl(record.url)}`;}catch{return null;}
}

function upsert(list,record,keyFor){
  const key=keyFor(record);
  if(!key)return;
  const index=list.findIndex((item)=>keyFor(item)===key);
  if(index<0)list.push(record);
  else list[index]={...list[index],...record,confidence:Math.max(Number(list[index].confidence)||0,Number(record.confidence)||0)};
}

async function archive(source,root,submission,status,result){
  const relative=path.relative(pendingRoot,source);
  const destination=path.join(root,relative);
  const updated={
    ...submission,
    status,
    processedAt:new Date().toISOString(),
    verification:{
      ...(submission.verification||{}),
      result:result.reason,
      finalUrl:result.finalUrl||null,
      ...(result.verification||{}),
    },
  };
  await writeJson(destination,updated);
  await fs.unlink(source);
}

async function main(){
  const [institutions,audits,evidenceOutput,documentOutput]=await Promise.all([
    readJson(path.join(projectRoot,"data/isc/institutions.json"),[]),
    readJson(path.join(projectRoot,"data/audit/portal-audit.json"),[]),
    readJson(evidenceFile,{evidence:[],portalCandidates:[]}),
    readJson(documentsFile,{documents:[]}),
  ]);

  const institutionBySlug=new Map(institutions.map((item)=>[item.slug,item]));
  const auditBySlug=new Map(audits.map((item)=>[item.universitySlug,item]));
  const evidence=Array.isArray(evidenceOutput?.evidence)?[...evidenceOutput.evidence]:[];
  const portalCandidates=Array.isArray(evidenceOutput?.portalCandidates)?[...evidenceOutput.portalCandidates]:[];
  const documents=Array.isArray(documentOutput?.documents)?[...documentOutput.documents]:[];

  const allFiles=await listJsonFiles(pendingRoot);
  const limit=Math.min(300,Math.max(1,Number(process.env.COMMUNITY_PROCESS_LIMIT||150)));
  const files=allFiles.slice(0,limit);
  const maxAttempts=Math.min(5,Math.max(1,Number(process.env.COMMUNITY_MAX_ATTEMPTS||3)));
  const concurrency=Math.min(6,Math.max(1,Number(process.env.COMMUNITY_VERIFY_CONCURRENCY||4)));

  const stats={processed:0,accepted:0,reference:0,rejected:0,retry:0,error:0};
  const events=[];
  let cursor=0;

  async function worker(){
    while(true){
      const index=cursor++;
      if(index>=files.length)return;
      const file=files[index];
      const submission=await readJson(file,null);
      if(!submission||submission.status!=="pending")continue;

      stats.processed+=1;
      const institution=institutionBySlug.get(submission.universitySlug);
      if(!institution){
        const result={disposition:"rejected",reason:"unknown-university"};
        await archive(file,rejectedRoot,submission,"rejected",result);
        stats.rejected+=1;
        events.push({id:submission.id,universitySlug:submission.universitySlug,...result});
        continue;
      }

      let result;
      try{result=await verifySubmission(submission,institution,auditBySlug.get(submission.universitySlug));}
      catch(error){result={disposition:"retry",reason:error instanceof Error?error.message:"verification-error"};}

      if(result.disposition==="accepted"){
        if(result.candidate.kind==="document")upsert(documents,result.candidate.record,documentKey);
        else if(result.candidate.kind==="portal"){
          upsert(evidence,result.candidate.record,evidenceKey);
          upsert(portalCandidates,result.candidate.record,portalKey);
        }else upsert(evidence,result.candidate.record,evidenceKey);
        await archive(file,acceptedRoot,submission,"accepted",result);
        stats.accepted+=1;
      }else if(result.disposition==="reference"){
        await archive(file,referenceRoot,submission,"reference",result);
        stats.reference+=1;
      }else if(result.disposition==="rejected"){
        await archive(file,rejectedRoot,submission,"rejected",result);
        stats.rejected+=1;
      }else{
        const attempts=Number(submission.attemptCount||0)+1;
        if(attempts>=maxAttempts){
          await archive(file,errorRoot,{...submission,attemptCount:attempts},"error",result);
          stats.error+=1;
        }else{
          await writeJson(file,{...submission,attemptCount:attempts,lastAttemptAt:new Date().toISOString(),lastError:result.reason});
          stats.retry+=1;
        }
      }

      events.push({
        id:submission.id,
        universitySlug:submission.universitySlug,
        disposition:result.disposition,
        reason:result.reason,
        finalUrl:result.finalUrl||null,
      });
    }
  }

  await Promise.all(Array.from({length:concurrency},()=>worker()));

  if(stats.accepted>0){
    await Promise.all([
      writeJson(evidenceFile,{...evidenceOutput,evidence,portalCandidates,communityUpdatedAt:new Date().toISOString()}),
      writeJson(documentsFile,{...documentOutput,documents,communityUpdatedAt:new Date().toISOString()}),
    ]);
  }

  if(stats.processed>0){
    await writeJson(reportFile,{
      schemaVersion:1,
      generatedAt:new Date().toISOString(),
      policy:"community-submission-1.0-official-domain-conservative",
      stats,
      remainingPending:Math.max(0,allFiles.length-files.length)+stats.retry,
      events,
    });
  }

  if(process.env.GITHUB_ENV){
    await fs.appendFile(process.env.GITHUB_ENV,`COMMUNITY_PROCESSED=${stats.processed}\nCOMMUNITY_ACCEPTED=${stats.accepted}\n`,"utf8");
  }

  console.log([
    "community submissions complete",
    `processed=${stats.processed}`,
    `accepted=${stats.accepted}`,
    `reference=${stats.reference}`,
    `rejected=${stats.rejected}`,
    `retry=${stats.retry}`,
    `error=${stats.error}`,
  ].join(" | "));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  await main();
}
