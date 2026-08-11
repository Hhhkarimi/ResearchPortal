"use client";

type Theme="light"|"dark";
const storageKey="rtpmi-theme";

function applyTheme(theme:Theme){
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
}

export function ThemeToggle(){
  function toggle(){
    const current=document.documentElement.dataset.theme==="dark"?"dark":"light";
    const next:Theme=current==="dark"?"light":"dark";
    applyTheme(next);
    localStorage.setItem(storageKey,next);
  }
  return <button className="themeToggle" type="button" onClick={toggle} aria-label="تغییر نمای روشن و تیره" title="تغییر نما"><span className="lightIcon" aria-hidden="true">☾</span><span className="darkIcon" aria-hidden="true">☀</span></button>;
}
