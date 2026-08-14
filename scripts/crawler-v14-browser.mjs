import fs from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLICK_TERMS = [
  "پژوهش", "پژوهشی", "پژوهش و فناوری", "معاونت پژوهش", "معاونت پژوهشی",
  "فناوری", "نوآوری", "ارتباط با صنعت", "جامعه و صنعت", "صنعت",
  "آزمایشگاه", "آزمایشگاه مرکزی", "کتابخانه", "کتابخانه مرکزی", "انتشارات",
  "نشریات", "سامانه", "خدمات پژوهشی", "آیین نامه", "آیین‌نامه", "شیوه نامه",
  "شیوه‌نامه", "دستورالعمل", "فرم", "فرآیند", "فرایند", "اسناد",
  "research", "technology transfer", "innovation", "industry", "laboratory",
  "central lab", "library", "publication", "journal", "regulation", "guideline",
  "procedure", "forms", "documents", "services"
];

const BLOCKED_CLICK_TERMS = [
  "ورود", "login", "sign in", "ثبت نام", "register", "logout", "خروج",
  "حذف", "delete", "پرداخت", "payment", "ارسال", "submit"
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fallbackDump(browserPath, url, timeoutMs) {
  try {
    const { stdout } = await execFileAsync(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--no-first-run",
        "--no-default-browser-check",
        "--virtual-time-budget=6500",
        "--dump-dom",
        url,
      ],
      { timeout: timeoutMs, maxBuffer: 14_000_000, windowsHide: true }
    );
    return stdout || null;
  } catch {
    return null;
  }
}

function cdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(String(event.data));
      if (!message.id || !pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || "CDP error"));
      else resolve(message.result || {});
    } catch {}
  });

  const send = async (method, params = {}) => {
    await ready;
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 12_000).unref?.();
    });
  };

  return {
    send,
    close: () => {
      try { socket.close(); } catch {}
    },
  };
}

async function readDevtoolsPort(profileDir, deadline) {
  const file = path.join(profileDir, "DevToolsActivePort");
  while (Date.now() < deadline) {
    try {
      const [port, browserPath] = (await fs.readFile(file, "utf8")).trim().split(/\r?\n/);
      if (port && browserPath) return { port: Number(port), browserPath };
    } catch {}
    await sleep(120);
  }
  return null;
}

async function pageWebSocket(port, deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(1500),
      });
      const pages = await response.json();
      const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(150);
  }
  return null;
}

const CLICK_SCRIPT = String.raw`(() => {
  const normalize = (v) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim();
  const wanted = ${JSON.stringify(CLICK_TERMS)}.map(normalize);
  const blocked = ${JSON.stringify(BLOCKED_CLICK_TERMS)}.map(normalize);
  const visible = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
  };
  const candidates = [...document.querySelectorAll(
    'button,[role="button"],[role="tab"],[aria-expanded],a[href^="#"],a[href^="javascript:"],[data-toggle],[data-bs-toggle],[data-target],[data-bs-target]'
  )];
  return candidates.map((el, index) => {
    const text = normalize([el.innerText, el.textContent, el.getAttribute("aria-label"), el.title].filter(Boolean).join(" "));
    const href = el.getAttribute("href") || "";
    const type = normalize(el.getAttribute("type"));
    const tag = el.tagName.toLowerCase();
    const safeAnchor = tag !== "a" || !href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:");
    const safeButton = tag !== "button" || type !== "submit";
    const score = wanted.reduce((n, term) => n + (term && text.includes(term) ? 1 : 0), 0);
    const isBlocked = blocked.some((term) => term && text.includes(term));
    return { index, text: text.slice(0, 180), score, isBlocked, visible: visible(el), safeAnchor, safeButton };
  }).filter((x) => x.visible && x.safeAnchor && x.safeButton && !x.isBlocked && x.score > 0)
    .sort((a,b) => b.score - a.score || a.index - b.index)
    .slice(0, 24);
})()`;

const CLICK_INDEX_SCRIPT = (index) => String.raw`(() => {
  const list = [...document.querySelectorAll(
    'button,[role="button"],[role="tab"],[aria-expanded],a[href^="#"],a[href^="javascript:"],[data-toggle],[data-bs-toggle],[data-target],[data-bs-target]'
  )];
  const el = list[${Number(index)}];
  if (!el) return {ok:false};
  const text = String([el.innerText, el.textContent, el.getAttribute("aria-label"), el.title].filter(Boolean).join(" ")).toLowerCase();
  const blocked = ${JSON.stringify(BLOCKED_CLICK_TERMS)}.map((v) => String(v).toLowerCase());
  const href = el.getAttribute("href") || "";
  const tag = el.tagName.toLowerCase();
  const type = String(el.getAttribute("type") || "").toLowerCase();
  if (blocked.some((term) => term && text.includes(term))) return {ok:false, reason:"blocked-text"};
  if (tag === "button" && type === "submit") return {ok:false, reason:"submit"};
  if (tag === "a" && href && !href.startsWith("#") && !href.toLowerCase().startsWith("javascript:")) return {ok:false, reason:"navigation"};
  try { el.scrollIntoView({block:"center", inline:"nearest"}); } catch {}
  const before = document.querySelectorAll('a[href],iframe[src],[data-href],[data-url],[data-link],[data-target-url]').length;
  try { el.click(); } catch { return {ok:false, before}; }
  return {ok:true, before};
})()`;

const SNAPSHOT_SCRIPT = String.raw`(() => ({
  html: document.documentElement ? document.documentElement.outerHTML : "",
  url: location.href,
  links: document.querySelectorAll('a[href],iframe[src],[data-href],[data-url],[data-link],[data-target-url]').length,
  title: document.title || ""
}))()`;

export async function interactiveRender(
  browserPath,
  url,
  {
    timeoutMs = 45_000,
    clickBudget = 6,
    clickWaitMs = 900,
    universitySlug = "unknown",
  } = {}
) {
  if (!browserPath) return null;

  const profileDir = path.resolve(
    ".pipeline",
    "browser-v14",
    `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  await fs.mkdir(profileDir, { recursive: true });

  let child = null;
  let client = null;
  const actions = [];
  const startedAt = new Date().toISOString();

  try {
    child = spawn(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--remote-debugging-port=0",
        `--user-data-dir=${profileDir}`,
        "about:blank",
      ],
      { windowsHide: true, stdio: "ignore" }
    );

    const deadline = Date.now() + Math.max(8_000, timeoutMs - 2_000);
    const active = await readDevtoolsPort(profileDir, deadline);
    if (!active?.port) throw new Error("DevTools port unavailable");

    const wsUrl = await pageWebSocket(active.port, deadline);
    if (!wsUrl) throw new Error("DevTools page unavailable");

    client = cdpClient(wsUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Page.navigate", { url });
    await sleep(1800);

    const beforeSnapshot = await client.send("Runtime.evaluate", {
      expression: SNAPSHOT_SCRIPT,
      returnByValue: true,
      awaitPromise: true,
    });
    const first = beforeSnapshot?.result?.value || {};

    const candidateResult = await client.send("Runtime.evaluate", {
      expression: CLICK_SCRIPT,
      returnByValue: true,
      awaitPromise: true,
    });
    const candidates = candidateResult?.result?.value || [];

    for (const candidate of candidates.slice(0, Math.max(0, clickBudget))) {
      const clickedAt = new Date().toISOString();
      const click = await client.send("Runtime.evaluate", {
        expression: CLICK_INDEX_SCRIPT(candidate.index),
        returnByValue: true,
        awaitPromise: true,
      }).catch(() => null);
      if (!click?.result?.value?.ok) continue;

      await sleep(clickWaitMs);
      const afterResult = await client.send("Runtime.evaluate", {
        expression: SNAPSHOT_SCRIPT,
        returnByValue: true,
        awaitPromise: true,
      }).catch(() => null);
      const after = afterResult?.result?.value || {};

      actions.push({
        universitySlug,
        pageUrl: url,
        renderedUrl: after.url || first.url || url,
        text: candidate.text,
        score: candidate.score,
        beforeLinks: click.result.value.before ?? first.links ?? null,
        afterLinks: after.links ?? null,
        linkDelta:
          Number.isFinite(after.links) && Number.isFinite(click.result.value.before)
            ? after.links - click.result.value.before
            : null,
        clickedAt,
      });
    }

    const finalResult = await client.send("Runtime.evaluate", {
      expression: SNAPSHOT_SCRIPT,
      returnByValue: true,
      awaitPromise: true,
    });
    const final = finalResult?.result?.value || {};

    return {
      html: final.html || first.html || null,
      finalUrl: final.url || first.url || url,
      actions,
      interactive: true,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (error) {
    const html = await fallbackDump(browserPath, url, timeoutMs);
    return html
      ? {
          html,
          finalUrl: url,
          actions,
          interactive: false,
          fallback: "dump-dom",
          error: error instanceof Error ? error.message : String(error),
          startedAt,
          finishedAt: new Date().toISOString(),
        }
      : null;
  } finally {
    client?.close?.();
    try { child?.kill?.(); } catch {}
    await sleep(80);
    await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}
