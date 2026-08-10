import {UniversityExplorer} from "@/components/university-explorer";
import {institutions,audits,rankings} from "@/lib/data";
export const metadata={title:"دایرکتوری ۱۱۵ دانشگاه و مؤسسه ISC"};
export default function Page(){return <main className="shell page"><header className="pageHero"><div><span className="eyebrow">National directory · ISC 115</span><h1>هر دانشگاه، یک پرونده مستند.</h1><p>از میان ۱۱۵ نهاد دولتی ISC جست‌وجو کنید. نبود رتبه RTPMI به معنی عملکرد ضعیف نیست؛ یعنی شواهد عمومی برای انتشار نمره کافی نبوده است.</p></div><div className="pageHeroStamp"><b>115</b><span>پروفایل مستقل</span><small>۶ گروه ISC</small></div></header><UniversityExplorer institutions={institutions} audits={audits} rankings={rankings}/></main>}
