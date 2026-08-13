import Link from "next/link";
import {
  notFound
} from "next/navigation";

import {
  ShareButton
} from "@/components/share-button";

import {
  canonicalPublicUrl,
  dedupePublicCatalog,
  getAudit,
  getDimensionEvidence,
  getDocuments,
  getInstitution,
  getRank,
  getResearchReview,
  getSystems,
  getUnits,
  institutions,
} from "@/lib/data";

import {
  PUBLIC_DIMENSION_COUNT,
  RTPMI_VERSION,
} from "@/lib/public-model";

import {
  semanticCatalogTitles,
  semanticEvidenceSources,
} from "@/lib/semantic-labels";
import {buildUniversityInsights} from "@/lib/university-insights";
import {getInternationalStanding} from "@/lib/international-rankings";

export function generateStaticParams() {
  return institutions.map(
    (item) => ({
      slug:
        item.slug,
    })
  );
}

export async function generateMetadata(
  {
    params,
  }: {
    params:
      Promise<{
        slug: string;
      }>;
  }
) {
  const {
    slug,
  } =
    await params;

  const university:
    any =
    getInstitution(slug);

  return {
    title:
      university
        ? `${university.nameFa} | پرونده پرتال معاونت پژوهشی و فناوری`
        : "دانشگاه",

    description:
      university
        ? `پرونده ممیزی پرتال معاونت پژوهشی و فناوری ${university.nameFa}، وضعیت شواهد، RTPMI، واحدها، سامانه‌ها و اسناد.`
        : "",
  };
}

const labels:
  Record<
    string,
    string
  > = {
  portalIdentity:
    "هویت پرتال معاونت پژوهشی و فناوری",

  organization:
    "ساختار سازمانی",

  libraryDocuments:
    "کتابخانه و اسناد",

  laboratories:
    "آزمایشگاه‌ها",

  industryTechnology:
    "صنعت و فناوری",

  systemsServices:
    "سامانه‌ها و خدمات",

  documentsRegulations:
    "اسناد و مقررات",
};

const states:
  Record<
    string,
    string
  > = {
  verified:
    "تأیید مستقیم",

  "observed-reference":
    "شاهد/ارجاع",

  restricted:
    "دسترسی محدود",

  unresolved:
    "هنوز حل نشده",
};

const metricLabels:
  Record<
    string,
    string
  > = {
  documents:
    "اسناد",

  organization:
    "ساختار",

  library:
    "کتابخانه",

  laboratories:
    "آزمایشگاه",

  systems:
    "سامانه‌های پژوهشی",

  industryTech:
    "صنعت و فناوری",

  dataQuality:
    "کیفیت داده",

  findability:
    "یافت‌پذیری",
};

export default async function Page(
  {
    params,
  }: {
    params:
      Promise<{
        slug: string;
      }>;
  }
) {
  const {
    slug,
  } =
    await params;

  const university:
    any =
    getInstitution(slug);

  if (
    !university
  ) {
    notFound();
  }

  const audit:
    any =
    getAudit(slug);

  const review:
    any =
    getResearchReview(slug);

  const reviewed:
    any[] =
    getDimensionEvidence(slug);

  const ranking:
    any =
    getRank(slug);

  const units:
    any[] =
    dedupePublicCatalog(
      getUnits(slug)
    );

  const systems:
    any[] =
    dedupePublicCatalog(
      getSystems(slug)
    );

  const documents:
    any[] =
    dedupePublicCatalog(
      getDocuments(slug)
    );

  const verified =
    reviewed.filter(
      (item) =>
        item.status ===
        "verified"
    ).length;

  const coverage =
    review
      ?.reviewEvidenceCoverage ??
    0;

  /*
   * Keep every distinct canonical URL, but preserve the richest
   * metadata available for each one so the UI can name it
   * semantically instead of showing numbered duplicates.
   */
  const reviewSources =
    semanticEvidenceSources(
      slug,
      review,
      audit
    );

  const reviewUrls =
    reviewSources.map(
      (source) =>
        source.url
    );

  const primarySources =
    reviewSources.slice(
      0,
      14
    );

  const additionalSources =
    reviewSources.slice(
      14
    );

  const metrics =
    ranking
      ? {
          ...(
            ranking
              .metrics ||
            {}
          ),
        }
      : null;

  const insights = buildUniversityInsights({
    outcomes: reviewed,
    coverage,
    ranking,
    units: units.length,
    systems: systems.length,
    documents: documents.length,
  });

  const international = getInternationalStanding(slug);

  return (
    <main className="shell page profilePage">
      <nav
        className="breadcrumbs"
        aria-label="مسیر صفحه"
      >
        <Link href="/universities">
          دانشگاه‌ها
        </Link>

        <span>/</span>

        <span>
          {university.nameFa}
        </span>
      </nav>

      <header className="profileHero">
        <div>
          <div className="profileMeta">
            <span>
              {university.category}
            </span>

            <span>
              رتبه ISC{" "}
              {university.iscRank.toLocaleString(
                "fa-IR"
              )}
            </span>

            <span>
              آخرین ممیزی{" "}
              {new Date(
                audit
                  ?.auditDate ||
                  "2026-08-11"
              ).toLocaleDateString(
                "fa-IR"
              )}
            </span>
          </div>

          <h1>
            {university.nameFa}
          </h1>

          <p>
            نمای یکپارچه از شواهد عمومی پرتال معاونت پژوهشی و فناوری،
            منابع رسمی، واحدها، سامانه‌ها، اسناد و وضعیت بلوغ
            این پرتال. جایگاه ISC و RTPMI دو سنجه مستقل‌اند.
          </p>

          <div className="profileActions">
            {audit
              ?.researchUrl
              ? (
                <a
                  className="primaryAction"
                  href={
                    audit.researchUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  باز کردن پرتال رسمی معاونت پژوهشی و فناوری ↗
                </a>
              )
              : (
                <span className="disabledAction">
                  پرتال مستقیم معاونت پژوهشی و فناوری هنوز تأیید نشده
                </span>
              )}

            <ShareButton
              title={`پرونده پرتال معاونت پژوهشی و فناوری ${university.nameFa}`}
            />

            <a
              href={`/datasets/audit-packets/${slug}.json`}
            >
              دریافت پرونده JSON ↓
            </a>
          </div>
        </div>

        <div
          className={
            ranking
              ? "profileScore"
              : "profileScore unranked"
          }
        >
          {ranking
            ? (
              <>
                <span>
                  RTPMI{" "}
                  {RTPMI_VERSION}
                </span>

                <b>
                  {ranking.score}
                </b>

                <div>
                  <small>
                    رتبه ملی پرتال معاونت پژوهشی و فناوری
                  </small>

                  <strong>
                    #
                    {ranking.rank.toLocaleString(
                      "fa-IR"
                    )}
                  </strong>
                </div>

                <div>
                  <small>
                    سطح اطمینان
                  </small>

                  <strong>
                    {ranking.confidence}%
                  </strong>
                </div>
              </>
            )
            : (
              <>
                <span>
                  وضعیت RTPMI
                </span>

                <b>—</b>

                <strong>
                  رتبه منتشر نشده
                </strong>

                <small>
                  Evidence برای نمره عمومی کافی نیست.
                </small>
              </>
            )}
        </div>
      </header>

      <nav
        className="profileNav"
        aria-label="بخش‌های پرونده"
      >
        <a href="#evidence-map">
          نقشه شواهد
        </a>

        {ranking && (
          <a href="#rtpmi-profile">
            پروفایل RTPMI
          </a>
        )}

        <a href="#international-standing">
          جایگاه بین‌المللی
        </a>

        <a href="#evidence-sources">
          منابع رسمی
        </a>

        <a href="#public-catalog">
          اقلام ثبت‌شده
        </a>
      </nav>

      <section
        className="profileSnapshot"
        aria-label="خلاصه پرونده"
      >
        <div>
          <span>
            نتیجه بازبینی
          </span>

          <b>
            {review
              ?.reviewOutcome ||
              "بازبینی ثبت شده"}
          </b>
        </div>

        <div>
          <span>
            پوشش شواهد
          </span>

          <b>
            {coverage}%
          </b>

          <i>
            <em
              style={{
                width:
                  `${coverage}%`,
              }}
            />
          </i>
        </div>

        <div>
          <span>
            ابعاد تأیید مستقیم
          </span>

          <b>
            {verified.toLocaleString(
              "fa-IR"
            )}{" "}
            از{" "}
            {PUBLIC_DIMENSION_COUNT.toLocaleString(
              "fa-IR"
            )}
          </b>
        </div>

        <div>
          <span>
            منابع و اقلام یکتا
          </span>

          <b>
            {(
              reviewUrls.length +
              units.length +
              systems.length +
              documents.length
            ).toLocaleString(
              "fa-IR"
            )}
          </b>

          <small>
            {reviewUrls.length.toLocaleString(
              "fa-IR"
            )}{" "}
            منبع ·{" "}
            {units.length.toLocaleString(
              "fa-IR"
            )}{" "}
            واحد ·{" "}
            {systems.length.toLocaleString(
              "fa-IR"
            )}{" "}
            سامانه ·{" "}
            {documents.length.toLocaleString(
              "fa-IR"
            )}{" "}
            سند
          </small>
        </div>
      </section>

      <section
        className={`internationalStanding ${international.record ? "verified" : "unavailable"}`}
        id="international-standing"
        aria-labelledby="international-standing-title"
      >
        <header>
          <div>
            <span className="eyebrow">International context · independent from RTPMI</span>
            <h2 id="international-standing-title">جایگاه در نظام‌های بین‌المللی</h2>
          </div>
          <span className="licenseTag">{international.source} {international.edition} · {international.license}</span>
        </header>

        {international.record ? <div className="internationalResult">
          <div className="internationalOrder">
            <span>جایگاه جهانی در مرتب‌سازی شاخص</span>
            <b>#{international.record.globalIndicatorOrder.toLocaleString("fa-IR")}</b>
            <small>{international.indicator.code} · این عدد رتبه مرکب دانشگاه نیست.</small>
          </div>
          <dl>
            <div><dt>{international.indicator.labelFa}</dt><dd>{international.record.top10Share.toLocaleString("fa-IR")}٪</dd></div>
            <div><dt>انتشارات محاسبه‌شده</dt><dd>{international.record.publications.toLocaleString("fa-IR")}</dd></div>
            <div><dt>مقالات ۱۰٪ پراستناد</dt><dd>{international.record.top10Publications.toLocaleString("fa-IR")}</dd></div>
          </dl>
          <div className="internationalContext">
            <p>همه علوم · دوره {international.indicator.period} · شمارش کسری · فقط انتشارات هسته. هویت دانشگاه با ROR و بازبینی انسانی تطبیق داده شده است.</p>
            <div><a href={international.record.sourceUrl} target="_blank" rel="noopener noreferrer">مشاهده رکورد رسمی Leiden ↗</a><a href={international.record.rorId} target="_blank" rel="noopener noreferrer">شناسه ROR ↗</a></div>
          </div>
        </div> : <div className="internationalEmpty">
          <b>برای این نهاد، تطبیق تأییدشده‌ای در Snapshot حاضر ثبت نشده است.</b>
          <p>این وضعیت به معنی «بدون رتبه» یا عملکرد ضعیف نیست؛ ممکن است نهاد معیار ورود Leiden را نداشته باشد یا crosswalk هویت آن هنوز تأیید نشده باشد.</p>
          <a href={international.sourceUrl} target="_blank" rel="noopener noreferrer">بررسی فهرست رسمی Leiden Open {international.edition} ↗</a>
        </div>}

        <footer>این شاخص اثر علمی مستقل از RTPMI است و در ارزیابی بلوغ پرتال معاونت پژوهشی و فناوری دخالت ندارد. Snapshot: {new Date(international.retrievedAt).toLocaleDateString("fa-IR")}.</footer>
      </section>

      <section className="profileDecision" aria-labelledby="profile-decision-title">
        <div className="profileDecisionHead">
          <div>
            <span className="eyebrow">Decision brief · همین Snapshot</span>
            <h2 id="profile-decision-title">سه نکته مهم این پرتال</h2>
          </div>
          <p>این جمع‌بندی از outcomeهای عمومی ساخته شده و درباره عملکرد پژوهشی دانشگاه داوری نمی‌کند.</p>
        </div>
        <div className="profileInsightGrid">
          {insights.highlights.map((item) => <article className={item.tone} key={item.label}>
            <span>{item.label}</span><b>{item.title}</b><p>{item.text}</p>
          </article>)}
        </div>
        <div className="actionGapPanel">
          <header><div><span>شکاف‌های قابل اقدام</span><b>چه چیزی در سطح عمومی پرتال قابل بهبود است؟</b></div><small>{insights.gaps.length.toLocaleString("fa-IR")} اقدام اولویت‌دار</small></header>
          <div>
            {insights.gaps.map((gap, index) => <article key={gap.dimension}>
              <i>{(index + 1).toLocaleString("fa-IR")}</i><span><b>{gap.title}</b><p>{gap.action}</p></span><em className={gap.status}/>
            </article>)}
          </div>
        </div>
      </section>

      <section
        className="section"
        id="evidence-map"
      >
        <div className="sectionHead">
          <div>
            <span className="eyebrow">
              Evidence map · 7 dimensions
            </span>

            <h2>
              وضعیت اکوسیستم در یک نگاه
            </h2>
          </div>

          <p>
            هر بُعد outcome مستقل دارد. «حل‌نشده» یعنی شواهد عمومی
            کافی بازیابی نشده؛ نه اینکه آن قابلیت در دانشگاه وجود
            ندارد.
          </p>
        </div>

        <div className="dimensionGrid">
          {reviewed.map(
            (
              item:
                any
            ) => (
              <article
                className={`dimensionCard ${item.status}`}
                key={
                  item.dimension
                }
              >
                <div>
                  <i />

                  <span>
                    {states[
                      item.status
                    ]}
                  </span>
                </div>

                <b>
                  {labels[
                    item.dimension
                  ]}
                </b>

                <small>
                  {item.status ===
                  "verified"
                    ? `${item.sourceCount.toLocaleString(
                        "fa-IR"
                      )} منبع رسمی یکتا ثبت شده`

                    : item.status ===
                        "observed-reference"
                      ? "نشانه رسمی وجود دارد؛ انتساب مستقیم برای انتشار کافی نیست"

                      : item.status ===
                          "restricted"
                        ? "راستی‌آزمایی عمومی محدود است"

                        : "منبع عمومی کافی حل نشده است"}
                </small>

                {item
                  .sources
                  ?.[0] && (
                  <a
                    href={
                      item
                        .sources[0]
                        .url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    مشاهده شاهد اصلی ↗
                  </a>
                )}
              </article>
            )
          )}
        </div>
      </section>

      {ranking &&
        metrics && (
        <section
          className="section rtpmiSection"
          id="rtpmi-profile"
        >
          <div className="sectionHead">
            <div>
              <span className="eyebrow">
                RTPMI{" "}
                {RTPMI_VERSION} · active weights
              </span>

              <h2>
                پروفایل بلوغ پرتال معاونت پژوهشی و فناوری
              </h2>
            </div>

            <p>
              مؤلفه‌های نامشخص از مخرج وزن فعال حذف می‌شوند و
              به‌جای صفر ساختگی، Confidence را کاهش می‌دهند.
              <Link className="inlineMethodLink" href="/methodology"> فرمول کامل و شیوه ارزیابی ←</Link>
            </p>
          </div>

          <div className="metricGrid">
            {Object.entries(
              metrics
            ).map(
              (
                [
                  key,
                  value,
                ]:
                  any
              ) => (
                <div
                  className={
                    value ===
                    null
                      ? "metricCard missing"
                      : "metricCard"
                  }
                  key={
                    key
                  }
                >
                  <div>
                    <span>
                      {metricLabels[
                        key
                      ] ||
                        key}
                    </span>

                    <b>
                      {value ===
                      null
                        ? "نامشخص"
                        : value}
                    </b>
                  </div>

                  <i>
                    <em
                      style={{
                        width:
                          `${value ?? 0}%`,
                      }}
                    />
                  </i>
                </div>
              )
            )}
          </div>
        </section>
      )}

      <section
        className="section evidenceStory"
        id="evidence-sources"
      >
        <div className="evidenceSummary">
          <span className="eyebrow">
            Official evidence · canonical & deduplicated
          </span>

          <h2>
            این نتیجه بر چه اساسی ثبت شده؟
          </h2>

          <p>
            این جمع‌بندی از URLهای رسمی یکتاشده، شواهد بُعدی و
            اقلام دارای provenance ساخته شده است. URLهای متفاوت
            حفظ می‌شوند و عنوان هر منبع از متادیتا و ساختار همان
            لینک به‌صورت معنایی نمایش داده می‌شود.
          </p>

          {reviewSources.length
            ? (
              <div className="sourceList">
                {primarySources.map(
                  (
                    source
                  ) => (
                    <SourceLink
                      source={
                        source
                      }
                      key={
                        canonicalPublicUrl(
                          source.url
                        ) ||
                        source.url
                      }
                    />
                  )
                )}

                {additionalSources.length >
                  0 && (
                  <details className="sourceMore">
                    <summary>
                      نمایش{" "}
                      {additionalSources.length.toLocaleString(
                        "fa-IR"
                      )}{" "}
                      منبع یکتای دیگر
                    </summary>

                    <div>
                      {additionalSources.map(
                        (
                          source
                        ) => (
                          <SourceLink
                            source={
                              source
                            }
                            key={
                              canonicalPublicUrl(
                                source.url
                              ) ||
                              source.url
                            }
                          />
                        )
                      )}
                    </div>
                  </details>
                )}
              </div>
            )
            : (
              <div className="noEvidence">
                در Snapshot فعلی URL مستقیم قابل انتشار ثبت نشده
                است. outcome «حل‌نشده» یا «محدود» جایگزین ادعای
                بدون منبع شده است.
              </div>
            )}
        </div>

        <aside>
          <b>
            {coverage}%
          </b>

          <span>
            پوشش شواهد بازبینی
          </span>

          <p>
            این عدد میزان حل‌شدن Evidence در مدل هفت‌بُعدی عمومی
            است، نه امتیاز کیفیت علمی یا عملکرد دانشگاه.
          </p>

          <Link href="/methodology">
            قواعد تفسیر داده ←
          </Link>
        </aside>
      </section>

      <section
        className="section catalogSection"
        id="public-catalog"
      >
        <div className="sectionHead">
          <div>
            <span className="eyebrow">
              Public ecosystem catalog · deduplicated
            </span>

            <h2>
              واحدها، سامانه‌ها و اسناد ثبت‌شده
            </h2>
          </div>

          <p>
            فقط URLهای واقعاً تکراری ادغام می‌شوند. اگر چند لینک
            متفاوت عنوان خام یکسان داشته باشند، همه لینک‌ها حفظ
            می‌شوند و با عنوان معنایی متناسب با نوع منبع نمایش داده
            می‌شوند.
          </p>
        </div>

        <div className="catalogGrid">
          <Catalog
            title="واحدها و زیرمجموعه‌ها"
            items={
              units
            }
            empty="واحد تأییدشده‌ای در Snapshot ثبت نشده است."
          />

          <Catalog
            title="سامانه‌ها و خدمات"
            items={
              systems
            }
            empty="سامانه تأییدشده‌ای در Snapshot ثبت نشده است."
          />

          <Catalog
            title="اسناد و مقررات"
            items={
              documents
            }
            empty="سند مستقیم تأییدشده‌ای در Snapshot ثبت نشده است."
          />
        </div>
      </section>
    </main>
  );
}

function SourceLink(
  {
    source,
  }: {
    source: any;
  }
) {
  const url =
    source.url;

  let host =
    "منبع رسمی";

  let path =
    url;

  try {
    const parsed =
      new URL(
        url
      );

    host =
      parsed.hostname.replace(
        /^www\./,
        ""
      );

    path =
      decodeURIComponent(
        parsed.pathname ||
        "/"
      );

    if (
      path.length >
      88
    ) {
      path =
        `${path.slice(
          0,
          85
        )}…`;
    }
  } catch {}

  return (
    <a
      className="sourceItem"
      href={
        url
      }
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>
        <b>
          {source.displayTitle ||
            "منبع رسمی"}
        </b>

        <small>
          {[
            host,
            path || "/",
          ]
            .filter(Boolean)
            .join(
              " · "
            )}
        </small>
      </span>

      <i>
        ↗
      </i>
    </a>
  );
}

function Catalog(
  {
    title,
    items,
    empty,
  }: {
    title: string;
    items: any[];
    empty: string;
  }
) {
  const displayTitles =
    semanticCatalogTitles(
      items
    );

  const primary =
    items.slice(
      0,
      12
    );

  const extra =
    items.slice(
      12
    );

  return (
    <article className="catalogCard">
      <header>
        <div>
          <h3>
            {title}
          </h3>

          <small>
            رکورد یکتا
          </small>
        </div>

        <b>
          {items.length.toLocaleString(
            "fa-IR"
          )}
        </b>
      </header>

      {items.length
        ? (
          <>
            <div className="catalogList">
              {primary.map(
                (
                  item
                ) => (
                  <CatalogItem
                    item={
                      item
                    }
                    displayTitle={
                      displayTitles.get(
                        item
                      )
                    }
                    key={
                      item.id ||
                      canonicalPublicUrl(
                        item.url ||
                        item.sourceUrl
                      ) ||
                      item.nameFa ||
                      item.title
                    }
                  />
                )
              )}
            </div>

            {extra.length >
              0 && (
              <details className="catalogMore">
                <summary>
                  نمایش{" "}
                  {extra.length.toLocaleString(
                    "fa-IR"
                  )}{" "}
                  مورد دیگر
                </summary>

                <div className="catalogList">
                  {extra.map(
                    (
                      item
                    ) => (
                      <CatalogItem
                        item={
                          item
                        }
                        displayTitle={
                          displayTitles.get(
                            item
                          )
                        }
                        key={
                          item.id ||
                          canonicalPublicUrl(
                            item.url ||
                            item.sourceUrl
                          ) ||
                          item.nameFa ||
                          item.title
                        }
                      />
                    )
                  )}
                </div>
              </details>
            )}
          </>
        )
        : (
          <p>
            {empty}

            <small>
              نامشخص ≠ وجود ندارد
            </small>
          </p>
        )}
    </article>
  );
}

function CatalogItem(
  {
    item,
    displayTitle,
  }: {
    item: any;
    displayTitle?: string;
  }
) {
  const url =
    item.url ||
    item.sourceUrl ||
    item.parentUrl;

  const meta = [
    item.type ||
    item.category ||
    item.status,

    item.topic,
  ]
    .filter(Boolean)
    .join(
      " · "
    );

  let host = "";

  try {
    host =
      url
        ? new URL(
            url
          ).hostname.replace(
            /^www\./,
            ""
          )
        : "";
  } catch {}

  const content = (
    <>
      <span>
        <b>
          {displayTitle ||
            item.nameFa ||
            item.title ||
            "رکورد بدون عنوان"}
        </b>

        <small>
          {[
            meta,
            host,
          ]
            .filter(Boolean)
            .join(
              " · "
            )}
        </small>
      </span>

      {url && (
        <i>
          ↗
        </i>
      )}
    </>
  );

  return url
    ? (
      <a
        className="catalogItem"
        href={
          url
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    )
    : (
      <div className="catalogItem">
        {content}
      </div>
    );
}
