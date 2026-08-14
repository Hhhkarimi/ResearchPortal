import fs from "node:fs/promises";

import {
  transformCrawlerSource,
  CRAWLER_V14_VERSION,
} from "./crawler-v14-transform.mjs";

const original =
  await fs.readFile(
    "scripts/deep-crawl-research.mjs",
    "utf8"
  );

const lfSource =
  original.replace(
    /\r\n?/g,
    "\n"
  );

const crlfSource =
  lfSource.replace(
    /\n/g,
    "\r\n"
  );

function validateRuntime(
  runtime,
  platformLabel
) {
  const checks = [
    [
      runtime.includes(
        CRAWLER_V14_VERSION
      ),
      "version",
    ],

    [
      !runtime.includes(
        "informationTechnology:"
      ),
      "IT dimension removed",
    ],

    [
      !runtime.includes(
        "informationTechnologyUrls"
      ),
      "IT URL seed removed",
    ],

    [
      runtime.includes(
        "interactiveRender"
      ),
      "interactive browser",
    ],

    [
      runtime.includes(
        "browserClickBudget"
      ),
      "bounded click budget",
    ],

    [
      runtime.includes(
        "external-reference"
      ),
      "external reference capture",
    ],

    [
      runtime.includes(
        "countTowardUniversitySystems: false"
      ),
      "external systems no-count",
    ],

    [
      runtime.includes(
        "countTowardRTPMI: false"
      ),
      "external RTPMI no-count",
    ],

    [
      runtime.includes(
        "entityHint"
      ),
      "entity hints",
    ],

    [
      runtime.includes(
        "relationHint"
      ),
      "relation hints",
    ],

    [
      runtime.includes(
        "ownershipHint"
      ),
      "ownership hints",
    ],

    [
      runtime.includes(
        "discoveryConfidence"
      ),
      "discovery confidence",
    ],

    [
      runtime.includes(
        "semanticConfidence"
      ),
      "semantic confidence",
    ],

    [
      runtime.includes(
        "crawl-v14-actions.json"
      ),
      "action log output",
    ],

    [
      !runtime.includes("\r\n"),
      "runtime normalized to LF",
    ],
  ];

  for (
    const [
      ok,
      label
    ] of checks
  ) {
    if (!ok) {
      throw new Error(
        `v14 source guard failed [${platformLabel}]: ${label}`
      );
    }

    console.log(
      `PASS | ${platformLabel} | ${label}`
    );
  }
}

console.log(
  "=========================================="
);

console.log(
  "Testing crawler v14 transform with LF input"
);

console.log(
  "=========================================="
);

const lfRuntime =
  transformCrawlerSource(
    lfSource
  );

validateRuntime(
  lfRuntime,
  "LF"
);

console.log("");

console.log(
  "=========================================="
);

console.log(
  "Testing crawler v14 transform with CRLF input"
);

console.log(
  "=========================================="
);

const crlfRuntime =
  transformCrawlerSource(
    crlfSource
  );

validateRuntime(
  crlfRuntime,
  "CRLF"
);

if (
  lfRuntime !==
  crlfRuntime
) {
  throw new Error(
    "v14 source guard failed: LF and CRLF inputs generated different runtime sources"
  );
}

console.log("");

console.log(
  "=========================================="
);

console.log(
  `crawler v14 source guards passed | version=${CRAWLER_V14_VERSION}`
);

console.log(
  "LF and CRLF transforms are identical."
);

console.log(
  "=========================================="
);
