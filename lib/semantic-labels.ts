import {
  canonicalPublicUrl,
  normalizePublicText,
} from "@/lib/public-model";

const GENERIC_DISPLAY_TITLES =
  new Set([
    "",
    "سند",
    "سند پژوهشی",
    "دانلود",
    "دانلود فایل",
    "مشاهده",
    "مشاهده فایل",
    "فایل",
    "لینک",
    "صفحه",
    "منبع",
    "منبع رسمی",
  ]);

const FILE_TYPE_LABELS:
  Record<string, string> = {
  pdf: "فایل PDF",
  doc: "فایل Word",
  docx: "فایل Word",
  xls: "فایل Excel",
  xlsx: "فایل Excel",
  ppt: "فایل PowerPoint",
  pptx: "فایل PowerPoint",
  csv: "فایل CSV",
  zip: "فایل فشرده",
  rar: "فایل فشرده",
  "7z": "فایل فشرده",
};

type SemanticRecord =
  Record<string, any> & {
    url?: string;
    sourceUrl?: string;
    parentUrl?: string;
    displayTitle?: string;
  };

function recordUrl(
  record: SemanticRecord
) {
  return String(
    record?.url ||
    record?.sourceUrl ||
    record?.parentUrl ||
    ""
  ).trim();
}

function cleanTitleCandidate(
  value: unknown
) {
  const text =
    String(
      value ?? ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    !text ||
    /^https?:\/\//i.test(
      text
    ) ||
    text.length > 220
  ) {
    return "";
  }

  return text;
}

function isGenericTitle(
  value: unknown
) {
  return GENERIC_DISPLAY_TITLES.has(
    normalizePublicText(
      value
    )
  );
}

function decodeSafe(
  value: string
) {
  try {
    return decodeURIComponent(
      value
    );
  } catch {
    return value;
  }
}

function cleanUrlPhrase(
  value: string
) {
  return decodeSafe(
    value
  )
    .replace(
      /\.(pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z)$/i,
      ""
    )
    .replace(
      /[_+\-]+/g,
      " "
    )
    .replace(
      /\(\s*[0-9۰-۹]+\s*\)/g,
      " "
    )
    .replace(
      /(^|\s)[0-9۰-۹]{2,}(?=\s|$)/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function urlExtension(
  value: string
) {
  try {
    const pathname =
      new URL(
        value
      ).pathname;

    const match =
      pathname.match(
        /\.([a-z0-9]{2,5})$/i
      );

    return match
      ? match[1].toLowerCase()
      : "";
  } catch {
    return "";
  }
}

function semanticPathIdentity(
  value: string
) {
  const canonical =
    canonicalPublicUrl(
      value
    );

  if (!canonical) {
    return "";
  }

  try {
    const url =
      new URL(
        canonical
      );

    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return canonical;
  }
}

function urlContentTitle(
  value: string
) {
  try {
    const url =
      new URL(
        value
      );

    const segments =
      url.pathname
        .split("/")
        .filter(Boolean)
        .map(decodeSafe)
        .filter(
          (segment) => {
            const normalized =
              normalizePublicText(
                segment
              );

            return (
              normalized &&
              !/^\d+$/.test(
                normalized
              ) &&
              !/^site\d+$/i.test(
                normalized
              ) &&
              ![
                "fa",
                "en",
                "ar",
                "page",
                "pages",
                "content",
                "article",
                "news",
                "node",
                "files",
                "file",
                "uploads",
                "upload",
                "download",
                "documents",
                "document",
                "index.php",
                "login",
                "signin",
                "sign-in",
                "cas",
              ].includes(
                normalized
              )
            );
          }
        );

    const last =
      segments.at(-1) ||
      "";

    const cleaned =
      cleanUrlPhrase(
        last
      );

    const normalized =
      normalizePublicText(
        cleaned
      );

    if (
      normalized ===
      "introduction to the library"
    ) {
      return "معرفی کتابخانه";
    }

    if (
      normalized ===
      "director of the library"
    ) {
      return "مدیریت کتابخانه";
    }

    return cleaned.length >= 3
      ? cleaned.slice(
          0,
          180
        )
      : "";
  } catch {
    return "";
  }
}

function primaryRawTitle(
  record: SemanticRecord
) {
  return [
    record?.nameFa,
    record?.title,
    record?.anchorText,
    record?.label,
  ]
    .map(
      cleanTitleCandidate
    )
    .find(Boolean) ||
    "";
}

function meaningfulRecordTitle(
  record: SemanticRecord
) {
  const candidates = [
    record?.nameFa,
    record?.title,
    record?.anchorText,
    record?.label,
    record?.topic,
    record?.taxonomy,
  ]
    .map(
      cleanTitleCandidate
    )
    .filter(Boolean);

  const specific =
    candidates.find(
      (candidate) =>
        !isGenericTitle(
          candidate
        )
    );

  if (specific) {
    return specific;
  }

  const fromUrl =
    urlContentTitle(
      recordUrl(record)
    );

  if (
    fromUrl &&
    !isGenericTitle(
      fromUrl
    )
  ) {
    return fromUrl;
  }

  return candidates[0] ||
    "";
}

function semanticResourceKind(
  record: SemanticRecord
) {
  const url =
    recordUrl(record);

  const extension =
    urlExtension(url);

  if (
    FILE_TYPE_LABELS[
      extension
    ]
  ) {
    return FILE_TYPE_LABELS[
      extension
    ];
  }

  try {
    const parsed =
      new URL(url);

    const pathname =
      parsed.pathname
        .toLowerCase();

    if (
      pathname.endsWith(
        "/index.php"
      ) &&
      parsed.search
    ) {
      return "مسیر داخلی پرتال";
    }

    if (
      pathname.endsWith(
        "/find.php"
      )
    ) {
      return "صفحه جست‌وجوی منبع";
    }

    if (
      pathname.endsWith(
        "/persons.php"
      )
    ) {
      return "صفحه اطلاعات سازمانی";
    }
  } catch {}

  const text =
    normalizePublicText(
      [
        record?.nameFa,
        record?.title,
        record?.anchorText,
        record?.label,
        record?.topic,
        record?.taxonomy,
        record?.type,
        record?.category,
        decodeSafe(url),
      ]
        .filter(Boolean)
        .join(" ")
    );

  if (
    /(\/|\b)(login|signin|sign in|cas)(\/|\b)/i.test(
      text
    ) ||
    /ورود\s+به\s+سامانه/.test(
      text
    )
  ) {
    return "ورود به سامانه";
  }

  if (
    /researchweek|هفته\s*پژوهش/.test(
      text
    )
  ) {
    return "پرتال هفته پژوهش";
  }

  if (
    /respro|proposal|پروپوزال|طرح\s*پژوهشی/.test(
      text
    )
  ) {
    return "سامانه طرح‌های پژوهشی";
  }

  if (
    /publish|journal|نشری|انتشارات/.test(
      text
    )
  ) {
    return "سامانه نشریات و انتشارات";
  }

  if (
    /lab[\s/_-]*portal|laboratory|آزمایشگاه/.test(
      text
    )
  ) {
    return /portal|system|سامانه/.test(
      text
    )
      ? "سامانه آزمایشگاه"
      : "صفحه آزمایشگاه";
  }

  if (
    /library|کتابخانه|مرکز\s*اسناد/.test(
      text
    )
  ) {
    return "صفحه کتابخانه و اسناد";
  }

  if (
    /entrepreneur|کارآفر|ارتباط\s*با\s*جامعه/.test(
      text
    )
  ) {
    return "کارآفرینی و ارتباط با جامعه";
  }

  if (
    /innovation|incubator|مرکز\s*رشد|نوآور/.test(
      text
    )
  ) {
    return "مرکز رشد و نوآوری";
  }

  if (
    /industry|ارتباط\s*با\s*صنعت|صنعت/.test(
      text
    )
  ) {
    return "صفحه ارتباط با صنعت";
  }

  if (
    /regulation|bylaw|guideline|directive|آیین\s*نامه|شیوه\s*نامه|دستورالعمل|بخشنامه/.test(
      text
    )
  ) {
    return "صفحه اسناد و مقررات";
  }

  if (
    /form|template|فرم|الگو/.test(
      text
    )
  ) {
    return "فرم رسمی";
  }

  if (
    /system|portal|سامانه/.test(
      text
    )
  ) {
    return "سامانه پژوهشی";
  }

  if (
    /research|پژوهش/.test(
      text
    )
  ) {
    return "صفحه پژوهش و فناوری";
  }

  try {
    const parsed =
      new URL(url);

    if (
      parsed.pathname === "/" ||
      !parsed.pathname
    ) {
      return "پرتال رسمی دانشگاه";
    }
  } catch {}

  return "صفحه رسمی دانشگاه";
}

function semanticUrlContext(
  value: string
) {
  try {
    const url =
      new URL(value);

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const first =
      host.split(".")[0];

    const hostContexts:
      Record<string, string> = {
      research:
        "معاونت پژوهش و فناوری",
      lib:
        "کتابخانه مرکزی",
      library:
        "کتابخانه مرکزی",
      pgeducation:
        "تحصیلات تکمیلی",
      "lab-portal":
        "آزمایشگاه مرکزی",
      publish:
        "انتشارات و نشریات",
      researchweek:
        "هفته پژوهش",
      respro:
        "طرح‌های پژوهشی",
      inc:
        "مرکز رشد",
      ent:
        "کارآفرینی",
      accounts:
        "سامانه احراز هویت",
      "alborz-research":
        "پژوهش پردیس البرز",
    };

    const fromPath =
      urlContentTitle(
        value
      );

    if (
      fromPath &&
      !isGenericTitle(
        fromPath
      )
    ) {
      return fromPath;
    }

    if (
      hostContexts[first]
    ) {
      return hostContexts[first];
    }

    return host;
  } catch {
    return "منبع رسمی";
  }
}

function recordRichness(
  record: SemanticRecord
) {
  return [
    record?.nameFa,
    record?.title,
    record?.anchorText,
    record?.label,
    record?.topic,
    record?.taxonomy,
    record?.type,
    record?.category,
  ].reduce(
    (
      score,
      value
    ) =>
      score +
      (
        cleanTitleCandidate(
          value
        )
          ? 1
          : 0
      ),
    0
  );
}

function mergeSameUrlRecords(
  existing: SemanticRecord,
  incoming: SemanticRecord
) {
  const firstUrl =
    recordUrl(existing) ||
    recordUrl(incoming);

  const richerIncoming =
    recordRichness(incoming) >
    recordRichness(existing);

  const merged =
    richerIncoming
      ? {
          ...existing,
          ...incoming,
        }
      : {
          ...incoming,
          ...existing,
        };

  return {
    ...merged,
    url: firstUrl,
  };
}

function addCollisionContext(
  titles: string[],
  records: SemanticRecord[]
) {
  const groups =
    new Map<
      string,
      number[]
    >();

  titles.forEach(
    (
      title,
      index
    ) => {
      const key =
        normalizePublicText(
          title
        );

      const bucket =
        groups.get(key) ||
        [];

      bucket.push(index);
      groups.set(
        key,
        bucket
      );
    }
  );

  for (
    const indexes
    of groups.values()
  ) {
    if (
      indexes.length < 2
    ) {
      continue;
    }

    for (
      const index
      of indexes
    ) {
      const context =
        semanticUrlContext(
          recordUrl(
            records[index]
          )
        );

      if (
        context &&
        !normalizePublicText(
          titles[index]
        ).includes(
          normalizePublicText(
            context
          )
        )
      ) {
        titles[index] =
          `${titles[index]} · ${context}`;
      }
    }
  }

  return titles;
}

export function semanticEvidenceSources(
  universitySlug: string,
  review: any,
  audit: any
) {
  const candidates:
    SemanticRecord[] = [
    ...(
      review?.officialSources ||
      []
    ).map(
      (source: any) => ({
        ...source,
        universitySlug,
        url:
          source.url,
      })
    ),

    ...(
      review?.officialSourceUrls ||
      []
    ).map(
      (url: string) => ({
        universitySlug,
        url,
      })
    ),

    ...(
      audit?.evidenceUrls ||
      []
    ).map(
      (url: string) => ({
        universitySlug,
        url,
      })
    ),
  ];

  const byUrl =
    new Map<
      string,
      SemanticRecord
    >();

  for (
    const candidate
    of candidates
  ) {
    const url =
      recordUrl(candidate);

    const key =
      canonicalPublicUrl(
        url
      );

    if (!key) {
      continue;
    }

    const existing =
      byUrl.get(key);

    byUrl.set(
      key,
      existing
        ? mergeSameUrlRecords(
            existing,
            candidate
          )
        : {
            ...candidate,
            url,
          }
    );
  }

  const records = [
    ...byUrl.values(),
  ];

  /*
   * A portal often publishes the same page twice: once with a
   * human-readable slug and once through index.php?sid=... .
   * We keep both distinct URLs, but let the opaque route borrow
   * the human-readable content title from its same-page sibling.
   */
  const siblingTitles =
    new Map<
      string,
      string
    >();

  for (
    const record
    of records
  ) {
    const url =
      recordUrl(record);

    const identity =
      semanticPathIdentity(
        url
      );

    const fromUrl =
      urlContentTitle(
        url
      );

    const fromRecord =
      meaningfulRecordTitle(
        record
      );

    const candidate =
      !isGenericTitle(
        fromRecord
      )
        ? fromRecord
        : fromUrl;

    if (
      identity &&
      candidate &&
      !isGenericTitle(
        candidate
      )
    ) {
      const current =
        siblingTitles.get(
          identity
        );

      if (
        !current ||
        candidate.length >
          current.length
      ) {
        siblingTitles.set(
          identity,
          candidate
        );
      }
    }
  }

  const titles =
    records.map(
      (record) => {
        const url =
          recordUrl(record);

        const directBase =
          meaningfulRecordTitle(
            record
          );

        const siblingBase =
          siblingTitles.get(
            semanticPathIdentity(
              url
            )
          );

        const base =
          !isGenericTitle(
            directBase
          )
            ? directBase
            : siblingBase ||
              directBase;

        const kind =
          semanticResourceKind(
            record
          );

        if (
          !base ||
          isGenericTitle(
            base
          )
        ) {
          return kind;
        }

        if (
          normalizePublicText(
            base
          ) ===
          normalizePublicText(
            kind
          )
        ) {
          return base;
        }

        return `${kind} — ${base}`;
      }
    );

  addCollisionContext(
    titles,
    records
  );

  return records.map(
    (
      record,
      index
    ) => ({
      ...record,
      displayTitle:
        titles[index],
    })
  );
}

export function semanticCatalogTitles(
  items: SemanticRecord[]
) {
  const baseTitles =
    items.map(
      (item) =>
        meaningfulRecordTitle(
          item
        )
    );

  const baseGroups =
    new Map<
      string,
      number[]
    >();

  baseTitles.forEach(
    (
      title,
      index
    ) => {
      const key =
        normalizePublicText(
          title
        );

      const bucket =
        baseGroups.get(key) ||
        [];

      bucket.push(index);
      baseGroups.set(
        key,
        bucket
      );
    }
  );

  const titles =
    items.map(
      (
        item,
        index
      ) => {
        const base =
          baseTitles[index];

        const group =
          baseGroups.get(
            normalizePublicText(
              base
            )
          ) || [];

        const kind =
          semanticResourceKind(
            item
          );

        const rawTitle =
          primaryRawTitle(
            item
          );

        if (
          !base ||
          isGenericTitle(
            base
          )
        ) {
          const fromUrl =
            urlContentTitle(
              recordUrl(item)
            );

          return fromUrl &&
            !isGenericTitle(
              fromUrl
            )
              ? `${kind} — ${fromUrl}`
              : kind;
        }

        if (
          group.length < 2 &&
          rawTitle &&
          !isGenericTitle(
            rawTitle
          )
        ) {
          return base;
        }

        return `${kind} — ${base}`;
      }
    );

  addCollisionContext(
    titles,
    items
  );

  return new Map(
    items.map(
      (
        item,
        index
      ) => [
        item,
        titles[index],
      ]
    )
  );
}
