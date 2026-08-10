import {NextResponse} from "next/server";
import {datasetSummary} from "@/lib/data";
export const dynamic="force-static";
export function GET(){return NextResponse.json({data:datasetSummary},{headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"public, s-maxage=3600, stale-while-revalidate=86400"}})}
