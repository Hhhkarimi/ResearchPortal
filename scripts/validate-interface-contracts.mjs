import fs from "node:fs";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const fail = (message) => { throw new Error(message); };
const normalize = (value) => String(value || "").toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[ۀة]/g, "ه").replace(/\u200c/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const institutions = readJson("data/isc/institutions.json");
const universities = readJson("data/search/university-index.json");
const international = readJson("data/international-rankings/leiden-open-2025.json");
const slugs = new Set(institutions.map((item) => item.slug));

if (universities.length !== institutions.length) fail(`University fallback index has ${universities.length}, expected ${institutions.length}`);
if (new Set(universities.map((item) => item.id)).size !== universities.length) fail("Duplicate university search ids");
for (const row of universities) {
  if (row.kind !== "university" || !row.href.startsWith("/universities/") || !row.searchText) fail(`Invalid search row: ${row.id}`);
}

const search = (query) => {
  const normalized = normalize(query);
  const tokens = normalized.split(" ").filter(Boolean);
  return universities.filter((row) => tokens.every((token) => normalize(row.searchText).includes(token)));
};
for (const query of ["دانشگاه تهران", "شریف", "فردوسی", "علم و صنعت"]) {
  if (!search(query).length) fail(`Fallback search regression for: ${query}`);
}

if (international.source !== "CWTS Leiden Ranking Open Edition" || international.license !== "CC0-1.0") fail("International snapshot provenance is incomplete");
if (!international.records.length) fail("International snapshot is empty");
if (new Set(international.records.map((row) => row.universitySlug)).size !== international.records.length) fail("Duplicate international ranking slugs");
for (const row of international.records) {
  if (!slugs.has(row.universitySlug)) fail(`Unknown international ranking slug: ${row.universitySlug}`);
  if (!/^https:\/\/ror\.org\/[a-z0-9]{9}$/.test(row.rorId)) fail(`Invalid ROR: ${row.rorId}`);
  if (!(row.globalIndicatorOrder > 0 && row.top10Share >= 0 && row.top10Share <= 100)) fail(`Invalid Leiden values: ${row.universitySlug}`);
  if (!row.sourceUrl.startsWith("https://open.leidenranking.com/ranking/2025/university/")) fail(`Invalid Leiden source: ${row.universitySlug}`);
}

const commandSearch = fs.readFileSync("components/command-search.tsx", "utf8");
for (const contract of ["response.ok", "ArrowDown", "ArrowUp", "event.key === \"Enter\"", "searchUniversitiesLocally"]) {
  if (!commandSearch.includes(contract)) fail(`Command search contract missing: ${contract}`);
}
const globalSearch = fs.readFileSync("lib/global-search.ts", "utf8");
if (!globalSearch.includes("university: 80")) fail("Global search does not prioritize university intent");
const homeSearch = fs.readFileSync("components/home-explorer.tsx", "utf8");
for (const contract of ["searchUniversitiesLocally", "ArrowDown", "event.key===\"Enter\""]) {
  if (!homeSearch.includes(contract)) fail(`Home search contract missing: ${contract}`);
}

console.log(`Interface contracts valid: ${universities.length} fallback universities, ${international.records.length} verified Leiden matches.`);
