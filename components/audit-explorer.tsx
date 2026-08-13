"use client";

import Link from "next/link";
import {
  useMemo,
  useState
} from "react";

const dimensions = [
  ["portalIdentity", "هویت پرتال معاونت پژوهشی و فناوری"],
  ["organization", "ساختار"],
  ["libraryDocuments", "کتابخانه"],
  ["laboratories", "آزمایشگاه"],
  ["industryTechnology", "صنعت/فناوری"],
  ["systemsServices", "سامانه‌ها"],
  ["documentsRegulations", "اسناد"],
] as const;

const state:
  any = {
  verified:
    "تأیید",

  "observed-reference":
    "شاهد",

  restricted:
    "محدود",

  unresolved:
    "باز",
};

const coverage = (
  audit:
    any
) =>
  audit
    .reviewEvidenceCoverage ??
  audit
    .auditEvidenceCoverage ??
  0;

export function AuditExplorer(
  {
    audits,
  }: {
    audits:
      any[];
  }
) {
  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState(
      "همه"
    );

  const [
    mode,
    setMode,
  ] =
    useState(
      "همه"
    );

  const rows =
    useMemo(
      () =>
        audits.filter(
          (audit) =>
            (
              category ===
                "همه" ||
              audit.iscCategory ===
                category
            ) &&
            (
              !query ||
              audit.nameFa.includes(
                query
              )
            ) &&
            (
              mode ===
                "همه" ||

              (
                mode ===
                  "complete" &&
                coverage(
                  audit
                ) ===
                  100
              ) ||

              (
                mode ===
                  "pending" &&
                coverage(
                  audit
                ) <
                  75
              ) ||

              (
                mode ===
                  "restricted" &&
                Object.values(
                  audit.dimensions
                ).every(
                  (value) =>
                    value ===
                    "restricted"
                )
              )
            )
        ),

      [
        audits,
        query,
        category,
        mode,
      ]
    );

  return (
    <>
      <div className="explorerBar glass">
        <div className="field searchField">
          <label htmlFor="audit-search">
            جست‌وجوی دانشگاه
          </label>

          <input
            id="audit-search"
            value={
              query
            }
            onChange={
              (
                event
              ) =>
                setQuery(
                  event.target.value
                )
            }
            placeholder="نام دانشگاه…"
          />
        </div>

        <div className="field">
          <label htmlFor="audit-category">
            گروه ISC
          </label>

          <select
            id="audit-category"
            value={
              category
            }
            onChange={
              (
                event
              ) =>
                setCategory(
                  event.target.value
                )
            }
          >
            <option>
              همه
            </option>

            {[
              ...new Set(
                audits.map(
                  (item) =>
                    item.iscCategory
                )
              ),
            ].map(
              (
                value
              ) => (
                <option
                  key={
                    value
                  }
                >
                  {value}
                </option>
              )
            )}
          </select>
        </div>

        <div className="field">
          <label htmlFor="audit-mode">
            وضعیت شواهد
          </label>

          <select
            id="audit-mode"
            value={
              mode
            }
            onChange={
              (
                event
              ) =>
                setMode(
                  event.target.value
                )
            }
          >
            <option value="همه">
              همه وضعیت‌ها
            </option>

            <option value="complete">
              پوشش کامل
            </option>

            <option value="pending">
              پوشش کمتر از ۷۵٪
            </option>

            <option value="restricted">
              دسترسی محدود
            </option>
          </select>
        </div>
      </div>

      <div className="matrixLegend">
        <span>
          <i className="verified" />
          تأیید مستقیم
        </span>

        <span>
          <i className="observed-reference" />
          شاهد/ارجاع
        </span>

        <span>
          <i className="restricted" />
          دسترسی محدود
        </span>

        <span>
          <i className="unresolved" />
          هنوز حل نشده
        </span>
      </div>

      <div className="deepMatrixWrap glass">
        <div className="deepMatrix">
          <div className="deepRow deepHead">
            <b>
              دانشگاه / ISC
            </b>

            {dimensions.map(
              (item) => (
                <span
                  key={
                    item[0]
                  }
                >
                  {item[1]}
                </span>
              )
            )}

            <strong>
              پوشش
            </strong>
          </div>

          {rows.map(
            (
              row
            ) => (
              <Link
                href={`/universities/${row.universitySlug}`}
                className="deepRow"
                key={
                  row.universitySlug
                }
              >
                <b>
                  {row.nameFa}

                  <small>
                    {row.iscCategory} · ISC #{row.iscRank}
                  </small>
                </b>

                {dimensions.map(
                  (
                    [key]
                  ) => (
                    <span
                      className={`eState ${row.dimensions[key]}`}
                      title={
                        state[
                          row.dimensions[
                            key
                          ]
                        ]
                      }
                      key={
                        key
                      }
                    >
                      <i />

                      {state[
                        row.dimensions[
                          key
                        ]
                      ]}
                    </span>
                  )
                )}

                <strong>
                  {coverage(
                    row
                  )}%
                </strong>
              </Link>
            )
          )}
        </div>
      </div>

      <div className="resultMeta">
        <b>
          {rows.length.toLocaleString(
            "fa-IR"
          )}
        </b>{" "}
        ردیف نمایش داده می‌شود.
      </div>
    </>
  );
}
