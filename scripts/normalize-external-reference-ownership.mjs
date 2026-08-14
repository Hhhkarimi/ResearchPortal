import fs from "node:fs/promises";

const FILE =
  "data/generated/reference-pages.json";

const EXACT_SERVICES = new Map([
  [
    "shaa.msrt.ir",
    {
      serviceId: "shaa",
      dimension: "laboratories",
      ownerType: "ministry",
      ownershipScope: "ministry-national",
    },
  ],

  [
    "emshaa.msrt.ir",
    {
      serviceId: "shaa",
      dimension: "laboratories",
      ownerType: "ministry",
      ownershipScope: "ministry-national",
    },
  ],

  [
    "sajed.msrt.ir",
    {
      serviceId: "sajed",
      dimension: null,
      ownerType: "ministry",
      ownershipScope: "ministry-national",
    },
  ],

  [
    "mapfa.msrt.ir",
    {
      serviceId: "mapfa",
      dimension: null,
      ownerType: "ministry",
      ownershipScope: "ministry-national",
    },
  ],

  [
    "sate.atf.gov.ir",
    {
      serviceId: "sate",
      dimension: null,
      ownerType: "national-agency",
      ownershipScope: "national-shared",
    },
  ],

  [
    "jcr.isc.ac",
    {
      serviceId: "isc-jcr",
      dimension: "libraryDocuments",
      ownerType: "national-index",
      ownershipScope: "national-shared",
    },
  ],

  [
    "nan.ac",
    {
      serviceId: "nan",
      dimension: null,
      ownerType: "national-platform",
      ownershipScope: "national-shared",
    },
  ],

  [
    "gigalib.org",
    {
      serviceId: "gigalib",
      dimension: "libraryDocuments",
      ownerType: "external-provider",
      ownershipScope: "commercial-external",
    },
  ],

  [
    "gigalib.ir",
    {
      serviceId: "gigalib",
      dimension: "libraryDocuments",
      ownerType: "external-provider",
      ownershipScope: "commercial-external",
    },
  ],

  [
    "gigapaper.ir",
    {
      serviceId: "gigapaper",
      dimension: "libraryDocuments",
      ownerType: "external-provider",
      ownershipScope: "commercial-external",
    },
  ],

  [
    "megapaper.ir",
    {
      serviceId: "megapaper",
      dimension: "libraryDocuments",
      ownerType: "external-provider",
      ownershipScope: "commercial-external",
    },
  ],
]);

function hostOf(value) {
  try {
    return new URL(
      String(value ?? "")
    )
      .hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );
  } catch {
    return null;
  }
}

function externalServiceFor(
  value
) {
  const host =
    hostOf(value);

  if (!host) {
    return null;
  }

  if (
    EXACT_SERVICES.has(host)
  ) {
    return {
      ...EXACT_SERVICES.get(
        host
      ),
    };
  }

  if (
    host === "msrt.ir" ||
    host.endsWith(
      ".msrt.ir"
    )
  ) {
    return {
      serviceId: null,
      dimension: null,
      ownerType:
        "ministry",
      ownershipScope:
        "ministry-national",
    };
  }

  if (
    host === "isc.ac" ||
    host.endsWith(
      ".isc.ac"
    )
  ) {
    return {
      serviceId: null,
      dimension:
        "libraryDocuments",
      ownerType:
        "national-index",
      ownershipScope:
        "national-shared",
    };
  }

  return null;
}

function reasonFor(
  service
) {
  if (
    service.serviceId ===
    "shaa"
  ) {
    return (
      "msrt-shaa-national-service-not-university-system"
    );
  }

  if (
    service.ownershipScope ===
    "commercial-external"
  ) {
    return (
      "third-party-research-access-service-not-university-system"
    );
  }

  return (
    "national-shared-service-not-university-system"
  );
}

const references =
  JSON.parse(
    await fs.readFile(
      FILE,
      "utf8"
    )
  );

if (
  !Array.isArray(
    references
  )
) {
  throw new Error(
    "reference-pages.json must contain an array"
  );
}

let changed = 0;

const changes = [];

for (
  const ref of
    references
) {
  const service =
    externalServiceFor(
      ref.url
    );

  if (!service) {
    continue;
  }

  const previous = {
    entityType:
      ref.entityType ??
      null,

    dimension:
      ref.dimension ??
      null,

    relation:
      ref.relation ??
      null,

    ownerType:
      ref.ownerType ??
      null,

    ownershipScope:
      ref.ownershipScope ??
      null,

    countTowardUniversitySystems:
      ref.countTowardUniversitySystems ??
      null,

    countTowardRTPMI:
      ref.countTowardRTPMI ??
      null,
  };

  const dimension =
    service.dimension ||
    ref.dimension ||
    ref.primaryDimension ||
    "systemsServices";

  ref.entityType =
    "external-service";

  ref.dimension =
    dimension;

  ref.primaryDimension =
    dimension;

  if (
    service.dimension
  ) {
    ref.topicDimension =
      null;
  }

  ref.relation =
    "links-to";

  ref.reason =
    reasonFor(
      service
    );

  ref.serviceId =
    service.serviceId;

  ref.ownerType =
    service.ownerType;

  ref.ownershipScope =
    service.ownershipScope;

  ref.countTowardUniversitySystems =
    false;

  ref.countTowardRTPMI =
    false;

  changed += 1;

  changes.push({
    universitySlug:
      ref.universitySlug ||
      null,

    url:
      ref.url ||
      null,

    previous,

    next: {
      entityType:
        ref.entityType,

      dimension:
        ref.dimension,

      relation:
        ref.relation,

      serviceId:
        ref.serviceId,

      ownerType:
        ref.ownerType,

      ownershipScope:
        ref.ownershipScope,

      countTowardUniversitySystems:
        ref.countTowardUniversitySystems,

      countTowardRTPMI:
        ref.countTowardRTPMI,
    },
  });
}

await fs.writeFile(
  FILE,
  JSON.stringify(
    references,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  "=========================================="
);

console.log(
  "External reference ownership normalization complete"
);

console.log(
  `references=${references.length}`
);

console.log(
  `changed=${changed}`
);

for (
  const item of changes
) {
  console.log(
    [
      "NORMALIZED",
      item.universitySlug ||
        "unknown",
      item.next.ownerType,
      item.next.ownershipScope,
      item.next.dimension,
      item.url,
    ].join(" | ")
  );
}

console.log(
  "All recognized external services have explicit ownership and no-count metadata."
);

console.log(
  "=========================================="
);
