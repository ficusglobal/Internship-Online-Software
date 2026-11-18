import{c as p,a as n,j as t,s as E,E as A,C as F}from"./index-CuFOZAT6.js";import{M as q}from"./modal-O0sh3u7D.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=p("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O=p("FileCheck2",[["path",{d:"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4",key:"1pf5j1"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"m3 15 2 2 4-4",key:"1lhrkk"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=p("Pencil",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q=p("RotateCcw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V=p("UserRound",[["circle",{cx:"12",cy:"8",r:"5",key:"1hypcn"}],["path",{d:"M20 21a8 8 0 0 0-16 0",key:"rfgkzh"}]]);let w=null;function G(s){if(!w)return Promise.resolve(window.confirm(typeof s.message=="string"?s.message:s.title??"Are you sure?"));const c=w;return new Promise(a=>c(s,a))}function J(){const[s,c]=n.useState(null);if(n.useEffect(()=>(w=(u,h)=>c({options:u,resolve:h}),()=>{w=null}),[]),!s)return null;const{options:a,resolve:d}=s,o=u=>{c(null),d(u)};return t.jsxs(q,{title:a.title??"Please confirm",size:"sm",onClose:()=>o(!1),children:[t.jsx("div",{className:"ui-modal-body",children:t.jsx("p",{className:"confirm-message",children:a.message})}),t.jsxs("div",{className:"ui-modal-footer",children:[t.jsx("button",{type:"button",className:"button button-outline",onClick:()=>o(!1),children:"Cancel"}),t.jsx("button",{type:"button",className:`button ${a.danger?"button-danger":""}`,onClick:()=>o(!0),"data-autofocus":!0,children:a.confirmLabel??"Confirm"})]})]})}function K({ariaLabel:s,className:c,disabled:a=!1,floating:d=!1,onBlur:o,onValueChange:u,options:h,placeholder:M,value:f}){const[m,x]=n.useState(!1),[y,v]=n.useState(""),b=n.useRef(null),k=n.useRef(null),[z,R]=n.useState(),r=h.find(e=>e.value===f),C=h.filter(e=>e.label.toLocaleLowerCase().includes(y.trim().toLocaleLowerCase()));n.useEffect(()=>{const e=i=>{b.current&&!b.current.contains(i.target)&&(x(!1),o==null||o())};return document.addEventListener("mousedown",e),()=>document.removeEventListener("mousedown",e)},[o]);const l=n.useCallback(()=>{var N;const e=(N=k.current)==null?void 0:N.getBoundingClientRect();if(!e)return;const i=6,g=window.innerHeight-e.bottom-i-8,j=e.top-i-8,L=g<240&&j>g,H=Math.max(160,Math.min(352,L?j:g));R({position:"fixed",left:e.left,width:e.width,right:"auto",maxHeight:H,zIndex:1e3,...L?{top:"auto",bottom:window.innerHeight-e.top+i}:{top:e.bottom+i,bottom:"auto"}})},[]);n.useLayoutEffect(()=>{if(!(!d||!m))return l(),window.addEventListener("resize",l),window.addEventListener("scroll",l,!0),()=>{window.removeEventListener("resize",l),window.removeEventListener("scroll",l,!0)}},[d,m,l]);const P=e=>{u(e),v(""),x(!1),o==null||o()},S=()=>{x(e=>(e&&v(""),!e))};return t.jsxs("div",{className:E("dropdown-selector",c,m&&"is-open",a&&"is-disabled"),ref:b,children:[t.jsxs("button",{type:"button",className:"dropdown-trigger","aria-label":s,"aria-expanded":m,"aria-haspopup":"listbox",title:r==null?void 0:r.label,disabled:a,ref:k,onClick:S,children:[t.jsx("span",{className:E("dropdown-value",!r&&"is-placeholder"),children:(r==null?void 0:r.label)??M??"Select an option"}),t.jsx(A,{size:16})]}),m&&t.jsxs("div",{className:"dropdown-menu",role:"listbox","aria-label":s,style:d?z??{visibility:"hidden"}:void 0,children:[t.jsx("input",{className:"dropdown-search",value:y,onChange:e=>v(e.target.value),placeholder:`Search ${(s==null?void 0:s.toLocaleLowerCase())??"options"}`,autoFocus:!0}),C.length?C.map(e=>t.jsxs("button",{type:"button",role:"option","aria-selected":e.value===f,className:e.value===f?"selected":"",onClick:()=>P(e.value),children:[t.jsx("span",{children:e.label}),e.value===f&&t.jsx(F,{size:15})]},e.value)):t.jsx("p",{className:"dropdown-empty",children:"No matching options"})]})]})}export{I as A,J as C,K as D,O as F,$ as P,Q as R,V as U,G as c};
