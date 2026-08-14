import fs from "node:fs/promises";
import { transformCrawlerSource, CRAWLER_V14_VERSION } from "./crawler-v14-transform.mjs";

const original = await fs.readFile("scripts/deep-crawl-research.mjs", "utf8");
const runtime = transformCrawlerSource(original);

const checks = [
  [runtime.includes(CRAWLER_V14_VERSION), "version"],
  [!runtime.includes("informationTechnology:"), "IT dimension removed"],
  [!runtime.includes("informationTechnologyUrls"), "IT URL seed removed"],
  [runtime.includes("interactiveRender"), "interactive browser"],
  [runtime.includes("browserClickBudget"), "bounded click budget"],
  [runtime.includes("external-reference"), "external reference capture"],
  [runtime.includes("countTowardUniversitySystems: false"), "external systems no-count"],
  [runtime.includes("countTowardRTPMI: false"), "external RTPMI no-count"],
  [runtime.includes("entityHint"), "entity hints"],
  [runtime.includes("relationHint"), "relation hints"],
  [runtime.includes("ownershipHint"), "ownership hints"],
  [runtime.includes("discoveryConfidence"), "discovery confidence"],
  [runtime.includes("semanticConfidence"), "semantic confidence"],
  [runtime.includes("crawl-v14-actions.json"), "action log output"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`v14 source guard failed: ${label}`);
  console.log(`PASS | ${label}`);
}

console.log(`crawler v14 source guards passed | version=${CRAWLER_V14_VERSION}`);
