import {
  AuditExplorer
} from "@/components/audit-explorer";

import {
  EvidenceSpectrum
} from "@/components/visual-stories";

import {
  datasetSummary,
  researchReviews
} from "@/lib/data";

export const metadata = {
  title:
    "نقشه ملی ممیزی ۱۱۵ × ۷"
};

export default function Page() {
  const summary:
    any =
    datasetSummary;

  return (
    <main className="shell page">
      <header className="pageHero">
        <div>
          <span className="eyebrow">
            National evidence map · 115 × 7
          </span>

          <h1>
            جایی که شواهد داریم؛ جایی که هنوز باید ببینیم.
          </h1>

          <p>
            هر خانه وضعیت Evidence یک بُعد از اکوسیستم عمومی پژوهش
            و فناوری را نشان می‌دهد. خانه باز یعنی «حل‌نشده»، نه
            «وجود ندارد».
          </p>
        </div>

        <div className="pageHeroStamp">
          <b>۸۰۵</b>

          <span>
            خانه ممیزی
          </span>

          <small>
            ۱۱۵ نهاد × ۷ بُعد
          </small>
        </div>
      </header>

      <div className="auditKpis">
        <div>
          <b>
            {summary.reviewCoverage.reviewedInstitutions}
          </b>

          <span>
            دانشگاه بازبینی‌شده
          </span>
        </div>

        <div>
          <b>
            {summary.reviewCoverage.complete100}
          </b>

          <span>
            پوشش کامل Evidence
          </span>
        </div>

        <div>
          <b>
            {summary.ranked}
          </b>

          <span>
            رتبه‌پذیر RTPMI
          </span>
        </div>

        <div>
          <b>
            {summary.dimensionEvidenceOutcomes}
          </b>

          <span>
            outcome بُعدی مستند
          </span>
        </div>
      </div>

      <EvidenceSpectrum
        dimensions={
          summary.reviewDimensions
        }
      />

      <AuditExplorer
        audits={researchReviews.map(item=>({
          universitySlug:item.universitySlug,
          nameFa:item.nameFa,
          iscCategory:item.iscCategory,
          iscRank:item.iscRank,
          reviewEvidenceCoverage:item.reviewEvidenceCoverage,
          dimensions:item.dimensions,
        }))}
      />
    </main>
  );
}
