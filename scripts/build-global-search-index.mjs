import fs from "node:fs";
import path from "node:path";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const normalize = (value) => String(value || "")
  .toLocaleLowerCase("fa-IR")
  .replace(/[يى]/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/[ۀة]/g, "ه")
  .replace(/\u200c/g, " ")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const institutions = read("data/isc/institutions.json");
const documents = read("data/documents/catalog.json");
const systems = read("data/systems/catalog.json");
const units = read("data/units/catalog.json");
const universityNames = new Map(institutions.map((item) => [item.slug, item.nameFa]));
const rows = [];

const add = ({id, kind, title, context, href, terms}) => rows.push({
  id,
  kind,
  title,
  context,
  href,
  searchText: normalize([title, ...terms].join(" ")),
});

for (const item of institutions) {
  add({
    id: `university:${item.slug}`,
    kind: "university",
    title: item.nameFa,
    context: `${item.category} · رتبه ISC ${item.iscRank}`,
    href: `/universities/${item.slug}`,
    terms: [item.nameEn, item.slug, item.category],
  });
}

for (const item of documents) {
  const university = universityNames.get(item.universitySlug) || item.universitySlug;
  add({
    id: `document:${item.id}`,
    kind: "document",
    title: item.title,
    context: `${university} · ${item.type || item.topic || "سند"}`,
    href: `/universities/${item.universitySlug}#public-catalog`,
    terms: [item.type, item.topic, university],
  });
}

for (const item of systems) {
  const university = universityNames.get(item.universitySlug) || item.universitySlug;
  const title = item.nameFa || item.title;
  add({
    id: `system:${item.id}`,
    kind: "system",
    title,
    context: `${university} · سامانه و خدمت`,
    href: `/universities/${item.universitySlug}#public-catalog`,
    terms: [item.category, university],
  });
}

for (const item of units) {
  const university = universityNames.get(item.universitySlug) || item.universitySlug;
  const title = item.nameFa || item.title;
  add({
    id: `unit:${item.id}`,
    kind: "unit",
    title,
    context: `${university} · واحد پژوهشی`,
    href: `/universities/${item.universitySlug}#public-catalog`,
    terms: [item.type, university],
  });
}

rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
write("data/search/global-index.json", rows);
console.log(`Global observatory search index: ${rows.length} records`);
