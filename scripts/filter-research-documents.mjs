import fs from "node:fs/promises";

import {
  canonicalScopeUrl,
  classifyResearchDocumentScope,
} from "./research-document-scope.mjs";

const FILES = {
  audits: "data/audit/portal-audit.json",
  reviews: "data/evidence/research-review.json",
  reaudit: "data/evidence/portal-document-reaudit.json",
  documents: "data/documents/catalog.json",
  discoveryDocuments:
    "data/generated/discovered-documents.json",
  report:
    "data/generated/research-document-filter-report.json",
};

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(
      await fs.readFile(file, "utf8")
    );
  } catch {
    return fallback;
  }
};

const writeJson = async (file, value) => {
  await fs.writeFile(
    file,
    JSON.stringify(value, null, 2) + "\n"
  );
};

function recordUrl(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  return (
    record.url ||
    record.sourceUrl ||
    record.parentUrl ||
    null
  );
}

function compactRemoval(
  surface,
  record,
  classification,
  slug = null
) {
  return {
    surface,
    universitySlug:
      slug ||
      record?.universitySlug ||
      record?.slug ||
      null,
    title:
      record?.title ||
      record?.nameFa ||
      record?.label ||
      null,
    url: recordUrl(record),
    parentUrl:
      record?.parentUrl ||
      record?.sourcePage ||
      null,
    reason: classification.reason,
    reasonFa: classification.reasonFa,
    matched: classification.matched,
    strength: classification.strength,
  };
}

function trustedRootsBySlug(audits) {
  const map = new Map();

  for (const audit of audits || []) {
    const roots = [];

    if (
      audit.portalAuditStatus ===
        "direct-official" &&
      audit.researchUrl
    ) {
      roots.push(audit.researchUrl);
    }

    map.set(
      audit.universitySlug,
      roots
    );
  }

  return map;
}

function filterRecords(
  rows,
  surface,
  removals,
  rootsBySlug,
  fixedSlug = null
) {
  const kept = [];

  for (const row of rows || []) {
    const slug =
      fixedSlug ||
      row?.universitySlug ||
      null;

    const classification =
      classifyResearchDocumentScope(
        row,
        {
          researchRoots:
            rootsBySlug.get(slug) || [],
        }
      );

    if (!classification.keep) {
      removals.push(
        compactRemoval(
          surface,
          row,
          classification,
          slug
        )
      );
      continue;
    }

    kept.push(row);
  }

  return kept;
}

const [
  rawAudits,
  rawReviews,
  rawReaudit,
  rawDocuments,
  rawDiscoveryDocuments,
] = await Promise.all([
  readJson(FILES.audits, []),
  readJson(FILES.reviews, []),
  readJson(FILES.reaudit, []),
  readJson(FILES.documents, []),
  readJson(
    FILES.discoveryDocuments,
    { documents: [] }
  ),
]);

const rootsBySlug =
  trustedRootsBySlug(rawAudits);

const removals = [];

const documents = filterRecords(
  rawDocuments,
  "documents-catalog",
  removals,
  rootsBySlug
);

const discoveryDocuments = {
  ...rawDiscoveryDocuments,
  documents: filterRecords(
    rawDiscoveryDocuments?.documents || [],
    "discovered-documents",
    removals,
    rootsBySlug
  ),
};

const reaudit = rawReaudit.map((row) => ({
  ...row,
  directDocuments: filterRecords(
    row.directDocuments || [],
    `reaudit-directDocuments:${row.slug}`,
    removals,
    rootsBySlug,
    row.slug
  ),
}));

const removedUrlKeys = new Set(
  removals
    .map((item) =>
      canonicalScopeUrl(item.url)
    )
    .filter(Boolean)
);

let auditEvidenceRemoved = 0;

const audits = rawAudits.map((audit) => ({
  ...audit,
  evidenceUrls: (
    audit.evidenceUrls || []
  ).filter((url) => {
    const remove =
      removedUrlKeys.has(
        canonicalScopeUrl(url)
      );

    if (remove) {
      auditEvidenceRemoved += 1;
    }

    return !remove;
  }),
}));

let reviewSourcesRemoved = 0;

const reviews = rawReviews.map((review) => {
  const officialSources = [];

  for (
    const source of
      review.officialSources || []
  ) {
    const key =
      canonicalScopeUrl(source.url);

    /*
     * Research-review sources are not all "documents".
     * Do not require a positive document signal here.
     * Only remove a source if its URL was identified as
     * an excluded document, or if it explicitly matches
     * a hard/soft non-research rule.
     */
    const classification =
      classifyResearchDocumentScope(
        source,
        {
          requirePositive: false,
          researchRoots:
            rootsBySlug.get(
              review.universitySlug
            ) || [],
        }
      );

    if (
      (key && removedUrlKeys.has(key)) ||
      !classification.keep
    ) {
      reviewSourcesRemoved += 1;

      if (!classification.keep) {
        removals.push(
          compactRemoval(
            `research-review:${review.universitySlug}`,
            source,
            classification,
            review.universitySlug
          )
        );
      }

      continue;
    }

    officialSources.push(source);
  }

  const sourceUrlMap = new Map();

  for (const source of officialSources) {
    const key =
      canonicalScopeUrl(source.url);

    if (
      key &&
      !sourceUrlMap.has(key)
    ) {
      sourceUrlMap.set(
        key,
        source.url
      );
    }
  }

  return {
    ...review,
    officialSources,
    officialSourceUrls: [
      ...sourceUrlMap.values(),
    ],
  };
});

const countsByReason = {};

for (const item of removals) {
  countsByReason[item.reason] =
    (countsByReason[item.reason] || 0) + 1;
}

const report = {
  schemaVersion: 2,
  policyVersion:
    "research-document-scope-2.0-positive-evidence",
  generatedAt:
    new Date().toISOString(),
  policy: {
    crawlerDiscoveredDocuments:
      "require explicit research/technology/library/laboratory evidence or a trusted direct research-portal context",
    curatedRecords:
      "kept unless an explicit non-research rule matches",
    missingEvidence:
      "excluded from public research-document catalog; exclusion is not proof the document is unimportant, only that research relevance is not established",
  },
  counts: {
    documentsCatalog:
      `${rawDocuments.length}->${documents.length}`,
    discoveredDocuments:
      `${rawDiscoveryDocuments?.documents?.length || 0}->${discoveryDocuments.documents.length}`,
    reauditDirectDocumentsRemoved:
      removals.filter((item) =>
        item.surface.startsWith(
          "reaudit-directDocuments:"
        )
      ).length,
    auditEvidenceUrlsRemoved:
      auditEvidenceRemoved,
    reviewOfficialSourcesRemoved:
      reviewSourcesRemoved,
    removalEvents:
      removals.length,
  },
  countsByReason,
  removed: removals,
};

await Promise.all([
  writeJson(FILES.audits, audits),
  writeJson(FILES.reviews, reviews),
  writeJson(FILES.reaudit, reaudit),
  writeJson(FILES.documents, documents),
  writeJson(
    FILES.discoveryDocuments,
    discoveryDocuments
  ),
  writeJson(FILES.report, report),
]);

const examples = removals
  .filter((item) => item.title || item.url)
  .slice(0, 12)
  .map((item) =>
    `${item.reasonFa}: ${item.title || item.url}`
  );

console.log(
  [
    "research document scope v2 filter complete",
    `catalog=${rawDocuments.length}->${documents.length}`,
    `discovered=${rawDiscoveryDocuments?.documents?.length || 0}->${discoveryDocuments.documents.length}`,
    `reauditRemoved=${report.counts.reauditDirectDocumentsRemoved}`,
    `auditEvidenceRemoved=${auditEvidenceRemoved}`,
    `reviewSourcesRemoved=${reviewSourcesRemoved}`,
    `removalEvents=${removals.length}`,
    `unproven=${countsByReason["unproven-research-scope"] || 0}`,
  ].join(" | ")
);

if (examples.length) {
  console.log(
    `removed examples | ${examples.join(" | ")}`
  );
}
