import weightsConfig from "@/data/statistics/rtpmi-weights.json";

type WeightKey = keyof typeof weightsConfig.weights;

export const rankingGate = weightsConfig.rankingGate;

export const metricMethods: Array<{
  key: WeightKey;
  label: string;
  weight: number;
  evaluation: string;
  fullScore: string;
}> = [
  {key: "documents", label: "اسناد و مقررات", weight: weightsConfig.weights.documents, evaluation: "۴۵ امتیاز از تنوع نوع سند، ۳۰ امتیاز از تعداد اسناد تأییدشده و ۲۵ امتیاز از داشتن URL مستقیم.", fullScore: "حداقل ۵ نوع، ۸ سند و URL مستقیم برای همه اسناد."},
  {key: "organization", label: "ساختار سازمانی", weight: weightsConfig.weights.organization, evaluation: "وجود ساختار تأییدشده ۴۵ امتیاز پایه می‌دهد؛ تنوع واحدهای هسته پژوهش تا ۵۵ امتیاز دیگر دارد.", fullScore: "ساختار تأییدشده و دست‌کم ۶ نوع واحد هسته‌ای."},
  {key: "library", label: "کتابخانه", weight: weightsConfig.weights.library, evaluation: "واحد رسمی کتابخانه ۷۰ امتیاز و سامانه کتابخانه ۳۰ امتیاز دارد.", fullScore: "هم واحد رسمی و هم سامانه مرتبط تأیید شده باشد."},
  {key: "laboratories", label: "آزمایشگاه‌ها", weight: weightsConfig.weights.laboratories, evaluation: "واحد رسمی آزمایشگاه ۷۰ امتیاز و سامانه آزمایشگاهی ۳۰ امتیاز دارد.", fullScore: "هم واحد رسمی و هم سامانه مرتبط تأیید شده باشد."},
  {key: "systems", label: "سامانه‌ها و خدمات", weight: weightsConfig.weights.systems, evaluation: "۵۰ امتیاز از تنوع دسته، ۳۰ امتیاز از تعداد و ۲۰ امتیاز از رابطه مستقیم سامانه با پرتال/واحد.", fullScore: "۴ دسته مرتبط، ۶ سامانه و رابطه مستقیم برای همه موارد."},
  {key: "industryTech", label: "صنعت و فناوری", weight: weightsConfig.weights.industryTech, evaluation: "واحد ارتباط با صنعت ۴۵، واحد فناوری ۴۵ و سامانه صنعت/نوآوری ۱۰ امتیاز دارد.", fullScore: "هر دو نوع واحد و یک سامانه مرتبط تأیید شده باشد."},
  {key: "dataQuality", label: "کیفیت داده و منبع", weight: weightsConfig.weights.dataQuality, evaluation: "۳۰ امتیاز پایه، ۲۰ امتیاز URL پرتال و هرکدام ۲۵ امتیاز برای تکمیل منبع و تاریخ راستی‌آزمایی اقلام.", fullScore: "URL رسمی و source/date برای همه اقلام ثبت شده باشد."},
  {key: "findability", label: "یافت‌پذیری", weight: weightsConfig.weights.findability, evaluation: "دسترسی به پرتال ۳۵ امتیاز دارد؛ نسبت URLدار بودن واحدها ۲۵، سامانه‌ها ۲۰ و اسناد ۲۰ امتیاز فعال می‌گیرد.", fullScore: "پرتال و تمام اقلام فعال URL مستقیم داشته باشند."},
];

export const scoringStages = [
  {number: "۰۱", title: "حل هویت پرتال", text: "ابتدا باید پرتال رسمی مستقیم معاونت پژوهشی و فناوری از وب‌سایت عمومی دانشگاه تفکیک شود."},
  {number: "۰۲", title: "ثبت شواهد ۷ بُعد", text: "هر بُعد outcome مستقل و منبع نسخه‌بندی‌شده دارد؛ «حل‌نشده» به معنی نبود قابلیت نیست."},
  {number: "۰۳", title: "ساخت ۸ نمره ۰ تا ۱۰۰", text: "اقلام تأییدشده مانند واحد، سامانه، سند، URL منبع و تاریخ بازبینی به نمره هر مؤلفه تبدیل می‌شوند."},
  {number: "۰۴", title: "دروازه انتشار رتبه", text: "فقط پرتال مستقیم با پوشش حداقل ۷۵٪ و اطمینان حداقل ۶۵٪ وارد جدول رتبه می‌شود."},
];

export function weightPercent(weight: number) {
  return `${Math.round(weight * 100).toLocaleString("fa-IR")}٪`;
}
