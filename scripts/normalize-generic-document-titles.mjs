import fs from "node:fs/promises";
import path from "node:path";

const DOCUMENTS_FILE =
  "data/documents/catalog.json";

const REAUDIT_FILE =
  "data/evidence/portal-document-reaudit.json";

const GENERIC_TITLES = new Set([
  "",
  "دانلود",
  "دانلود فایل",
  "دریافت",
  "دریافت فایل",
  "مشاهده",
  "مشاهده فایل",
  "فایل",
  "سند",
  "سند پژوهشی",
  "پیوست",
  "download",
  "download file",
  "file",
  "document",
  "attachment",
  "click here",
]);

const PATH_NOISE = new Set([
  "fa",
  "en",
  "ar",
  "fa-ir",
  "en-us",
  "research",
  "research-and-technology",
  "file",
  "files",
  "download",
  "downloads",
  "document",
  "documents",
  "regulation",
  "regulations",
  "category",
  "categories",
  "page",
  "pages",
]);

function decodeRepeated(
  value,
  rounds = 3
) {
  let current =
    String(value ?? "");

  for (
    let index = 0;
    index < rounds;
    index += 1
  ) {
    if (
      !/%[0-9a-f]{2}/i.test(
        current
      )
    ) {
      break;
    }

    try {
      const decoded =
        decodeURIComponent(
          current
        );

      if (
        decoded === current
      ) {
        break;
      }

      current = decoded;
    } catch {
      break;
    }
  }

  return current;
}

function normalizeText(
  value
) {
  return decodeRepeated(value)
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(
      /[\u064B-\u065F]/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLabel(
  value
) {
  return decodeRepeated(value)
    .replace(/[_+]+/g, " ")
    .replace(
      /-{2,}/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /فرم\s+های/gu,
      "فرم‌های"
    )
    .replace(
      /آیین\s+نامه/gu,
      "آیین‌نامه"
    )
    .replace(
      /شیوه\s+نامه/gu,
      "شیوه‌نامه"
    )
    .replace(
      /پایان\s+نامه/gu,
      "پایان‌نامه"
    );
}

function isGenericTitle(
  value
) {
  return GENERIC_TITLES.has(
    normalizeText(value)
  );
}

function validUrl(
  value
) {
  try {
    const url =
      new URL(
        String(value ?? "")
      );

    return [
      "http:",
      "https:",
    ].includes(
      url.protocol
    );
  } catch {
    return false;
  }
}

function contextFromUrl(
  value
) {
  if (
    !validUrl(value)
  ) {
    return null;
  }

  try {
    const url =
      new URL(value);

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean)
        .map(
          (item) =>
            cleanLabel(item)
        )
        .filter(Boolean);

    for (
      let index =
        parts.length - 1;
      index >= 0;
      index -= 1
    ) {
      const part =
        parts[index];

      const normalized =
        normalizeText(part);

      if (
        !normalized ||
        PATH_NOISE.has(
          normalized
        ) ||
        /^\d+$/.test(
          normalized
        ) ||
        /^\d+\.(?:html?|php|aspx?)$/i.test(
          normalized
        )
      ) {
        continue;
      }

      const extension =
        path.extname(
          normalized
        );

      if (
        extension &&
        [
          ".pdf",
          ".doc",
          ".docx",
          ".xls",
          ".xlsx",
          ".ppt",
          ".pptx",
          ".rtf",
          ".zip",
        ].includes(
          extension.toLowerCase()
        )
      ) {
        continue;
      }

      if (
        part.length >= 3 &&
        part.length <= 180
      ) {
        return part;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function fileIdentifier(
  record
) {
  const candidates = [
    record?.fileName,
    record?.url,
    record?.sourceUrl,
  ].filter(Boolean);

  for (
    const value of candidates
  ) {
    let name =
      String(value);

    try {
      if (
        validUrl(value)
      ) {
        name =
          new URL(value)
            .pathname
            .split("/")
            .filter(Boolean)
            .at(-1) ||
          "";
      }
    } catch {
      // Continue with the raw value.
    }

    name =
      decodeRepeated(name)
        .replace(
          /\.(?:pdf|docx?|xlsx?|pptx?|rtf|odt|ods|odp|csv|txt|zip)$/i,
          ""
        )
        .replace(
          /[-_\s]+$/g,
          ""
        )
        .trim();

    if (!name) {
      continue;
    }

    const numeric =
      name.match(
        /\d{5,}/
      );

    if (numeric) {
      return numeric[0];
    }

    const cleaned =
      cleanLabel(name);

    if (
      cleaned &&
      !isGenericTitle(
        cleaned
      ) &&
      !/^[\d._ -]+$/.test(
        cleaned
      )
    ) {
      return cleaned
        .slice(
          0,
          100
        );
    }
  }

  return null;
}

function deriveTitle(
  record
) {
  const context =
    contextFromUrl(
      record?.parentUrl
    ) ||
    contextFromUrl(
      record?.sourcePage
    );

  const identifier =
    fileIdentifier(
      record
    );

  if (
    context &&
    identifier
  ) {
    return `${context} — فایل ${identifier}`;
  }

  if (context) {
    return context;
  }

  if (
    identifier &&
    !/^\d+$/.test(
      identifier
    )
  ) {
    return identifier;
  }

  return null;
}

function normalizeRecord(
  record,
  location
) {
  if (
    !record ||
    typeof record !==
      "object"
  ) {
    return false;
  }

  if (
    !isGenericTitle(
      record.title
    )
  ) {
    return false;
  }

  const derived =
    deriveTitle(record);

  if (
    !derived ||
    isGenericTitle(
      derived
    )
  ) {
    return false;
  }

  const previous =
    record.title ||
    null;

  record.title =
    derived;

  if (
    previous &&
    !record.originalTitle
  ) {
    record.originalTitle =
      previous;
  }

  console.log(
    [
      "RETITLED",
      location,
      record.universitySlug ||
        "unknown",
      record.id ||
        "-",
      previous ||
        "(empty)",
      "=>",
      derived,
      record.url ||
        record.sourceUrl ||
        "",
    ].join(" | ")
  );

  return true;
}

const [
  documents,
  reaudit,
] = await Promise.all([
  fs
    .readFile(
      DOCUMENTS_FILE,
      "utf8"
    )
    .then(JSON.parse),

  fs
    .readFile(
      REAUDIT_FILE,
      "utf8"
    )
    .then(JSON.parse),
]);

if (
  !Array.isArray(
    documents
  )
) {
  throw new Error(
    "documents catalog must contain an array"
  );
}

if (
  !Array.isArray(
    reaudit
  )
) {
  throw new Error(
    "portal-document-reaudit must contain an array"
  );
}

let documentChanges = 0;
let reauditChanges = 0;

for (
  const document of
    documents
) {
  if (
    normalizeRecord(
      document,
      "documents"
    )
  ) {
    documentChanges += 1;
  }
}

for (
  const row of reaudit
) {
  for (
    const document of
      row.directDocuments ||
      []
  ) {
    const record = {
      ...document,
      universitySlug:
        row.slug,
    };

    if (
      normalizeRecord(
        record,
        "reaudit:directDocuments"
      )
    ) {
      document.title =
        record.title;

      if (
        record.originalTitle
      ) {
        document.originalTitle =
          record.originalTitle;
      }

      reauditChanges += 1;
    }
  }
}

const remainingGeneric =
  documents.filter(
    (record) =>
      isGenericTitle(
        record?.title
      )
  );

if (
  remainingGeneric.length
) {
  console.error(
    "Generic document titles still remain:"
  );

  for (
    const record of
      remainingGeneric
  ) {
    console.error(
      [
        record.universitySlug ||
          "unknown",
        record.id ||
          "-",
        record.title ||
          "(empty)",
        record.url ||
          record.sourceUrl ||
          "",
      ].join(" | ")
    );
  }

  throw new Error(
    `Unable to derive trustworthy titles for ${remainingGeneric.length} document(s)`
  );
}

await Promise.all([
  fs.writeFile(
    DOCUMENTS_FILE,
    JSON.stringify(
      documents,
      null,
      2
    ) + "\n",
    "utf8"
  ),

  fs.writeFile(
    REAUDIT_FILE,
    JSON.stringify(
      reaudit,
      null,
      2
    ) + "\n",
    "utf8"
  ),
]);

console.log(
  "=========================================="
);

console.log(
  "Generic document title normalization complete"
);

console.log(
  `documentsRetitled=${documentChanges}`
);

console.log(
  `reauditDocumentsRetitled=${reauditChanges}`
);

console.log(
  "remainingGeneric=0"
);

console.log(
  "=========================================="
);
