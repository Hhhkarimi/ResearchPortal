import type { NextConfig } from "next";
const isDev=process.env.NODE_ENV!=="production";
const csp=["default-src 'self'","img-src 'self' data: https:","style-src 'self' 'unsafe-inline'",`script-src 'self' 'unsafe-inline'${isDev?" 'unsafe-eval'":""}`,"font-src 'self' data:","connect-src 'self'","frame-ancestors 'none'","base-uri 'self'","form-action 'self'","object-src 'none'"].join('; ');
const security=[{key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"DENY"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},{key:"Content-Security-Policy",value:csp}];
const config:NextConfig={async headers(){return[{source:"/(.*)",headers:security},{source:"/datasets/:path*",headers:[{key:"Cache-Control",value:"public,max-age=0,s-maxage=3600,stale-while-revalidate=86400"}]}]}};export default config;
