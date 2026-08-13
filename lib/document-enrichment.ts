export type EnrichedPublicDocument = Record<string, any> & {
  originalTitle: string;
  displayTitle: string;
  displayType: string;
  displayTopic: string;
  displayFileName: string | null;
  titleSource: "original" | "filename" | "context";
};

const GENERIC_TITLES = new Set([
  "",
  "سند",
  "سند پژوهشی",
  "فایل",
  "دانلود",
  "دانلود فایل",
  "دریافت فایل",
  "مشاهده",
  "مشاهده فایل",
  "فایل پیوست",
  "پیوست",
  "برای دانلود کلیک کنید",
  "اینجا کلیک کنید",
  "document",
  "file",
  "download",
  "download file",
  "view file",
  "attachment",
  "click here",
]);

const DATABASE_NAMES: Record<string, string> = {
  springer: "Springer",
  ieee: "IEEE",
  sid: "SID",
  irandoc: "IranDoc",
  scopus: "Scopus",
  proquest: "ProQuest",
  wos: "Web of Science",
  "web of science": "Web of Science",
};

const TOKEN_MAP: Record<string, string> = {
  pajohesh: "پژوهش",
  pajoheshi: "پژوهشی",
  tajhizat: "تجهیزات",
  amozeshi: "آموزشی",
  rahnama: "راهنما",
  jostejo: "جستجو",
  ketabkhaneh: "کتابخانه",
  ketabkhane: "کتابخانه",
  library: "کتابخانه",
  moghararat: "مقررات",
  sharayet: "شرایط",
  ozviyat: "عضویت",
  saat: "ساعت",
  kari: "کاری",
  morrefi: "معرفی",
  hamaayesh: "همایش",
  sanaye: "صنایع",
  madani: "معدنی",
  faslname: "فصلنامه",
  khabari: "خبری",
  akhlaq: "اخلاق",
  proposal: "پروپوزال",
  thesis: "پایان‌نامه",
  dissertation: "رساله",
  journal: "نشریه",
  journals: "نشریات",
  publication: "انتشارات",
  publications: "انتشارات",
  laboratory: "آزمایشگاه",
  lab: "آزمایشگاه",
  research: "پژوهش",
  grant: "گرنت",
  innovation: "نوآوری",
  industry: "صنعت",
  patent: "اختراع",
  form: "فرم",
  guideline: "راهنما",
  regulation: "آیین‌نامه",
};

const JUNK_STEMS =
  /^(?:file|document|download|attachment|index|default|new|final|scan|img|image|pdf|doc|untitled|\d+)$/i;

function normalize(value: unknown) {
  return String(value ?? "")
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: unknown) {
  return normalize(value).toLowerCase();
}

function decodeSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function fileNameFromUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    const part = url.pathname.split("/").filter(Boolean).at(-1);
    return part ? decodeSafe(part) : "";
  } catch {
    return "";
  }
}

function rawFileName(record: any) {
  return normalize(
    record?.fileName ||
    fileNameFromUrl(record?.url) ||
    fileNameFromUrl(record?.sourceUrl)
  );
}

function fileStem(fileName: string) {
  return normalize(
    fileName
      .replace(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|rtf|odt)$/i, "")
      .replace(/[_+]+/g, " ")
      .replace(/-{2,}/g, " ")
  );
}

function isGenericTitle(value: unknown) {
  const key = normalizeKey(value);

  return (
    GENERIC_TITLES.has(key) ||
    /^(?:دانلود|دریافت|مشاهده)\s*(?:فایل|سند)?$/u.test(key) ||
    /^(?:file|document|download|attachment)(?:\s+\d+)?$/i.test(key)
  );
}

function looksMostlyLatin(value: string) {
  const latin = (value.match(/[a-z]/gi) || []).length;
  const persian = (value.match(/[\u0600-\u06ff]/g) || []).length;

  return latin >= 4 && latin > persian * 2;
}

function humanizeStem(stem: string) {
  const clean = normalize(
    stem
      .replace(/([a-z])(\d+)$/i, "$1")
      .replace(/[-_]+/g, " ")
  );

  if (!clean || JUNK_STEMS.test(clean)) {
    return "";
  }

  const database =
    DATABASE_NAMES[clean.toLowerCase()];

  if (database) {
    return database;
  }

  const tokens = clean.split(/\s+/);
  const mapped = tokens.map((token) => {
    const key = token.toLowerCase();
    return TOKEN_MAP[key] || token;
  });

  return normalize(mapped.join(" "))
    .replace(/راهنما\s+جستجو/g, "راهنمای جستجو")
    .replace(/راهنما\s+کتابخانه/g, "راهنمای کتابخانه");
}

function evidenceText(record: any, candidateTitle: string) {
  return normalizeKey([
    candidateTitle,
    record?.title,
    record?.nameFa,
    record?.topic,
    record?.taxonomy,
    record?.type,
    record?.label,
    record?.claim,
    record?.fileName,
    record?.url,
    record?.sourceUrl,
    record?.parentUrl,
  ].filter(Boolean).join(" "));
}

function inferTopic(record: any, title: string) {
  const text = evidenceText(record, title);

  if (/اخلاق\s*پژوهش|کمیته\s*اخلاق|\bresearch ethics\b/i.test(text)) {
    return "اخلاق پژوهش";
  }

  if (/پایان[\s‌-]*نامه|رساله|\bthesis\b|\bdissertation\b/i.test(text)) {
    return "پایان‌نامه و رساله";
  }

  if (/آزمایشگاه|تجهیزات\s*پژوهشی|\blab\b|\blaborator/i.test(text)) {
    return "آزمایشگاه و تجهیزات پژوهشی";
  }

  if (/کتابخانه|راهنمای?\s*جستجو|springer|ieee|irandoc|\bsid\b|scopus|proquest|web\s*of\s*science/i.test(text)) {
    return "کتابخانه و منابع علمی";
  }

  if (/نشریه|مجله|انتشارات|\bjournal\b|\bpublication/i.test(text)) {
    return "انتشارات و نشریات";
  }

  if (/صنعت|فناور|نوآور|مالکیت\s*فکری|اختراع|دانش[\s‌-]*بنیان|مرکز\s*رشد|پارک\s*علم|\bindustry\b|\btechnology\b|\binnovation\b|\bpatent\b/i.test(text)) {
    return "صنعت، فناوری و مالکیت فکری";
  }

  if (/گرنت|پژوهانه|طرح[\s‌-]*(?:ها(?:ی)?[\s‌-]*)?(?:پژوهشی|تحقیقاتی)|پروپوزال|\bgrant\b|\bproposal\b/i.test(text)) {
    return "طرح‌ها، گرنت و پژوهانه";
  }

  if (/آیین[\s‌-]*نامه|مقررات|دستورالعمل|شیوه[\s‌-]*نامه|فرم|راهنما|\bregulation\b|\bguideline\b|\bform\b/i.test(text)) {
    return "اسناد و مقررات پژوهشی";
  }

  const current = normalize(record?.topic || record?.category);

  if (
    current &&
    current !== "سایر" &&
    current.toLowerCase() !== "other"
  ) {
    return current;
  }

  return "سایر اسناد پژوهشی";
}

function inferType(record: any, title: string) {
  const text = evidenceText(record, title);

  if (/آیین[\s‌-]*نامه|\bregulation\b/i.test(text)) {
    return "آیین‌نامه";
  }

  if (/فرم|الگو|\bform\b|\btemplate\b/i.test(text)) {
    return "فرم/الگو";
  }

  if (/شیوه[\s‌-]*نامه|دستورالعمل|\bguideline\b|\bprocedure\b/i.test(text)) {
    return "شیوه‌نامه/دستورالعمل";
  }

  if (/راهنما|\bguide\b|\bmanual\b/i.test(text)) {
    return "راهنما";
  }

  if (/گزارش|\breport\b/i.test(text)) {
    return "گزارش";
  }

  if (/نشریه|مجله|\bjournal\b|\bpublication\b/i.test(text)) {
    return "نشریه/انتشارات";
  }

  if (/springer|ieee|irandoc|\bsid\b|scopus|proquest|web\s*of\s*science/i.test(text)) {
    return "منبع علمی";
  }

  const current = normalize(record?.type);

  if (
    current &&
    !["سند", "فایل", "document", "file"].includes(
      current.toLowerCase()
    )
  ) {
    return current;
  }

  return "سند";
}

function contextFallback(topic: string, fileName: string) {
  const extension =
    fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase();

  const format =
    extension && extension !== "HTML"
      ? `فایل ${extension}`
      : "سند";

  const labels: Record<string, string> = {
    "آزمایشگاه و تجهیزات پژوهشی": "آزمایشگاه پژوهشی",
    "کتابخانه و منابع علمی": "کتابخانه و منابع علمی",
    "انتشارات و نشریات": "انتشارات و نشریات",
    "صنعت، فناوری و مالکیت فکری": "صنعت و فناوری",
    "پایان‌نامه و رساله": "پایان‌نامه و رساله",
    "اخلاق پژوهش": "اخلاق پژوهش",
    "طرح‌ها، گرنت و پژوهانه": "طرح و گرنت پژوهشی",
    "اسناد و مقررات پژوهشی": "مقررات پژوهشی",
  };

  return `${format} ${labels[topic] || "پژوهشی"}`;
}

export function enrichPublicDocument(
  record: Record<string, any>
): EnrichedPublicDocument {
  const originalTitle = normalize(
    record?.title || record?.nameFa
  );

  const fileName = rawFileName(record);
  const stem = fileStem(fileName);
  const humanFileTitle = humanizeStem(stem);

  let displayTitle = originalTitle;
  let titleSource: EnrichedPublicDocument["titleSource"] =
    "original";

  if (
    isGenericTitle(originalTitle) ||
    !originalTitle
  ) {
    if (humanFileTitle) {
      displayTitle = humanFileTitle;
      titleSource = "filename";
    }
  } else if (
    looksMostlyLatin(originalTitle) &&
    humanFileTitle &&
    humanFileTitle !== originalTitle
  ) {
    displayTitle = humanFileTitle;
    titleSource = "filename";
  }

  const preliminaryTopic =
    inferTopic(record, displayTitle);

  if (
    !displayTitle ||
    isGenericTitle(displayTitle) ||
    JUNK_STEMS.test(displayTitle)
  ) {
    displayTitle = contextFallback(
      preliminaryTopic,
      fileName
    );
    titleSource = "context";
  }

  const displayTopic =
    inferTopic(record, displayTitle);

  const displayType =
    inferType(record, displayTitle);

  return {
    ...record,
    originalTitle,
    displayTitle,
    displayType,
    displayTopic,
    displayFileName:
      fileName || null,
    titleSource,
    title: displayTitle,
    type: displayType,
    topic: displayTopic,
  };
}
