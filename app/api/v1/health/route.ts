import {
  NextResponse
} from "next/server";

import {
  audits,
  datasetSummary,
  deepAudits,
  dimensionEvidence,
  institutions,
  researchReviews,
} from "@/lib/data";

import {
  PUBLIC_OUTCOME_COUNT
} from "@/lib/public-model";

export const dynamic =
  "force-static";

export function GET() {
  const healthy =
    institutions.length ===
      115 &&
    audits.length ===
      115 &&
    deepAudits.length ===
      115 &&
    researchReviews.length ===
      115 &&
    dimensionEvidence.length ===
      PUBLIC_OUTCOME_COUNT;

  return NextResponse.json(
    {
      status:
        healthy
          ? "ok"
          : "degraded",

      checks: {
        iscRoster:
          institutions.length,

        portalAudits:
          audits.length,

        deepAuditRows:
          deepAudits.length,

        researchReviews:
          researchReviews.length,

        dimensionEvidenceOutcomes:
          dimensionEvidence.length,

        expectedDimensionEvidenceOutcomes:
          PUBLIC_OUTCOME_COUNT,

        dimensionsPerInstitution:
          7,

        referentialIntegrity:
          healthy,
      },

      snapshotDate:
        datasetSummary.snapshotDate,

      methodologyVersion:
        datasetSummary.methodologyVersion,
    },

    {
      status:
        healthy
          ? 200
          : 503,

      headers: {
        "Access-Control-Allow-Origin":
          "*",

        "Cache-Control":
          "no-store",
      },
    }
  );
}
