import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT = "data/international-rankings/leiden-open-2025.json";
const SOURCE_PAGE = "https://open.leidenranking.com/ranking/2025/list";
const RESULT_ENDPOINT = "https://open.leidenranking.com/Ranking2025/Ranking2025ListResult";

// Human-reviewed identity crosswalk. Leiden defines universities with ROR.
const crosswalk = {
  "ilam": {sourceName: "Ilam University", rorId: "01r277z15"},
  "gorgan-agri": {sourceName: "Gorgan University of Agricultural Sciences and Natural Resources", rorId: "01w6vdf77"},
  "babol-noshirvani": {sourceName: "Babol Noshirvani University of Technology", rorId: "02zc85170"},
  "shiraz-technology": {sourceName: "Shiraz University of Technology", rorId: "04bxa3v83"},
  "iust": {sourceName: "Iran University of Science and Technology", rorId: "01jw2p796"},
  "kashan": {sourceName: "University of Kashan", rorId: "015zmr509"},
  "kurdistan": {sourceName: "University of Kurdistan", rorId: "04k89yk85"},
  "maragheh": {sourceName: "University of Maragheh", rorId: "0037djy87"},
  "kntu": {sourceName: "K.N. Toosi University of Technology", rorId: "0433abe34"},
  "shahrekord": {sourceName: "Shahrekord University", rorId: "051rngw70"},
  "golestan": {sourceName: "Golestan University", rorId: "046nf9z89"},
  "tehran": {sourceName: "University of Tehran", rorId: "05vf56z40"},
  "azarbaijan-shahid-madani": {sourceName: "Azarbaijan Shahid Madani University", rorId: "05pg2cw06"},
  "amirkabir": {sourceName: "Amirkabir University of Technology", rorId: "04gzbav43"},
  "mohaghegh-ardabili": {sourceName: "University of Mohaghegh Ardabili", rorId: "045zrcm98"},
  "tabriz": {sourceName: "University of Tabriz", rorId: "01papkj44"},
  "semnan": {sourceName: "Semnan University", rorId: "029gksw03"},
  "bu-ali-sina": {sourceName: "Bu-Ali Sina University", rorId: "04ka8rx28"},
  "allameh": {sourceName: "Allameh Tabataba'i University", rorId: "02cc4gc68"},
  "sharif": {sourceName: "Sharif University of Technology", rorId: "024c2fq17"},
  "lorestan": {sourceName: "Lorestan University", rorId: "051bats05"},
  "mazandaran": {sourceName: "University of Mazandaran", rorId: "05fp9g671"},
  "tarbiat-modares": {sourceName: "Tarbiat Modares University", rorId: "03mwgfy56"},
  "imam-khomeini-international": {sourceName: "Imam Khomeini International University", rorId: "02jeykk09"},
  "urmia": {sourceName: "Urmia University", rorId: "032fk0x53"},
  "shahid-bahonar-kerman": {sourceName: "Shahid Bahonar University of Kerman", rorId: "04zn42r77"},
  "yazd": {sourceName: "Yazd University", rorId: "02x99ac45"},
  "shahid-beheshti": {sourceName: "Shahid Beheshti University", rorId: "0091vmj44"},
  "shahrood-technology": {sourceName: "University of Shahrood", rorId: "00yqvtm78"},
  "guilan": {sourceName: "University of Guilan", rorId: "01bdr6121"},
  "kharazmi": {sourceName: "Kharazmi University", rorId: "05hsgex59"},
  "zanjan": {sourceName: "University of Zanjan", rorId: "05e34ej29"},
  "isfahan": {sourceName: "University of Isfahan", rorId: "05h9t7759"},
  "isfahan-technology": {sourceName: "Isfahan University of Technology", rorId: "00af3sa43"},
  "ferdowsi": {sourceName: "Ferdowsi University of Mashhad", rorId: "00g6ka752"},
  "sahand": {sourceName: "Sahand University of Technology", rorId: "03wdrmh81"},
  "razi": {sourceName: "Razi University", rorId: "02ynb0474"},
  "shahid-chamran-ahvaz": {sourceName: "Shahid Chamran University of Ahwaz", rorId: "01k3mbs15"},
  "shiraz": {sourceName: "Shiraz University", rorId: "028qtbk54"},
  "payame-noor": {sourceName: "Payame Noor University", rorId: "031699d98"},
  "sistan-baluchestan": {sourceName: "University of Sistan and Baluchestan", rorId: "02n43xw86"},
  "alzahra": {sourceName: "Alzahra University", rorId: "013cdqc34"},
  "birjand": {sourceName: "University of Birjand", rorId: "03g4hym73"},
  "shahed": {sourceName: "Shahed University", rorId: "01e8ff003"},
  "arak": {sourceName: "Arak University", rorId: "00ngrq502"},
};

const decode = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&#39;", "'")
  .replaceAll("&quot;", '"')
  .replaceAll("&ndash;", "–")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function parseResults(html) {
  const results = new Map();
  for (const match of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const row = match[1];
    const university = row.match(/<td class="university[^>]*" id="(\d+)"[\s\S]*?<span data-tooltip="([^"]+)"/);
    const rank = row.match(/<td class="rank"[\s\S]*?<span[^>]*>(\d+)<\/span>/);
    if (!university || !rank) continue;
    const values = [...row.matchAll(/<td class="number[^>]*">[\s\S]*?<a[^>]*>([^<]+)<\/a>/g)].map((item) => decode(item[1]));
    if (values.length < 3) continue;
    results.set(decode(university[2]), {
      sourceUniversityId: university[1],
      globalIndicatorOrder: Number(rank[1]),
      publications: Number(values[0].replaceAll(",", "")),
      top10Publications: Number(values[1].replaceAll(",", "")),
      top10Share: Number(values[2].replace("%", "")),
    });
  }
  return results;
}

async function fetchOfficialResults() {
  const body = new URLSearchParams({
    field_id: "0", continent_code: "", country_code: "", performance_dimension: "0",
    ranking_indicator: "3", fractional_counting: "true", core_pubs_only: "true",
    number_of_publications: "0", period_id: "15", period_text: "2020–2023", order_by: "pp_top_10",
  });
  const response = await fetch(RESULT_ENDPOINT, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded", Referer: SOURCE_PAGE, "X-Requested-With": "XMLHttpRequest"},
    body,
  });
  if (!response.ok) throw new Error(`Leiden request failed: ${response.status}`);
  return response.text();
}

const inputIndex = process.argv.indexOf("--input");
const dateIndex = process.argv.indexOf("--retrieved-at");
const html = inputIndex >= 0 ? await fs.readFile(process.argv[inputIndex + 1], "utf8") : await fetchOfficialResults();
const retrievedAt = dateIndex >= 0 ? process.argv[dateIndex + 1] : new Date().toISOString().slice(0, 10);
const officialResults = parseResults(html);
const records = Object.entries(crosswalk).map(([universitySlug, identity]) => {
  const result = officialResults.get(identity.sourceName);
  if (!result) throw new Error(`Verified crosswalk missing from official result: ${identity.sourceName}`);
  return {
    universitySlug,
    sourceName: identity.sourceName,
    rorId: `https://ror.org/${identity.rorId}`,
    matchMethod: "human-reviewed-ror",
    ...result,
    sourceUrl: `https://open.leidenranking.com/ranking/2025/university/${result.sourceUniversityId}`,
  };
}).sort((a, b) => a.universitySlug.localeCompare(b.universitySlug));

const snapshot = {
  source: "CWTS Leiden Ranking Open Edition",
  edition: 2025,
  license: "CC0-1.0",
  retrievedAt,
  sourceUrl: SOURCE_PAGE,
  resourcesUrl: "https://open.leidenranking.com/resources",
  indicator: {code: "PP(top 10%)", labelFa: "سهم مقالات در ۱۰٪ پراستناد", field: "all-sciences", period: "2020–2023", countingMethod: "fractional", publicationSet: "core"},
  interpretation: "globalIndicatorOrder is an ordering by one named bibliometric indicator, not a composite world university rank",
  records,
};

await fs.mkdir(path.dirname(OUTPUT), {recursive: true});
await fs.writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Leiden Open 2025: ${records.length} verified institutions written to ${OUTPUT}`);
