import{c as i}from"./index-CuFOZAT6.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=i("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=i("CreditCard",[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=i("Eye",[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]),c=5,k=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png",s=[[37,80,68,70],[255,216,255],[137,80,78,71,13,10,26,10]];async function f(e){if(e.size===0)return"The selected file is empty. / चुनी गई फ़ाइल खाली है।";if(e.size>c*1024*1024)return`The file is too large. Maximum size is ${c} MB. / फ़ाइल ${c} MB से बड़ी है।`;const n=new Uint8Array(await e.slice(0,8).arrayBuffer());return s.some(t=>t.every((r,a)=>n[a]===r))?"":"Only PDF, JPG or PNG files are allowed. / केवल PDF, JPG या PNG फ़ाइल।"}function w(e){return!!(e!=null&&e.consentUploaded)&&(e==null?void 0:e.consentStatus)!=="REJECTED"}async function C(e){const n=window.open("","_blank");try{const o=URL.createObjectURL(await e());if(n)n.opener=null,n.location.href=o;else{const t=document.createElement("a");t.href=o,t.download="consent-letter",t.click()}window.setTimeout(()=>URL.revokeObjectURL(o),6e4)}catch(o){throw n==null||n.close(),o}}export{d as C,y as E,p as a,k as b,w as c,c as d,f as e,C as o};
