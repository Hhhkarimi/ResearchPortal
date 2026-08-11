from pathlib import Path

crawler = Path("scripts/deep-crawl-research.mjs")
workflow = Path(".github/workflows/audit.yml")

if not crawler.exists() or not workflow.exists():
    raise SystemExit("Run this from the ResearchPortal repository root.")

s = crawler.read_text(encoding="utf-8")


def rep(old: str, new: str, label: str):
    global s

    if new in s:
        print(f"Already applied: {label}")
        return

    count = s.count(old)

    if count != 1:
        raise SystemExit(
            f"Patch failed at {label}: expected 1 match, found {count}"
        )

    s = s.replace(old, new, 1)
    print(f"Patched: {label}")


# ------------------------------------------------------------
# 1. افزایش عمق و بودجه crawl
# ------------------------------------------------------------

rep(
'''  maxDepth: intEnv("CRAWL_MAX_DEPTH", 3, 1, 6),
  maxPagesPerUniversity: intEnv("CRAWL_MAX_PAGES_PER_UNIVERSITY", 40, 5, 250),
  maxDocumentsPerUniversity: intEnv("CRAWL_MAX_DOCUMENTS_PER_UNIVERSITY", 60, 1, 300),''',

'''  maxDepth: intEnv("CRAWL_MAX_DEPTH", 6, 1, 8),
  maxPagesPerUniversity: intEnv("CRAWL_MAX_PAGES_PER_UNIVERSITY", 90, 5, 250),
  maxDocumentsPerUniversity: intEnv("CRAWL_MAX_DOCUMENTS_PER_UNIVERSITY", 100, 1, 300),''',

"deeper limits",
)


# ------------------------------------------------------------
# 2. تعریف Research Hub
# ------------------------------------------------------------

rep(
'''  "research",
  "vpr",
];

const DIMENSIONS = {''',

'''  "research",
  "vpr",
];

const RESEARCH_HUB_KEYWORDS = [
  "مدیریت پژوهشی",
  "مدیریت پژوهش",
  "مدیریت امور پژوهشی",
  "امور پژوهشی",
  "دفتر پژوهش",
  "اداره پژوهش",
  "معاونت پژوهشی",
  "معاونت پژوهش",
  "معاونت پژوهش و فناوری",
  "پژوهش و فناوری",

  "مدیریت فناوری",
  "ارتباط با صنعت",
  "جامعه و صنعت",
  "صنعت و جامعه",

  "آزمایشگاه مرکزی",
  "شبکه آزمایشگاهی",

  "کتابخانه مرکزی",
  "مرکز اسناد",

  "فرایندهای پژوهشی",
  "فرآیندهای پژوهشی",
  "فرم های پژوهشی",
  "فرم‌های پژوهشی",

  "research management",
  "research administration",
  "research affairs",
  "research office",
  "office of research",

  "vice chancellor for research",
  "vice-chancellor for research",

  "research and technology",
  "technology transfer",
  "industry liaison",

  "central laboratory",
  "central library",

  "/web/mrt/",
  "/mrt/",
  "/research/",
  "/research-affairs/",
  "/research-management/",
];

const DIMENSIONS = {''',

"hub vocabulary",
)


# ------------------------------------------------------------
# 3. Normalize hub keywords
# ------------------------------------------------------------

rep(
'''const normalizedPortalKeywords = PORTAL_KEYWORDS.map(normalizeText);
const normalizedDocumentKeywords = DOCUMENT_KEYWORDS.map(normalizeText);''',

'''const normalizedPortalKeywords = PORTAL_KEYWORDS.map(normalizeText);

const normalizedResearchHubKeywords =
  RESEARCH_HUB_KEYWORDS.map(normalizeText);

const normalizedDocumentKeywords =
  DOCUMENT_KEYWORDS.map(normalizeText);''',

"normalized hub vocabulary",
)


# ------------------------------------------------------------
# 4. Research Hub signal
# ------------------------------------------------------------

rep(
'''function portalSignal(context) {
  return weightedSignal(context, normalizedPortalKeywords);
}

function dimensionSignals(context) {''',

'''function portalSignal(context) {
  return weightedSignal(context, normalizedPortalKeywords);
}

function researchHubSignal(context) {
  return weightedSignal(
    context,
    normalizedResearchHubKeywords
  );
}

function dimensionSignals(context) {''',

"hub signal",
)


# ------------------------------------------------------------
# 5. استخراج URLهایی که CMS داخل JavaScript مخفی کرده
# ------------------------------------------------------------

rep(
'''    }
  }

  return links;
}

function isHtmlContentType(contentType) {''',

'''    }
  }

  // Some university CMS templates keep useful navigation URLs only
  // inside JavaScript/configuration strings instead of <a href>.
  //
  // We only keep URLs which themselves contain a research,
  // research-hub, dimension, or document signal.
  const embeddedSource =
    decodeHtml(String(html)).replace(/\\\\\\//g, "/");

  const embeddedRegex =
    /["'`]((?:https?:\\/\\/|\\/)[^"'`<>\\s]{2,800})["'`]/gi;

  const ignoredAssetExtensions = new Set([
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".map",
  ]);

  while ((match = embeddedRegex.exec(embeddedSource))) {
    const url = safeHttpUrl(
      match[1],
      pageUrl
    );

    if (!url) continue;

    const ext =
      path.extname(
        url.pathname
      ).toLowerCase();

    if (
      ignoredAssetExtensions.has(ext)
    ) {
      continue;
    }

    const context = {
      anchor: "",
      url: url.toString(),
      title: "",
      body: "",
    };

    const portalScore =
      portalSignal(context).score;

    const hubScore =
      researchHubSignal(context).score;

    const dims =
      dimensionSignals(context);

    const dimensionMax =
      Math.max(
        0,
        ...Object.values(dims)
          .map(
            (signal) =>
              signal.score
          )
      );

    if (
      !extensionOfUrl(
        url.toString()
      ) &&
      portalScore < 4 &&
      hubScore < 4 &&
      dimensionMax < 4
    ) {
      continue;
    }

    const key =
      canonicalUrl(
        url.toString()
      ) || url.toString();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    links.push({
      url: url.toString(),
      anchorText: "",
      title: "",
      discoveryKind:
        "embedded-url",
    });
  }

  return links;
}

function isHtmlContentType(contentType) {''',

"embedded JS/CMS URLs",
)


# ------------------------------------------------------------
# 6. Sitemap هم Research Hub را تشخیص دهد
# ------------------------------------------------------------

rep(
'''        const p = portalSignal(context).score;
        const dims = dimensionSignals(context);
        const dimMax = Math.max(...Object.values(dims).map((x) => x.score));
        if (p >= 4 || dimMax >= 4 || extensionOfUrl(value)) {''',

'''        const p =
          portalSignal(context).score;

        const hub =
          researchHubSignal(context).score;

        const dims =
          dimensionSignals(context);

        const dimMax =
          Math.max(
            ...Object.values(dims)
              .map((x) => x.score)
          );

        if (
          p >= 4 ||
          hub >= 4 ||
          dimMax >= 4 ||
          extensionOfUrl(value)
        ) {''',

"hub-aware sitemap",
)


# ------------------------------------------------------------
# 7. Research Hub اولویت خیلی بالاتر داشته باشد
# ------------------------------------------------------------

rep(
'''  const portal = portalSignal(context).score;
  const dimensions = dimensionSignals(context);
  const dimensionMax = Math.max(
    0,
    ...Object.values(dimensions).map((signal) => signal.score)
  );
  const document = looksLikeDocumentLink(link) ? 18 : 0;
  const negative = hasNegativeNavigationSignal(context.anchor) ? -12 : 0;

  return (
    portal * 3 +
    dimensionMax * 2 +
    document +
    (parentResearchContext ? 12 : 0) +
    negative
  );
}''',

'''  const portal =
    portalSignal(context).score;

  const hub =
    researchHubSignal(context).score;

  const dimensions =
    dimensionSignals(context);

  const dimensionMax =
    Math.max(
      0,
      ...Object.values(dimensions)
        .map(
          (signal) =>
            signal.score
        )
    );

  const document =
    looksLikeDocumentLink(link)
      ? 18
      : 0;

  const negative =
    hasNegativeNavigationSignal(
      context.anchor
    )
      ? -12
      : 0;

  return (
    portal * 3 +
    hub * 5 +
    dimensionMax * 2 +
    document +
    (
      parentResearchContext
        ? 12
        : 0
    ) +
    negative
  );
}''',

"hub priority",
)


# ------------------------------------------------------------
# 8. Research Hub همیشه اجازه ورود داشته باشد
# ------------------------------------------------------------

rep(
'''  const portal = portalSignal(context).score;
  const dimensions = dimensionSignals(context);
  const dimensionMax = Math.max(
    0,
    ...Object.values(dimensions).map((signal) => signal.score)
  );

  if (portal >= 4 || dimensionMax >= 5) return true;''',

'''  const portal =
    portalSignal(context).score;

  const hub =
    researchHubSignal(context).score;

  const dimensions =
    dimensionSignals(context);

  const dimensionMax =
    Math.max(
      0,
      ...Object.values(dimensions)
        .map(
          (signal) =>
            signal.score
        )
    );

  if (
    hub >= 4 ||
    portal >= 4 ||
    dimensionMax >= 5
  ) {
    return true;
  }''',

"hub queue gate",
)


# ------------------------------------------------------------
# 9. مسیر کشف را برای Seed نگه داریم
# ------------------------------------------------------------

rep(
'''    seeds.push({
      url: url.toString(),
      depth: 0,
      priority,
      researchContext,
      anchorText: "",
      from: null,
      sourceKind,
    });''',

'''    seeds.push({
      url: url.toString(),
      depth: 0,
      priority,
      researchContext,
      anchorText: "",
      from: null,
      sourceKind,

      discoveryPath: [
        url.toString()
      ],
    });''',

"seed paths",
)


# ------------------------------------------------------------
# 10. صفحات پژوهشی که قبلا شناخته شده‌اند خودشان Seed شوند
# ------------------------------------------------------------

rep(
'''  addSeed(university.officialWebsite, false, 90, "official-website");

  if (!seeds.length) {''',

'''  addSeed(
    university.officialWebsite,
    false,
    90,
    "official-website"
  );

  // Existing official dimension pages can themselves be
  // deep research branches.
  //
  // Only the first two from every dimension are used so old
  // evidence cannot consume the entire crawl budget.
  for (const key of [
    "organizationUrls",
    "libraryUrls",
    "laboratoryUrls",
    "industryTechnologyUrls",
    "informationTechnologyUrls",
    "systemsUrls",
    "documentIndexUrls",
  ]) {
    for (
      const value of
        (
          reauditRow?.[key] ||
          []
        ).slice(0, 2)
    ) {
      addSeed(
        value,
        true,
        100,
        `known-${key}`
      );
    }
  }

  if (!seeds.length) {''',

"known dimension seeds",
)


# ------------------------------------------------------------
# 11. Sitemap همه originها بررسی شود
# ------------------------------------------------------------

rep(
'''  // Pull a filtered subset from sitemaps to improve discovery on CMS sites.
  try {
    const sitemapCandidates = await fetchSitemapCandidates(
      university.officialWebsite || seeds[0].url,
      allowedBases
    );

    for (const value of sitemapCandidates) {
      const key = canonicalUrl(value);
      if (!key || queued.has(key)) continue;
      queued.add(key);
      queue.push({
        url: value,
        depth: 1,
        priority: 45,
        researchContext: false,
        anchorText: "",
        from: university.officialWebsite || seeds[0].url,
        sourceKind: "sitemap",
      });
    }
  } catch {
    // non-fatal
  }''',

'''  // Check sitemaps for EVERY distinct official seed origin.
  //
  // Example:
  //   https://vr.ub.ac.ir/
  //   https://ub.ac.ir/
  //
  // Both are under ub.ac.ir but have separate CMS/robots/sitemaps.
  const sitemapOrigins =
    new Map();

  for (const seed of seeds) {
    const parsed =
      safeHttpUrl(seed.url);

    if (
      parsed &&
      !sitemapOrigins.has(
        parsed.origin
      )
    ) {
      sitemapOrigins.set(
        parsed.origin,
        seed
      );
    }
  }

  for (
    const seed of
      sitemapOrigins.values()
  ) {
    try {
      const sitemapCandidates =
        await fetchSitemapCandidates(
          seed.url,
          allowedBases
        );

      for (
        const value of
          sitemapCandidates
      ) {
        const key =
          canonicalUrl(value);

        if (
          !key ||
          queued.has(key)
        ) {
          continue;
        }

        const hubScore =
          researchHubSignal({
            anchor: "",
            url: value,
            title: "",
            body: "",
          }).score;

        const isHub =
          hubScore >= 4;

        queued.add(key);

        queue.push({
          url: value,

          depth: 1,

          priority:
            isHub
              ? 95
              : seed.researchContext
                ? 65
                : 45,

          researchContext:
            seed.researchContext ||
            isHub,

          anchorText: "",

          from: seed.url,

          sourceKind:
            isHub
              ? "research-hub-sitemap"
              : "sitemap",

          discoveryPath: [
            seed.url,
            value,
          ],
        });
      }
    } catch {
      // Sitemap failures never mean absence.
    }
  }''',

"multi-origin sitemaps",
)


# ------------------------------------------------------------
# 12. Browser روی Research Hub حتما render کند
# ------------------------------------------------------------

rep(
'''      if (
        BROWSER_PATH &&
        CONFIG.useBrowserFallback &&
        links.length < 4 &&
        item.depth <= 2
      ) {''',

'''      const preRenderContext = {
        anchor:
          item.anchorText,

        url:
          resource.finalUrl,

        title: "",
        body: "",
      };

      const preRenderPortalScore =
        portalSignal(
          preRenderContext
        ).score;

      const preRenderHubScore =
        researchHubSignal(
          preRenderContext
        ).score;

      if (
        BROWSER_PATH &&
        CONFIG.useBrowserFallback &&
        (
          item.sourceKind ===
            "known-portal" ||

          item.sourceKind ===
            "research-url" ||

          String(
            item.sourceKind || ""
          ).startsWith(
            "research-hub"
          ) ||

          (
            item.researchContext &&
            links.length < 12 &&
            item.depth <= 2
          ) ||

          preRenderPortalScore >= 4 ||

          preRenderHubScore >= 4 ||

          (
            links.length < 6 &&
            item.depth <= 3
          )
        )
      ) {''',

"forced browser on research hubs",
)


# ------------------------------------------------------------
# 13. Research Hub context را از دست ندهد
# ------------------------------------------------------------

rep(
'''        portal.score >= 8 ||
        item.sourceKind === "known-portal" ||
        item.sourceKind === "research-url";''',

'''        portal.score >= 8 ||

        item.sourceKind ===
          "known-portal" ||

        item.sourceKind ===
          "research-url" ||

        String(
          item.sourceKind || ""
        ).startsWith(
          "research-hub"
        );''',

"hub context inheritance",
)


# ------------------------------------------------------------
# 14. مهم‌ترین بخش:
#     با یافتن Research Hub عمق محلی reset شود
# ------------------------------------------------------------

rep(
'''        const nextDepth = item.depth + 1;
        if (!shouldQueueLink(link, currentResearchContext, nextDepth)) continue;

        const key = canonicalUrl(parsed.toString());
        if (!key || queued.has(key) || visited.has(key)) continue;

        queued.add(key);
        queue.push({
          url: parsed.toString(),
          depth: nextDepth,
          priority: priorityForLink(link, currentResearchContext),
          researchContext:
            currentResearchContext ||
            portalSignal({
              anchor: `${link.anchorText} ${link.title}`,
              url: link.url,
              title: "",
              body: "",
            }).score >= 5,
          anchorText: link.anchorText || link.title,
          from: resource.finalUrl,
          sourceKind: "link",
        });''',

'''        const linkContext = {
          anchor:
            `${link.anchorText} ${link.title}`,

          url:
            link.url,

          title: "",
          body: "",
        };

        const hubScore =
          researchHubSignal(
            linkContext
          ).score;

        const isResearchHub =
          hubScore >= 4;

        // IMPORTANT:
        //
        // A research sub-portal gets a fresh local depth budget.
        //
        // Example:
        //
        // vr.ub.ac.ir
        //   -> ub.ac.ir/web/mrt/home
        //       -> processes
        //          -> forms
        //             -> PDF
        //
        // Even if /web/mrt/home was found deep in the first branch,
        // its own branch starts again at depth 1.
        const nextDepth =
          isResearchHub
            ? 1
            : item.depth + 1;

        if (
          !shouldQueueLink(
            link,
            currentResearchContext ||
              isResearchHub,
            nextDepth
          )
        ) {
          continue;
        }

        const key =
          canonicalUrl(
            parsed.toString()
          );

        if (
          !key ||
          queued.has(key) ||
          visited.has(key)
        ) {
          continue;
        }

        queued.add(key);

        queue.push({
          url:
            parsed.toString(),

          depth:
            nextDepth,

          priority:
            priorityForLink(
              link,
              currentResearchContext
            ) +
            (
              isResearchHub
                ? 60
                : 0
            ),

          researchContext:
            currentResearchContext ||

            isResearchHub ||

            portalSignal(
              linkContext
            ).score >= 5,

          anchorText:
            link.anchorText ||
            link.title,

          from:
            resource.finalUrl,

          sourceKind:
            isResearchHub
              ? (
                  link.discoveryKind ===
                  "embedded-url"
                    ? "research-hub-embedded"
                    : "research-hub"
                )
              : (
                  link.discoveryKind ===
                  "embedded-url"
                    ? "embedded-url"
                    : "link"
                ),

          discoveryPath: [
            ...(
              item.discoveryPath ||
              [resource.finalUrl]
            ),

            parsed.toString(),
          ].slice(-16),
        });''',

"local depth reset on research hubs",
)


# ------------------------------------------------------------
# 15. مسیر کشف Evidence نگه داشته شود
# ------------------------------------------------------------

rep(
'''          kind: "portal",
          discoveredAt: new Date().toISOString(),''',

'''          kind: "portal",

          discoveryPath:
            item.discoveryPath ||
            [resource.finalUrl],

          discoveredAt:
            new Date().toISOString(),''',

"portal discovery path",
)


rep(
'''          kind: "page",
          discoveredAt: new Date().toISOString(),''',

'''          kind: "page",

          discoveryPath:
            item.discoveryPath ||
            [resource.finalUrl],

          discoveredAt:
            new Date().toISOString(),''',

"evidence discovery path",
)


rep(
'''              depth: item.depth + 1,
              linkedFromInstitution: true,
              researchContext: currentResearchContext,
            });''',

'''              depth:
                item.depth + 1,

              linkedFromInstitution:
                true,

              researchContext:
                currentResearchContext,

              discoveryPath: [
                ...(
                  item.discoveryPath ||
                  [resource.finalUrl]
                ),

                parsed.toString(),
              ].slice(-16),
            });''',

"document discovery path",
)


# ------------------------------------------------------------
# 16. metadata خروجی crawler
# ------------------------------------------------------------

rep(
'''    maxDepth: CONFIG.maxDepth,
    maxPagesPerUniversity: CONFIG.maxPagesPerUniversity,
    pageTimeoutMs: CONFIG.pageTimeoutMs,''',

'''    maxDepth:
      CONFIG.maxDepth,

    maxPagesPerUniversity:
      CONFIG.maxPagesPerUniversity,

    maxDocumentsPerUniversity:
      CONFIG.maxDocumentsPerUniversity,

    researchHubDepthReset:
      true,

    embeddedCmsUrlDiscovery:
      true,

    multiOriginSitemaps:
      true,

    pageTimeoutMs:
      CONFIG.pageTimeoutMs,''',

"output crawler capabilities",
)


crawler.write_text(
    s,
    encoding="utf-8",
    newline="\n",
)


# ------------------------------------------------------------
# 17. workflow جدید
# ------------------------------------------------------------

workflow.write_text(
r'''name: National Research Discovery & Evidence Monitor

on:
  workflow_dispatch:
  schedule:
    - cron: "30 2 * * 0,3"

permissions:
  contents: write

concurrency:
  group: national-research-discovery
  cancel-in-progress: true

jobs:
  audit:
    runs-on: [self-hosted, windows, iran-crawler]

    timeout-minutes: 180

    env:
      CRAWL_MAX_DEPTH: "6"

      CRAWL_MAX_PAGES_PER_UNIVERSITY: "90"

      CRAWL_MAX_DOCUMENTS_PER_UNIVERSITY: "100"

      CRAWL_PAGE_TIMEOUT_MS: "12000"

      CRAWL_DOCUMENT_TIMEOUT_MS: "25000"

      CRAWL_BROWSER_TIMEOUT_MS: "25000"

      CRAWL_PAGE_CONCURRENCY: "3"

      CRAWL_UNIVERSITY_CONCURRENCY: "3"

      CRAWL_MAX_DOCUMENT_BYTES: "26214400"

      CRAWL_DOCUMENT_DIR: 'C:\actions-runner\_research-documents'

      CRAWL_USE_BROWSER_FALLBACK: "1"

      DISCOVERY_PROMOTE_CONFIDENCE: "0.78"

    steps:

      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0
          clean: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Sanitize and rebuild current published evidence
        shell: cmd
        run: |
          npm run prepare:data
          npm run validate:data
          npm run validate:no-social

      - name: Publish sanitized baseline
        shell: cmd
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          git add data public/datasets

          git diff --cached --quiet || git commit -m "chore(data): sanitize published evidence"

          git pull --rebase origin main
          git push origin HEAD:main

      - name: Deep crawl official research portals
        shell: cmd
        run: npm run discover:research

      - name: Promote discovery and rebuild evidence datasets
        shell: cmd
        run: npm run prepare:data

      - name: Validate promoted datasets
        shell: cmd
        run: npm run validate:data

      - name: Enforce no social evidence
        shell: cmd
        run: npm run validate:no-social

      - name: Monitor published evidence links
        shell: cmd
        run: npm run monitor:links

      - name: Commit deep crawler results
        shell: cmd
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          git add data public/datasets

          git diff --cached --quiet || git commit -m "chore(crawl): refresh multi-hub deep research evidence"

          git pull --rebase origin main
          git push origin HEAD:main
''',
    encoding="utf-8",
    newline="\n",
)


print()
print("Multi-Hub Deep Crawl upgrade applied.")
print()
print("Changed exactly:")
print("  scripts/deep-crawl-research.mjs")
print("  .github/workflows/audit.yml")
print()
print("Now run:")
print("  node --check scripts/deep-crawl-research.mjs")
print("  git diff --check")
print("  git status --short")
