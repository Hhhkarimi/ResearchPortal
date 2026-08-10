"use client";

import {useState} from "react";
export function ShareButton({title}:{title:string}){const [done,setDone]=useState(false);async function share(){if(navigator.share){await navigator.share({title,url:location.href})}else{await navigator.clipboard.writeText(location.href);setDone(true);setTimeout(()=>setDone(false),1800)}}return <button type="button" className="shareButton" onClick={share}>{done?"پیوند کپی شد ✓":"اشتراک پرونده ↗"}</button>}
