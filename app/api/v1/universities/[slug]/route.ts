import {NextResponse} from "next/server";
import {datasetSummary,getAudit,getDeepAudit,getDimensionEvidence,getDocuments,getInstitution,getRank,getResearchReview,getSystems,getUnits,institutions} from "@/lib/data";

export const dynamic="force-static";
export function generateStaticParams(){return institutions.map(x=>({slug:x.slug}))}
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;const institution=getInstitution(slug);if(!institution)return NextResponse.json({error:{code:"not_found",message:"University slug was not found in the locked ISC roster."}},{status:404});return NextResponse.json({data:{institution,audit:getAudit(slug),deepAudit:getDeepAudit(slug),researchReview:getResearchReview(slug),dimensionEvidence:getDimensionEvidence(slug),rtpmi:getRank(slug)||null,units:getUnits(slug),systems:getSystems(slug),documents:getDocuments(slug)},meta:{snapshotDate:datasetSummary.snapshotDate,methodologyVersion:datasetSummary.methodologyVersion,disclaimer:datasetSummary.disclaimer}},{headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"public, s-maxage=3600, stale-while-revalidate=86400"}})}
