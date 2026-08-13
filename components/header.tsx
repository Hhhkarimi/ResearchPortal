"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {ThemeToggle} from "@/components/theme-toggle";
import {CommandSearch} from "@/components/command-search";

const nav = [
  ["/universities", "دانشگاه‌ها"],
  ["/audit", "نقشه ممیزی"],
  ["/evidence", "شواهد"],
  ["/rankings", "RTPMI"],
  ["/compare", "مقایسه"],
  ["/documents", "اسناد"],
  ["/datasets", "داده و API"],
] as const;

export function Header(){
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  return <header className="siteHeader">
    <div className="shell headerIn">
      <Link href="/" className="brand" aria-label="صفحه نخست رصدخانه">
        <span className="brandMark" aria-hidden="true"><i/><i/><i/></span>
        <span><strong>رصدخانه پرتال معاونت پژوهشی و فناوری</strong><small>ISC ۱۱۵ · IRAN</small></span>
      </Link>
      <nav className={open?"nav open":"nav"} aria-label="ناوبری اصلی">
        {nav.map(([href,label])=><Link href={href} key={href} onClick={()=>setOpen(false)} className={pathname.startsWith(href)?"active":""}>{label}</Link>)}
        <Link href="/methodology" onClick={()=>setOpen(false)} className={pathname.startsWith("/methodology")?"active":""}>روش‌شناسی</Link>
      </nav>
      <div className="headerActions">
        <CommandSearch/>
        <ThemeToggle/>
        <Link href="/datasets" className="headerCta">دریافت داده <span>↙</span></Link>
        <button className="menuButton" type="button" aria-label={open?"بستن منو":"باز کردن منو"} aria-expanded={open} onClick={()=>setOpen(current=>!current)}><i/><i/><i/></button>
      </div>
    </div>
  </header>
}
