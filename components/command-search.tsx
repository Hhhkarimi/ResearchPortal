"use client";

import Link from "next/link";
import {useEffect, useRef, useState} from "react";

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=18`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        setResults(payload.data || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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
              <input ref={inputRef} value={query} onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (value.trim().length < 2) {
                  setResults([]);
                  setLoading(false);
                }
              }}
                placeholder="دانشگاه، سند، آزمایشگاه، گرنت یا سامانه…" aria-label="عبارت جست‌وجو" />
              <button type="button" onClick={() => setOpen(false)}>بستن</button>
            </header>
            <div className="commandBody" aria-live="polite">
              {query.trim().length < 2 ? (
                <div className="commandGuide"><b>در کل رصدخانه جست‌وجو کنید</b><p>نام دانشگاه، عنوان سند، واحد یا سامانه را بنویسید.</p></div>
              ) : loading ? (
                <div className="commandGuide">در حال جست‌وجو…</div>
              ) : results.length ? results.map((result) => (
                <Link href={result.href} key={result.id} onClick={() => setOpen(false)}>
                  <i>{labels[result.kind]}</i><span><b>{result.title}</b><small>{result.context}</small></span><em>←</em>
                </Link>
              )) : (
                <div className="commandGuide"><b>نتیجه‌ای پیدا نشد</b><p>عنوان کوتاه‌تر یا نام دانشگاه را امتحان کنید.</p></div>
              )}
            </div>
            <footer><span>Enter برای باز کردن</span><span>Esc برای بستن</span></footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
