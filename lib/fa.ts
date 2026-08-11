const persianDigits="۰۱۲۳۴۵۶۷۸۹";
export function toPersianDigits(value:string|number){return String(value).replace(/\d/g,d=>persianDigits[Number(d)]).replaceAll("%","٪")}
export function formatFaNumber(value:number,options?:Intl.NumberFormatOptions){return new Intl.NumberFormat("fa-IR",options).format(value)}
export function formatFaPercent(value:number,maximumFractionDigits=1){return new Intl.NumberFormat("fa-IR",{style:"percent",maximumFractionDigits}).format(value/100)}
