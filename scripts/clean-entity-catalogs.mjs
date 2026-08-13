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
    relation: classification.relation,
    reason: classification.reason,
    discoveredBy: record?.discoveredBy || null,
    discoveryConfidence: record?.discoveryConfidence ?? null,
    lastVerified: record?.lastVerified || null,
  };
}

function cleanCatalog(rows, catalogKind, references, quarantine, events) {
  const kept = [];
  const before = rows.length;

  for (const row of rows) {
    const classification = classifyCatalogRecord(row, catalogKind);

    if (!classification.keep) {
      const output = compactReference(catalogKind, row, classification);

      if (classification.disposition === "quarantine") {
        quarantine.push(output);
      } else {
        references.push(output);
      }

      events.push({
        action: classification.disposition === "quarantine" ? "quarantined" : "moved-to-reference",
        catalog: catalogKind,
        universitySlug: row.universitySlug,
        id: row.id,
        title: row.nameFa || row.title || null,
        url: targetUrl(row),
        entityType: classification.entityType,
        dimension: classification.dimension,
        reason: classification.reason,
      });
      continue;
    }

    const enriched = enrichCatalogRecord(row, catalogKind, classification);

    if (
      catalogKind === "units" &&
      row.type &&
      row.type !== enriched.type
    ) {
      events.push({
        action: "reclassified",
        catalog: catalogKind,
        universitySlug: row.universitySlug,
        id: row.id,
        from: row.type,
        to: enriched.type,
        reason: "semantic-unit-type",
      });
    }

    if (
      catalogKind === "systems" &&
      row.category &&
      row.category !== enriched.category
    ) {
      events.push({
        action: "reclassified",
        catalog: catalogKind,
        universitySlug: row.universitySlug,
        id: row.id,
        from: row.category,
        to: enriched.category,
        reason: "semantic-system-category",
      });
    }

    if (
      catalogKind === "documents" &&
      (
        row.title !== enriched.title ||
        row.type !== enriched.type ||
        row.topic !== enriched.topic
      )
    ) {
      events.push({
        action: "relabelled",
        catalog: catalogKind,
        universitySlug: row.universitySlug,
        id: row.id,
        from: {
          title: row.title || null,
          type: row.type || null,
          topic: row.topic || null,
        },
        to: {
          title: enriched.title || null,
          type: enriched.type || null,
          topic: enriched.topic || null,
        },
        reason: "document-semantic-normalization",
      });
    }

    kept.push(enriched);
  }

  const merged = new Map();

  for (const row of kept) {
    const key = logicalEntityKey(row);
    if (!merged.has(key)) {
      merged.set(key, row);
      continue;
    }

    const current = merged.get(key);
    const next = mergeLogicalRecords(current, row);
    merged.set(key, next);

    events.push({
      action: "logical-merge",
      catalog: catalogKind,
      universitySlug: row.universitySlug,
      entityType: row.entityType,
      keptId: next.id,
      mergedId: row.id,
      alternateUrls: next.alternateUrls || [],
      key,
    });
  }

  const result = sortCatalog([...merged.values()]);

  return {
    rows: result,
    stats: {
      before,
      after: result.length,
      removedFromCatalog: before - kept.length,
      logicalMerges: kept.length - result.length,
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
    const next = {
      ...row,
    };

    delete next.informationTechnologyUrls;

    const routed = new Map(
      Object.keys(REAUDIT_DIMENSION_KEYS).map((dimension) => [dimension, []])
    );

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
            relation: "reference-only",
            reason: result.reason,
          });

          events.push({
            action: "reaudit-reference-removed",
            universitySlug: row.slug,
            fromDimension: originalDimension,
            toDimension: result.dimension,
            url,
            reason: result.reason,
          });

          if (
            result.dimension &&
            result.dimension !== "informationTechnology" &&
            result.dimension !== "systemsServices" &&
            REAUDIT_DIMENSION_KEYS[result.dimension]
          ) {
            routed.get(result.dimension).push(url);
          }

          continue;
        }

        const targetDimension =
          result.dimension && REAUDIT_DIMENSION_KEYS[result.dimension]
            ? result.dimension
            : originalDimension;

        routed.get(targetDimension).push(url);

        if (targetDimension !== originalDimension) {
          events.push({
            action: "reaudit-reference-rerouted",
            universitySlug: row.slug,
            fromDimension: originalDimension,
            toDimension: targetDimension,
            url,
            reason: result.reason,
          });
        }
      }
    }

    const directDocuments = [];

    for (const item of row.directDocuments || []) {
      const record = {
        ...item,
        universitySlug: row.slug,
      };

      const result = classifyCatalogRecord(record, "documents");

      if (result.keep) {
        directDocuments.push(enrichCatalogRecord(record, "documents", result));
        continue;
      }

      references.push({
        ...compactReference("reaudit:directDocuments", record, result),
        universitySlug: row.slug,
      });

      if (
        result.entityType === "document-index" &&
        validEntityUrl(targetUrl(record))
      ) {
        routed.get("documentsRegulations").push(targetUrl(record));
      }

      events.push({
        action: "reaudit-direct-document-reclassified",
        universitySlug: row.slug,
        title: item.title || null,
        url: targetUrl(item),
        entityType: result.entityType,
        reason: result.reason,
      });
    }

    for (const [dimension, key] of Object.entries(REAUDIT_DIMENSION_KEYS)) {
      next[key] = uniqueUrls(routed.get(dimension));
    }

    next.directDocuments = directDocuments.map(({universitySlug: _slug, ...item}) => item);

    return next;
  });
}

const [
  rawUnits,
  rawSystems,
  rawDocuments,
  rawReaudit,
] = await Promise.all([
  readJson(FILES.units, []),
  readJson(FILES.systems, []),
  readJson(FILES.documents, []),
  readJson(FILES.reaudit, []),
]);

const references = [];
const quarantine = [];
const events = [];

const rawIndex = recordIndex(
  rawUnits,
  rawSystems,
  rawDocuments
);

const cleanedUnits = cleanCatalog(
  rawUnits,
  "units",
  references,
  quarantine,
  events
);

const cleanedSystems = cleanCatalog(
  rawSystems,
  "systems",
  references,
  quarantine,
  events
);

const cleanedDocuments = cleanCatalog(
  rawDocuments,
  "documents",
  references,
  quarantine,
  events
);

const cleanedReaudit = cleanReaudit(
  rawReaudit,
  rawIndex,
  references,
  events
);

const countsByAction = {};
for (const event of events) {
  countsByAction[event.action] =
    (countsByAction[event.action] || 0) + 1;
}

const lorestanEvents = events.filter(
  (item) => item.universitySlug === "lorestan"
);

const report = {
  schemaVersion: 1,
  policyVersion: "entity-cleaning-1.0-relation-aware",
  generatedAt: new Date().toISOString(),
  policy: {
    catalogs: "Only actual units, system endpoints, and documents remain in their public catalogs.",
    references: "Indexes, guides, announcements, structure hubs and service pages are preserved outside public catalogs.",
    logicalEntities: "Safe URL/concept duplicates are merged; alternate target URLs are preserved.",
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
    events: lorestanEvents.slice(0, 120),
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

console.log(
  [
    "entity cleaning complete",
    `units=${cleanedUnits.stats.before}->${cleanedUnits.stats.after}`,
    `systems=${cleanedSystems.stats.before}->${cleanedSystems.stats.after}`,
    `documents=${cleanedDocuments.stats.before}->${cleanedDocuments.stats.after}`,
    `references=${references.length}`,
    `quarantine=${quarantine.length}`,
    `logicalMerges=${cleanedUnits.stats.logicalMerges + cleanedSystems.stats.logicalMerges + cleanedDocuments.stats.logicalMerges}`,
    `lorestanEvents=${lorestanEvents.length}`,
  ].join(" | ")
);
