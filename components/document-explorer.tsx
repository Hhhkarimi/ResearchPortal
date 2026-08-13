"use client";

import {
  useMemo,
  useState,
} from "react";

import styles from "./document-explorer.module.css";

const classify = (
  document: any
) =>
  document.displayTopic ||
  document.topic ||
  document.category ||
  "سایر اسناد پژوهشی";

const titleOf = (
  document: any
) =>
  document.displayTitle ||
  document.title ||
  "سند پژوهشی";

const typeOf = (
  document: any
) =>
  document.displayType ||
  document.type ||
  "سند";

export function DocumentExplorer({
  documents,
  institutions,
}: {
  documents: any[];
  institutions: any[];
}) {
  const [query, setQuery] =
    useState("");

  const [type, setType] =
    useState("همه");

  const [topic, setTopic] =
    useState("همه");

  const [sort, setSort] =
    useState("university");

  const university =
    useMemo(
      () =>
        new Map(
          institutions.map(
            (item) => [
              item.slug,
              item,
            ]
          )
        ),
      [institutions]
    );

  const types =
    useMemo(
      () =>
        [
          ...new Set(
            documents.map(
              typeOf
            )
          ),
        ].sort(
          (a, b) =>
            String(a).localeCompare(
              String(b),
              "fa"
            )
        ),
      [documents]
    );

  const topics =
    useMemo(
      () =>
        [
          ...new Set(
            documents.map(
              classify
            )
          ),
        ].sort(
          (a, b) =>
            String(a).localeCompare(
              String(b),
              "fa"
            )
        ),
      [documents]
    );

  const rows =
    useMemo(
      () =>
        documents
          .filter(
            (document) => {
              const uni: any =
                university.get(
                  document.universitySlug
                );

              const haystack =
                [
                  titleOf(document),
                  document.originalTitle,
                  document.displayFileName,
                  uni?.nameFa,
                  classify(document),
                ]
                  .filter(Boolean)
                  .join(" ");

              return (
                (
                  type === "همه" ||
                  typeOf(document) === type
                ) &&
                (
                  topic === "همه" ||
                  classify(document) === topic
                ) &&
                (
                  !query ||
                  haystack.includes(query)
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
                  ? titleOf(a).localeCompare(
                      titleOf(b),
                      "fa"
                    )
                  : (
                      (
                        university.get(
                          a.universitySlug
                        ) as any
                      )?.nameFa || ""
                    ).localeCompare(
                      (
                        (
                          university.get(
                            b.universitySlug
                          ) as any
                        )?.nameFa || ""
                      ),
                      "fa"
                    ) ||
                    titleOf(a).localeCompare(
                      titleOf(b),
                      "fa"
                    )
          ),
      [
        documents,
        query,
        type,
        topic,
        sort,
        university,
      ]
    );

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
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="عنوان سند، نام فایل یا دانشگاه…"
          />
        </div>

        <div className="field">
          <label htmlFor="document-type">
            نوع سند
          </label>
          <select
            id="document-type"
            value={type}
            onChange={(event) =>
              setType(
                event.target.value
              )
            }
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
            onChange={(event) =>
              setTopic(
                event.target.value
              )
            }
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
            onChange={(event) =>
              setSort(
                event.target.value
              )
            }
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
          {rows.length.toLocaleString(
            "fa-IR"
          )}
        </b>{" "}
        سند پژوهشی دارای شاهد عمومی
      </div>

      <div
        className={`${styles.grid} docGrid`}
      >
        {rows.map(
          (document) => {
            const uni: any =
              university.get(
                document.universitySlug
              );

            const href =
              document.url ||
              document.sourceUrl;

            return (
              <a
                className={`docCard ${styles.card}`}
                key={document.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div>
                  <span className="categoryPill">
                    {typeOf(document)}
                  </span>
                  <em>
                    {document.status ===
                    "active"
                      ? "فعال"
                      : "ثبت‌شده"}
                  </em>
                </div>

                <h2>
                  {titleOf(document)}
                </h2>

                <p>
                  {uni?.nameFa}
                </p>

                <div className="documentTopic">
                  {classify(document)}
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
    </>
  );
}
