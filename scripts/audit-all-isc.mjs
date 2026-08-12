/**
 * Non-destructive metadata-only link monitor for every published evidence URL.
 *
 * Goals:
 * - Never turns a network failure into a claim that a service is absent.
 * - Excludes Telegram/social-media URLs from authoritative monitoring.
 * - Avoids downloading full HTML/PDF/DOCX/etc bodies.
 * - Uses HEAD first.
 * - Falls back to GET Range: bytes=0-0 when HEAD is unsupported.
 * - Cancels response bodies immediately after metadata is available.
 */

import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const SOCIAL_HOSTS = new Set([
  "t.me",
  "telegram.me",
  "telegram.org",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
]);

function intEnv(
  name,
  fallback,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
) {
  const value = Number.parseInt(
    process.env[name] ?? "",
    10
  );

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(min, value)
  );
}

const MONITOR_TIMEOUT_MS = intEnv(
  "MONITOR_TIMEOUT_MS",
  10_000,
  2_000,
  60_000
);

const MONITOR_CONCURRENCY = intEnv(
  "MONITOR_CONCURRENCY",
  12,
  1,
  32
);

const MONITOR_HEADERS = {
  "User-Agent":
    "IranResearchPortalObservatory/12.0 (+metadata-link-monitor)",

  Accept:
    "text/html,application/pdf,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.5",

  "Accept-Language":
    "fa-IR,fa;q=0.9,en;q=0.5",
};

const read = async (file) =>
  JSON.parse(
    await fs.readFile(
      file,
      "utf8"
    )
  );

function hostMatches(
  host,
  expected
) {
  return (
    host === expected ||
    host.endsWith(
      `.${expected}`
    )
  );
}

function allowedEvidenceUrl(
  value
) {
  try {
    const url =
      new URL(value);

    if (
      ![
        "http:",
        "https:",
      ].includes(
        url.protocol
      )
    ) {
      return false;
    }

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return ![
      ...SOCIAL_HOSTS,
    ].some(
      (blocked) =>
        hostMatches(
          host,
          blocked
        )
    );
  } catch {
    return false;
  }
}

const [
  audits,
  units,
  systems,
  documents,
  ledger,
] = await Promise.all([
  read(
    "data/audit/portal-audit.json"
  ),

  read(
    "data/units/catalog.json"
  ),

  read(
    "data/systems/catalog.json"
  ),

  read(
    "data/documents/catalog.json"
  ),

  read(
    "data/evidence/provenance-ledger.json"
  ),
]);

const sources = [];

/*
 * ==========================================================
 * COLLECT PUBLISHED URL CLAIMS
 * ==========================================================
 */

// Portal and portal-evidence URLs.
for (
  const row of audits
) {
  if (
    allowedEvidenceUrl(
      row.researchUrl
    )
  ) {
    sources.push({
      url:
        row.researchUrl,

      slug:
        row.universitySlug,

      kind:
        "portal",
    });
  }

  for (
    const url of
      row.evidenceUrls ||
      []
  ) {
    if (
      !allowedEvidenceUrl(
        url
      )
    ) {
      continue;
    }

    sources.push({
      url,

      slug:
        row.universitySlug,

      kind:
        "portal-evidence",
    });
  }
}

// Catalog and provenance URLs.
for (
  const [
    kind,
    rows,
  ] of [
    [
      "unit",
      units,
    ],

    [
      "system",
      systems,
    ],

    [
      "document",
      documents,
    ],

    [
      "provenance",
      ledger,
    ],
  ]
) {
  for (
    const row of rows
  ) {
    const url =
      row.sourceUrl ||
      row.parentUrl ||
      row.url;

    if (
      allowedEvidenceUrl(
        url
      )
    ) {
      sources.push({
        url,

        slug:
          row.universitySlug,

        kind,

        id:
          row.id,
      });
    }
  }
}

/*
 * ==========================================================
 * DE-DUPLICATE URLS
 * ==========================================================
 *
 * One URL may support several claims.
 *
 * We check the URL only once but preserve all claim references.
 */

const grouped =
  new Map();

for (
  const source of sources
) {
  try {
    const key =
      new URL(
        source.url
      ).toString();

    if (
      !grouped.has(key)
    ) {
      grouped.set(
        key,
        {
          url:
            key,

          claims:
            [],
        }
      );
    }

    grouped
      .get(key)
      .claims
      .push({
        slug:
          source.slug,

        kind:
          source.kind,

        id:
          source.id,
      });
  } catch (
    error
  ) {
    console.warn(
      `Skipping invalid URL: ${source.url}`,

      error instanceof
      Error
        ? error.message
        : String(error)
    );
  }
}

const targets = [
  ...grouped.values(),
];

/*
 * ==========================================================
 * PREVIOUS MONITOR RESULT
 * ==========================================================
 *
 * Older versions may contain an array directly.
 * Current format stores records under report.results.
 */

const previousFile =
  await fs
    .readFile(
      "data/generated/site-health.json",
      "utf8"
    )
    .then(
      JSON.parse
    )
    .catch(
      () => []
    );

const previous =
  Array.isArray(
    previousFile
  )
    ? previousFile

    : Array.isArray(
        previousFile
          ?.results
      )
      ? previousFile.results

      : [];

const previousByUrl =
  new Map(
    previous
      .filter(
        (item) =>
          item?.url
      )
      .map(
        (item) => [
          item.url,
          item,
        ]
      )
  );

/*
 * ==========================================================
 * METADATA-ONLY HTTP PROBING
 * ==========================================================
 */

function responseMetadata(
  response,
  probeMethod
) {
  const contentRange =
    response.headers.get(
      "content-range"
    ) || "";

  /*
   * Range GET may return:
   *
   * Content-Range: bytes 0-0/123456
   *
   * Content-Length can then be only "1",
   * so extract the actual total size from Content-Range.
   */
  const totalFromRange =
    contentRange.match(
      /\/(\d+)\s*$/
    )?.[1];

  const rawContentLength =
    totalFromRange ||
    response.headers.get(
      "content-length"
    );

  const parsedLength =
    Number.parseInt(
      rawContentLength ||
        "",
      10
    );

  return {
    status:
      response.status,

    ok:
      response.ok,

    finalUrl:
      response.url,

    contentType:
      response.headers.get(
        "content-type"
      ),

    etag:
      response.headers.get(
        "etag"
      ),

    lastModified:
      response.headers.get(
        "last-modified"
      ),

    contentLength:
      Number.isFinite(
        parsedLength
      )
        ? parsedLength
        : null,

    probeMethod,
  };
}

async function cancelBody(
  response
) {
  try {
    await response
      .body
      ?.cancel();
  } catch {
    /*
     * Metadata is already available.
     * Failure to cancel a body must not fail monitoring.
     */
  }
}

async function probeMetadata(
  url
) {
  let headError =
    null;

  /*
   * --------------------------------------------------------
   * First attempt: HEAD
   * --------------------------------------------------------
   *
   * This normally transfers no document/page body.
   */

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "HEAD",

          redirect:
            "follow",

          headers:
            MONITOR_HEADERS,

          signal:
            AbortSignal.timeout(
              MONITOR_TIMEOUT_MS
            ),
        }
      );

    const metadata =
      responseMetadata(
        response,
        "HEAD"
      );

    await cancelBody(
      response
    );

    /*
     * Some university servers/CDNs reject HEAD while
     * a normal GET still works.
     */
    const headUnsupported =
      [
        400,
        403,
        405,
        406,
        501,
      ].includes(
        response.status
      );

    if (
      !headUnsupported
    ) {
      return metadata;
    }
  } catch (
    error
  ) {
    headError =
      error;
  }

  /*
   * --------------------------------------------------------
   * Fallback: GET Range bytes=0-0
   * --------------------------------------------------------
   *
   * Only request the first byte.
   *
   * If the server ignores Range and responds with a full 200,
   * the body is immediately cancelled instead of intentionally
   * consuming the entire resource.
   */

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          redirect:
            "follow",

          headers: {
            ...MONITOR_HEADERS,

            Range:
              "bytes=0-0",
          },

          signal:
            AbortSignal.timeout(
              MONITOR_TIMEOUT_MS
            ),
        }
      );

    const metadata =
      responseMetadata(
        response,
        "GET-range"
      );

    await cancelBody(
      response
    );

    return metadata;
  } catch (
    rangeError
  ) {
    if (
      rangeError
    ) {
      throw rangeError;
    }

    if (
      headError
    ) {
      throw headError;
    }

    throw new Error(
      "metadata-probe-failed"
    );
  }
}

/*
 * ==========================================================
 * INSPECT ONE URL
 * ==========================================================
 */

async function inspect(
  target
) {
  const checkedAt =
    new Date()
      .toISOString();

  try {
    const metadata =
      await probeMetadata(
        target.url
      );

    /*
     * probeMethod intentionally does NOT participate in
     * the signature.
     *
     * A URL should not be considered changed just because
     * one run used HEAD and another required GET Range.
     */
    const signaturePayload = {
      status:
        metadata.status,

      ok:
        metadata.ok,

      finalUrl:
        metadata.finalUrl,

      contentType:
        metadata.contentType,

      etag:
        metadata.etag,

      lastModified:
        metadata.lastModified,

      contentLength:
        metadata.contentLength,
    };

    const signature =
      createHash(
        "sha256"
      )
        .update(
          JSON.stringify(
            signaturePayload
          )
        )
        .digest(
          "hex"
        )
        .slice(
          0,
          16
        );

    const before =
      previousByUrl.get(
        target.url
      );

    return {
      ...target,
      ...metadata,

      signature,
      checkedAt,

      change:
        !before
          ? "new"

          : before
                .signature !==
              signature
            ? "changed"

            : "unchanged",
    };
  } catch (
    error
  ) {
    /*
     * Network failure is recorded only as check-failed.
     *
     * It must never become evidence that the portal,
     * system, document, or service does not exist.
     */
    return {
      ...target,

      status:
        "network-error",

      ok:
        false,

      error:
        error instanceof
        Error
          ? error.message
          : String(error),

      checkedAt,

      change:
        "check-failed",
    };
  }
}

/*
 * ==========================================================
 * CONCURRENT MONITORING
 * ==========================================================
 */

const results = [];

let cursor = 0;
let completed = 0;

const startedAt =
  Date.now();

console.log(
  [
    "[monitor] starting",

    `urls=${targets.length}`,

    `claims=${sources.length}`,

    `concurrency=${MONITOR_CONCURRENCY}`,

    `timeout=${MONITOR_TIMEOUT_MS}ms`,

    "mode=metadata-only",

    "probe=HEAD+Range-fallback",
  ].join(
    " | "
  )
);

const workers =
  Array.from(
    {
      length:
        Math.min(
          MONITOR_CONCURRENCY,
          Math.max(
            1,
            targets.length
          )
        ),
    },

    async () => {
      while (
        cursor <
        targets.length
      ) {
        const index =
          cursor++;

        results[index] =
          await inspect(
            targets[index]
          );

        completed++;

        if (
          completed % 100 ===
            0 ||
          completed ===
            targets.length
        ) {
          const elapsedSeconds =
            Math.round(
              (
                Date.now() -
                startedAt
              ) /
                1000
            );

          console.log(
            [
              "[monitor] progress",

              `${completed}/${targets.length}`,

              `elapsed=${elapsedSeconds}s`,
            ].join(
              " | "
            )
          );
        }
      }
    }
  );

await Promise.all(
  workers
);

/*
 * ==========================================================
 * SUMMARIZE RESULT
 * ==========================================================
 */

const counts =
  results.reduce(
    (
      output,
      row
    ) => {
      output[
        row.change
      ] =
        (
          output[
            row.change
          ] ||
          0
        ) + 1;

      return output;
    },

    {}
  );

const probeCounts =
  results.reduce(
    (
      output,
      row
    ) => {
      const method =
        row.probeMethod ||
        "failed";

      output[
        method
      ] =
        (
          output[
            method
          ] ||
          0
        ) + 1;

      return output;
    },

    {}
  );

const elapsedMs =
  Date.now() -
  startedAt;

const report = {
  schemaVersion:
    1,

  checkedAt:
    new Date()
      .toISOString(),

  monitorMode:
    "metadata-only",

  probeStrategy:
    "HEAD with Range GET fallback",

  timeoutMs:
    MONITOR_TIMEOUT_MS,

  concurrency:
    MONITOR_CONCURRENCY,

  elapsedMs,

  uniqueUrls:
    targets.length,

  claimReferences:
    sources.length,

  probeCounts,

  counts,

  results,
};

/*
 * ==========================================================
 * WRITE GENERATED REPORTS
 * ==========================================================
 */

await fs.mkdir(
  "data/generated",
  {
    recursive: true,
  }
);

await fs.writeFile(
  "data/generated/site-health.json",

  JSON.stringify(
    report,
    null,
    2
  ) + "\n"
);

await fs.writeFile(
  "data/generated/change-report.json",

  JSON.stringify(
    {
      checkedAt:
        report.checkedAt,

      monitorMode:
        report.monitorMode,

      probeStrategy:
        report.probeStrategy,

      timeoutMs:
        report.timeoutMs,

      concurrency:
        report.concurrency,

      elapsedMs:
        report.elapsedMs,

      changed:
        results.filter(
          (item) =>
            item.change ===
            "changed"
        ),

      failed:
        results.filter(
          (item) =>
            !item.ok
        ),

      new:
        results.filter(
          (item) =>
            item.change ===
            "new"
        ),
    },

    null,
    2
  ) + "\n"
);

/*
 * ==========================================================
 * FINAL LOG
 * ==========================================================
 */

console.log(
  [
    `[monitor] completed`,

    `urls=${targets.length}`,

    `claims=${sources.length}`,

    `changed=${counts.changed || 0}`,

    `new=${counts.new || 0}`,

    `unchanged=${counts.unchanged || 0}`,

    `failed=${
      results.filter(
        (item) =>
          !item.ok
      ).length
    }`,

    `head=${probeCounts.HEAD || 0}`,

    `range=${probeCounts["GET-range"] || 0}`,

    `elapsed=${Math.round(elapsedMs / 1000)}s`,
  ].join(
    " | "
  )
);
