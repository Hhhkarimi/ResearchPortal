import {
  AuditExplorer
} from "@/components/audit-explorer";

import {
  EvidenceSpectrum
} from "@/components/visual-stories";

import {
  datasetSummary,
  dimensionEvidence,
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
  const evidenceIndex = new Map(dimensionEvidence.map((item:any) => [`${item.universitySlug}:${item.dimension}`, item]));

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
          <b>۱۱۵</b>

          <span>
            نهاد در رصد ملی
          </span>

          <small>
            ۷ بُعد · ۸۰۵ outcome مستند
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
          evidence:Object.fromEntries(Object.keys(item.dimensions).map((dimension) => {
            const evidence:any=evidenceIndex.get(`${item.universitySlug}:${dimension}`);
            const source=evidence?.sources?.[0];
            return [dimension,evidence?{
              sourceCount:evidence.sourceCount,
              lastVerified:evidence.reviewedAt || source?.lastVerified || evidence.lastVerified || source?.verifiedAt || null,
              verificationBasis:evidence.verificationBasis,
              source:source?{url:source.url,label:source.label || source.title || source.claim}:null,
            }:null];
          })),
        }))}
      />
    </main>
  );
}
