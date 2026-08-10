import {NextRequest,NextResponse} from "next/server";
import {datasetSummary,rankings} from "@/lib/data";
export const dynamic="force-static";
export function GET(request:NextRequest){const category=request.nextUrl.searchParams.get("category");const data=category?rankings.filter(x=>x.iscCategory===category):rankings;return NextResponse.json({data,meta:{total:data.length,eligiblePortals:datasetSummary.ranked,unranked:datasetSummary.unranked,snapshotDate:datasetSummary.snapshotDate,methodologyVersion:datasetSummary.methodologyVersion,disclaimer:datasetSummary.disclaimer}},{headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"public, s-maxage=3600, stale-while-revalidate=86400"}})}
