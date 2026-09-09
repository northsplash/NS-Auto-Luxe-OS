import{r as a}from"./react-DddEMGD3.js";import{c as I}from"./supabase--uBXP-YI.js";/**
 * @license lucide-react v0.446.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),c=(...e)=>e.filter((r,t,s)=>!!r&&s.indexOf(r)===t).join(" ");/**
 * @license lucide-react v0.446.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var b={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.446.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=a.forwardRef(({color:e="currentColor",size:r=24,strokeWidth:t=2,absoluteStrokeWidth:s,className:n="",children:o,iconNode:i,...l},p)=>a.createElement("svg",{ref:p,...b,width:r,height:r,stroke:e,strokeWidth:s?Number(t)*24/Number(r):t,className:c("lucide",n),...l},[...i.map(([u,m])=>a.createElement(u,m)),...Array.isArray(o)?o:[o]]));/**
 * @license lucide-react v0.446.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=(e,r)=>{const t=a.forwardRef(({className:s,...n},o)=>a.createElement(h,{ref:o,iconNode:r,className:c(`lucide-${d(e)}`,s),...n}));return t.displayName=`${e}`,t},w="https://placeholder.supabase.co",C="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjAsImV4cCI6MH0.placeholder",J=I(w,C);export{y as c,J as s};
