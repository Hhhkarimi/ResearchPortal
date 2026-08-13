import "server-only";

import {documentCatalog,institutions} from "@/lib/data";

const universityBySlug=new Map(institutions.map(institution=>[institution.slug,institution.nameFa]));

export const documentSearchIndex=documentCatalog.map(document=>{
  const title=document.displayTitle||document.title||"سند پژوهشی";
  const type=document.displayType||document.type||"سند";
  const topic=document.displayTopic||document.topic||document.category||"سایر اسناد پژوهشی";
  const universityName=universityBySlug.get(document.universitySlug)||"";
  return {
    id:document.id,
    title,
    type,
    topic,
    universityName,
    displayFileName:document.displayFileName||"",
    status:document.status,
    lastVerified:document.lastVerified||"",
    url:document.url||document.sourceUrl||"",
    searchText:[title,document.originalTitle,document.displayFileName,universityName,topic].filter(Boolean).join(" "),
  };
});

export const documentTypes=[...new Set(documentSearchIndex.map(document=>document.type))].sort((a,b)=>a.localeCompare(b,"fa"));
export const documentTopics=[...new Set(documentSearchIndex.map(document=>document.topic))].sort((a,b)=>a.localeCompare(b,"fa"));
