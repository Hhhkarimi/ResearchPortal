import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformCrawlerSource, CRAWLER_V14_VERSION } from "./crawler-v14-transform.mjs";

const sourcePath = path.resolve("scripts/deep-crawl-research.mjs");
const runtimePath = path.resolve("scripts/.deep-crawl-research-v14-runtime.mjs");

const source = await fs.readFile(sourcePath, "utf8");
const runtime = transformCrawlerSource(source);

await fs.writeFile(runtimePath, runtime, "utf8");
console.log(`[v14] runtime prepared | version=${CRAWLER_V14_VERSION}`);

try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  await fs.rm(runtimePath, { force: true }).catch(() => {});
}
