const HARD_RULES = [
  {
    id: "student-housing",
    label: "خوابگاه/اسکان دانشجویی",
    pattern:
      /خوابگاه|اسکان\s*دانشجوی(?:ی|ان)|ثبت\s*نام\s*خوابگاه|\bkhabg(?:ah|hah)\b|\b(?:student\s+housing|dormitory|dormitories|dorm\s+application)\b/iu,
  },
  {
    id: "student-loan-welfare",
    label: "وام و رفاه دانشجویی",
    pattern:
      /وام\s*(?:دانشجویی|تحصیلی|ضروری|ودیعه\s*مسکن|شهریه)|انواع\s*وام|مبلغ\s*وام|زمانبندی\s*وام|صندوق\s*رفاه|پرتال\s*دانشجویی\s*صندوق\s*رفاه|اداره\s*رفاه\s*دانشجویان|امور\s*رفاهی\s*دانشجویان|تسهیلات\s*رفاهی\s*دانشجویان|کار\s*دانشجویی|\bvam(?:\.|\/|\s|$)|\bswf\.ir\b|\b(?:student\s+loan|student\s+welfare(?:\s+fund)?|student\s+employment)\b/iu,
  },
  {
    id: "student-food",
    label: "تغذیه/سلف دانشجویی",
    pattern:
      /تغذیه\s*(?:دانشجویی|دانشجویان)|سلف\s*(?:سرویس)?|رزرو\s*غذا|ژتون\s*غذا|کارت\s*تغذیه|\bghaza\b|\/food\/|\b(?:meal\s+(?:reservation|plan)|student\s+cafeteria|cafeteria)\b/iu,
  },
  {
    id: "student-portal",
    label: "پرتال و فرم‌های عمومی دانشجویی",
    pattern:
      /پرتال\s*دانشجویی|فرم\s*مشخصات\s*دانشجویان|تعهد[\s‌-]*نامه\s*دانشجویی|سند\s*تعهد\s*نامه\s*دانشجویی|\bstudent\s+portal\b/iu,
  },
  {
    id: "student-registration-admission",
    label: "ثبت‌نام/پذیرش آموزشی",
    pattern:
      /ثبت\s*نام\s*پذیرفته\s*شدگان|راهنمای\s*ثبت\s*نام\s*الکترونیک|ثبت\s*نام\s*الکترونیک|تکمیل\s*ظرفیت|\bsabt\s*nam\b|\btakmil(?:\d|\s|$)|\b(?:student\s+enrollment|accepted\s+students?|admission\s+registration)\b/iu,
  },
  {
    id: "course-exam-curriculum",
    label: "امتحان/چارت/برنامه آموزشی",
    pattern:
      /برنامه\s*(?:زمانبندی\s*)?برگزاری\s*امتحانات|برنامه\s*امتحانات|کارت\s*ورود\s*به\s*جلسه|زمانبندی\s*امتحانات|چارت\s*درسی|برنامه\s*درسی|انتخاب\s*واحد|حذف\s*و\s*اضافه|\bexam\d*\b|\bchart\s*darsi\b|\b(?:exam\s+schedule|course\s+registration|curriculum|add\s*\/\s*drop)\b/iu,
  },
  {
    id: "educational-only",
    label: "محتوای صرفاً آموزشی",
    pattern:
      /شرایط\s*عمومی\s*و\s*آموزشی|تجهیزات\s*آموزشی|آزمایشگاه\s*آموزشی|\btajhizat\s+amozeshi\b|\b(?:educational\s+equipment|teaching\s+laboratory)\b/iu,
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
    id: "guarantee-general",
    label: "ضمانت/ضامن بدون زمینه پژوهشی",
    pattern:
      /شرایط\s*ضمانت|تعداد\s*ضامنین|تعداد\s*ضامن|ضامن(?:ین)?|\bguarantor\b/iu,
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
  {
    id: "general-newsletter",
    label: "خبرنامه/فصلنامه عمومی",
    pattern:
      /فصلنامه\s*خبری|خبرنامه|\bnewsletter\b/iu,
  },
];

const STRONG_RESEARCH_SIGNAL =
  /پژوهش|پژوهشی|پژوهشگر|پژوهانه|گرنت|طرح\s*پژوهشی|طرح\s*تحقیقاتی|تحقیقاتی|پایان[\s‌-]*نامه|رساله|پروپوزال|اخلاق\s*پژوهش|کمیته\s*اخلاق|نشریه\s*علمی|مجله\s*علمی|مقاله\s*علمی|انتشارات\s*علمی|آزمایشگاه|تجهیزات\s*پژوهشی|فناور|نوآور|صنعت|مالکیت\s*فکری|اختراع|دانش[\s‌-]*بنیان|مرکز\s*رشد|پارک\s*علم|فرصت\s*مطالعاتی|پسادکتری|پسا\s*دکتری|\bpajohesh(?:i)?\b|\b(?:research|researcher|thesis|dissertation|proposal|journal|publication|laboratory|technology|innovation|industry|patent|intellectual\s+property|postdoc|postdoctoral|grant)\b/iu;

const SCHOLARLY_RESOURCE_SIGNAL =
  /کتابخانه|مرکز\s*اسناد|پایگاه\s*(?:اطلاعاتی|علمی)|راهنمای\s*جستجو|جستجو\s*در\s*منابع|کتابخانه\s*دیجیتال|\bspringer\b|\bieee\b|\birandoc\b|\bsid\b|\bscopus\b|\bproquest\b|\bscience\s*direct\b|\bweb\s+of\s+science\b|\bendnote\b|\bmendeley\b|\bzotero\b/iu;

const APPROVED_RESEARCH_PATH =
  /\/(?:research|researches|pajohesh|pajoheshi|lab|labs|laboratory|library|ketabkhaneh|journal|journals|publication|publications|thesis|dissertation|innovation|industry|technology)(?:\/|$)/iu;

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

export function semanticRecordText(record) {
  if (!record || typeof record !== "object") {
    return normalizeScopeText(record);
  }

  return normalizeScopeText(
    [
      record.title,
      record.nameFa,
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

export function scopeRecordText(record) {
  if (!record || typeof record !== "object") {
    return normalizeScopeText(record);
  }

  return normalizeScopeText(
    [
      semanticRecordText(record),
      record.topic,
      record.type,
      record.taxonomy,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function isCrawlerDiscoveredDocument(record) {
  return Boolean(
    record &&
      typeof record === "object" &&
      (
        record.discoveredBy ===
          "research-deep-discovery" ||
        Number.isFinite(
          Number(record.discoveryConfidence)
        ) ||
        String(record.id || "").includes(
          "-discovery-document-"
        )
      )
  );
}

export function hasExplicitResearchSignal(record) {
  const text = semanticRecordText(record);

  return (
    STRONG_RESEARCH_SIGNAL.test(text) ||
    SCHOLARLY_RESOURCE_SIGNAL.test(text) ||
    APPROVED_RESEARCH_PATH.test(text)
  );
}

function candidateUrls(record) {
  return [
    record?.parentUrl,
    record?.sourcePage,
    record?.url,
    record?.sourceUrl,
  ].filter(Boolean);
}

function pathWithinRoot(candidate, root) {
  try {
    const candidateUrl = new URL(candidate);
    const rootUrl = new URL(root);

    const candidateHost = candidateUrl.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const rootHost = rootUrl.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (candidateHost !== rootHost) {
      return false;
    }

    const rootPath =
      rootUrl.pathname.replace(/\/+$/, "") || "/";

    if (rootPath === "/") {
      return true;
    }

    const candidatePath =
      candidateUrl.pathname.replace(/\/+$/, "") || "/";

    return (
      candidatePath === rootPath ||
      candidatePath.startsWith(`${rootPath}/`)
    );
  } catch {
    return false;
  }
}

export function isWithinTrustedResearchRoot(
  record,
  researchRoots = []
) {
  if (!researchRoots.length) {
    return false;
  }

  return candidateUrls(record).some(
    (candidate) =>
      researchRoots.some((root) =>
        pathWithinRoot(candidate, root)
      )
  );
}

export function classifyResearchDocumentScope(
  record,
  options = {}
) {
  const text = scopeRecordText(record);
  const semanticText = semanticRecordText(record);

  for (const rule of HARD_RULES) {
    const match = text.match(rule.pattern);

    if (match) {
      return {
        keep: false,
        reason: rule.id,
        reasonFa: rule.label,
        matched: match[0],
        strength: "hard",
        evidenceBasis: null,
      };
    }
  }

  const explicitResearch =
    hasExplicitResearchSignal(record);

  for (const rule of SOFT_RULES) {
    const match = text.match(rule.pattern);

    if (match && !explicitResearch) {
      return {
        keep: false,
        reason: rule.id,
        reasonFa: rule.label,
        matched: match[0],
        strength: "soft",
        evidenceBasis: null,
      };
    }
  }

  const researchRoots =
    Array.isArray(options.researchRoots)
      ? options.researchRoots
      : [];

  const trustedResearchContext =
    isWithinTrustedResearchRoot(
      record,
      researchRoots
    );

  const requirePositive =
    options.requirePositive ??
    isCrawlerDiscoveredDocument(record);

  if (
    requirePositive &&
    !explicitResearch &&
    !trustedResearchContext
  ) {
    return {
      keep: false,
      reason: "unproven-research-scope",
      reasonFa:
        "ارتباط پژوهشی/فناوری اثبات نشده",
      matched:
        String(
          record?.title ||
          record?.nameFa ||
          record?.fileName ||
          ""
        ).slice(0, 160) || null,
      strength: "positive-evidence-required",
      evidenceBasis: null,
    };
  }

  return {
    keep: true,
    reason: null,
    reasonFa: null,
    matched: null,
    strength: null,
    evidenceBasis:
      explicitResearch
        ? "explicit-research-signal"
        : trustedResearchContext
          ? "trusted-research-root"
          : "curated-existing-record",
  };
}

export function isResearchRelevantDocument(
  record,
  options = {}
) {
  return classifyResearchDocumentScope(
    record,
    options
  ).keep;
}

export function canonicalScopeUrl(value) {
  try {
    const url = new URL(String(value ?? ""));

    if (
      !["http:", "https:"].includes(
        url.protocol
      )
    ) {
      return null;
    }

    url.hash = "";
    url.hostname = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (url.pathname.length > 1) {
      url.pathname =
        url.pathname.replace(/\/+$/, "");
    }

    const params = [
      ...url.searchParams.entries(),
    ]
      .filter(
        ([key]) =>
          !key
            .toLowerCase()
            .startsWith("utm_") &&
          !TRACKING_PARAMS.has(
            key.toLowerCase()
          )
      )
      .sort(
        (
          [aKey, aValue],
          [bKey, bValue]
        ) =>
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
