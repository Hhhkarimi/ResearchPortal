import {ImageResponse} from "next/og";

export const alt="Iran Research Portal Observatory — ISC ۱۱۵";
export const size={width:1200,height:630};
export const contentType="image/png";

export default function Image(){return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"72px",background:"radial-gradient(circle at 85% 20%,#6545e8 0,#0b1020 48%,#050812 100%)",color:"white",direction:"ltr"}}><div style={{display:"flex",fontSize:24,color:"#b8ef48",letterSpacing:"3px"}}>ISC ۱۱۵ · RTPMI ۴.۲ · OPEN DATA</div><div style={{display:"flex",flexDirection:"column"}}><div style={{display:"flex",fontSize:70,fontWeight:800,lineHeight:1.08,maxWidth:"960px"}}>Iran Research Portal Observatory</div><div style={{display:"flex",fontSize:28,color:"#aab4c8",marginTop:24}}>A national evidence map for public research & technology portals</div></div><div style={{display:"flex",gap:42,fontSize:21}}><span>۱۱۵ PORTAL OUTCOMES</span><span>۱۱۵ × ۷ AUDIT</span><span>ZERO SYNTHETIC SCORES</span></div></div>,size)}
