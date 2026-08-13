import universityIndex from "@/data/search/university-index.json";
import {normalizePublicText} from "@/lib/public-model";

export type UniversitySearchResult = {
  id: string;
  kind: "university";
  title: string;
  context: string;
  href: string;
  searchText: string;
};

const rows = universityIndex as UniversitySearchResult[];

const normalize = (value: unknown) => normalizePublicText(value)
  .replace(/[ۀة]/g, "ه")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

export function searchUniversitiesLocally(rawQuery: string, limit = 8) {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];

  const tokens = query.split(" ").filter(Boolean);
  return rows
    .flatMap((row) => {
      const title = normalize(row.title);
      const searchText = normalize(row.searchText);
      if (!tokens.every((token) => searchText.includes(token))) return [];
      const score = title === query ? 300 : title.startsWith(query) ? 220 : title.includes(query) ? 160 : 90;
      return [{...row, score}];
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fa"))
    .slice(0, limit)
    .map(({searchText: _searchText, score: _score, ...result}) => result);
}
