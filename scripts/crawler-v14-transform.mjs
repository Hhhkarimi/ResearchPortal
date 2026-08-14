const VERSION = "14.0-hub-interactive-relations";

function requiredReplace(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);

  if (next === source) {
    throw new Error(
      `Crawler v14 transform failed: ${label}`
    );
  }

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
    if (rule.host && host === rule.host) {
      return {...rule, host};
    }

    if (rule.suffix && host.endsWith(rule.suffix)) {
      return {...rule, host};
    }
  }

  const normalized = normalizeText(text);

  if (/گیگالیب|gigalib|گیگاپیپر|gigapaper|مگاپیپر|megapaper/.test(normalized)) {
    return {
      host,
      dimension:"libraryDocuments",
      ownershipHint:"commercial-external"
    };
  }

  if (/شاعا|emshaa|\bshaa\b/.test(normalized)) {
    return {
      host,
      serviceId:"shaa",
      dimension:"laboratories",
      ownershipHint:"ministry-national"
    };
  }

  if (/سامانه ساتع|\bsate\b|سامانه ساجد|\bsajed\b|سامانه مپفا|\bmapfa\b|سامانه نان/.test(normalized)) {
    return {
      host,
      dimension:"systemsServices",
      ownershipHint:"national-shared"
    };
  }

  return null;
}

function v14EntityHint(dimension, text) {
  const value = normalizeText(text);

  if (dimension === "systemsServices") {
    return "system";
  }

  if (dimension === "documentsRegulations") {
    return "document-index";
  }

  if (dimension === "organization") {
    return "unit";
  }

  if (dimension === "laboratories") {
    return "unit";
  }

  if (dimension === "libraryDocuments") {
    return /کتابخانه|انتشارات|نشریات|library|publication|journal/.test(value)
      ? "unit"
      : "service-page";
  }

  if (dimension === "industryTechnology") {
    return /مدیریت|مرکز|دفتر|اداره|office|center|management|incubator/.test(value)
      ? "unit"
      : "service-page";
  }

  return "service-page";
}

function v14SemanticHints({
  dimension,
  url,
  title = "",
  anchorText = "",
  bases
}) {
  const universityOwned =
    isInstitutionUrl(url, bases);

  const semanticText =
    [title, anchorText, url]
      .filter(Boolean)
      .join(" ");

  const entityHint =
    v14EntityHint(
      dimension,
      semanticText
    );

  const strong =
    countHits(
      semanticText,
      N_DIMS[dimension] || []
    );

  return {
    entityHint,

    relationHint:
      universityOwned
        ? "belongs-to"
        : "links-to",

    ownershipHint:
      universityOwned
        ? "university"
        : "unknown-external",

    ownershipScope:
      universityOwned
        ? "university"
        : "unknown-external",

    discoveryConfidence:
      null,

    semanticConfidence:
      Math.min(
        0.98,
        0.66 +
          Math.min(strong, 3) * 0.08 +
          (universityOwned ? 0.08 : 0)
      ),

    countTowardUniversitySystems:
      universityOwned &&
      entityHint === "system",

    countTowardRTPMI:
      universityOwned,
  };
}
`;

export function transformCrawlerSource(input) {
  /*
   * IMPORTANT:
   *
   * GitHub self-hosted Windows runners may check files out with CRLF.
   * The v14 transform intentionally contains a number of structural,
   * multi-line replacements written against LF.
   *
   * Normalize the source exactly once before performing ANY transform.
   * This makes the transform deterministic on Windows, Linux and macOS.
   */
  let source =
    String(input)
      .replace(/\r\n?/g, "\n");

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
    [
      /(maxDepth:\s*intEnv\("CRAWL_MAX_DEPTH",\s*)6(,\s*1,\s*8\))/,
      8
    ],

    [
      /(maxPagesPerUniversity:\s*intEnv\("CRAWL_MAX_PAGES_PER_UNIVERSITY",\s*)90(,\s*10,\s*250\))/,
      200
    ],

    [
      /(maxPagesPerHub:\s*intEnv\("CRAWL_MAX_PAGES_PER_HUB",\s*)35(,\s*5,\s*100\))/,
      60
    ],

    [
      /(maxResearchHubs:\s*intEnv\("CRAWL_MAX_RESEARCH_HUBS",\s*)12(,\s*1,\s*40\))/,
      24
    ],

    [
      /(maxDocumentsPerUniversity:\s*intEnv\("CRAWL_MAX_DOCUMENTS_PER_UNIVERSITY",\s*)100(,\s*1,\s*300\))/,
      250
    ],
  ];

  for (
    const [
      pattern,
      value
    ] of configReplacements
  ) {
    source = requiredReplace(
      source,
      pattern,
      (
        _,
        left,
        right
      ) =>
        `${left}${value}${right}`,
      `config ${value}`
    );
  }

  source = requiredReplace(
    source,
    /(browserTimeoutMs:\s*intEnv\("CRAWL_BROWSER_TIMEOUT_MS",\s*25_000,\s*3_000,\s*90_000\),)/,
    `$1
  browserClickBudget: intEnv("CRAWL_BROWSER_CLICK_BUDGET", 6, 0, 12),
  browserClickWaitMs: intEnv("CRAWL_BROWSER_CLICK_WAIT_MS", 900, 250, 4000),
  browserActionLogLimit: intEnv("CRAWL_BROWSER_ACTION_LOG_LIMIT", 240, 20, 1000),`,
    "interactive config"
  );

  source = requiredReplace(
    source,
    /const NEGATIVE = \[[\s\S]*?\n\];/,
    `const NEGATIVE = [
  "اخبار", "خبر", "رویداد", "تقویم", "پذیرش", "ثبت نام",
  "news", "event", "calendar", "admission", "undergraduate",
];`,
    "negative keyword relaxation"
  );

  /*
   * Remove the standalone IT dimension.
   *
   * The input has already been normalized to LF above, therefore this
   * structural replacement behaves identically on Windows and Linux.
   */
  source = requiredReplace(
    source,
    /\n  informationTechnology:\s*\{[\s\S]*?\n  \},\n  systemsServices:/,
    "\n  systemsServices:",
    "IT dimension removal"
  );

  /*
   * Remove IT URL seed keys from both arrays of known seed names.
   */
  source =
    source.replace(
      /\n\s*"informationTechnologyUrls",/g,
      ""
    );

  /*
   * Remove the IT URL seed value from checkpointSeedShape.
   */
  source =
    source.replace(
      /\n\s*informationTechnologyUrls:\s*[\s\S]*?\[\],\n(?=\s*systemsUrls:)/g,
      "\n"
    );

  source = requiredReplace(
    source,
    /function decodeURIComponentSafe/,
    `${SEMANTIC_HELPERS}
function decodeURIComponentSafe`,
    "semantic helper insertion"
  );

  source =
    source.replace(
      /IranResearchPortalObservatory\/12\.2 \(\+multi-hub-smart-document-metadata\)/g,
      "IranResearchPortalObservatory/14.0 (+hub-interactive-relations-metadata-only)"
    );

  source = requiredReplace(
    source,
    /async function render\(url\) \{[\s\S]*?\n\}\n\nconst robotsCache =/,
    `async function render(url, universitySlug = "unknown") {
  if (!BROWSER_PATH) return null;

  return interactiveRender(
    BROWSER_PATH,
    url,
    {
      timeoutMs:
        CONFIG.browserTimeoutMs,

      clickBudget:
        CONFIG.browserClickBudget,

      clickWaitMs:
        CONFIG.browserClickWaitMs,

      universitySlug,
    }
  );
}

const robotsCache =`,
    "interactive render replacement"
  );

  source = requiredReplace(
    source,
    /(browserTimeoutMs:\s*\n\s*CONFIG\s*\n\s*\.browserTimeoutMs,\n)(\s*\n\s*pageConcurrency:)/,
    `$1
    browserClickBudget:
      CONFIG.browserClickBudget,

    browserClickWaitMs:
      CONFIG.browserClickWaitMs,

    browserActionLogLimit:
      CONFIG.browserActionLogLimit,
$2`,
    "checkpoint interactive config"
  );

  source = requiredReplace(
    source,
    /let browserPages =\s*\n?\s*0;/,
    `let browserPages =
    0;

  const browserActions = [];`,
    "browser action accumulator"
  );

  source = requiredReplace(
    source,
    /const evidence =\s*\n?\s*new Map\(\);/,
    `const evidence =
    new Map();

  const references =
    new Map();`,
    "reference map"
  );

  source = requiredReplace(
    source,
    /const rendered =\s*await render\([\s\S]*?\n\s*\}\n\s*\}\n\n\s*const pageTitle =/,
    `const rendered =
          await render(
            response.finalUrl,
            university.slug
          );

        if (rendered?.html) {
          const renderedLinks =
            extractLinks(
              rendered.html,
              rendered.finalUrl ||
                response.finalUrl
            );

          if (
            renderedLinks.length >
            links.length
          ) {
            html =
              rendered.html;

            links =
              renderedLinks;

            browserPages++;
          }

          if (
            rendered.actions?.length &&
            browserActions.length <
              CONFIG.browserActionLogLimit
          ) {
            const room =
              CONFIG.browserActionLogLimit -
              browserActions.length;

            browserActions.push(
              ...rendered.actions
                .slice(
                  0,
                  room
                )
                .map(
                  (
                    action
                  ) => ({
                    ...action,

                    sourcePage:
                      response.finalUrl,

                    depth:
                      item.depth,
                  })
                )
            );
          }
        }
      }

      const pageTitle =`,
    "render call object handling"
  );

  source = requiredReplace(
    source,
    /\n\s*if \(\n\s*record\.confidence >=/,
    `
        const semanticHints =
          v14SemanticHints({
            dimension,

            url:
              response.finalUrl,

            title:
              pageTitle,

            anchorText:
              item.anchorText,

            bases,
          });

        Object.assign(
          record,
          semanticHints,
          {
            discoveryConfidence:
              record.confidence,
          }
        );

        if (
          record.confidence >=`,
    "semantic hints on page evidence"
  );

  source = requiredReplace(
    source,
    /\n\s*if \(\n\s*!isInstitutionUrl\(\n\s*parsed\.toString\(\),\n\s*bases\n\s*\) \|\|\n\s*extOf\(/,
    `
        const externalService =
          v14ExternalService(
            parsed.toString(),

            [
              link.anchorText,
              link.title,
              link.contextText,
              link.sectionHeading,
            ]
              .filter(Boolean)
              .join(" ")
          );

        if (externalService) {
          const referenceRecord = {
            universitySlug:
              university.slug,

            nameFa:
              university.nameFa,

            dimension:
              externalService.dimension,

            labelFa:
              DIMENSIONS[
                externalService.dimension
              ]?.labelFa ||
              externalService.dimension,

            url:
              parsed.toString(),

            sourcePage:
              response.finalUrl,

            anchorText:
              link.anchorText ||
              link.title ||
              "",

            title:
              link.title ||
              link.anchorText ||
              "",

            depth:
              item.depth + 1,

            kind:
              "external-reference",

            entityHint:
              "external-service",

            relationHint:
              "links-to",

            ownershipHint:
              externalService.ownershipHint,

            ownershipScope:
              externalService.ownershipHint,

            serviceId:
              externalService.serviceId ||
              null,

            discoveryConfidence:
              0.94,

            semanticConfidence:
              0.99,

            confidence:
              0.94,

            countTowardUniversitySystems:
              false,

            countTowardRTPMI:
              false,

            officialDomain:
              false,

            researchContext:
              research,

            discoveryPath:
              chain,

            discoveredAt:
              new Date()
                .toISOString(),
          };

          const referenceKey =
            university.slug +
            "|" +
            externalService.dimension +
            "|" +
            canonicalUrl(
              parsed.toString()
            );

          if (
            !references.has(
              referenceKey
            )
          ) {
            references.set(
              referenceKey,
              referenceRecord
            );
          }
        }

        if (
          !isInstitutionUrl(
            parsed.toString(),
            bases
          ) ||
          extOf(`,
    "external reference capture"
  );

  source = requiredReplace(
    source,
    /const candidate = \{\n\s*universitySlug:[\s\S]*?\n\s*discoveredAt:[\s\S]*?\n\s*\};\n\n\s*const previous =\n\s*portals\.get/,
    (
      block
    ) =>
      block.replace(
        /\n\s*const previous =\n\s*portals\.get/,
        `
        Object.assign(
          candidate,
          {
            entityHint:
              "hub",

            relationHint:
              "belongs-to",

            ownershipHint:
              "university",

            ownershipScope:
              "university",

            discoveryConfidence:
              candidate.confidence,

            semanticConfidence:
              Math.min(
                0.99,
                0.78 +
                  Math.min(
                    candidate.score,
                    12
                  ) /
                    100
              ),
          }
        );

        const previous =
          portals.get`
      ),
    "portal semantic hints"
  );

  source = requiredReplace(
    source,
    /\n\s*portalCandidates:\s*\[[\s\S]*?\n\s*failures,\n\s*\};\n\}/,
    (
      block
    ) =>
      block.replace(
        /\n\s*failures,\n/,
        `
    references:
      [...references.values()]
        .sort(
          (
            a,
            b
          ) =>
            b.semanticConfidence -
            a.semanticConfidence
        ),

    browserActions,

    failures,
`
      ),
    "return references/actions"
  );

  source = requiredReplace(
    source,
    /const allPortals =\s*[\s\S]*?\n\s*\);\n\nconst dimensionCounts =/,
    (
      block
    ) =>
      `${block.replace(
        /\nconst dimensionCounts =$/,
        ""
      )}

const allReferences =
  results.flatMap(
    (
      result
    ) =>
      result.references ||
      []
  );

const allBrowserActions =
  results.flatMap(
    (
      result
    ) =>
      result.browserActions ||
      []
  );

const dimensionCounts =`,
    "aggregate references/actions"
  );

  source = requiredReplace(
    source,
    /const evidenceOutput = \{\n\s*schemaVersion:\s*\n\s*1,/,
    `const evidenceOutput = {
  schemaVersion:
    1,

  crawlerVersion:
    CRAWLER_VERSION,`,
    "evidence crawlerVersion"
  );

  source = requiredReplace(
    source,
    /\n\s*evidence:\s*\n\s*allEvidence,\s*\n\s*portalCandidates:/,
    `
  evidence:
    allEvidence,

  references:
    allReferences,

  portalCandidates:`,
    "reference output"
  );

  source = requiredReplace(
    source,
    /const docsOutput = \{\n\s*schemaVersion:\s*\n\s*1,/,
    `const docsOutput = {
  schemaVersion:
    1,

  crawlerVersion:
    CRAWLER_VERSION,`,
    "docs crawlerVersion"
  );

  source = requiredReplace(
    source,
    /const summary = \{\n\s*schemaVersion:\s*\n\s*1,/,
    `const summary = {
  schemaVersion:
    1,

  crawlerVersion:
    CRAWLER_VERSION,`,
    "summary crawlerVersion"
  );

  source = requiredReplace(
    source,
    /\n\s*evidenceRecords:\s*\n\s*allEvidence\.length,/,
    `
  evidenceRecords:
    allEvidence.length,

  referenceRecords:
    allReferences.length,

  interactiveActions:
    allBrowserActions.length,`,
    "summary reference/action counts"
  );

  source = requiredReplace(
    source,
    /await Promise\.all\(\[\n(?=\s*fs\.writeFile\(\n\s*"data\/generated\/discovery-evidence\.json")/,
    `const actionOutput = {
  schemaVersion:
    1,

  crawlerVersion:
    CRAWLER_VERSION,

  generatedAt:
    new Date()
      .toISOString(),

  actions:
    allBrowserActions,
};

await Promise.all([
`,
    "action output declaration"
  );

  source = requiredReplace(
    source,
    /\n\s*fs\.writeFile\(\n\s*"data\/generated\/discovery-summary\.json",[\s\S]*?\n\s*\),\n\]\);/,
    (
      block
    ) =>
      block.replace(
        /\n\]\);$/,
        `

  fs.writeFile(
    "data/generated/crawl-v14-actions.json",

    JSON.stringify(
      actionOutput,
      null,
      2
    ) + "\\n"
  )
]);`
      ),
    "action output file"
  );

  source = requiredReplace(
    source,
    /`browser=\$\{/,
    '`v14References=${allReferences.length}`,\n\n    `interactiveActions=${allBrowserActions.length}`,\n\n    `browser=${',
    "final log counts"
  );

  /*
   * Safety assertions on the generated runtime source.
   */
  if (
    /informationTechnology\s*:/
      .test(source)
  ) {
    throw new Error(
      "Crawler v14 transform left informationTechnology dimension in runtime source"
    );
  }

  if (
    /informationTechnologyUrls/
      .test(source)
  ) {
    throw new Error(
      "Crawler v14 transform left informationTechnologyUrls in runtime source"
    );
  }

  if (
    !source.includes(
      "interactiveRender"
    )
  ) {
    throw new Error(
      "Interactive browser hook missing"
    );
  }

  if (
    !source.includes(
      "external-reference"
    )
  ) {
    throw new Error(
      "External-reference capture missing"
    );
  }

  if (
    !source.includes(
      VERSION
    )
  ) {
    throw new Error(
      "Crawler v14 version missing"
    );
  }

  return source;
}

export const CRAWLER_V14_VERSION =
  VERSION;
