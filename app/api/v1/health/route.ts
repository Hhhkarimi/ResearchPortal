import {NextResponse} from "next/server";
import {audits,datasetSummary,deepAudits,institutions} from "@/lib/data";
export const dynamic="force-static";
export function GET(){const healthy=institutions.length===115&&audits.length===115&&deepAudits.length===115;return NextResponse.json({status:healthy?"ok":"degraded",checks:{iscRoster:institutions.length,portalAudits:audits.length,deepAuditRows:deepAudits.length,referentialIntegrity:healthy},snapshotDate:datasetSummary.snapshotDate,methodologyVersion:datasetSummary.methodologyVersion},{status:healthy?200:503,headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"}})}
