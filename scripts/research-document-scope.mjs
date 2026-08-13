const HARD_RULES = [
  {
    id: "student-housing",
    label: "خوابگاه/اسکان دانشجویی",
    pattern:
      /خوابگاه|اسکان\s*دانشجوی(?:ی|ان)|ثبت\s*نام\s*خوابگاه|\b(?:student\s+housing|dormitory|dormitories|dorm\s+application)\b/iu,
  },
  {
    id: "student-loan-welfare",
    label: "وام و رفاه دانشجویی",
    pattern:
      /وام\s*(?:دانشجویی|تحصیلی|ضروری|ودیعه\s*مسکن|شهریه)|صندوق\s*رفاه\s*دانشجویان|اداره\s*رفاه\s*دانشجویان|امور\s*رفاهی\s*دانشجویان|تسهیلات\s*رفاهی\s*دانشجویان|کار\s*دانشجویی|\b(?:student\s+loan|student\s+welfare(?:\s+fund)?|student\s+employment)\b/iu,
  },
  {
    id: "student-food",
    label: "تغذیه/سلف دانشجویی",
    pattern:
      /تغذیه\s*(?:دانشجویی|دانشجویان)|سلف\s*(?:سرویس)?|رزرو\s*غذا|ژتون\s*غذا|کارت\s*تغذیه|\b(?:meal\s+(?:reservation|plan)|student\s+cafeteria|cafeteria)\b/iu,
  },
  {
    id: "student-transport",
    label: "ایاب‌وذهاب/سرویس دانشجویی",
    pattern:
      /ایاب\s*و\s*ذهاب\s*(?:دانشجویان|دانشجویی)?|سرویس\s*(?:دانشجویی|دانشجویان)|\b(?:student\s+(?:transport|shuttle)|campus\s+shuttle)\b/iu,
  },
  {
    id: "student-insurance-card",
    label: "بیمه یا کارت دانشجویی",
    pattern:
      /بیمه\s*دانشجویی|کارت\s*دانشجویی|\b(?:student\s+insurance|student\s+card)\b/iu,
  },
  {
    id: "student-affairs",
    label: "امور دانشجویی",
    pattern:
      /معاونت\s*دانشجویی|مدیریت\s*امور\s*دانشجویی|اداره\s*امور\s*دانشجویی|امور\s*دانشجویی|\bstudent\s+affairs\b/iu,
  },
  {
    id: "student-sports",
    label: "ورزش/تربیت‌بدنی دانشجویی",
    pattern:
      /تربیت\s*بدنی|امور\s*ورزشی\s*دانشجویان|ورزش\s*دانشجویی|\bstudent\s+sports\b/iu,
  },
  {
    id: "student-counseling",
    label: "مشاوره دانشجویی",
    pattern:
      /مرکز\s*مشاوره\s*دانشجویی|مشاوره\s*دانشجویی|\bstudent\s+counsel(?:ing|ling)\b/iu,
  },
  {
    id: "student-discipline-health",
    label: "انضباط/بهداشت دانشجویی",
    pattern:
      /کمیته\s*انضباطی\s*دانشجویان|آیین[\s‌-]*نامه\s*انضباطی\s*دانشجویان|بهداشت\s*دانشجویی|مرکز\s*بهداشت\s*(?:و\s*درمان)?\s*دانشجویان|\b(?:student\s+disciplin(?:e|ary)|student\s+health)\b/iu,
  },
  {
    id: "tuition",
    label: "شهریه",
    pattern:
      /شهریه\s*(?:دانشجویان|دانشجویی|نیمسال|ترم)?|\btuition(?:\s+fee)?s?\b/iu,
  },
  {
    id: "student-council",
    label: "شورای صنفی دانشجویان",
    pattern:
      /شورای\s*صنفی\s*دانشجویان|انتخابات\s*شورای\s*صنفی|\bstudent\s+council\s+election\b/iu,
  },
];

const SOFT_RULES = [
  {
    id: "course-registration",
    label: "انتخاب واحد/حذف و اضافه",
    pattern:
      /انتخاب\s*واحد|حذف\s*و\s*اضافه|\b(?:course\s+registration|add\s*\/\s*drop)\b/iu,
  },
  {
    id: "exam-schedule",
    label: "امتحانات آموزشی",
    pattern:
      /برنامه\s*امتحانات|کارت\s*ورود\s*به\s*جلسه|زمانبندی\s*امتحانات|\bexam\s+schedule\b/iu,
  },
  {
    id: "student-enrollment",
    label: "ثبت‌نام آموزشی دانشجویان",
    pattern:
      /ثبت\s*نام\s*(?:دانشجویان|دانشجوی\s*جدید|ورودی(?:\s*های)?\s*جدید)|\bstudent\s+enrollment\b/iu,
  },
  {
    id: "academic-calendar",
    label: "تقویم آموزشی",
    pattern:
      /تقویم\s*آموزشی|\bacademic\s+calendar\b/iu,
  },
  {
    id: "student-administration",
    label: "امور آموزشی/اداری دانشجو",
    pattern:
      /نقل\s*و\s*انتقال\s*دانشجویان|مهمانی\s*(?:و\s*انتقال)?\s*دانشجو|تسویه\s*حساب\s*دانشجویی|گواهی\s*اشتغال\s*به\s*تحصیل|مرخصی\s*تحصیلی|\b(?:student\s+transfer|leave\s+of\s+absence|enrollment\s+certificate)\b/iu,
  },
  {
    id: "graduation-ceremony",
    label: "مراسم دانش‌آموختگی",
    pattern:
      /جشن\s*دانش\s*آموختگی|مراسم\s*فارغ\s*التحصیلی|\bgraduation\s+ceremony\b/iu,
  },
];

const RESEARCH_SIGNAL =
  /پژوهش|پژوهشی|پژوهشگر|پژوهانه|گرنت|طرح\s*پژوهشی|پایان[\s‌-]*نامه|رساله|پروپوزال|اخلاق\s*پژوهش|نشریه|مجله|مقاله|انتشارات|آزمایشگاه|فناور|نوآور|صنعت|مالکیت\s*فکری|اختراع|دانش[\s‌-]*بنیان|مرکز\s*رشد|پارک\s*علم|فرصت\s*مطالعاتی|پسادکتری|پسا\s*دکتری|\b(?:research|researcher|thesis|dissertation|proposal|journal|publication|laboratory|technology|innovation|industry|patent|intellectual\s+property|postdoc|postdoctoral|grant)\b/iu;

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "yclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeScopeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function valueText(value) {
  const raw = String(value ?? "");
  return `${raw} ${decodeSafe(raw)}`;
}

export function scopeRecordText(record) {
  if (!record || typeof record !== "object") {
    return normalizeScopeText(record);
  }

  return normalizeScopeText(
    [
      record.title,
      record.nameFa,
      record.topic,
      record.type,
      record.taxonomy,
      record.label,
      record.claim,
      record.description,
      record.note,
      record.anchorText,
      record.fileName,
      valueText(record.url),
      valueText(record.sourceUrl),
      valueText(record.parentUrl),
      valueText(record.sourcePage),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function classifyResearchDocumentScope(record) {
  const text = scopeRecordText(record);

  for (const rule of HARD_RULES) {
    const match = text.match(rule.pattern);

    if (match) {
      return {
        keep: false,
        reason: rule.id,
        reasonFa: rule.label,
        matched: match[0],
        strength: "hard",
      };
    }
  }

  const hasResearchSignal =
    RESEARCH_SIGNAL.test(text);

  for (const rule of SOFT_RULES) {
    const match = text.match(rule.pattern);

    if (match && !hasResearchSignal) {
      return {
        keep: false,
        reason: rule.id,
        reasonFa: rule.label,
        matched: match[0],
        strength: "soft",
      };
    }
  }

  return {
    keep: true,
    reason: null,
    reasonFa: null,
    matched: null,
    strength: null,
  };
}

export function isResearchRelevantDocument(record) {
  return classifyResearchDocumentScope(record).keep;
}

export function canonicalScopeUrl(value) {
  try {
    const url = new URL(String(value ?? ""));

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    url.hash = "";
    url.hostname = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    const params = [
      ...url.searchParams.entries(),
    ]
      .filter(
        ([key]) =>
          !key.toLowerCase().startsWith("utm_") &&
          !TRACKING_PARAMS.has(key.toLowerCase())
      )
      .sort(
        ([aKey, aValue], [bKey, bValue]) =>
          aKey.localeCompare(bKey) ||
          aValue.localeCompare(bValue)
      );

    url.search = "";

    for (const [key, item] of params) {
      url.searchParams.append(key, item);
    }

    return url.toString();
  } catch {
    return null;
  }
}
