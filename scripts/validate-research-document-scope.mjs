import fs from "node:fs/promises";

import {
  classifyResearchDocumentScope,
} from "./research-document-scope.mjs";

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(
      await fs.readFile(file, "utf8")
    );
  } catch {
    return fallback;
  }
};

const [
  documents,
  reaudit,
  discoveryDocuments,
  reviews,
] = await Promise.all([
  readJson(
    "data/documents/catalog.json",
    []
  ),
  readJson(
    "data/evidence/portal-document-reaudit.json",
    []
  ),
  readJson(
    "data/generated/discovered-documents.json",
    { documents: [] }
  ),
  readJson(
    "data/evidence/research-review.json",
    []
  ),
]);

const failures = [];

function check(record, surface, slug = null) {
  const classification =
    classifyResearchDocumentScope(record);

  if (classification.keep) {
    return;
  }

  failures.push({
    surface,
    universitySlug:
      slug ||
      record?.universitySlug ||
      null,
    title:
      record?.title ||
      record?.nameFa ||
      record?.label ||
      null,
    url:
      record?.url ||
      record?.sourceUrl ||
      null,
    reasonFa:
      classification.reasonFa,
    matched:
      classification.matched,
  });
}

for (const item of documents) {
  check(item, "documents-catalog");
}

for (const row of reaudit) {
  for (
    const item of
      row.directDocuments || []
  ) {
    check(
      item,
      "reaudit-directDocuments",
      row.slug
    );
  }
}

for (
  const item of
    discoveryDocuments?.documents || []
) {
  check(item, "discovered-documents");
}

for (const review of reviews) {
  for (
    const source of
      review.officialSources || []
  ) {
    check(
      source,
      "research-review",
      review.universitySlug
    );
  }
}

if (failures.length) {
  const sample = failures
    .slice(0, 20)
    .map((item) =>
      `${item.surface} ${item.universitySlug || "-"} | ${item.reasonFa} | ${item.title || item.url || "بدون عنوان"}`
    )
    .join("\n");

  throw new Error(
    [
      `Non-research student/administrative records leaked into research evidence: ${failures.length}`,
      sample,
    ].join("\n")
  );
}

console.log(
  [
    "research document scope validation passed",
    `documents=${documents.length}`,
    `reauditRows=${reaudit.length}`,
    `discovered=${discoveryDocuments?.documents?.length || 0}`,
    `reviews=${reviews.length}`,
  ].join(" | ")
);
