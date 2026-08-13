# پژوهش منابع رتبه‌بندی بین‌المللی برای پرونده دانشگاه‌ها

تاریخ بررسی: ۱۳ اوت ۲۰۲۶  
دامنه: ۱۱۵ نهاد موجود در `data/isc/institutions.json`  
قاعده منبع: فقط صفحات، داده‌ها، مستندات و شرایط استفاده رسمی ناشران رتبه‌بندی بررسی شده‌اند.

## تصمیم پیشنهادی

برای نسخه production، «رتبه بین‌المللی» نباید یک عدد واحد و بدون نام منبع باشد. در پرونده هر دانشگاه یک بخش مستقل با عنوان «جایگاه در نظام‌های بین‌المللی» نمایش داده شود و هر رکورد این موارد را داشته باشد: نام نظام، ویرایش، مقدار منتشرشده عیناً، تاریخ بازیابی و لینک مستقیم به منبع رسمی.

پیشنهاد اجرایی دو سطح دارد:

1. **منبع خودکار و قابل بازنشر: CWTS Leiden Ranking Open Edition 2025.** نتایج و داده‌های زیربنایی آن CC0 هستند، فایل نتیجه، فایل دانشگاه‌ها، BigQuery و کد منبع رسمی دارد و دانشگاه‌ها را با ROR تعریف می‌کند. با این حال Leiden «رتبه جهانی مرکب» تولید نمی‌کند؛ بنابراین باید یک شاخص نام‌دار مانند `PP(top 10%)` همراه با دوره، حوزه و شیوه شمارش نمایش داده شود، نه عبارتی مانند «رتبه Leiden جهان».
2. **QS، THE و ARWU فقط با مجوز روشن یا قرارداد داده.** تا پیش از دریافت اجازه بازنشر، صفحه هر دانشگاه صرفاً می‌تواند لینک «مشاهده در منبع رسمی» را نشان دهد. scraping دوره‌ای، کپی انبوه جدول یا بازنشر dataset این سه ناشر برای یک pipeline عمومی توصیه نمی‌شود.

این داده‌ها نباید وارد محاسبه RTPMI شوند. RTPMI بلوغ و قابلیت ممیزی پرتال معاونت پژوهشی را می‌سنجد، در حالی که رتبه‌بندی‌های بین‌المللی عمدتاً عملکرد علمی، شهرت، آموزش یا برون‌داد پژوهشی را می‌سنجند. کنار هم نمایش‌دادن مفید است، اما ترکیب امتیازها از نظر روش‌شناسی نادرست است.

## مقایسه منابع رسمی

| نظام | آخرین ویرایش در تاریخ بررسی | شکل مقدار منتشرشده | دسترسی تولیدی | وضعیت بازنشر | نگاشت هویت |
|---|---:|---|---|---|---|
| QS World University Rankings | 2027، منتشرشده در ۱۸ ژوئن ۲۰۲۶؛ بیش از ۱۵۰۰ دانشگاه | رتبه دقیق/مشترک برای برخی رکوردها و بازه یا `1401+` برای برخی دیگر | جدول و پروفایل عمومی؛ دانلود Excel به ثبت‌نام هدایت می‌شود؛ API عمومی مستند پیدا نشد | داده باز نیست؛ شرایط QS محدودیت بازتولید دارد و برای استفاده تجاری تماس با QS را لازم می‌داند | نام انگلیسی، کشور و slug؛ شناسه باز استاندارد مستند در جدول عمومی ندارد |
| THE World University Rankings | 2026؛ تعداد ۲۱۹۱ دانشگاه از ۱۱۵ کشور/قلمرو | فقط ۲۰۰ رتبه نخست دقیق؛ بعد از آن band چون تفاوت امتیازها از نظر آماری معنادار نیست | جدول و پروفایل عمومی؛ dataset کامل محصول قراردادی DataPoints است؛ API عمومی مستند پیدا نشد | داده کامل قراردادی و دارای مجوز محدود است | نام انگلیسی، کشور و slug؛ crosswalk عمومی ROR در جدول دیده نشد |
| ARWU / ShanghaiRanking | 2025؛ بیش از ۲۵۰۰ ارزیابی و ۱۰۰۰ رکورد منتشرشده | رتبه دقیق در بالای جدول و سپس bandهایی مانند `401–500` | جدول عمومی و گزینه Excel؛ داده عمیق‌تر در ARWU Tracker؛ API عمومی مستند پیدا نشد | سایت اثر را copyrighted و All Rights Reserved اعلام می‌کند؛ مجوز داده باز پیدا نشد | نام انگلیسی، کشور و slug؛ ROR عمومی مستند ندارد |
| CWTS Leiden Open Edition | 2025؛ تعداد ۲۸۳۱ دانشگاه | شاخص‌های جداگانه اثر علمی، همکاری و دسترسی باز؛ بدون امتیاز/رتبه مرکب | Excel رسمی، داده زیربنایی، BigQuery و کد منبع | نتایج و داده‌ها CC0؛ کد MIT | ROR به‌صورت رسمی در تعریف دانشگاه و وابستگی‌ها به‌کار می‌رود |

## شواهد رسمی هر منبع

### QS

- [جدول رسمی QS WUR 2027](https://www.topuniversities.com/world-university-rankings) ویرایش ۲۰۲۷ را با تاریخ انتشار ۱۸ ژوئن ۲۰۲۶ و پوشش بیش از ۱۵۰۰ دانشگاه معرفی می‌کند.
- پروفایل‌های رسمی نشان می‌دهند نوع رتبه یکسان نیست: [دانشگاه تهران `=367`](https://www.topuniversities.com/universities/university-tehran)، [دانشگاه صنعتی شریف `=390`](https://www.topuniversities.com/universities/sharif-university-technology)، [دانشگاه علم و صنعت ایران `=504`](https://www.topuniversities.com/universities/iran-university-science-technology)، [دانشگاه شیراز `791–800`](https://www.topuniversities.com/universities/shiraz-university) و [دانشگاه آزاد اسلامی `1401+`](https://www.topuniversities.com/universities/islamic-azad-university). بنابراین مقدار باید عیناً به‌صورت string نگهداری شود؛ midpoint یا رتبه دقیق ساختگی ممنوع است.
- [شرایط استفاده QS](https://www.topuniversities.com/terms-conditions) رتبه‌بندی‌ها و data compilationها را مالکیت فکری QS می‌داند. متن شرایط، استفاده شخصی/غیرتجاری و الزامات انتساب/اجازه را بیان می‌کند و برای استفاده تجاری تماس با QS را لازم می‌داند.
- [صفحه رسمی QS Datasets](https://www.qs.com/solutions/datasets) دسترسی سازمانی به dataset رتبه‌بندی را به‌عنوان محصول و با دعوت به درخواست demo ارائه می‌کند.

نتیجه: QS برای مخاطب شناخته‌شده است، اما منبع ingestion آزاد و بدون قرارداد نیست. اگر مجوز تهیه شد، مقدار نمایشی منتشرشده، edition و URL رسمی ذخیره شود و نام‌ها با crosswalk کنترل‌شده تطبیق داده شوند.

### THE

- [جدول رسمی THE WUR 2026](https://www.timeshighereducation.com/world-university-rankings/latest/world-ranking) پوشش ۲۱۹۱ نهاد در ۱۱۵ کشور و قلمرو را اعلام می‌کند.
- [روش‌شناسی رسمی THE 2026](https://www.timeshighereducation.com/world-university-rankings/methodology) تصریح می‌کند که رتبه و امتیاز دقیق فقط برای ۲۰۰ نهاد نخست نشان داده می‌شود و بعد از آن band به‌کار می‌رود، چون اختلاف امتیازها از نظر آماری معنادار نیست. اعضای یک band نیز هم‌رتبه‌اند و ترتیب الفبایی داخل band رتبه فرعی ایجاد نمی‌کند.
- نمونه‌های رسمی ایران: [دانشگاه تهران `401–500`](https://www.timeshighereducation.com/world-university-rankings/university-tehran)، [دانشگاه علم و صنعت ایران `401–500`](https://www.timeshighereducation.com/world-university-rankings/iran-university-science-and-technology)، [دانشگاه محقق اردبیلی `1001–1200`](https://www.timeshighereducation.com/world-university-rankings/university-mohaghegh-ardabili) و [دانشگاه گیلان `1201–1500`](https://www.timeshighereducation.com/world-university-rankings/university-guilan).
- [THE DataPoints WUR Dashboard](https://www.timeshighereducation.com/our-solutions/data-and-insights/world-university-rankings-dashboard) دسترسی به dataset کامل و امکان download را به‌عنوان سرویس سازمانی ارائه می‌کند. [شرایط DataPoints](https://www.timeshighereducation.com/terms-and-conditions/datapoints) مجوز را محدود، غیرانحصاری و غیرقابل‌انتقال معرفی می‌کند و مالکیت داده را برای THE/مجوزدهندگان نگه می‌دارد.

نتیجه: THE پوشش مناسبی دارد، ولی band باید عیناً حفظ شود. استفاده خودکار و بازنشر dataset کامل نیازمند قرارداد سازگار با پرتال عمومی است.

### ARWU / ShanghaiRanking

- [جدول رسمی ARWU 2025](https://www.shanghairanking.com/rankings/arwu/2025) می‌گوید بیش از ۲۵۰۰ دانشگاه ارزیابی و ۱۰۰۰ دانشگاه منتشر می‌شوند و ARWU از سال ۲۰۰۹ توسط ShanghaiRanking Consultancy منتشر و copyrighted می‌شود.
- [روش‌شناسی رسمی ARWU 2025](https://www.shanghairanking.com/methodology/arwu/2025) شش شاخص و وزن‌های آنها را شرح می‌دهد: Alumni ده درصد، Award بیست درصد، HiCi بیست درصد، Nature & Science بیست درصد، PUB بیست درصد و PCP ده درصد.
- نمونه‌های رسمی ایران: [دانشگاه تهران `401–500`](https://www.shanghairanking.com/universities/university-of-tehran) و [دانشگاه صنعتی شریف `801–900`](https://www.shanghairanking.com/universities/sharif-university-of-technology). اگر URL ناشر تغییر کرد، URL جدول و شناسه/slug منبع در snapshot نیز نگهداری شود.
- صفحه رسمی رتبه‌بندی گزینه دانلود Excel دارد، اما ارائه فایل به‌تنهایی مجوز بازنشر ایجاد نمی‌کند. footer و صفحه رتبه‌بندی عبارت All Rights Reserved را دارند و مجوز باز داده مشابه CC0 پیدا نشد.

نتیجه: ARWU به‌عنوان منبع لینک‌شده یا منبع دارای مجوز قابل استفاده است؛ دانلودپذیری Excel نباید با مجازبودن انتشار مجدد اشتباه گرفته شود.

### CWTS Leiden Ranking Open Edition

- [منابع رسمی Leiden Open](https://open.leidenranking.com/resources) نتیجه را در Excel، داده زیربنایی را در فایل و BigQuery، و کد منبع را در GitHub ارائه می‌کند. این صفحه صریحاً نتایج و داده‌ها را CC0 و کد را MIT اعلام می‌کند.
- [فایل رسمی Universities در snapshot سال 2025](https://zenodo.org/records/17473224) شامل ۲۸۳۱ دانشگاه، نام، ROR ID و کشور است. بررسی فایل رسمی نشان داد ۸۲ رکورد با کشور `Iran` وجود دارد؛ این عدد شامل دانشگاه‌های علوم پزشکی، شعب دانشگاه آزاد و نهادهایی خارج از فهرست ۱۱۵تایی پرتال نیز می‌شود و به معنی پوشش ۸۲ مورد از ۱۱۵ مورد نیست.
- [روش انتخاب دانشگاه‌ها](https://open.leidenranking.com/information/universities) حداقل ۱۵۰۰ انتشار OpenAlex در دوره ۲۰۲۰ تا ۲۰۲۳ را بیان می‌کند و توضیح می‌دهد که روابط دانشگاه و نهادهای وابسته با ROR مدل می‌شوند.
- [راهنمای استفاده مسئولانه](https://open.leidenranking.com/information/responsibleuse) تأکید می‌کند که Leiden مفهوم مرکب «بهترین دانشگاه» نمی‌سازد، شاخص‌های علمی را جداگانه نشان می‌دهد و تمرکز صرف بر rank را گمراه‌کننده می‌داند.

نتیجه: این منبع بهترین پایه برای pipeline باز و قابل بازتولید است، اما UI باید نام شاخص و context آن را نمایش دهد، نه یک رتبه کلی جعلی.

## قرارداد پیشنهادی داده

```json
{
  "institutionSlug": "tehran",
  "matchedRorId": "https://ror.org/05vf56z40",
  "matchMethod": "official-domain",
  "matchConfidence": "verified",
  "source": "leiden-open",
  "edition": "2025",
  "rankKind": "indicator-order",
  "rankDisplay": null,
  "rankMin": null,
  "rankMax": null,
  "tied": null,
  "indicator": {
    "code": "PP(top 10%)",
    "value": null,
    "field": "all-sciences",
    "period": "2020-2023",
    "countingMethod": "fractional",
    "publicationSet": "core"
  },
  "sourceUrl": "https://open.leidenranking.com/",
  "licenseStatus": "CC0-1.0",
  "retrievedAt": "2026-08-13T00:00:00Z"
}
```

برای QS/THE/ARWU همین envelope استفاده شود، اما `rankKind` یکی از `exact`، `tied-exact`، `band` یا `open-ended-band` باشد. `rankDisplay` باید دقیقاً مقدار ناشر مانند `=367`، `401–500` یا `1401+` باشد. `rankMin` و `rankMax` صرفاً برای filter هستند و نباید به midpoint یا رتبه جدید تبدیل شوند.

## راهبرد نگاشت ۱۱۵ دانشگاه

فهرست فعلی نام فارسی، slug و دامنه رسمی دارد، اما شناسه جهانی صریح ندارد. production-gradeترین مسیر این است:

1. به هر دانشگاه `rorId` و `nameEn` افزوده شود.
2. تطبیق اولیه با دامنه رسمی انجام شود؛ ROR دامنه‌ها، نام‌ها، aliasها و نام‌های چندزبانه را ارائه می‌کند. [ROR](https://ror.org/) داده CC0، API باز و dump عمومی دارد و حداقل ماهانه به‌روز می‌شود.
3. تطبیق نامی فقط candidate بسازد؛ fuzzy match نباید بدون بازبینی انسانی منتشر شود.
4. crosswalk نهایی با `matchMethod`، `matchConfidence`، `reviewedBy` و `reviewedAt` نسخه‌بندی شود.
5. برای QS/THE/ARWU یک شناسه داخلی منبع یا slug صفحه رسمی نیز ذخیره شود؛ تغییر نام دانشگاه نباید پیوند تاریخی را قطع کند.
6. دانشگاهی که در ویرایش حاضر نیست با عبارت «در این ویرایش فهرست نشده» نمایش داده شود، نه «بدون رتبه» یا رتبه‌ای بزرگ‌تر از آخرین band. نبودن ممکن است ناشی از معیار ورود، عدم ارسال داده یا دامنه پوشش منبع باشد.

[شرایط ROR](https://ror.org/about/terms/) همه ROR IDها و metadata را CC0 اعلام می‌کند و [مستند نگاشت ROR](https://ror.readme.io/docs/mapping) استفاده از API یا dump را برای crosswalk توضیح می‌دهد.

## پیشنهاد UI پرونده دانشگاه

- عنوان: «جایگاه در نظام‌های بین‌المللی»؛ نه «رتبه جهانی دانشگاه» به صورت مفرد.
- برای هر منبع: لوگو/نام متنی، ویرایش، `rankDisplay` یا نام و مقدار شاخص، وضعیت «رتبه‌شده / فهرست‌نشده / داده در دسترس نیست»، تاریخ snapshot و لینک رسمی.
- Tooltip ثابت: «این جایگاه مستقل از RTPMI است و کیفیت پرتال معاونت پژوهشی را اندازه‌گیری نمی‌کند.»
- band به همان صورت ناشر نمایش داده شود. عبارت «میانگین band» یا تبدیل `401–500` به `450` ممنوع باشد.
- برای Leiden: به‌جای کارت «رتبه»، کارت «اثر علمی / سهم مقالات در ۱۰٪ پراستناد» با context کامل نمایش داده شود.
- برای QS/THE/ARWU تا قبل از مجوز: فقط دکمه «بررسی در منبع رسمی» و در صورت نیاز پیام «بازنشر داده این منبع نیازمند مجوز است» نشان داده شود.

## کنترل‌های pipeline

- snapshot هر ناشر immutable و دارای `edition`, `publishedAt`, `retrievedAt`, checksum و URL منبع باشد.
- validator اجازه انتشار band به‌صورت عدد دقیق را ندهد.
- validator برای Leiden وجود تمام اجزای context شاخص را اجباری کند.
- خروجی بدون `verified` identity match وارد پروفایل عمومی نشود.
- تغییر خودکار نام/شناسه یا جهش غیرعادی رتبه به صف بازبینی برود.
- حذف دانشگاه از ویرایش جدید، رکورد تاریخی را حذف نکند؛ فقط وضعیت edition جدید را `not-listed` کند.
- metadata مجوز به هر snapshot متصل باشد و pipeline برای منابع permission-required بدون ثبت قرارداد معتبر fail-closed شود.

## نتیجه نهایی

برای انتشار سریع، دقیق و کم‌ریسک، فاز اول باید **Leiden Open + ROR crosswalk** باشد و در کنار آن لینک رسمی QS/THE/ARWU قرار گیرد. افزودن مقدارهای QS، THE و ARWU به‌صورت داده میزبانی‌شده باید به بعد از دریافت اجازه کتبی یا قرارداد مناسب موکول شود. این تصمیم هم قابلیت استناد و بازتولید را حفظ می‌کند، هم جلوی ادعای رتبه جعلی برای دانشگاه‌های فهرست‌نشده و تبدیل نادرست bandها را می‌گیرد.
