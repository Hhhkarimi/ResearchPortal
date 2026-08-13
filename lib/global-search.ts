import "server-only";

import rawSearchIndex from "@/data/search/global-index.json";
import {normalizePublicText} from "@/lib/public-model";

export type GlobalSearchKind = "university" | "document" | "system" | "unit";

export type GlobalSearchResult = {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  context: string;
  href: string;
  score: number;
};

type SearchIndexRow = Omit<GlobalSearchResult, "score"> & {searchText: string};
const searchIndex = rawSearchIndex as SearchIndexRow[];

const normalize = (value: unknown) => normalizePublicText(value)
  .replace(/[ۀة]/g, "ه")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const rankText = (query: string, title: string, searchText: string) => {
  const normalizedTitle = normalize(title);
  const tokens = query.split(" ").filter(Boolean);
  if (!tokens.every((token) => searchText.includes(token))) return 0;
  if (normalizedTitle === query) return 300;
  if (normalizedTitle.startsWith(query)) return 220;
  if (normalizedTitle.includes(query)) return 160;
  return 90 + tokens.filter((token) => normalizedTitle.includes(token)).length * 10;
};

export function searchObservatory(rawQuery: string, limit = 18): GlobalSearchResult[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];

  const results = searchIndex.flatMap(({searchText, ...result}) => {
    const score = rankText(query, result.title, searchText);
    return score ? [{...result, score}] : [];
  });

  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fa"))
    .slice(0, Math.min(Math.max(limit, 1), 24));
}
