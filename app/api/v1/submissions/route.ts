import {createHash,randomUUID} from "node:crypto";
import {isIP} from "node:net";

import institutions from "@/data/isc/institutions.json";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;

const CATEGORY_HINTS=new Set([
  "unknown",
  "portalIdentity",
  "organization",
  "libraryDocuments",
  "laboratories",
  "industryTechnology",
  "systemsServices",
  "documentsRegulations",
]);

const BLOCKED_HOSTS=[
  "t.me",
  "telegram.me",
  "telegram.org",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
];

const TRACKING_PARAMS=new Set([
  "fbclid",
  "gclid",
  "yclid",
  "mc_cid",
  "mc_eid",
]);

const UNIVERSITY_SLUGS=new Set(
  (institutions as Array<{slug:string}>).map((item)=>item.slug)
);

type SubmissionBody={
  universitySlug?:unknown;
  url?:unknown;
  description?:unknown;
  categoryHint?:unknown;
  website?:unknown;
};

type GitHubContentItem={
  name?:string;
  type?:string;
};

function json(data:unknown,status=200){
  return Response.json(data,{
    status,
    headers:{
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff",
    },
  });
}

function integerEnv(name:string,fallback:number,min:number,max:number){
  const parsed=Number(process.env[name]??fallback);
  if(!Number.isInteger(parsed))return fallback;
  return Math.min(max,Math.max(min,parsed));
}

function cleanText(value:unknown,max:number){
  return String(value??"")
    .replace(/[\u0000-\u001F\u007F]/g," ")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,max);
}

function hostMatches(host:string,base:string){
  return host===base||host.endsWith(`.${base}`);
}

function isBlockedHost(hostname:string){
  const host=hostname.toLowerCase().replace(/^www\./,"");
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))return true;
  if(isIP(host))return true;
  return BLOCKED_HOSTS.some((blocked)=>hostMatches(host,blocked));
}

function canonicalSubmittedUrl(value:unknown){
  const raw=String(value??"").trim();
  if(raw.length<10||raw.length>2048)throw new Error("invalid-url");

  let url:URL;
  try{url=new URL(raw);}catch{throw new Error("invalid-url");}

  if(!["http:","https:"].includes(url.protocol))throw new Error("invalid-url");
  if(url.username||url.password)throw new Error("invalid-url");

  url.hostname=url.hostname.toLowerCase().replace(/^www\./,"");
  if(isBlockedHost(url.hostname))throw new Error("blocked-url");
  url.hash="";
  if(url.pathname.length>1)url.pathname=url.pathname.replace(/\/+$/,"");

  const params=[...url.searchParams.entries()]
    .filter(([key])=>{
      const normalized=key.toLowerCase();
      return !normalized.startsWith("utm_")&&!TRACKING_PARAMS.has(normalized);
    })
    .sort(([ak,av],[bk,bv])=>ak.localeCompare(bk)||av.localeCompare(bv));

  url.search="";
  for(const [key,item] of params)url.searchParams.append(key,item);

  return url.toString();
}

function allowedOrigin(request:Request){
  const origin=request.headers.get("origin");
  if(!origin)return process.env.NODE_ENV!=="production";

  const allowed=new Set<string>();
  try{allowed.add(new URL(request.url).origin);}catch{}
  try{
    if(process.env.NEXT_PUBLIC_SITE_URL)allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  }catch{}

  if(process.env.NODE_ENV!=="production"){
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }

  return allowed.has(origin);
}

function apiPath(pathname:string){
  return pathname.split("/").map(encodeURIComponent).join("/");
}

function githubConfig(){
  const token=process.env.GITHUB_SUBMISSION_TOKEN?.trim();
  const repository=(process.env.GITHUB_SUBMISSION_REPOSITORY||"Hhhkarimi/ResearchPortal").trim();
  const branch=(process.env.GITHUB_SUBMISSION_BRANCH||"main").trim();
  const salt=process.env.COMMUNITY_SUBMISSION_IP_SALT?.trim();

  if(!token||!repository.includes("/")||!branch||!salt){
    throw new Error("submission-service-not-configured");
  }

  return {token,repository,branch,salt};
}

async function githubRequest(
  config:ReturnType<typeof githubConfig>,
  pathname:string,
  init:RequestInit={}
){
  const headers=new Headers(init.headers);
  headers.set("Accept","application/vnd.github+json");
  headers.set("Authorization",`Bearer ${config.token}`);
  headers.set("X-GitHub-Api-Version","2022-11-28");
  headers.set("User-Agent","research-portal-community-submissions");

  return fetch(`https://api.github.com/repos/${config.repository}/contents/${apiPath(pathname)}`,{
    ...init,
    cache:"no-store",
    headers,
  });
}

function clientFingerprint(request:Request,day:string,salt:string){
  const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip=forwarded||request.headers.get("x-real-ip")?.trim()||"unknown";
  return createHash("sha256").update(`${day}|${ip}|${salt}`).digest("hex").slice(0,20);
}

async function listDayFiles(config:ReturnType<typeof githubConfig>,directory:string){
  const response=await githubRequest(config,directory,{method:"GET"});
  if(response.status===404)return [] as GitHubContentItem[];
  if(!response.ok)throw new Error(`github-list-${response.status}`);

  const value=await response.json();
  return Array.isArray(value)?value as GitHubContentItem[]:[];
}

async function createSubmissionFile(
  config:ReturnType<typeof githubConfig>,
  directory:string,
  fingerprint:string,
  record:Record<string,unknown>
){
  for(let attempt=0;attempt<2;attempt+=1){
    const fileId=randomUUID();
    const filename=`${fingerprint}-${fileId}.json`;
    const pathname=`${directory}/${filename}`;
    const body={
      message:`chore(submissions): add community source ${String(record.id).slice(0,12)}`,
      content:Buffer.from(`${JSON.stringify(record,null,2)}\n`,"utf8").toString("base64"),
      branch:config.branch,
    };

    const response=await githubRequest(config,pathname,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
    });

    if(response.ok)return;
    if(response.status===409&&attempt===0)continue;
    if(response.status===422)throw new Error("github-rejected-submission");
    throw new Error(`github-create-${response.status}`);
  }

  throw new Error("github-create-conflict");
}

export async function POST(request:Request){
  if(!allowedOrigin(request)){
    return json({ok:false,error:"درخواست از مبدأ مجاز ارسال نشده است."},403);
  }

  const contentType=request.headers.get("content-type")||"";
  if(!contentType.toLowerCase().includes("application/json")){
    return json({ok:false,error:"نوع محتوای درخواست معتبر نیست."},415);
  }

  const declaredLength=Number(request.headers.get("content-length")||0);
  if(Number.isFinite(declaredLength)&&declaredLength>8192){
    return json({ok:false,error:"حجم درخواست بیش از حد مجاز است."},413);
  }

  let raw="";
  try{raw=await request.text();}catch{return json({ok:false,error:"خواندن درخواست ممکن نشد."},400);}
  if(Buffer.byteLength(raw,"utf8")>8192){
    return json({ok:false,error:"حجم درخواست بیش از حد مجاز است."},413);
  }

  let body:SubmissionBody;
  try{body=JSON.parse(raw) as SubmissionBody;}catch{return json({ok:false,error:"ساختار درخواست معتبر نیست."},400);}

  // Honeypot: bots receive a normal-looking response but no repository write occurs.
  if(cleanText(body.website,200)){
    return json({ok:true,id:randomUUID(),message:"پیشنهاد شما دریافت شد و پس از بررسی خودکار وارد چرخه ارزیابی می‌شود."},202);
  }

  const universitySlug=cleanText(body.universitySlug,80);
  if(!UNIVERSITY_SLUGS.has(universitySlug)){
    return json({ok:false,error:"دانشگاه انتخاب‌شده معتبر نیست."},400);
  }

  const description=cleanText(body.description,1200);
  if(description.length<20){
    return json({ok:false,error:"لطفاً حداقل ۲۰ نویسه درباره کاربرد یا محتوای لینک توضیح دهید."},400);
  }

  const categoryHint=cleanText(body.categoryHint,80)||"unknown";
  if(!CATEGORY_HINTS.has(categoryHint)){
    return json({ok:false,error:"دسته‌بندی انتخاب‌شده معتبر نیست."},400);
  }

  let submittedUrl:string;
  try{submittedUrl=canonicalSubmittedUrl(body.url);}catch(error){
    const message=error instanceof Error&&error.message==="blocked-url"
      ?"این دامنه برای ورود خودکار به چرخه شواهد مجاز نیست."
      :"لینک واردشده معتبر نیست.";
    return json({ok:false,error:message},400);
  }

  let config:ReturnType<typeof githubConfig>;
  try{config=githubConfig();}catch{
    return json({ok:false,error:"سرویس ثبت منبع در حال حاضر پیکربندی نشده است."},503);
  }

  const now=new Date();
  const day=now.toISOString().slice(0,10);
  const directory=`data/community-submissions/pending/${day}`;
  const fingerprint=clientFingerprint(request,day,config.salt);
  const perIpLimit=integerEnv("COMMUNITY_DAILY_PER_IP",5,1,20);
  const dailyLimit=integerEnv("COMMUNITY_DAILY_TOTAL",200,10,500);

  try{
    const files=await listDayFiles(config,directory);
    const fileNames=files.filter((item)=>item.type==="file"&&typeof item.name==="string").map((item)=>item.name as string);

    if(fileNames.length>=dailyLimit){
      return json({ok:false,error:"ظرفیت دریافت پیشنهادهای امروز تکمیل شده است. لطفاً فردا دوباره تلاش کنید."},429);
    }

    const ownCount=fileNames.filter((name)=>name.startsWith(`${fingerprint}-`)).length;
    if(ownCount>=perIpLimit){
      return json({ok:false,error:"سقف ارسال روزانه برای این اتصال تکمیل شده است."},429);
    }

    const id=randomUUID();
    const record={
      schemaVersion:1,
      id,
      universitySlug,
      url:submittedUrl,
      description,
      categoryHint,
      submittedAt:now.toISOString(),
      status:"pending",
      source:"community",
      trusted:false,
    };

    await createSubmissionFile(config,directory,fingerprint,record);

    return json({
      ok:true,
      id,
      message:"پیشنهاد شما ثبت شد. لینک ابتدا به‌صورت خودکار بررسی می‌شود و فقط پس از عبور از پاک‌سازی و اعتبارسنجی وارد داده رسمی خواهد شد.",
    },201);
  }catch(error){
    console.error("community submission error",error);
    return json({ok:false,error:"ثبت پیشنهاد در مخزن انجام نشد. لطفاً بعداً دوباره تلاش کنید."},502);
  }
}
