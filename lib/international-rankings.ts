import snapshot from "@/data/international-rankings/leiden-open-2025.json";

export type LeidenRankingRecord = (typeof snapshot.records)[number];

const byUniversity = new Map(snapshot.records.map((record) => [record.universitySlug, record]));

export function getInternationalStanding(universitySlug: string) {
  return {
    source: snapshot.source,
    edition: snapshot.edition,
    license: snapshot.license,
    retrievedAt: snapshot.retrievedAt,
    sourceUrl: snapshot.sourceUrl,
    resourcesUrl: snapshot.resourcesUrl,
    indicator: snapshot.indicator,
    record: byUniversity.get(universitySlug) ?? null,
  };
}
