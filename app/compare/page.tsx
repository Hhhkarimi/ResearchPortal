import {
  CompareExplorer
} from "@/components/compare-explorer";

import {
  rankings
} from "@/lib/data";

export const metadata = {
  title:
    "مقایسه تعاملی پرتال‌های معاونت پژوهشی و فناوری"
};

export default function Page() {
  return (
    <main className="shell page">
      <header className="pageHero">
        <div>
          <span className="eyebrow">
            Build your comparison · RTPMI 4.2
          </span>

          <h1>
            مقایسه‌ای که سؤال شما را جواب دهد.
          </h1>

          <p>
            دو تا چهار پرتال معاونت پژوهشی و فناوریِ Evidence-qualified را انتخاب کنید و
            هشت مؤلفه امتیازدهی بلوغ پرتال معاونت پژوهشی و فناوری را کنار هم ببینید.
          </p>
        </div>

        <div className="pageHeroStamp">
          <b>۸</b>
          <span>مؤلفه هم‌سنجه</span>
          <small>۲ تا ۴ دانشگاه</small>
        </div>
      </header>

      <CompareExplorer
        rankings={
          rankings
        }
      />
    </main>
  );
}
