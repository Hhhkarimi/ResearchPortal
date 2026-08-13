import isc from "@/data/isc/institutions.json";
import rawAudit from "@/data/audit/portal-audit.json";
import rawDeepAudit from "@/data/audit/deep-audit-matrix.json";
import rawRanking from "@/data/statistics/portal-ranking.json";
import rawUnits from "@/data/units/catalog.json";
import rawSystems from "@/data/systems/catalog.json";
import rawDocs from "@/data/documents/catalog.json";
import rawSummary from "@/data/statistics/summary.json";
import rawProvenance from "@/data/evidence/provenance-ledger.json";
import rawDimensions from "@/data/evidence/dimension-evidence.json";
import rawReviews from "@/data/evidence/research-review.json";

import {
  PUBLIC_DIMENSION_COUNT,
  PUBLIC_OUTCOME_COUNT,
  canonicalPublicUrl,
  coverageFromPublicDimensions,
  dedupePublicCatalog,
  isInformationTechnologyRecord,
  isInformationTechnologyUrl,
  omitInformationTechnologyDimension,
  uniquePublicUrls,
} from "@/lib/public-model";

import {
  isPublicResearchDocument,
} from "@/lib/research-document-scope";

export const institutions=isc;

const researchRootsBySlug=new Map<string,string[]>(
  (rawAudit as any[]).map((audit:any)=>[
    audit.universitySlug,
    audit.portalAuditStatus==="direct-official" && audit.researchUrl
      ? [audit.researchUrl]
      : [],
  ])
);

const rawDocumentRows=rawDocs as any[];

const publicDocumentRows=rawDocumentRows.filter((row:any)=>
  isPublicResearchDocument(
    row,
    researchRootsBySlug.get(row.universitySlug) || []
  )
);

const excludedDocumentUrlKeys=new Set(
  rawDocumentRows
    .filter((row:any)=>
      !isPublicResearchDocument(
        row,
        researchRootsBySlug.get(row.universitySlug) || []
      )
    )
    .flatMap((row:any)=>[row.url,row.sourceUrl])
    .map(canonicalPublicUrl)
    .filter(Boolean) as string[]
);

const keepEvidenceUrl=(url:unknown)=>{
  const key=canonicalPublicUrl(url);
  return !key || !excludedDocumentUrlKeys.has(key);
};

export const audits=(rawAudit as any[]).map((audit)=>({
  ...audit,
  researchUrl:
    audit.researchUrl && !isInformationTechnologyUrl(audit.researchUrl)
      ? audit.researchUrl
      : null,
  evidenceUrls:uniquePublicUrls(audit.evidenceUrls||[]).filter(keepEvidenceUrl),
  observedSignals:(audit.observedSignals||[]).filter((signal:string)=>
    !["it","it-related","informationtechnology","information-technology"]
      .includes(signal.toLowerCase())
  ),
}));

export const deepAudits=(rawDeepAudit as any[]).map((row)=>{
  const dimensions=omitInformationTechnologyDimension(row.dimensions);
  return {
    ...row,
    dimensions,
    auditEvidenceCoverage:coverageFromPublicDimensions(dimensions),
    evidenceUrls:uniquePublicUrls(row.evidenceUrls||[]).filter(keepEvidenceUrl),
  };
});

export const rankings=(rawRanking as any[]).map((row)=>({
  ...row,
  metrics:{...(row.metrics||{})},
}));

export const unitCatalog=dedupePublicCatalog(rawUnits as any[]);
export const systemCatalog=dedupePublicCatalog(rawSystems as any[]);
export const documentCatalog=dedupePublicCatalog(publicDocumentRows);

export const dimensionEvidence=(rawDimensions as any[])
  .filter((row)=>row.dimension!=="informationTechnology")
  .map((row)=>({
    ...row,
    sources:dedupePublicCatalog(
      (row.sources||[])
        .filter((source:any)=>
          !isInformationTechnologyRecord(source) &&
          keepEvidenceUrl(source.url)
        )
        .map((source:any,index:number)=>({
          ...source,
          id:source.id||`${row.id}-source-${index}`,
          universitySlug:row.universitySlug,
          url:source.url,
        }))
    ).map(({id:_id,universitySlug:_slug,...source}:any)=>source),
  }))
  .map((row)=>({...row,sourceCount:row.sources.length}));

export const researchReviews=(rawReviews as any[]).map((review)=>{
  const dimensions=omitInformationTechnologyDimension(review.dimensions);
  const reportedDimensions=omitInformationTechnologyDimension(
    review.reportedDimensions||review.dimensions
  );

  const officialSources=dedupePublicCatalog(
    (review.officialSources||[])
      .filter((source:any)=>
        !isInformationTechnologyRecord(source) &&
        keepEvidenceUrl(source.url)
      )
      .map((source:any,index:number)=>({
        ...source,
        id:`${review.universitySlug}-official-${index}`,
        universitySlug:review.universitySlug,
        sourceUrl:source.url,
      }))
  ).map(({id:_id,universitySlug:_slug,sourceUrl:_sourceUrl,...source}:any)=>source);

  return {
    ...review,
    dimensions,
    reportedDimensions,
    reviewEvidenceCoverage:coverageFromPublicDimensions(dimensions),
    officialSources,
    officialSourceUrls:uniquePublicUrls(
      officialSources.map((source:any)=>source.url)
    ).filter(keepEvidenceUrl),
  };
});

export const provenanceLedger=(rawProvenance as any[]).filter((row:any)=>
  !isInformationTechnologyRecord(row) &&
  keepEvidenceUrl(row.sourceUrl||row.url)
);

const reviewCoverageAverage=researchReviews.length
  ? Math.round(
      10*researchReviews.reduce(
        (sum,row:any)=>sum+(row.reviewEvidenceCoverage||0),0
      )/researchReviews.length
    )/10
  : 0;

export const datasetSummary:any={
  ...(rawSummary as any),
  publicEvidenceDimensions:PUBLIC_DIMENSION_COUNT,
  dimensions:omitInformationTechnologyDimension((rawSummary as any).dimensions),
  reviewDimensions:omitInformationTechnologyDimension((rawSummary as any).reviewDimensions),
  reportedReviewDimensions:omitInformationTechnologyDimension(
    (rawSummary as any).reportedReviewDimensions
  ),
  dimensionEvidenceOutcomes:dimensionEvidence.length||PUBLIC_OUTCOME_COUNT,
  reviewCoverage:{
    ...((rawSummary as any).reviewCoverage||{}),
    average:reviewCoverageAverage,
    dimensionOutcomes:dimensionEvidence.length||PUBLIC_OUTCOME_COUNT,
  },
  units:unitCatalog.length,
  systems:systemCatalog.length,
  documents:documentCatalog.length,
  provenanceRecords:provenanceLedger.length,
};

export {
  canonicalPublicUrl,
  dedupePublicCatalog,
  uniquePublicUrls,
} from "@/lib/public-model";

export const getInstitution=(slug:string)=>
  institutions.find((item)=>item.slug===slug);

export const getAudit=(slug:string)=>
  audits.find((item)=>item.universitySlug===slug);

export const getDeepAudit=(slug:string)=>
  deepAudits.find((item)=>item.universitySlug===slug);

export const getRank=(slug:string)=>
  rankings.find((item)=>item.universitySlug===slug);
