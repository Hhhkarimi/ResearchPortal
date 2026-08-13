import {UniversityExplorer} from "@/components/university-explorer";
import {institutions,audits,rankings,documentCatalog,researchReviews} from "@/lib/data";
export const metadata={title:"دایرکتوری ۱۱۵ دانشگاه و مؤسسه ISC"};
export default function Page(){
  const auditBySlug=new Map(audits.map(item=>[item.universitySlug,item]));
  const rankBySlug=new Map(rankings.map(item=>[item.universitySlug,item]));
  const coverageBySlug=new Map(researchReviews.map(item=>[item.universitySlug,item.reviewEvidenceCoverage??item.auditEvidenceCoverage??0]));
  const documentsBySlug=new Map<string,number>();
  for(const document of documentCatalog){documentsBySlug.set(document.universitySlug,(documentsBySlug.get(document.universitySlug)||0)+1)}
  const rows=institutions.map(institution=>{
    const ranking=rankBySlug.get(institution.slug);
    return {
      slug:institution.slug,
      nameFa:institution.nameFa,
      category:institution.category,
      iscRank:institution.iscRank,
      portalAuditStatus:auditBySlug.get(institution.slug)?.portalAuditStatus||"",
      evidenceCoverage:Number(coverageBySlug.get(institution.slug)||0),
      documentCount:documentsBySlug.get(institution.slug)||0,
      score:ranking?.score??null,
      confidence:ranking?.confidence??null,
    };
  });
  return <main className="shell page"><header className="pageHero"><div><span className="eyebrow">National directory · ISC 115</span><h1>هر دانشگاه، یک پرونده مستند.</h1><p>از میان ۱۱۵ نهاد دولتی ISC جست‌وجو، فیلتر و مرتب‌سازی کنید. نبود رتبه RTPMI به معنی عملکرد ضعیف نیست؛ یعنی شواهد عمومی برای انتشار نمره کافی نبوده است.</p></div><div className="pageHeroStamp"><b>۱۱۵</b><span>پروفایل مستقل</span><small>۶ گروه ISC</small></div></header><UniversityExplorer rows={rows}/></main>;
}
