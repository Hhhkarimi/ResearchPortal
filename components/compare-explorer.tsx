"use client";

import Link from "next/link";

import {
  useMemo,
  useState
} from "react";

const dimensions = [
  ["documents", "اسناد"],
  ["organization", "ساختار"],
  ["library", "کتابخانه"],
  ["laboratories", "آزمایشگاه"],
  ["systems", "سامانه‌ها و خدمات پژوهشی"],
  ["industryTech", "صنعت و فناوری"],
  ["dataQuality", "کیفیت داده"],
  ["findability", "یافت‌پذیری"],
] as const;

export function CompareExplorer(
  {
    rankings,
  }: {
    rankings:
      any[];
  }
) {
  const [
    selected,
    setSelected,
  ] =
    useState(
      rankings
        .slice(
          0,
          3
        )
        .map(
          (item) =>
            item.universitySlug
        )
    );

  const add = (
    slug:
      string
  ) =>
    setSelected(
      (current) =>
        current.includes(
          slug
        )
          ? current.filter(
              (item) =>
                item !==
                slug
            )

          : current.length <
              4
            ? [
                ...current,
                slug,
              ]

            : current
    );

  const rows =
    useMemo(
      () => {
        const bySlug=new Map(rankings.map(row=>[row.universitySlug,row]));
        return (
        selected
          .map(
            (slug) =>
              bySlug.get(slug)
          )
          .filter(Boolean)
        );
      },

      [
        selected,
        rankings,
      ]
    );

  return (
    <>
      <div className="comparePicker glass">
        <div>
          <span className="eyebrow">
            انتخاب ۲ تا ۴ پرتال معاونت پژوهشی و فناوری
          </span>

          <h2>
            مقایسه‌ای که خودتان می‌سازید
          </h2>
        </div>

        <select
          aria-label="افزودن دانشگاه به مقایسه"
          value=""
          onChange={
            (
              event
            ) =>
              event.target.value &&
              add(
                event.target.value
              )
          }
        >
          <option value="">
            + افزودن دانشگاه
          </option>

          {rankings
            .filter(
              (row) =>
                !selected.includes(
                  row.universitySlug
                )
            )
            .map(
              (row) => (
                <option
                  value={
                    row.universitySlug
                  }
                  key={
                    row.universitySlug
                  }
                >
                  {row.nameFa}
                </option>
              )
            )}
        </select>

        <div className="selectedChips">
          {rows.map(
            (
              row
            ) => (
              <button
                key={
                  row.universitySlug
                }
                onClick={
                  () =>
                    add(
                      row.universitySlug
                    )
                }
              >
                {row.nameFa}
                <span>
                  ×
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {rows.length <
      2
        ? (
          <div className="emptyState">
            <b>
              حداقل دو دانشگاه انتخاب کنید.
            </b>
          </div>
        )
        : (
          <div className="comparisonBoard">
            <div className="comparisonHeader">
              <span>
                مؤلفه RTPMI
              </span>

              {rows.map(
                (
                  row
                ) => (
                  <Link
                    href={`/universities/${row.universitySlug}`}
                    key={
                      row.universitySlug
                    }
                  >
                    <b>
                      {row.nameFa}
                    </b>

                    <small>
                      {row.score} RTPMI · اطمینان {row.confidence}%
                    </small>
                  </Link>
                )
              )}
            </div>

            {dimensions.map(
              (
                [
                  key,
                  label,
                ]
              ) => (
                <div
                  className="comparisonLine"
                  key={
                    key
                  }
                >
                  <b>
                    {label}
                  </b>

                  {rows.map(
                    (
                      row
                    ) => {
                      const value =
                        row.metrics[
                          key
                        ];

                      return (
                        <div
                          key={
                            row.universitySlug
                          }
                          className={
                            value ===
                              null ||
                            value ===
                              undefined
                              ? "missing"
                              : ""
                          }
                        >
                          <span>
                            <i
                              style={{
                                width:
                                  `${value ?? 0}%`,
                              }}
                            />
                          </span>

                          <strong>
                            {value ===
                              null ||
                            value ===
                              undefined
                              ? "نامشخص"
                              : value}
                          </strong>
                        </div>
                      );
                    }
                  )}
                </div>
              )
            )}
          </div>
        )}

      <p className="dataNote">
        اعداد فقط برای پرتال‌های معاونت پژوهشی و فناوریِ Evidence-qualified نمایش داده می‌شوند.
        «نامشخص» در محاسبه صفر نشده است.
      </p>
    </>
  );
}
