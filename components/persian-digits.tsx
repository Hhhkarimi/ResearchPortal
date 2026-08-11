"use client";

import {useEffect} from "react";
import {toPersianDigits} from "@/lib/fa";

const excluded="code, pre, script, style, [data-latin]";
function localize(root:Node){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes:Text[]=[];let node=walker.nextNode();
  while(node){const parent=node.parentElement;if(parent&&!parent.closest(excluded)&&/\d/.test(node.nodeValue||""))nodes.push(node as Text);node=walker.nextNode()}
  for(const text of nodes){const localized=toPersianDigits(text.nodeValue||"");if(localized!==text.nodeValue)text.nodeValue=localized}
  const element=root instanceof Element?root:root.parentElement;
  if(element&&!element.closest(excluded))for(const target of [element,...element.querySelectorAll<HTMLElement>("[title],[aria-label]")])for(const attribute of ["title","aria-label"]){const value=target.getAttribute(attribute);if(value)target.setAttribute(attribute,toPersianDigits(value))}
}
export function PersianDigits(){useEffect(()=>{document.title=toPersianDigits(document.title);localize(document.body);const observer=new MutationObserver(records=>{for(const record of records){if(record.type==="characterData")localize(record.target);for(const node of record.addedNodes)localize(node)}});observer.observe(document.body,{subtree:true,childList:true,characterData:true});return()=>observer.disconnect()},[]);return null}
