"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useMemo, useRef, useState} from "react";
import {searchUniversitiesLocally} from "@/lib/university-search";

type Result = {
  id: string;
  kind: "university" | "document" | "system" | "unit";
  title: string;
  context: string;
  href: string;
};

const labels = {
  university: "دانشگاه",
  document: "سند",
  system: "سامانه",
  unit: "واحد",
};

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fallback = useMemo(() => searchUniversitiesLocally(query), [query]);
  const results = useMemo(() => {
    if (!remoteResults) return fallback;
    return [...remoteResults, ...fallback].filter((result, index, all) =>
      all.findIndex((candidate) => candidate.id === result.id) === index
    ).slice(0, 18);
  }, [fallback, remoteResults]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=18`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search request failed: ${response.status}`);
        const payload = await response.json();
        const remote = Array.isArray(payload.data) ? payload.data as Result[] : [];
        setRemoteResults(remote);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, retryNonce]);

  const openResult = (result: Result | undefined) => {
    if (!result) return;
    setOpen(false);
    router.push(result.href);
  };

  return (
    <>
      <button className="commandTrigger" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">⌕</span>
        <b>جست‌وجوی رصدخانه</b>
        <kbd>Ctrl K</kbd>
      </button>
      {open ? (
        <div className="commandBackdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="commandDialog" role="dialog" aria-modal="true" aria-label="جست‌وجوی سراسری" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span aria-hidden="true">⌕</span>
              <input ref={inputRef} value={query} onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((current) => Math.min(current + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(current - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  openResult(results[activeIndex]);
                }
              }} onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                setRemoteResults(null);
                setActiveIndex(0);
                setError(false);
                if (value.trim().length < 2) {
                  setLoading(false);
                }
              }}
                placeholder="دانشگاه، سند، آزمایشگاه، گرنت یا سامانه…" aria-label="عبارت جست‌وجو"
                role="combobox" aria-expanded="true" aria-controls="observatory-search-results"
                aria-activedescendant={results[activeIndex] ? `search-result-${activeIndex}` : undefined} />
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن جست‌وجو">بستن</button>
            </header>
            <div className="commandBody" id="observatory-search-results" role="listbox" aria-live="polite">
              {error ? <div className="commandStatus error" role="status"><span>جست‌وجوی کامل موقتاً در دسترس نیست؛ نتایج دانشگاهی محلی نمایش داده می‌شوند.</span><button type="button" onClick={() => {setRemoteResults(null);setError(false);setRetryNonce((value) => value + 1);}}>تلاش دوباره</button></div> : null}
              {loading && results.length ? <div className="commandStatus" role="status">در حال تکمیل نتایج از اسناد، سامانه‌ها و واحدها…</div> : null}
              {query.trim().length < 2 ? (
                <div className="commandGuide"><b>در کل رصدخانه جست‌وجو کنید</b><p>نام دانشگاه، عنوان سند، واحد یا سامانه را بنویسید.</p></div>
              ) : loading && !results.length ? (
                <div className="commandGuide">در حال جست‌وجو…</div>
              ) : results.length ? results.map((result, index) => (
                <Link href={result.href} key={result.id} id={`search-result-${index}`} role="option"
                  aria-selected={index === activeIndex} className={index === activeIndex ? "active" : ""}
                  onMouseEnter={() => setActiveIndex(index)} onClick={() => setOpen(false)}>
                  <i>{labels[result.kind]}</i><span><b>{result.title}</b><small>{result.context}</small></span><em>←</em>
                </Link>
              )) : (
                <div className="commandGuide"><b>نتیجه‌ای پیدا نشد</b><p>عنوان کوتاه‌تر یا نام دانشگاه را امتحان کنید.</p></div>
              )}
            </div>
            <footer><span>Enter باز کردن</span><span>↑↓ انتخاب</span><span>Esc بستن</span></footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
