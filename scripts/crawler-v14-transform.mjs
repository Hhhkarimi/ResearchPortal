const VERSION = "14.0-hub-interactive-relations";

function requiredReplace(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Crawler v14 transform failed: ${label}`);
  return next;
}

const SEMANTIC_HELPERS = String.raw`
const V14_EXTERNAL_SERVICES = [
  {host:"shaa.msrt.ir", serviceId:"shaa", dimension:"laboratories", ownershipHint:"ministry-national"},
  {host:"emshaa.msrt.ir", serviceId:"shaa", dimension:"laboratories", ownershipHint:"ministry-national"},
  {suffix:".msrt.ir", dimension:"systemsServices", ownershipHint:"ministry-national"},
  {host:"jcr.isc.ac", dimension:"libraryDocuments", ownershipHint:"national-shared"},
  {host:"isc.ac", dimension:"libraryDocuments", ownershipHint:"national-shared"},
  {suffix:".isc.ac", dimension:"libraryDocuments", ownershipHint:"national-shared"},
  {host:"sate.atf.gov.ir", dimension:"systemsServices", ownershipHint:"national-shared"},
  {host:"nan.ac", dimension:"systemsServices", ownershipHint:"national-shared"},
  {host:"gigalib.org", dimension:"libraryDocuments", ownershipHint:"commercial-external"},
  {host:"gigalib.ir", dimension:"libraryDocuments", ownershipHint:"commercial-external"},
  {host:"gigapaper.ir", dimension:"libraryDocuments", ownershipHint:"commercial-external"},
  {host:"megapaper.ir", dimension:"libraryDocuments", ownershipHint:"commercial-external"},
];

function v14ExternalService(value, text = "") {
  const parsed = safeHttpUrl(value);
  if (!parsed) return null;
  const host = stripWww(parsed.hostname);
  for (const rule of V14_EXTERNAL_SERVICES) {
    if (rule.host && host === rule.host) return {...rule, host};
    if (rule.suffix && host.endsWith(rule.suffix)) return {...rule, host};
  }
  const normalized = normalizeText(text);
  if (/گیگالیب|gigalib|گیگاپیپر|gigapaper|مگاپیپر|megapaper/.test(normalized)) {
    return {host, dimension:"libraryDocuments", ownershipHint:"commercial-external"};
  }
  if (/شاعا|emshaa|\bshaa\b/.test(normalized)) {
    return {host, serviceId:"shaa", dimension:"laboratories", ownershipHint:"ministry-national"};
  }
  if (/سامانه ساتع|\bsate\b|سامانه ساجد|\bsajed\b|سامانه مپفا|\bmapfa\b|سامانه نان/.test(normalized)) {
    return {host, dimension:"systemsServices", ownershipHint:"national-shared"};
  }
  return null;
}

function v14EntityHint(dimension, text) {
  const value = normalizeText(text);
  if (dimension === "systemsServices") return "system";
  if (dimension === "documentsRegulations") return "document-index";
  if (dimension === "organization") return "unit";
  if (dimension === "laboratories") return "unit";
  if (dimension === "libraryDocuments") {
    return /کتابخانه|انتشارات|نشریات|library|publication|journal/.test(value) ? "unit" : "service-page";
  }
  if (dimension === "industryTechnology") {
    return /مدیریت|مرکز|دفتر|اداره|office|center|management|incubator/.test(value) ? "unit" : "service-page";
  }
  return "service-page";
}

function v14SemanticHints({dimension, url, title="", anchorText="", bases}) {
  const universityOwned = isInstitutionUrl(url, bases);
  const semanticText = [title, anchorText, url].filter(Boolean).join(" ");
  const entityHint = v14EntityHint(dimension, semanticText);
  const strong = countHits(semanticText, N_DIMS[dimension] || []);
  return {
    entityHint,
    relationHint: universityOwned ? "belongs-to" : "links-to",
    ownershipHint: universityOwned ? "university" : "unknown-external",
    ownershipScope: universityOwned ? "university" : "unknown-external",
    discoveryConfidence: null,
    semanticConfidence: Math.min(0.98, 0.66 + Math.min(strong, 3) * 0.08 + (universityOwned ? 0.08 : 0)),
    countTowardUniversitySystems: universityOwned && entityHint === "system",
    countTowardRTPMI: universityOwned,
  };
}
`;

export function transformCrawlerSource(input) {
  let source = String(input);

  source = requiredReplace(
    source,
    /import \{ promisify \} from "node:util";/,
    'import { promisify } from "node:util";\nimport { interactiveRender } from "./crawler-v14-browser.mjs";',
    "browser helper import"
  );

  source = requiredReplace(
    source,
    /const CRAWLER_VERSION =\s*\n?\s*"[^"]+";/,
    `const CRAWLER_VERSION =\n  "${VERSION}";`,
    "crawler version"
  );

  const configReplacements = [
    [/(maxDepth:\s*intEnv\("CRAWL_MAX_DEPTH",\s*)6(,\s*1,\s*8\))/, 8],
    [/(maxPagesPerUniversity:\s*intEnv\("CRAWL_MAX_PAGES_PER_UNIVERSITY",\s*)90(,\s*10,\s*250\))/, 200],
    [/(maxPagesPerHub:\s*intEnv\("CRAWL_MAX_PAGES_PER_HUB",\s*)35(,\s*5,\s*100\))/, 60],
    [/(maxResearchHubs:\s*intEnv\("CRAWL_MAX_RESEARCH_HUBS",\s*)12(,\s*1,\s*40\))/, 24],
    [/(maxDocumentsPerUniversity:\s*intEnv\("CRAWL_MAX_DOCUMENTS_PER_UNIVERSITY",\s*)100(,\s*1,\s*300\))/, 250],
  ];
  for (const [pattern, value] of configReplacements) {
    source = requiredReplace(source, pattern, (_, left, right) => `${left}${value}${right}`, `config ${value}`);
  }

  source = requiredReplace(
    source,
    /(browserTimeoutMs:\s*intEnv\("CRAWL_BROWSER_TIMEOUT_MS",\s*25_000,\s*3_000,\s*90_000\),)/,
    `$1\n  browserClickBudget: intEnv("CRAWL_BROWSER_CLICK_BUDGET", 6, 0, 12),\n  browserClickWaitMs: intEnv("CRAWL_BROWSER_CLICK_WAIT_MS", 900, 250, 4000),\n  browserActionLogLimit: intEnv("CRAWL_BROWSER_ACTION_LOG_LIMIT", 240, 20, 1000),`,
    "interactive config"
  );

  source = requiredReplace(
    source,
    /const NEGATIVE = \[[\s\S]*?\n\];/,
    `const NEGATIVE = [\n  "اخبار", "خبر", "رویداد", "تقویم", "پذیرش", "ثبت نام",\n  "news", "event", "calendar", "admission", "undergraduate",\n];`,
    "negative keyword relaxation"
  );

  source = requiredReplace(
    source,
    /\n  informationTechnology:\s*\{[\s\S]*?\n  \},\n  systemsServices:/,
    "\n  systemsServices:",
    "IT dimension removal"
  );

  source = source.replace(/\n\s*"informationTechnologyUrls",/g, "");
  source = source.replace(
    /\n\s*informationTechnologyUrls:\s*[\s\S]*?\[\],\n(?=\s*systemsUrls:)/g,
    "\n"
  );

  source = requiredReplace(
    source,
    /function decodeURIComponentSafe/,
    `${SEMANTIC_HELPERS}\nfunction decodeURIComponentSafe`,
    "semantic helper insertion"
  );

  source = source.replace(
    /IranResearchPortalObservatory\/12\.2 \(\+multi-hub-smart-document-metadata\)/g,
    "IranResearchPortalObservatory/14.0 (+hub-interactive-relations-metadata-only)"
  );

  source = requiredReplace(
    source,
    /async function render\(url\) \{[\s\S]*?\n\}\n\nconst robotsCache =/,
    `async function render(url, universitySlug = "unknown") {\n  if (!BROWSER_PATH) return null;\n  return interactiveRender(BROWSER_PATH, url, {\n    timeoutMs: CONFIG.browserTimeoutMs,\n    clickBudget: CONFIG.browserClickBudget,\n    clickWaitMs: CONFIG.browserClickWaitMs,\n    universitySlug,\n  });\n}\n\nconst robotsCache =`,
    "interactive render replacement"
  );

  source = requiredReplace(
    source,
    /(browserTimeoutMs:\s*\n\s*CONFIG\s*\n\s*\.browserTimeoutMs,\n)(\s*\n\s*pageConcurrency:)/,
    `$1\n    browserClickBudget:\n      CONFIG.browserClickBudget,\n\n    browserClickWaitMs:\n      CONFIG.browserClickWaitMs,\n\n    browserActionLogLimit:\n      CONFIG.browserActionLogLimit,\n$2`,
    "checkpoint interactive config"
  );

  source = requiredReplace(
    source,
    /let browserPages =\s*\n?\s*0;/,
    `let browserPages =\n    0;\n\n  const browserActions = [];`,
    "browser action accumulator"
  );

  source = requiredReplace(
    source,
    /const evidence =\s*\n?\s*new Map\(\);/,
    `const evidence =\n    new Map();\n\n  const references =\n    new Map();`,
    "reference map"
  );

  source = requiredReplace(
    source,
    /const rendered =\s*await render\([\s\S]*?\n\s*\}\n\s*\}\n\n\s*const pageTitle =/,
    `const rendered =\n          await render(\n            response.finalUrl,\n            university.slug\n          );\n\n        if (rendered?.html) {\n          const renderedLinks =\n            extractLinks(\n              rendered.html,\n              rendered.finalUrl || response.finalUrl\n            );\n\n          if (\n            renderedLinks.length >\n            links.length\n          ) {\n            html = rendered.html;\n            links = renderedLinks;\n            browserPages++;\n          }\n\n          if (rendered.actions?.length && browserActions.length < CONFIG.browserActionLogLimit) {\n            const room = CONFIG.browserActionLogLimit - browserActions.length;\n            browserActions.push(\n              ...rendered.actions.slice(0, room).map((action) => ({\n                ...action,\n                sourcePage: response.finalUrl,\n                depth: item.depth,\n              }))\n            );\n          }\n        }\n      }\n\n      const pageTitle =`,
    "render call object handling"
  );

  source = requiredReplace(
    source,
    /\n\s*if \(\n\s*record\.confidence >=/,
    `\n        const semanticHints = v14SemanticHints({\n          dimension,\n          url: response.finalUrl,\n          title: pageTitle,\n          anchorText: item.anchorText,\n          bases,\n        });\n        Object.assign(record, semanticHints, {\n          discoveryConfidence: record.confidence,\n        });\n\n        if (\n          record.confidence >=`,
    "semantic hints on page evidence"
  );

  source = requiredReplace(
    source,
    /\n\s*if \(\n\s*!isInstitutionUrl\(\n\s*parsed\.toString\(\),\n\s*bases\n\s*\) \|\|\n\s*extOf\(/,
    `\n        const externalService = v14ExternalService(parsed.toString(), [link.anchorText, link.title, link.contextText, link.sectionHeading].filter(Boolean).join(" "));\n        if (externalService) {\n          const referenceRecord = {\n            universitySlug: university.slug,\n            nameFa: university.nameFa,\n            dimension: externalService.dimension,\n            labelFa: DIMENSIONS[externalService.dimension]?.labelFa || externalService.dimension,\n            url: parsed.toString(),\n            sourcePage: response.finalUrl,\n            anchorText: link.anchorText || link.title || "",\n            title: link.title || link.anchorText || "",\n            depth: item.depth + 1,\n            kind: "external-reference",\n            entityHint: "external-service",\n            relationHint: "links-to",\n            ownershipHint: externalService.ownershipHint,\n            ownershipScope: externalService.ownershipHint,\n            serviceId: externalService.serviceId || null,\n            discoveryConfidence: 0.94,\n            semanticConfidence: 0.99,\n            confidence: 0.94,\n            countTowardUniversitySystems: false,\n            countTowardRTPMI: false,\n            officialDomain: false,\n            researchContext: research,\n            discoveryPath: chain,\n            discoveredAt: new Date().toISOString(),\n          };\n          const referenceKey = university.slug + "|" + externalService.dimension + "|" + canonicalUrl(parsed.toString());\n          if (!references.has(referenceKey)) references.set(referenceKey, referenceRecord);\n        }\n\n        if (\n          !isInstitutionUrl(\n            parsed.toString(),\n            bases\n          ) ||\n          extOf(`,
    "external reference capture"
  );

  source = requiredReplace(
    source,
    /const candidate = \{\n\s*universitySlug:[\s\S]*?\n\s*discoveredAt:[\s\S]*?\n\s*\};\n\n\s*const previous =\n\s*portals\.get/,
    (block) => block.replace(
      /\n\s*const previous =\n\s*portals\.get/,
      `\n        Object.assign(candidate, {\n          entityHint: "hub",\n          relationHint: "belongs-to",\n          ownershipHint: "university",\n          ownershipScope: "university",\n          discoveryConfidence: candidate.confidence,\n          semanticConfidence: Math.min(0.99, 0.78 + Math.min(candidate.score, 12) / 100),\n        });\n\n        const previous =\n          portals.get`
    ),
    "portal semantic hints"
  );

  source = requiredReplace(
    source,
    /\n\s*portalCandidates:\s*\[[\s\S]*?\n\s*failures,\n\s*\};\n\}/,
    (block) => block.replace(
      /\n\s*failures,\n/,
      `\n    references:\n      [...references.values()].sort((a, b) => b.semanticConfidence - a.semanticConfidence),\n\n    browserActions,\n\n    failures,\n`
    ),
    "return references/actions"
  );

  source = requiredReplace(
    source,
    /const allPortals =\s*[\s\S]*?\n\s*\);\n\nconst dimensionCounts =/,
    (block) => `${block.replace(/\nconst dimensionCounts =$/, "")}\n\nconst allReferences =\n  results.flatMap((result) => result.references || []);\n\nconst allBrowserActions =\n  results.flatMap((result) => result.browserActions || []);\n\nconst dimensionCounts =`,
    "aggregate references/actions"
  );

  source = requiredReplace(
    source,
    /const evidenceOutput = \{\n\s*schemaVersion:\s*\n\s*1,/,
    `const evidenceOutput = {\n  schemaVersion:\n    1,\n\n  crawlerVersion:\n    CRAWLER_VERSION,`,
    "evidence crawlerVersion"
  );

  source = requiredReplace(
    source,
    /\n\s*evidence:\s*\n\s*allEvidence,\s*\n\s*portalCandidates:/,
    `\n  evidence:\n    allEvidence,\n\n  references:\n    allReferences,\n\n  portalCandidates:`,
    "reference output"
  );

  source = requiredReplace(
    source,
    /const docsOutput = \{\n\s*schemaVersion:\s*\n\s*1,/,
    `const docsOutput = {\n  schemaVersion:\n    1,\n\n  crawlerVersion:\n    CRAWLER_VERSION,`,
    "docs crawlerVersion"
  );

  source = requiredReplace(
    source,
    /const summary = \{\n\s*schemaVersion:\s*\n\s*1,/,
    `const summary = {\n  schemaVersion:\n    1,\n\n  crawlerVersion:\n    CRAWLER_VERSION,`,
    "summary crawlerVersion"
  );

  source = requiredReplace(
    source,
    /\n\s*evidenceRecords:\s*\n\s*allEvidence\.length,/,
    `\n  evidenceRecords:\n    allEvidence.length,\n\n  referenceRecords:\n    allReferences.length,\n\n  interactiveActions:\n    allBrowserActions.length,`,
    "summary reference/action counts"
  );

  source = requiredReplace(
    source,
    /await Promise\.all\(\[\n(?=\s*fs\.writeFile\(\n\s*"data\/generated\/discovery-evidence\.json")/,
    `const actionOutput = {\n  schemaVersion: 1,\n  crawlerVersion: CRAWLER_VERSION,\n  generatedAt: new Date().toISOString(),\n  actions: allBrowserActions,\n};\n\nawait Promise.all([\n`,
    "action output declaration"
  );

  source = requiredReplace(
    source,
    /\n\s*fs\.writeFile\(\n\s*"data\/generated\/discovery-summary\.json",[\s\S]*?\n\s*\),\n\]\);/,
    (block) => block.replace(
      /\n\]\);$/,
      `\n\n  fs.writeFile(\n    "data/generated/crawl-v14-actions.json",\n    JSON.stringify(actionOutput, null, 2) + "\\n"\n  )\n]);`
    ),
    "action output file"
  );

  source = requiredReplace(
    source,
    /`browser=\$\{/,
    '`v14References=${allReferences.length}`,\n\n    `interactiveActions=${allBrowserActions.length}`,\n\n    `browser=${',
    "final log counts"
  );

  // Safety assertions on the generated runtime source.
  if (/informationTechnology\s*:/.test(source)) {
    throw new Error("Crawler v14 transform left informationTechnology dimension in runtime source");
  }
  if (/informationTechnologyUrls/.test(source)) {
    throw new Error("Crawler v14 transform left informationTechnologyUrls in runtime source");
  }
  if (!source.includes("interactiveRender")) throw new Error("Interactive browser hook missing");
  if (!source.includes("external-reference")) throw new Error("External-reference capture missing");
  if (!source.includes(VERSION)) throw new Error("Crawler v14 version missing");

  return source;
}

export const CRAWLER_V14_VERSION = VERSION;
