import {NextRequest, NextResponse} from "next/server";
import {searchObservatory} from "@/lib/global-search";
import rawSummary from "@/data/statistics/summary.json";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Number(request.nextUrl.searchParams.get("limit")) || 18;
  const data = searchObservatory(query, limit);

  return NextResponse.json(
    {data, meta: {
      query,
      total: data.length,
      snapshot: rawSummary.snapshotDate,
      methodologyVersion: rawSummary.methodologyVersion,
    }},
    {headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    }}
  );
}
