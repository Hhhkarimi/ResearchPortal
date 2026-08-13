import {NextResponse} from "next/server";
import {documentSearchIndex} from "@/lib/document-search-index";
import {datasetSummary} from "@/lib/data";

export const dynamic="force-static";

export function GET(){
  return NextResponse.json(
    {data:documentSearchIndex,meta:{total:documentSearchIndex.length,snapshotDate:datasetSummary.snapshotDate}},
    {headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"public, s-maxage=86400, stale-while-revalidate=604800"}}
  );
}
