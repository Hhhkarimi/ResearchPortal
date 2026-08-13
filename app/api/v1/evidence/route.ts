import {
  NextRequest,
  NextResponse
} from "next/server";

import {
  datasetSummary,
  dimensionEvidence
} from "@/lib/data";

import {
  PUBLIC_OUTCOME_COUNT
} from "@/lib/public-model";

export const dynamic =
  "force-static";

export function GET(
  request:
    NextRequest
) {
  const searchParams =
    request.nextUrl
      .searchParams;

  const universitySlug =
    searchParams.get(
      "university"
    );

  const dimension =
    searchParams.get(
      "dimension"
    );

  const status =
    searchParams.get(
      "status"
    );

  const limit =
    Math.min(
      Math.max(
        Number(
          searchParams.get(
            "limit"
          )
        ) ||
          100,

        1
      ),

      PUBLIC_OUTCOME_COUNT
    );

  const offset =
    Math.max(
      Number(
        searchParams.get(
          "offset"
        )
      ) ||
        0,

      0
    );

  const filteredOutcomes =
    dimensionEvidence.filter(
      (outcome) =>
        (
          !universitySlug ||
          outcome.universitySlug ===
            universitySlug
        ) &&
        (
          !dimension ||
          outcome.dimension ===
            dimension
        ) &&
        (
          !status ||
          outcome.status ===
            status
        )
    );

  return NextResponse.json(
    {
      data:
        filteredOutcomes.slice(
          offset,
          offset +
            limit
        ),

      meta: {
        total:
          filteredOutcomes.length,

        limit,
        offset,

        snapshotDate:
          datasetSummary.snapshotDate,

        dimensionOutcomes:
          PUBLIC_OUTCOME_COUNT,

        dimensionsPerInstitution:
          7,

        missingDataRule:
          "Unresolved is not absence and is never automatically scored as zero.",
      },
    },

    {
      headers: {
        "Access-Control-Allow-Origin":
          "*",

        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
