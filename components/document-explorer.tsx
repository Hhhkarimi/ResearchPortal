"use client";

import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import styles from "./document-explorer.module.css";

type DocumentRow={id:string;title:string;type:string;topic:string;universityName:string;displayFileName:string;status:string;lastVerified:string;url:string;searchText:string};
const initialLimit=96;

export function DocumentExplorer({
  initialDocuments,
  total,
  types,
  topics,
}: {
  initialDocuments: DocumentRow[];
  total: number;
  types: string[];
  topics: string[];
}) {
  const [documents,setDocuments]=useState(()=>initialDocuments);
  const [query, setQuery] =
    useState("");

  const [type, setType] =
    useState("همه");

  const [topic, setTopic] =
    useState("همه");

  const [sort, setSort] =
    useState("university");

  const [limit,setLimit]=useState(initialLimit);
  const [loading,setLoading]=useState(false);
  const [isPending,startTransition]=useTransition();
  const loadPromise=useRef<Promise<void>|null>(null);
  const deferredQuery=useDeferredValue(query);

  const loadAll=()=>{
    if(documents.length>=total)return Promise.resolve();
    if(loadPromise.current)return loadPromise.current;
    setLoading(true);
    loadPromise.current=fetch("/api/v1/documents")
      .then(response=>{if(!response.ok)throw new Error("document_index_failed");return response.json()})
      .then(payload=>{if(!Array.isArray(payload.data))throw new Error("document_index_invalid");startTransition(()=>setDocuments(payload.data))})
      .finally(()=>{loadPromise.current=null;setLoading(false)});
    return loadPromise.current;
  };

  const rows =
    useMemo(
      () =>
        documents
          .filter(
            (document) => {
              return (
                (
                  type === "همه" ||
                  document.type === type
                ) &&
                (
                  topic === "همه" ||
                  document.topic === topic
                ) &&
                (
                  !deferredQuery ||
                  document.searchText.includes(deferredQuery)
                )
              );
            }
          )
          .sort(
            (a, b) =>
              sort === "newest"
                ? String(
                    b.lastVerified || ""
                  ).localeCompare(
                    String(
                      a.lastVerified || ""
                    )
                  )
                : sort === "title"
                  ? a.title.localeCompare(
                      b.title,
                      "fa"
                    )
                  : a.universityName.localeCompare(
                      b.universityName,
                      "fa"
                    ) ||
                    a.title.localeCompare(
                      b.title,
                      "fa"
                    )
          ),
      [
        documents,
        deferredQuery,
        type,
        topic,
        sort,
      ]
    );

  const updateFilter=(setter:(value:string)=>void,value:string)=>{setter(value);setLimit(initialLimit)};
  const showMore=async()=>{if(documents.length<total)await loadAll();setLimit(value=>value+initialLimit)};
  const allDocumentsLoaded=documents.length>=total;
  const resultCount=!allDocumentsLoaded&&type==="همه"&&topic==="همه"&&!deferredQuery?total:rows.length;

  return (
    <>
      <div className="explorerBar documentFilters glass">
        <div className="field searchField">
          <label htmlFor="document-search">
            جست‌وجوی سند یا دانشگاه
          </label>
          <input
            id="document-search"
            value={query}
            type="search"
            onFocus={()=>void loadAll()}
            onChange={(event) =>{void loadAll();updateFilter(setQuery,event.target.value)}}
            placeholder="عنوان سند، نام فایل یا دانشگاه…"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label htmlFor="document-type">
            نوع سند
          </label>
          <select
            id="document-type"
            value={type}
            onFocus={()=>void loadAll()}
            onChange={(event) =>{void loadAll();updateFilter(setType,event.target.value)}}
          >
            <option>
              همه
            </option>
            {types.map(
              (item) => (
                <option key={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="field">
          <label htmlFor="document-topic">
            حوزه موضوعی
          </label>
          <select
            id="document-topic"
            value={topic}
            onFocus={()=>void loadAll()}
            onChange={(event) =>{void loadAll();updateFilter(setTopic,event.target.value)}}
          >
            <option>
              همه
            </option>
            {topics.map(
              (item) => (
                <option key={item}>
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        <div className="field">
          <label htmlFor="document-sort">
            مرتب‌سازی
          </label>
          <select
            id="document-sort"
            value={sort}
            onFocus={()=>void loadAll()}
            onChange={(event) =>{void loadAll();updateFilter(setSort,event.target.value)}}
          >
            <option value="university">
              دانشگاه
            </option>
            <option value="title">
              عنوان سند
            </option>
            <option value="newest">
              تازه‌ترین راستی‌آزمایی
            </option>
          </select>
        </div>
      </div>

      <div className="resultMeta">
        <b>
          {resultCount.toLocaleString(
            "fa-IR"
          )}
        </b>{" "}
        سند پژوهشی دارای شاهد عمومی
        {(loading||isPending)&&<span className="loadingHint" role="status"> · در حال آماده‌سازی نمایه کامل…</span>}
      </div>

      <div
        className={`${styles.grid} docGrid`}
      >
        {rows.slice(0,limit).map(
          (document) => {
            return (
              <a
                className={`docCard ${styles.card}`}
                key={document.id}
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div>
                  <span className="categoryPill">
                    {document.type}
                  </span>
                  <em>
                    {document.status ===
                    "active"
                      ? "فعال"
                      : "ثبت‌شده"}
                  </em>
                </div>

                <h2>
                  {document.title}
                </h2>

                <p>
                  {document.universityName}
                </p>

                <div className="documentTopic">
                  {document.topic}
                </div>

                {document.displayFileName && (
                  <div
                    className={
                      styles.fileName
                    }
                    title={
                      document.displayFileName
                    }
                  >
                    <span>
                      نام فایل
                    </span>
                    <code>
                      {document.displayFileName}
                    </code>
                  </div>
                )}

                <footer>
                  <small>
                    راستی‌آزمایی:{" "}
                    {document.lastVerified
                      ? new Date(
                          document.lastVerified
                        ).toLocaleDateString(
                          "fa-IR"
                        )
                      : "—"}
                  </small>
                  <b>
                    مشاهده منبع ↗
                  </b>
                </footer>
              </a>
            );
          }
        )}
      </div>
      {(limit<rows.length||!allDocumentsLoaded)&&<button className="loadMore" type="button" disabled={loading} onClick={()=>void showMore()}>{loading?"در حال بارگذاری…":"نمایش اسناد بیشتر ↓"}</button>}
    </>
  );
}
