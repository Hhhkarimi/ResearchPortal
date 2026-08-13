export type ResearchScopeDecision = {
  keep: boolean;
  reason: string | null;
};

const HARD_EXCLUDE =
  /خوابگاه|اسکان\s*دانشجو|وام|صندوق\s*رفاه|رفاه\s*دانشجو|پرتال\s*دانشجویی|تعهد[\s‌-]*نامه\s*دانشجویی|فرم\s*مشخصات\s*دانشجو|ثبت\s*نام\s*پذیرفته|ثبت\s*نام\s*الکترونیک|شرایط\s*عمومی\s*و\s*آموزشی|برنامه\s*(?:زمانبندی\s*)?امتحان|چارت\s*درسی|انتخاب\s*واحد|حذف\s*و\s*اضافه|تغذیه|رزرو\s*غذا|سلف|شهریه|کارت\s*دانشجویی|بیمه\s*دانشجویی|امور\s*دانشجویی|تربیت\s*بدنی|مشاوره\s*دانشجویی|شورای\s*صنفی|نقل\s*و\s*انتقال\s*دانشجو|مرخصی\s*تحصیلی|تسویه\s*حساب\s*دانشجویی|\bkhabg(?:ah|hah)\b|\/food\/|\bghaza\b|\bvam(?:\.|\/|\s|$)|\bswf\.ir\b|\bexam\d*\b|\bchart\s*darsi\b|\bsabt\s*nam\b|\bstudent\s+(?:loan|housing|welfare|portal|affairs|card|insurance|transport)\b|\btuition\b/iu;

const SOFT_EXCLUDE =
  /شرایط\s*ضمانت|تعداد\s*ضامن|ضامن(?:ین)?|تجهیزات\s*آموزشی|آزمایشگاه\s*آموزشی|\btajhizat\s+amozeshi\b|تقویم\s*آموزشی|فصلنامه\s*خبری|خبرنامه|مراسم\s*فارغ\s*التحصیلی/iu;

const POSITIVE =
  /پژوهش|پژوهشی|پژوهشگر|پژوهانه|گرنت|طرح\s*(?:پژوهشی|تحقیقاتی)|پایان[\s‌-]*نامه|رساله|پروپوزال|اخلاق\s*پژوهش|نشریه\s*علمی|مجله\s*علمی|مقاله\s*علمی|انتشارات\s*علمی|آزمایشگاه|تجهیزات\s*پژوهشی|فناور|نوآور|صنعت|مالکیت\s*فکری|اختراع|دانش[\s‌-]*بنیان|مرکز\s*رشد|پارک\s*علم|فرصت\s*مطالعاتی|پسادکتری|کتابخانه|مرکز\s*اسناد|پایگاه\s*(?:اطلاعاتی|علمی)|راهنمای\s*جستجو|\bspringer\b|\bieee\b|\birandoc\b|\bsid\b|\bscopus\b|\bresearch\b|\bthesis\b|\bdissertation\b|\bproposal\b|\bjournal\b|\bpublication\b|\blaborator(?:y|ies)\b|\btechnology\b|\binnovation\b|\bindustry\b|\bpatent\b|\bpostdoc(?:toral)?\b|\bgrant\b/iu;

const POSITIVE_PATH =
  /\/(?:research|pajohesh|pajoheshi|lab|labs|laboratory|library|ketabkhaneh|journal|journals|publication|publications|thesis|innovation|industry|technology)(?:\/|$)/iu;

const GENERIC = new Set([
  "", "سند", "سند پژوهشی", "فایل", "دانلود", "document", "file"
]);

function norm(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\u200c/g," ")
    .replace(/[يى]/g,"ی")
    .replace(/ك/g,"ک")
    .replace(/\s+/g," ")
    .trim();
}

function decoded(v: unknown) {
  const s=String(v??"");
  try { return `${s} ${decodeURIComponent(s)}`; }
  catch { return s; }
}

function semanticText(record:any) {
  const title=norm(record?.title || record?.nameFa);
  return norm([
    GENERIC.has(title) ? "" : title,
    record?.label,
    record?.claim,
    record?.description,
    record?.note,
    record?.anchorText,
    record?.fileName,
    decoded(record?.url),
    decoded(record?.sourceUrl),
    decoded(record?.parentUrl),
    decoded(record?.sourcePage),
  ].filter(Boolean).join(" "));
}

function withinRoot(candidate: unknown, root: unknown) {
  try {
    const a=new URL(String(candidate));
    const b=new URL(String(root));
    const ah=a.hostname.toLowerCase().replace(/^www\./,"");
    const bh=b.hostname.toLowerCase().replace(/^www\./,"");
    if (ah!==bh) return false;
    const bp=b.pathname.replace(/\/+$/,"") || "/";
    const ap=a.pathname.replace(/\/+$/,"") || "/";
    return bp==="/" || ap===bp || ap.startsWith(`${bp}/`);
  } catch { return false; }
}

export function classifyPublicResearchDocument(
  record:any,
  researchRoots:string[]=[]
):ResearchScopeDecision {
  const text=semanticText(record);

  if (HARD_EXCLUDE.test(text))
    return {keep:false,reason:"explicit-non-research"};

  const positive=POSITIVE.test(text) || POSITIVE_PATH.test(text);

  if (SOFT_EXCLUDE.test(text) && !positive)
    return {keep:false,reason:"educational-or-student-context"};

  const trusted=[record?.parentUrl,record?.sourcePage,record?.url,record?.sourceUrl]
    .filter(Boolean)
    .some((u:any)=>researchRoots.some(r=>withinRoot(u,r)));

  if (!positive && !trusted)
    return {keep:false,reason:"research-relevance-unproven"};

  return {keep:true,reason:null};
}

export function isPublicResearchDocument(record:any,researchRoots:string[]=[]){
  return classifyPublicResearchDocument(record,researchRoots).keep;
}
