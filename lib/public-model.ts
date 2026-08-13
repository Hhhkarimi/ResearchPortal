export const PUBLIC_DIMENSIONS = [
  ["portalIdentity", "هویت پرتال"],
  ["organization", "ساختار سازمانی"],
  ["libraryDocuments", "کتابخانه و اسناد"],
  ["laboratories", "آزمایشگاه‌ها"],
  ["industryTechnology", "صنعت و فناوری"],
  ["systemsServices", "سامانه‌ها و خدمات"],
  ["documentsRegulations", "اسناد و مقررات"],
] as const;

export const PUBLIC_DIMENSION_COUNT =
  PUBLIC_DIMENSIONS.length;

export const PUBLIC_OUTCOME_COUNT =
  115 *
  PUBLIC_DIMENSION_COUNT;

export const RTPMI_VERSION =
  "4.2";

export const RTPMI_METHODOLOGY_VERSION =
  "RTPMI-4.2-ISC";

const TRACKING_PARAMS =
  new Set([
    "fbclid",
    "gclid",
    "yclid",
    "mc_cid",
    "mc_eid",
  ]);

const GENERIC_TITLES =
  new Set([
    "",
    "سند",
    "سند پژوهشی",
    "دانلود",
    "دانلود فایل",
    "مشاهده",
    "مشاهده فایل",
    "فایل",
    "لینک",
    "صفحه",
  ]);

export function normalizePublicText(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .toLowerCase()
    .replace(
      /\u200c/g,
      " "
    )
    .replace(
      /[يى]/g,
      "ی"
    )
    .replace(
      /ك/g,
      "ک"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function decodeURIComponentSafe(
  value: string
) {
  try {
    return decodeURIComponent(
      value
    );
  } catch {
    return value;
  }
}

function urlObject(
  value: unknown
) {
  try {
    const url =
      new URL(
        String(
          value ?? ""
        )
      );

    return [
      "http:",
      "https:",
    ].includes(
      url.protocol
    )
      ? url
      : null;
  } catch {
    return null;
  }
}

export function isInformationTechnologyText(
  value: unknown
) {
  const text =
    normalizePublicText(
      value
    );

  if (!text) {
    return false;
  }

  return (
    /فناوری\s*اطلاعات/.test(
      text
    ) ||
    /فن\s*آوری\s*اطلاعات/.test(
      text
    ) ||
    /اطلاعات\s*و\s*ارتباطات/.test(
      text
    ) ||
    /مرکز\s*فاوا/.test(
      text
    ) ||
    /مدیریت\s*فاوا/.test(
      text
    ) ||
    /\bفاوا\b/.test(
      text
    ) ||
    /\binformation\s+technology\b/i.test(
      text
    ) ||
    /\binformation\s+(and\s+)?communications?\s+technology\b/i.test(
      text
    ) ||
    /\bict\b/i.test(
      text
    ) ||
    /\bit\s+(center|department|office|unit|services?)\b/i.test(
      text
    ) ||
    /\b(center|department|office|unit)\s+of\s+it\b/i.test(
      text
    )
  );
}

export function canonicalPublicUrl(
  value: unknown
) {
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
          .startsWith(
            "utm_"
          ) &&
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
    const [key, value]
    of params
  ) {
    url.searchParams.append(
      key,
      value
    );
  }

  return url.toString();
}

export function isInformationTechnologyUrl(
  value: unknown
) {
  const url =
    urlObject(value);

  if (!url) {
    return false;
  }

  const hostParts =
    url.hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      )
      .split(".");

  if (
    hostParts.some(
      (part) =>
        [
          "it",
          "ict",
          "cit",
          "fava",
          "faava",
        ].includes(part)
    )
  ) {
    return true;
  }

  const pathParts =
    url.pathname
      .toLowerCase()
      .split("/")
      .filter(Boolean)
      .map(
        (part) =>
          decodeURIComponentSafe(
            part
          ).replace(
            /[_-]+/g,
            " "
          )
      );

  return (
    pathParts.some(
      (part) =>
        [
          "it",
          "ict",
          "cit",
          "fava",
          "faava",
          "information technology",
          "information and communication technology",
          "information communication technology",
        ].includes(part)
    ) ||
    isInformationTechnologyText(
      decodeURIComponentSafe(
        url.toString()
      )
    )
  );
}

export function isInformationTechnologyRecord(
  record: any
) {
  if (
    !record ||
    typeof record !==
      "object"
  ) {
    return false;
  }

  if (
    record.dimension ===
    "informationTechnology"
  ) {
    return true;
  }

  if (
    normalizePublicText(
      record.type
    ) === "it"
  ) {
    return true;
  }

  if (
    normalizePublicText(
      record.category
    ) === "it"
  ) {
    return true;
  }

  const text = [
    record.nameFa,
    record.title,
    record.topic,
    record.label,
    record.claim,
    record.description,
    record.note,
  ]
    .filter(Boolean)
    .join(" ");

  const urls = [
    record.url,
    record.sourceUrl,
    record.parentUrl,
    record.relationshipEvidenceUrl,
  ].filter(Boolean);

  return (
    isInformationTechnologyText(
      text
    ) ||
    urls.some(
      isInformationTechnologyUrl
    )
  );
}

export function uniquePublicUrls(
  values: unknown[]
) {
  const map =
    new Map<
      string,
      string
    >();

  for (
    const value
    of values || []
  ) {
    if (
      isInformationTechnologyUrl(
        value
      )
    ) {
      continue;
    }

    const key =
      canonicalPublicUrl(
        value
      );

    if (
      key &&
      !map.has(key)
    ) {
      map.set(
        key,
        String(value)
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function titleOf(
  record: any
) {
  return String(
    record?.nameFa ||
    record?.title ||
    ""
  ).trim();
}

function quality(
  record: any
) {
  const title =
    titleOf(record);

  const generic =
    GENERIC_TITLES.has(
      normalizePublicText(
        title
      )
    );

  let score =
    generic
      ? 0
      : Math.min(
          10,
          title.length / 20
        );

  if (
    [
      "verified",
      "verified-basic",
      "direct",
      "official",
    ].includes(
      record?.evidence
    )
  ) {
    score += 8;
  }

  if (
    record?.sourceUrl
  ) {
    score += 4;
  }

  if (
    record?.url
  ) {
    score += 3;
  }

  if (
    record?.lastVerified
  ) {
    score += 2;
  }

  if (
    record?.topic
  ) {
    score += 1;
  }

  if (
    record?.taxonomy
  ) {
    score += 1;
  }

  return score;
}

function mergeRecords<
  T extends Record<
    string,
    any
  >
>(
  existing: T,
  incoming: T
): T {
  const preferred =
    quality(incoming) >
    quality(existing)
      ? incoming
      : existing;

  const secondary =
    preferred === incoming
      ? existing
      : incoming;

  const merged = {
    ...secondary,
    ...preferred,
  } as T;

  if (
    existing.id ||
    incoming.id
  ) {
    merged.id =
      existing.id ||
      incoming.id;
  }

  const existingTitle =
    titleOf(existing);

  const incomingTitle =
    titleOf(incoming);

  if (
    GENERIC_TITLES.has(
      normalizePublicText(
        existingTitle
      )
    ) &&
    !GENERIC_TITLES.has(
      normalizePublicText(
        incomingTitle
      )
    )
  ) {
    if (
      incoming.nameFa
    ) {
      merged.nameFa =
        incoming.nameFa;
    }

    if (
      incoming.title
    ) {
      merged.title =
        incoming.title;
    }
  }

  return merged;
}

export function publicCatalogKey(
  record: any
) {
  const slug =
    record
      ?.universitySlug ||
    "unknown";

  const url =
    canonicalPublicUrl(
      record?.url ||
      record?.sourceUrl ||
      record?.parentUrl
    );

  if (url) {
    return `${slug}|url:${url}`;
  }

  return [
    slug,
    "text",
    normalizePublicText(
      titleOf(record)
    ),
    normalizePublicText(
      record?.type ||
      record?.category ||
      record?.topic ||
      ""
    ),
  ].join("|");
}

export function dedupePublicCatalog<
  T extends Record<
    string,
    any
  >
>(
  rows: T[]
) {
  const map =
    new Map<
      string,
      T
    >();

  for (
    const row
    of rows || []
  ) {
    if (
      isInformationTechnologyRecord(
        row
      )
    ) {
      continue;
    }

    const key =
      publicCatalogKey(
        row
      );

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        row
      );
    } else {
      map.set(
        key,
        mergeRecords(
          map.get(key)!,
          row
        )
      );
    }
  }

  return [
    ...map.values(),
  ];
}

export function omitInformationTechnologyDimension<
  T extends Record<
    string,
    any
  >
>(
  value:
    | T
    | undefined
    | null
) {
  const next:
    Record<
      string,
      any
    > = {
      ...(value || {}),
    };

  delete next
    .informationTechnology;

  return next;
}

export function coverageFromPublicDimensions(
  dimensions:
    Record<
      string,
      any
    >
) {
  const values =
    Object.values(
      dimensions ||
      {}
    );

  if (!values.length) {
    return 0;
  }

  const verified =
    values.filter(
      (value) =>
        value ===
        "verified"
    ).length;

  const observed =
    values.filter(
      (value) =>
        value ===
        "observed-reference"
    ).length;

  return Math.round(
    (
      100 *
      (
        verified +
        0.5 * observed
      )
    ) /
      values.length
  );
}
