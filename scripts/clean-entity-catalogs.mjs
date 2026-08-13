import fs from "node:fs/promises";

import {
  canonicalEntityUrl,
  classifyCatalogRecord,
  classifyReauditReference,
  enrichCatalogRecord,
  logicalEntityKey,
  mergeLogicalRecords,
  REAUDIT_DIMENSION_KEYS,
  REAUDIT_KEY_DIMENSIONS,
  validEntityUrl,
} from "./entity-cleaning-policy.mjs";

const FILES = {
  units: "data/units/catalog.json",
  systems: "data/systems/catalog.json",
  documents: "data/documents/catalog.json",
  reaudit: "data/evidence/portal-document-reaudit.json",
  referencePages: "data/generated/reference-pages.json",
  quarantine: "data/generated/entity-quarantine.json",
  report: "data/generated/entity-cleaning-report.json",
};

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJson = async (file, value) => {
  await fs.mkdir("data/generated", {recursive: true});
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n");
};

function sortCatalog(rows) {
  return [...rows].sort((a, b) =>
    String(a.universitySlug || "").localeCompare(String(b.universitySlug || "")) ||
    String(a.id || "").localeCompare(String(b.id || ""))
  );
}

function targetUrl(record) {
  return record?.url || record?.sourceUrl || record?.parentUrl || null;
}

function compactReference(sourceCatalog, record, classification) {
  return {
    sourceCatalog,
    id: record?.id || null,
    universitySlug: record?.universitySlug || null,
    title: record?.nameFa || record?.title || null,
    url: targetUrl(record),
    sourceUrl: record?.sourceUrl || null,
    parentUrl: record?.parentUrl || null,
    entityType: classification.entityType,
    dimension: classification.dimension,
    primaryDimension: classification.primaryDimension || classification.dimension || null,
    topicDimension: classification.topicDimension || null,
    relation: classification.relation,
    reason: classification.reason,
    discoveredBy: record?.discoveredBy || null,
    discoveryConfidence: record?.discoveryConfidence ?? null,
    lastVerified: record?.lastVerified || null,
  };
}

function addReferenceFromClassification(catalogKind, row, classification, references, quarantine, events, action = null) {
  const output = compactReference(catalogKind, row, classification);
  if (classification.disposition === "quarantine") quarantine.push(output);
  else references.push(output);

  events.push({
    action: action || (classification.disposition === "quarantine" ? "quarantined" : "moved-to-reference"),
    catalog: catalogKind,
    universitySlug: row.universitySlug,
    id: row.id,
    title: row.nameFa || row.title || null,
    url: targetUrl(row),
    entityType: classification.entityType,
    dimension: classification.dimension,
    primaryDimension: classification.primaryDimension || classification.dimension || null,
    topicDimension: classification.topicDimension || null,
    reason: classification.reason,
  });
}

function mergePass(rows, catalogKind, events, action = "logical-merge") {
  const merged = new Map();

  for (const row of rows) {
    const key = logicalEntityKey(row);
    if (!merged.has(key)) {
      // Self-merge is intentional: it runs the final display-label recovery even
      // for records that never had a duplicate partner.
      merged.set(key, mergeLogicalRecords(row, row));
      continue;
    }

    const current = merged.get(key);
    const next = mergeLogicalRecords(current, row);
    merged.set(key, next);

    events.push({
      action,
      catalog: catalogKind,
      universitySlug: row.universitySlug,
      entityType: row.entityType,
      keptId: next.id,
      mergedId: row.id,
      evidenceUrls: next.evidenceUrls || [],
      alternateUrls: next.alternateUrls || [],
      key,
    });
  }

  return [...merged.values()];
}

function stabilizeCatalog(rows, catalogKind, references, quarantine, events) {
  let current = rows;
  let removedAfterMerge = 0;

  // Two stabilization rounds are enough for the observed failure mode:
  // 1) display labels can change after a logical merge;
  // 2) that new label can change the logical key or expose a content/news page.
  // A third round is a cheap safety net and keeps the operation deterministic.
  for (let pass = 1; pass <= 3; pass++) {
    const relabelled = mergePass(
      current,
      catalogKind,
      events,
      pass === 1 ? "logical-merge" : "post-merge-logical-merge"
    );

    const kept = [];
    for (const row of relabelled) {
      const classification = classifyCatalogRecord(row, catalogKind);
      if (!classification.keep) {
        removedAfterMerge += 1;
        addReferenceFromClassification(
          catalogKind,
          row,
          classification,
          references,
          quarantine,
          events,
          "post-merge-moved-to-reference"
        );
        continue;
      }

      // Re-enrich against the final label so type/dimension/relation cannot be
      // stale after a merge. Self-merge then guarantees a non-empty display label
      // for unit/system entities when one can be recovered from their URL.
      const enriched = enrichCatalogRecord(row, catalogKind, classification);
      kept.push(mergeLogicalRecords(enriched, enriched));
    }

    const beforeKeys = current.map(logicalEntityKey).sort().join("\n");
    const afterKeys = kept.map(logicalEntityKey).sort().join("\n");
    current = kept;

    if (beforeKeys === afterKeys && relabelled.length === kept.length) break;
  }

  // Final key collapse catches records such as Tehran Central Library whose
  // canonical concept becomes visible only after display-label normalization.
  current = mergePass(current, catalogKind, events, "post-merge-logical-merge");

  return {rows: current, removedAfterMerge};
}

function cleanCatalog(rows, catalogKind, references, quarantine, events) {
  const initiallyKept = [];
  const before = rows.length;

  for (const row of rows) {
    const classification = classifyCatalogRecord(row, catalogKind);

    if (!classification.keep) {
      addReferenceFromClassification(
        catalogKind, row, classification, references, quarantine, events
      );
      continue;
    }

    const enriched = enrichCatalogRecord(row, catalogKind, classification);

    if (catalogKind === "units" && row.type && row.type !== enriched.type) {
      events.push({
        action: "reclassified",
        catalog: catalogKind,
        universitySlug: row.universitySlug,
        id: row.id,
        from: row.type,
        to: enriched.type,
        reason: "semantic-unit-type-v2",
      });
    }

    if (catalogKind === "systems" && row.category && row.category !== enriched.category) {
      events.push({
        action: "reclassified",
        catalog: catalogKind,
        universitySlug: row.universitySlug,
        id: row.id,
        from: row.category,
        to: enriched.category,
        reason: "semantic-system-category-v2",
      });
    }

    if (catalogKind === "documents" && (
      row.title !== enriched.title ||
      row.type !== enriched.type ||
      row.topic !== enriched.topic ||
      row.topicDimension !== enriched.topicDimension
    )) {
      events.push({
        action: "relabelled",
        catalog: catalogKind,
        universitySlug: row.universitySlug,
        id: row.id,
        from: {
          title: row.title || null,
          type: row.type || null,
          topic: row.topic || null,
          topicDimension: row.topicDimension || null,
        },
        to: {
          title: enriched.title || null,
          type: enriched.type || null,
          topic: enriched.topic || null,
          topicDimension: enriched.topicDimension || null,
        },
        reason: "document-semantic-normalization-v2",
      });
    }

    initiallyKept.push(enriched);
  }

  const stabilized = stabilizeCatalog(
    initiallyKept, catalogKind, references, quarantine, events
  );
  const result = sortCatalog(stabilized.rows);
  const semanticSurvivors = initiallyKept.length - stabilized.removedAfterMerge;

  return {
    rows: result,
    stats: {
      before,
      after: result.length,
      removedFromCatalog: before - semanticSurvivors,
      logicalMerges: Math.max(0, semanticSurvivors - result.length),
      postMergeRemoved: stabilized.removedAfterMerge,
    },
  };
}

function recordIndex(...catalogs) {
  const index = new Map();

  for (const rows of catalogs) {
    for (const row of rows) {
      for (const value of [row.url, row.sourceUrl, row.parentUrl].filter(validEntityUrl)) {
        const key = canonicalEntityUrl(value);
        if (!key) continue;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(row);
      }
    }
  }

  return index;
}

function bestMatchedRecord(index, url) {
  const key = canonicalEntityUrl(url);
  const candidates = key ? index.get(key) || [] : [];
  if (!candidates.length) return null;
  return candidates.find((item) => item.url && canonicalEntityUrl(item.url) === key) || candidates[0];
}

function uniqueUrls(values) {
  const map = new Map();

  for (const value of values || []) {
    const key = canonicalEntityUrl(value);
    if (key && !map.has(key)) map.set(key, value);
  }

  return [...map.values()];
}

function cleanReaudit(rows, rawRecordIndex, references, events) {
  return rows.map((row) => {
    const next = {...row};
    delete next.informationTechnologyUrls;

    const routed = new Map(
      Object.keys(REAUDIT_DIMENSION_KEYS).map((dimension) => [dimension, []])
    );
    const documentIndexTopics = [];

    for (const [key, originalDimension] of Object.entries(REAUDIT_KEY_DIMENSIONS)) {
      for (const url of row[key] || []) {
        const matched = bestMatchedRecord(rawRecordIndex, url);
        const result = classifyReauditReference(url, originalDimension, matched);

        if (!result.keep) {
          references.push({
            sourceCatalog: `reaudit:${key}`,
            universitySlug: row.slug,
            title: matched?.nameFa || matched?.title || null,
            url,
            entityType: result.entityType,
            dimension: result.dimension,
            primaryDimension: result.primaryDimension || result.dimension || null,
            topicDimension: result.topicDimension || null,
            relation: "reference-only",
            reason: result.reason,
          });

          events.push({
            action: "reaudit-reference-removed",
            universitySlug: row.slug,
            fromDimension: originalDimension,
            toDimension: result.dimension,
            topicDimension: result.topicDimension || null,
            url,
            reason: result.reason,
          });

          if (
            result.dimension &&
            result.dimension !== "informationTechnology" &&
            REAUDIT_DIMENSION_KEYS[result.dimension]
          ) {
            routed.get(result.dimension).push(url);
          }

          if (result.dimension === "documentsRegulations" && result.topicDimension) {
            documentIndexTopics.push({url, topicDimension: result.topicDimension});
          }
          continue;
        }

        const targetDimension = result.dimension && REAUDIT_DIMENSION_KEYS[result.dimension]
          ? result.dimension
          : originalDimension;

        routed.get(targetDimension).push(url);

        if (targetDimension === "documentsRegulations" && result.topicDimension) {
          documentIndexTopics.push({url, topicDimension: result.topicDimension});
        }

        if (targetDimension !== originalDimension) {
          events.push({
            action: "reaudit-reference-rerouted",
            universitySlug: row.slug,
            fromDimension: originalDimension,
            toDimension: targetDimension,
            topicDimension: result.topicDimension || null,
            url,
            reason: result.reason,
          });
        }
      }
    }

    const directDocuments = [];

    for (const item of row.directDocuments || []) {
      const record = {...item, universitySlug: row.slug};
      const result = classifyCatalogRecord(record, "documents");

      if (result.keep) {
        directDocuments.push(enrichCatalogRecord(record, "documents", result));
        continue;
      }

      references.push({
        ...compactReference("reaudit:directDocuments", record, result),
        universitySlug: row.slug,
      });

      if (result.entityType === "document-index" && validEntityUrl(targetUrl(record))) {
        routed.get("documentsRegulations").push(targetUrl(record));
        if (result.topicDimension) {
          documentIndexTopics.push({
            url: targetUrl(record),
            topicDimension: result.topicDimension,
          });
        }
      }

      events.push({
        action: "reaudit-direct-document-reclassified",
        universitySlug: row.slug,
        title: item.title || null,
        url: targetUrl(item),
        entityType: result.entityType,
        primaryDimension: result.primaryDimension || result.dimension || null,
        topicDimension: result.topicDimension || null,
        reason: result.reason,
      });
    }

    for (const [dimension, key] of Object.entries(REAUDIT_DIMENSION_KEYS)) {
      next[key] = uniqueUrls(routed.get(dimension));
    }

    const topicMap = new Map();
    for (const item of documentIndexTopics) {
      const key = canonicalEntityUrl(item.url);
      if (key && !topicMap.has(`${key}|${item.topicDimension}`)) {
        topicMap.set(`${key}|${item.topicDimension}`, item);
      }
    }

    next.documentIndexTopics = [...topicMap.values()];
    next.directDocuments = directDocuments.map(({universitySlug: _slug, ...item}) => item);

    return next;
  });
}

const [rawUnits, rawSystems, rawDocuments, rawReaudit] = await Promise.all([
  readJson(FILES.units, []),
  readJson(FILES.systems, []),
  readJson(FILES.documents, []),
  readJson(FILES.reaudit, []),
]);

const references = [];
const quarantine = [];
const events = [];
const rawIndex = recordIndex(rawUnits, rawSystems, rawDocuments);

const cleanedUnits = cleanCatalog(rawUnits, "units", references, quarantine, events);
const cleanedSystems = cleanCatalog(rawSystems, "systems", references, quarantine, events);
const cleanedDocuments = cleanCatalog(rawDocuments, "documents", references, quarantine, events);
const cleanedReaudit = cleanReaudit(rawReaudit, rawIndex, references, events);

const countsByAction = {};
for (const event of events) countsByAction[event.action] = (countsByAction[event.action] || 0) + 1;

const lorestanEvents = events.filter((item) => item.universitySlug === "lorestan");
const report = {
  schemaVersion: 2,
  policyVersion: "entity-cleaning-2.2.2-news-path-canonical-labels",
  generatedAt: new Date().toISOString(),
  policy: {
    catalogs: "Catalogs contain actual organizational units, research-facing system endpoints, and documents only.",
    references: "Indexes, guides, announcements, staff/profile pages, service pages and non-research systems are preserved as references.",
    documentDimensions: "Document indexes stay in documentsRegulations; topicDimension records library/laboratory/industry/system context without moving the index out of the documents dimension.",
    logicalEntities: "Safe bilingual/unit duplicates are merged; evidenceUrls preserve provenance while alternateUrls contains only equivalent entity targets.",
    systemEndpoints: "Same-host CMS/content pages are not systems merely because their title or slug contains the word system; an application-like endpoint or trusted relation is required.",
    displayLabels: "Logical merges preserve the best human-readable entity label; when legacy rows lack a label, a safe URL-path label is recovered.",
    provenance: "No removed catalog record is silently discarded; every move is recorded.",
  },
  counts: {
    units: cleanedUnits.stats,
    systems: cleanedSystems.stats,
    documents: cleanedDocuments.stats,
    referencePages: references.length,
    quarantine: quarantine.length,
    events: events.length,
  },
  countsByAction,
  lorestan: {
    eventCount: lorestanEvents.length,
    events: lorestanEvents.slice(0, 180),
  },
  events,
};

await Promise.all([
  writeJson(FILES.units, cleanedUnits.rows),
  writeJson(FILES.systems, cleanedSystems.rows),
  writeJson(FILES.documents, cleanedDocuments.rows),
  writeJson(FILES.reaudit, cleanedReaudit),
  writeJson(FILES.referencePages, references),
  writeJson(FILES.quarantine, quarantine),
  writeJson(FILES.report, report),
]);

console.log([
  "entity cleaning v2.2.2 complete",
  `units=${cleanedUnits.stats.before}->${cleanedUnits.stats.after}`,
  `systems=${cleanedSystems.stats.before}->${cleanedSystems.stats.after}`,
  `documents=${cleanedDocuments.stats.before}->${cleanedDocuments.stats.after}`,
  `references=${references.length}`,
  `quarantine=${quarantine.length}`,
  `logicalMerges=${cleanedUnits.stats.logicalMerges + cleanedSystems.stats.logicalMerges + cleanedDocuments.stats.logicalMerges}`,
  `lorestanEvents=${lorestanEvents.length}`,
].join(" | "));
