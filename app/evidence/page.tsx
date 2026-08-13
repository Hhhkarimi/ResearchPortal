import {
  EvidenceExplorer
} from "@/components/evidence-explorer";

import {
  dimensionEvidence
} from "@/lib/data";

export const metadata = {
  title:
    "رجیستر ۸۰۵ outcome شواهد"
};

export default function Page() {
  const verified =
    dimensionEvidence.filter(
      (item) =>
        item.status ===
        "verified"
    ).length;

  const observed =
    dimensionEvidence.filter(
      (item) =>
        item.status ===
        "observed-reference"
    ).length;

  const restricted =
    dimensionEvidence.filter(
      (item) =>
        item.status ===
        "restricted"
    ).length;

  const unresolved =
    dimensionEvidence.filter(
      (item) =>
        item.status ===
        "unresolved"
    ).length;

  return (
    <main className="shell page">
      <header className="pageHero">
        <div>
          <span className="eyebrow">
            Evidence register · 115 × 7 · official sources only
          </span>

          <h1>
            هر ادعا، یک outcome قابل پیگیری.
          </h1>

          <p>
            برای هر دانشگاه و هر بُعد، نتیجه بازبینی، منبع رسمی،
            تاریخ و قاعده داده مفقود ثبت شده است. حل‌نشده هرگز
            معادل نبود یا صفر نیست.
          </p>
        </div>

        <div className="pageHeroStamp cyan">
          <b>
            ۸۰۵
          </b>

          <span>
            Outcome مستقل
          </span>

          <small>
            ۱۱۵ دانشگاه × ۷ بُعد
          </small>
        </div>
      </header>

      <div className="auditKpis evidenceKpis">
        <div>
          <b>{verified}</b>
          <span>تأیید مستقیم</span>
        </div>

        <div>
          <b>{observed}</b>
          <span>شاهد/ارجاع رسمی</span>
        </div>

        <div>
          <b>{restricted}</b>
          <span>محدود/مسدود</span>
        </div>

        <div>
          <b>{unresolved}</b>
          <span>حل‌نشده</span>
        </div>
      </div>

      <EvidenceExplorer
        rows={
          dimensionEvidence
        }
      />
    </main>
  );
}
