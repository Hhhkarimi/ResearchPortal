import fs from "node:fs/promises";
import { createHash } from "node:crypto";

import {
  canonicalEntityUrl,
  logicalEntityKey,
  validEntityUrl,
} from "./entity-cleaning-policy.mjs";

const FILES = {
  units: "data/units/catalog.json",
  systems: "data/systems/catalog.json",
  documents: "data/documents/catalog.json",
};

const CATALOG_ORDER = [
  "units",
  "systems",
  "documents",
];

const readJson = async (file) =>
  JSON.parse(
    await fs.readFile(
      file,
      "utf8"
    )
  );

const writeJson = async (
  file,
  value
) => {
  await fs.writeFile(
    file,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    "utf8"
  );
};

function targetUrl(record) {
  return (
    record?.url ||
    record?.sourceUrl ||
    record?.parentUrl ||
    null
  );
}

function canonicalTarget(record) {
  const value =
    targetUrl(record);

  if (
    !value ||
    !validEntityUrl(value)
  ) {
    return null;
  }

  return (
    canonicalEntityUrl(value) ||
    value
  );
}

function safeSlug(value) {
  const normalized =
    String(
      value ||
      "unknown"
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9-]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return (
    normalized ||
    "unknown"
  );
}

function catalogPrefix(
  catalogKind
) {
  if (
    catalogKind ===
    "units"
  ) {
    return "unit";
  }

  if (
    catalogKind ===
    "systems"
  ) {
    return "system";
  }

  if (
    catalogKind ===
    "documents"
  ) {
    return "document";
  }

  return "entity";
}

function deterministicId(
  catalogKind,
  record,
  salt = ""
) {
  const slug =
    safeSlug(
      record?.universitySlug
    );

  const canonical =
    canonicalTarget(record) ||
    "";

  const logical =
    logicalEntityKey(
      record
    );

  const title =
    String(
      record?.nameFa ||
      record?.title ||
      ""
    ).trim();

  const seed = [
    catalogKind,
    slug,
    canonical,
    logical,
    title,
    salt,
  ].join("|");

  const hash =
    createHash("sha256")
      .update(seed)
      .digest("hex")
      .slice(0, 16);

  return [
    slug,
    "entity",
    catalogPrefix(
      catalogKind
    ),
    hash,
  ].join("-");
}

function sortCatalog(rows) {
  return [
    ...rows,
  ].sort(
    (
      a,
      b
    ) =>
      String(
        a.universitySlug ||
        ""
      ).localeCompare(
        String(
          b.universitySlug ||
          ""
        )
      ) ||
      String(
        a.id ||
        ""
      ).localeCompare(
        String(
          b.id ||
          ""
        )
      )
  );
}

function findDuplicateIds(
  catalogs
) {
  const occurrences =
    new Map();

  for (
    const catalogKind of
      CATALOG_ORDER
  ) {
    for (
      const row of
        catalogs[
          catalogKind
        ]
    ) {
      const id =
        String(
          row?.id ||
          ""
        ).trim();

      if (!id) {
        continue;
      }

      if (
        !occurrences.has(id)
      ) {
        occurrences.set(
          id,
          []
        );
      }

      occurrences
        .get(id)
        .push({
          catalogKind,
          row,
        });
    }
  }

  return new Set(
    [
      ...occurrences
        .entries(),
    ]
      .filter(
        (
          [
            ,
            records,
          ]
        ) =>
          records.length >
          1
      )
      .map(
        ([id]) =>
          id
      )
  );
}

function allIds(
  catalogs
) {
  return CATALOG_ORDER
    .flatMap(
      (catalogKind) =>
        catalogs[
          catalogKind
        ]
    )
    .map(
      (row) =>
        String(
          row?.id ||
          ""
        ).trim()
    )
    .filter(Boolean);
}

function assertUniqueIds(
  catalogs
) {
  const seen =
    new Map();

  for (
    const catalogKind of
      CATALOG_ORDER
  ) {
    for (
      const row of
        catalogs[
          catalogKind
        ]
    ) {
      const id =
        String(
          row?.id ||
          ""
        ).trim();

      if (!id) {
        throw new Error(
          `Entity without id after stabilization: ${catalogKind} | ${row?.universitySlug || "unknown"}`
        );
      }

      if (
        seen.has(id)
      ) {
        const previous =
          seen.get(id);

        throw new Error(
          [
            "Duplicate entity id remains after stabilization:",
            id,
            `first=${previous.catalogKind}:${previous.universitySlug}`,
            `second=${catalogKind}:${row?.universitySlug || "unknown"}`,
          ].join(" ")
        );
      }

      seen.set(
        id,
        {
          catalogKind,
          universitySlug:
            row?.universitySlug ||
            "unknown",
        }
      );
    }
  }
}

const catalogs = {
  units:
    await readJson(
      FILES.units
    ),

  systems:
    await readJson(
      FILES.systems
    ),

  documents:
    await readJson(
      FILES.documents
    ),
};

const duplicateIds =
  findDuplicateIds(
    catalogs
  );

const reservedIds =
  new Set();

for (
  const catalogKind of
    CATALOG_ORDER
) {
  for (
    const row of
      catalogs[
        catalogKind
      ]
  ) {
    const id =
      String(
        row?.id ||
        ""
      ).trim();

    if (
      id &&
      !duplicateIds.has(
        id
      )
    ) {
      reservedIds.add(id);
    }
  }
}

const assignedIds =
  new Set(
    reservedIds
  );

const repairs = [];

for (
  const catalogKind of
    CATALOG_ORDER
) {
  const repairedRows = [];

  for (
    const original of
      catalogs[
        catalogKind
      ]
  ) {
    const row = {
      ...original,
    };

    const previousId =
      String(
        row?.id ||
        ""
      ).trim();

    const needsRepair =
      !previousId ||
      duplicateIds.has(
        previousId
      );

    if (
      !needsRepair
    ) {
      repairedRows.push(
        row
      );

      continue;
    }

    let attempt = 0;
    let nextId;

    do {
      nextId =
        deterministicId(
          catalogKind,
          row,
          attempt
            ? String(
                attempt
              )
            : ""
        );

      attempt += 1;
    } while (
      assignedIds.has(
        nextId
      )
    );

    assignedIds.add(
      nextId
    );

    row.id =
      nextId;

    repairs.push({
      catalog:
        catalogKind,

      universitySlug:
        row.universitySlug ||
        null,

      previousId:
        previousId ||
        null,

      newId:
        nextId,

      title:
        row.nameFa ||
        row.title ||
        null,

      url:
        targetUrl(row),

      reason:
        previousId
          ? "duplicate-id"
          : "missing-id",
    });

    repairedRows.push(
      row
    );
  }

  catalogs[
    catalogKind
  ] =
    sortCatalog(
      repairedRows
    );
}

assertUniqueIds(
  catalogs
);

await Promise.all([
  writeJson(
    FILES.units,
    catalogs.units
  ),

  writeJson(
    FILES.systems,
    catalogs.systems
  ),

  writeJson(
    FILES.documents,
    catalogs.documents
  ),
]);

const ids =
  allIds(
    catalogs
  );

console.log(
  "=========================================="
);

console.log(
  "Entity ID stabilization complete"
);

console.log(
  `units=${catalogs.units.length}`
);

console.log(
  `systems=${catalogs.systems.length}`
);

console.log(
  `documents=${catalogs.documents.length}`
);

console.log(
  `totalIds=${ids.length}`
);

console.log(
  `duplicateGroups=${duplicateIds.size}`
);

console.log(
  `repairedRecords=${repairs.length}`
);

for (
  const repair of
    repairs
) {
  console.log(
    [
      "REPAIRED",
      repair.catalog,
      repair.universitySlug,
      repair.previousId ||
        "(missing)",
      "=>",
      repair.newId,
      repair.url ||
        "",
    ].join(" | ")
  );
}

console.log(
  "All catalog entity IDs are globally unique."
);

console.log(
  "=========================================="
);
