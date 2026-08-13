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
  const counts:Record<string,number>={verified:0,"observed-reference":0,restricted:0,unresolved:0};
  for(const item of dimensionEvidence)counts[item.status]=(counts[item.status]||0)+1;

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
          <b>{counts.verified}</b>
          <span>تأیید مستقیم</span>
        </div>

        <div>
          <b>{counts["observed-reference"]}</b>
          <span>شاهد/ارجاع رسمی</span>
        </div>

        <div>
          <b>{counts.restricted}</b>
          <span>محدود/مسدود</span>
        </div>

        <div>
          <b>{counts.unresolved}</b>
          <span>حل‌نشده</span>
        </div>
      </div>

      <EvidenceExplorer
        rows={dimensionEvidence.map(item=>({
          id:item.id,
          universitySlug:item.universitySlug,
          nameFa:item.nameFa,
          dimension:item.dimension,
          status:item.status,
          reviewedAt:item.reviewedAt,
          publicationAdjusted:Boolean(item.publicationAdjustment),
          sourceCount:item.sourceCount,
          sourceUrl:item.sources[0]?.url||null,
        }))}
      />
    </main>
  );
}
