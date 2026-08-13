import {PUBLIC_DIMENSIONS} from "@/lib/public-model";

type Outcome = {
  dimension: string;
  status: "verified" | "observed-reference" | "restricted" | "unresolved";
  sourceCount?: number;
  reviewedAt?: string;
  verificationBasis?: string;
  sources?: Array<{url?: string; claim?: string}>;
};

const labels = new Map<string, string>(PUBLIC_DIMENSIONS);
const requiredPublicArtifact: Record<string, string> = {
  portalIdentity: "یک صفحه فرود رسمی با عنوان صریح «معاونت پژوهشی و فناوری»، دامنه دانشگاه و اطلاعات تماس",
  organization: "چارت سازمانی معاونت همراه نام واحدها، مسئولیت هر واحد و راه ارتباطی",
  libraryDocuments: "صفحه پایدار کتابخانه/مرکز اسناد همراه خدمات، دسترسی به فهرست و اطلاعات تماس",
  laboratories: "فهرست آزمایشگاه‌ها همراه تجهیزات شاخص، مسئول آزمایشگاه و مسیر درخواست خدمت",
  industryTechnology: "صفحه ارتباط با صنعت و فناوری همراه خدمات، مالکیت فکری، فرم‌ها و راه تماس",
  systemsServices: "کاتالوگ سامانه‌های پژوهشی همراه نام رسمی، مخاطب، کارکرد و لینک ورود هر سامانه",
  documentsRegulations: "مخزن اسناد و مقررات با عنوان رسمی، تاریخ/نسخه و لینک مستقیم فایل‌ها",
};

const sourceHost = (item: Outcome) => {
  try {
    return new URL(item.sources?.[0]?.url || "").hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const gapAction = (item: Outcome) => {
  const artifact = requiredPublicArtifact[item.dimension] || "یک منبع عمومی مستقیم و قابل استناد";
  const host = sourceHost(item);
  const reviewed = item.reviewedAt ? ` در بازبینی ${item.reviewedAt}` : " در Snapshot حاضر";
  if (item.status === "unresolved") {
    return `${artifact} منتشر و از صفحه اصلی پرتال معاونت پیوند داده شود؛${reviewed} منبع عمومی کافی برای این بُعد حل نشد.`;
  }
  if (item.status === "observed-reference") {
    return `${artifact} تکمیل شود؛ ${host ? `منبع ${host}` : "منبع فعلی"} فقط ارجاع را ثابت می‌کند و باید انتساب مستقیم به معاونت را روشن کند.`;
  }
  return `${artifact} روی یک مسیر بدون ورود و محدودیت دسترسی قرار گیرد؛ ${host ? `مسیر ثبت‌شده در ${host}` : "مسیر ثبت‌شده"} برای راستی‌آزمایی عمومی پایدار نبود.`;
};

export function buildUniversityInsights({
  outcomes,
  coverage,
  ranking,
  units,
  systems,
  documents,
}: {
  outcomes: Outcome[];
  coverage: number;
  ranking: any;
  units: number;
  systems: number;
  documents: number;
}) {
  const verified = outcomes
    .filter((item) => item.status === "verified")
    .sort((a, b) => (b.sourceCount || 0) - (a.sourceCount || 0));
  const unresolved = outcomes.filter((item) => item.status === "unresolved");
  const observed = outcomes.filter((item) => item.status === "observed-reference");
  const restricted = outcomes.filter((item) => item.status === "restricted");
  const strongest = verified[0];

  const highlights = [
    strongest ? {
      tone: "positive",
      label: "قوی‌ترین رد شواهد",
      title: labels.get(strongest.dimension) || strongest.dimension,
      text: `${(strongest.sourceCount || 0).toLocaleString("fa-IR")} منبع رسمی یکتا برای این بُعد ثبت شده است.`,
    } : {
      tone: "attention",
      label: "رد شواهد",
      title: "هنوز تأیید مستقیم ثبت نشده",
      text: "نتیجه باز به معنی نبود قابلیت نیست؛ منبع عمومی کافی بازیابی نشده است.",
    },
    {
      tone: coverage >= 75 ? "positive" : "attention",
      label: "آمادگی تصمیم",
      title: `${coverage.toLocaleString("fa-IR")}٪ پوشش Evidence`,
      text: ranking
        ? `پرتال با امتیاز ${ranking.score.toLocaleString("fa-IR")} در RTPMI 4.2 رتبه‌پذیر است.`
        : "پوشش یا اطمینان برای انتشار امتیاز RTPMI هنوز کافی نیست.",
    },
    {
      tone: "neutral",
      label: "دامنه عمومی ثبت‌شده",
      title: `${(units + systems + documents).toLocaleString("fa-IR")} قلم قابل رهگیری`,
      text: `${units.toLocaleString("fa-IR")} واحد، ${systems.toLocaleString("fa-IR")} سامانه و ${documents.toLocaleString("fa-IR")} سند در Snapshot حاضر دیده می‌شود.`,
    },
  ];

  const gaps = [
    ...unresolved.map((item) => ({
      dimension: item.dimension,
      title: labels.get(item.dimension) || item.dimension,
      action: gapAction(item),
      status: "unresolved",
    })),
    ...observed.map((item) => ({
      dimension: item.dimension,
      title: labels.get(item.dimension) || item.dimension,
      action: gapAction(item),
      status: "observed-reference",
    })),
    ...restricted.map((item) => ({
      dimension: item.dimension,
      title: labels.get(item.dimension) || item.dimension,
      action: gapAction(item),
      status: "restricted",
    })),
  ].slice(0, 5);

  if (!gaps.length) {
    gaps.push({
      dimension: "maintenance",
      title: "حفظ کیفیت انتشار",
      action: "تاریخ بازبینی، لینک‌های مستقیم و عنوان رسمی اقلام در Snapshot بعدی تازه نگه داشته شود.",
      status: "verified",
    });
  }

  return {highlights, gaps};
}
