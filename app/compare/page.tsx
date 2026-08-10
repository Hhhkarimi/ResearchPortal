import {CompareExplorer} from "@/components/compare-explorer";
import {rankings} from "@/lib/data";
export const metadata={title:"مقایسه تعاملی پرتال‌های پژوهش و فناوری"};
export default function Page(){return <main className="shell page"><header className="pageHero"><div><span className="eyebrow">Build your comparison · RTPMI 4.1</span><h1>مقایسه‌ای که سؤال شما را جواب دهد.</h1><p>دو تا چهار پرتال Evidence-qualified را انتخاب کنید و تفاوت هشت بُعد بلوغ پرتال را کنار هم ببینید.</p></div><div className="pageHeroStamp"><b>8</b><span>بُعد هم‌سنجه</span><small>۲ تا ۴ دانشگاه</small></div></header><CompareExplorer rankings={rankings}/></main>}
