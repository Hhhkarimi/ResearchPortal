"use client";

import {FormEvent,useMemo,useState} from "react";

import styles from "@/app/submit/submit.module.css";

type UniversityOption={
  slug:string;
  nameFa:string;
  category:string;
};

type ApiResponse={
  ok?:boolean;
  id?:string;
  message?:string;
  error?:string;
};

const CATEGORY_OPTIONS=[
  ["unknown","خودکار تشخیص بده"],
  ["portalIdentity","پرتال پژوهش و فناوری"],
  ["organization","ساختار و واحد پژوهشی"],
  ["libraryDocuments","کتابخانه و منابع"],
  ["laboratories","آزمایشگاه و زیرساخت"],
  ["industryTechnology","صنعت، فناوری و نوآوری"],
  ["systemsServices","سامانه یا خدمت پژوهشی"],
  ["documentsRegulations","سند، آیین‌نامه یا فرم"],
] as const;

export function SubmissionForm({universities}:{universities:UniversityOption[]}){
  const [state,setState]=useState<"idle"|"sending"|"success"|"error">("idle");
  const [message,setMessage]=useState("");
  const [submissionId,setSubmissionId]=useState("");

  const grouped=useMemo(()=>{
    const map=new Map<string,UniversityOption[]>();
    for(const university of universities){
      const rows=map.get(university.category)||[];
      rows.push(university);
      map.set(university.category,rows);
    }
    return [...map.entries()];
  },[universities]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(state==="sending")return;

    const form=event.currentTarget;
    const data=new FormData(form);
    const payload={
      universitySlug:String(data.get("universitySlug")||""),
      url:String(data.get("url")||""),
      description:String(data.get("description")||""),
      categoryHint:String(data.get("categoryHint")||"unknown"),
      website:String(data.get("website")||""),
    };

    setState("sending");
    setMessage("");
    setSubmissionId("");

    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),20000);

    try{
      const response=await fetch("/api/v1/submissions",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
        signal:controller.signal,
      });

      const result=await response.json() as ApiResponse;

      if(!response.ok||!result.ok){
        throw new Error(result.error||"ثبت پیشنهاد انجام نشد.");
      }

      setState("success");
      setMessage(result.message||"پیشنهاد شما ثبت شد.");
      setSubmissionId(result.id||"");
      form.reset();
    }catch(error){
      setState("error");
      setMessage(
        error instanceof DOMException&&error.name==="AbortError"
          ?"پاسخ سرویس بیش از حد طول کشید. لطفاً دوباره تلاش کنید."
          :error instanceof Error
            ?error.message
            :"ثبت پیشنهاد انجام نشد."
      );
    }finally{
      window.clearTimeout(timer);
    }
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <div className={styles.field}>
      <label htmlFor="universitySlug">دانشگاه یا مؤسسه <span aria-hidden="true">*</span></label>
      <select id="universitySlug" name="universitySlug" required defaultValue="">
        <option value="" disabled>انتخاب دانشگاه</option>
        {grouped.map(([category,rows])=><optgroup label={category} key={category}>
          {rows.map((item)=><option value={item.slug} key={item.slug}>{item.nameFa}</option>)}
        </optgroup>)}
      </select>
      <small>لینک باید به یکی از ۱۱۵ دانشگاه یا مؤسسه موجود در رصدخانه مربوط باشد.</small>
    </div>

    <div className={styles.field}>
      <label htmlFor="url">لینک منبع <span aria-hidden="true">*</span></label>
      <input id="url" name="url" type="url" inputMode="url" dir="ltr" required maxLength={2048} placeholder="https://research.example.ac.ir/..." autoComplete="url"/>
      <small>لینک‌های شبکه‌های اجتماعی یا آدرس‌های محلی وارد چرخه خودکار نمی‌شوند.</small>
    </div>

    <div className={styles.field}>
      <label htmlFor="categoryHint">این لینک بیشتر درباره چیست؟</label>
      <select id="categoryHint" name="categoryHint" defaultValue="unknown">
        {CATEGORY_OPTIONS.map(([value,label])=><option value={value} key={value}>{label}</option>)}
      </select>
      <small>این انتخاب فقط یک راهنماست؛ دسته‌بندی نهایی با محتوای واقعی منبع تعیین می‌شود.</small>
    </div>

    <div className={styles.field}>
      <label htmlFor="description">توضیح کوتاه <span aria-hidden="true">*</span></label>
      <textarea id="description" name="description" required minLength={20} maxLength={1200} rows={6} placeholder="مثلاً: صفحه رسمی معاونت پژوهشی که فهرست آیین‌نامه‌ها و فرم‌های پژوهشی را منتشر می‌کند."/>
      <small>۲۰ تا ۱۲۰۰ نویسه. توضیح شما evidence قطعی محسوب نمی‌شود و مستقیماً در رتبه‌بندی استفاده نخواهد شد.</small>
    </div>

    <div className={styles.trap} aria-hidden="true">
      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off"/>
    </div>

    <div className={styles.policyBox}>
      <b>قبل از انتشار چه اتفاقی می‌افتد؟</b>
      <ol>
        <li>لینک در صف Git ثبت می‌شود.</li>
        <li>job روزانه دامنه، دسترسی و ارتباط پژوهشی آن را بررسی می‌کند.</li>
        <li>فقط منبع رسمی از pipeline پاک‌سازی و validatorهای موجود عبور می‌کند.</li>
        <li>در صورت موفقیت همه اعتبارسنجی‌ها، تغییر همراه با تاریخچه Git منتشر می‌شود.</li>
      </ol>
      <p>متن و لینک ارسالی ممکن است در تاریخچه عمومی مخزن ثبت شود؛ اطلاعات شخصی در توضیح وارد نکنید.</p>
    </div>

    {state!=="idle"&&message?<div className={`${styles.notice} ${state==="success"?styles.success:state==="error"?styles.error:""}`} role={state==="error"?"alert":"status"} aria-live="polite">
      <b>{state==="success"?"ثبت شد":state==="error"?"ثبت انجام نشد":"در حال ارسال"}</b>
      <span>{message}</span>
      {submissionId?<small dir="ltr">ID: {submissionId}</small>:null}
    </div>:null}

    <div className={styles.actions}>
      <button type="submit" disabled={state==="sending"}>
        {state==="sending"?"در حال ثبت…":"ارسال برای بررسی"}
      </button>
      <span>ثبت پیشنهاد به معنی تأیید یا انتشار خودکار آن نیست.</span>
    </div>
  </form>;
}
