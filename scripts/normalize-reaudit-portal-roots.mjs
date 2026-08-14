import fs from "node:fs/promises";

const REAUDIT_FILE =
  "data/evidence/portal-document-reaudit.json";

const NON_PORTAL_KEYS = [
  "organizationUrls",
  "libraryUrls",
  "laboratoryUrls",
  "industryTechnologyUrls",
  "systemsUrls",
  "documentIndexUrls",
];

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "yclid",
  "mc_cid",
  "mc_eid",
]);

function urlObject(value) {
  try {
    const url = new URL(
      String(value ?? "")
    );

    if (
      ![
        "http:",
        "https:",
      ].includes(url.protocol)
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function canonicalUrl(value) {
  const url =
    urlObject(value);

  if (!url) {
    return null;
  }

  url.hash = "";

  url.hostname =
    url.hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );

  const parts =
    url.pathname
      .split("/")
      .filter(Boolean);

  for (
    let index = 1;
    index < parts.length;
    index++
  ) {
    if (
      /^(page|news|node|article)$/i.test(
        parts[index - 1]
      ) &&
      /^\d+$/.test(
        parts[index]
      )
    ) {
      url.pathname =
        `/${parts
          .slice(
            0,
            index + 1
          )
          .join("/")}`;

      break;
    }
  }

  if (
    url.pathname.length > 1
  ) {
    url.pathname =
      url.pathname.replace(
        /\/+$/,
        ""
      );
  }

  if (
    /^\/(fa|en|ar|fa-ir|en-us)$/i.test(
      url.pathname
    )
  ) {
    url.pathname = "/";
  }

  const params = [
    ...url.searchParams.entries(),
  ]
    .filter(
      ([key]) =>
        !key
          .toLowerCase()
          .startsWith("utm_") &&
        !TRACKING_PARAMS.has(
          key.toLowerCase()
        )
    )
    .sort(
      (
        [aKey, aValue],
        [bKey, bValue]
      ) =>
        aKey.localeCompare(
          bKey
        ) ||
        aValue.localeCompare(
          bValue
        )
    );

  url.search = "";

  for (
    const [key, value] of params
  ) {
    url.searchParams.append(
      key,
      value
    );
  }

  return url.toString();
}

function uniqueUrls(values) {
  const seen =
    new Map();

  for (
    const value of
      values || []
  ) {
    const key =
      canonicalUrl(value);

    if (
      key &&
      !seen.has(key)
    ) {
      seen.set(
        key,
        value
      );
    }
  }

  return [
    ...seen.values(),
  ];
}

const rows =
  JSON.parse(
    await fs.readFile(
      REAUDIT_FILE,
      "utf8"
    )
  );

if (
  !Array.isArray(rows)
) {
  throw new Error(
    "portal-document-reaudit.json must contain an array"
  );
}

let removedCount = 0;

const removals = [];

for (
  const row of rows
) {
  const portalUrls =
    uniqueUrls(
      row.portalUrls ||
      []
    );

  row.portalUrls =
    portalUrls;

  const portalRoots =
    new Set(
      portalUrls
        .map(
          canonicalUrl
        )
        .filter(Boolean)
    );

  if (
    portalRoots.size === 0
  ) {
    continue;
  }

  for (
    const key of
      NON_PORTAL_KEYS
  ) {
    const original =
      uniqueUrls(
        row[key] ||
        []
      );

    const kept = [];

    for (
      const value of original
    ) {
      const canonical =
        canonicalUrl(value);

      if (
        canonical &&
        portalRoots.has(
          canonical
        )
      ) {
        removedCount += 1;

        removals.push({
          universitySlug:
            row.slug ||
            null,

          field:
            key,

          url:
            value,

          reason:
            "portal-root-cannot-be-dimension-evidence",
        });

        continue;
      }

      kept.push(value);
    }

    row[key] = kept;
  }
}

await fs.writeFile(
  REAUDIT_FILE,
  JSON.stringify(
    rows,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  "=========================================="
);

console.log(
  "Portal-root re-audit normalization complete"
);

console.log(
  `rows=${rows.length}`
);

console.log(
  `removed=${removedCount}`
);

for (
  const item of removals
) {
  console.log(
    [
      "REMOVED",
      item.universitySlug ||
        "unknown",
      item.field,
      item.url,
    ].join(" | ")
  );
}

console.log(
  "Portal roots are retained only as portal identity evidence."
);

console.log(
  "=========================================="
);
