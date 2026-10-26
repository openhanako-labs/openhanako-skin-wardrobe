(function(){"use strict";const HANA_SKIN_CSS_V="?v=10ef34379e7b638a";const C={storageKey:"hana-theme",defaultTheme:"warm-paper",autoLightDefault:"warm-paper",autoDarkDefault:"midnight",legacyThemeAliases:{"claude-design":"new-warm-paper"},autoOption:{id:"auto",i18nName:"settings.appearance.auto",i18nMode:"settings.appearance.autoMode"},themes:{"warm-paper":{cssPath:"themes/warm-paper.css",backgroundColor:"#F8F4ED",appearance:"light",i18nName:"settings.appearance.warmPaper",i18nMode:"settings.appearance.warmPaperMode"},midnight:{cssPath:"themes/midnight.css",backgroundColor:"#3B4A54",appearance:"dark",i18nName:"settings.appearance.midnight",i18nMode:"settings.appearance.midnightMode"},"high-contrast":{cssPath:"themes/high-contrast.css",backgroundColor:"#FAF8F7",appearance:"light",i18nName:"settings.appearance.highContrast",i18nMode:"settings.appearance.highContrastMode"},"grass-aroma":{cssPath:"themes/grass-aroma.css",backgroundColor:"#F5F8F3",appearance:"light",i18nName:"settings.appearance.grassAroma",i18nMode:"settings.appearance.grassAromaMode"},contemplation:{cssPath:"themes/contemplation.css",backgroundColor:"#F3F5F7",appearance:"light",i18nName:"settings.appearance.contemplation",i18nMode:"settings.appearance.contemplationMode"},absolutely:{cssPath:"themes/absolutely.css",backgroundColor:"#F4F3EE",appearance:"light",i18nName:"settings.appearance.absolutely",i18nMode:"settings.appearance.absolutelyMode"},delve:{cssPath:"themes/delve.css",backgroundColor:"#FFFFFF",appearance:"light",i18nName:"settings.appearance.delve",i18nMode:"settings.appearance.delveMode"},"deep-think":{cssPath:"themes/deep-think.css",backgroundColor:"#FCFCFD",appearance:"light",i18nName:"settings.appearance.deepThink",i18nMode:"settings.appearance.deepThinkMode"},"new-warm-paper":{cssPath:"themes/new-warm-paper.css",backgroundColor:"#F5EFE4",appearance:"light",i18nName:"settings.appearance.newWarmPaper",i18nMode:"settings.appearance.newWarmPaperMode"},"midnight-contrast":{cssPath:"themes/midnight-contrast.css",backgroundColor:"#26343D",appearance:"dark",i18nName:"settings.appearance.midnightContrast",i18nMode:"settings.appearance.midnightContrastMode"},coral:{cssPath:"themes/coral.css",backgroundColor:"#FDF6EC",appearance:"light",i18nName:"settings.appearance.coral",i18nMode:"settings.appearance.coralMode"},"hana-moonlit-court":{cssPath:"themes/hana-moonlit-court.css",backgroundColor:"#172725",appearance:"dark",i18nName:"settings.appearance.moonlitCourt",i18nMode:"settings.appearance.moonlitCourtMode"},"hana-violet-dusk":{cssPath:"themes/hana-violet-dusk.css",backgroundColor:"#3C354A",appearance:"dark",i18nName:"settings.appearance.violetDusk",i18nMode:"settings.appearance.violetDuskMode"},"hana-deepsleep":{cssPath:"themes/hana-deepsleep.css",backgroundColor:"#F6F7FB",appearance:"light",i18nName:"settings.appearance.deepseekBlue",i18nMode:"settings.appearance.deepseekBlueMode"},"hana-claude-clay":{cssPath:"themes/hana-claude-clay.css",backgroundColor:"#FAF9F5",appearance:"light",i18nName:"settings.appearance.claudeClay",i18nMode:"settings.appearance.claudeClayMode"},"hana-luna":{cssPath:"themes/hana-luna.css",backgroundColor:"#141313",appearance:"dark",i18nName:"settings.appearance.lunaDragon",i18nMode:"settings.appearance.lunaDragonMode"}}},$=Object.freeze(["light","dark"]),Be=C.storageKey,B=C.defaultTheme,Q=C.autoLightDefault,Z=C.autoDarkDefault,G=Object.freeze({...C.legacyThemeAliases}),ee=Object.freeze({...C.autoOption}),_=Object.freeze(Object.fromEntries(Object.entries(C.themes).map(([e,t])=>[e,Object.freeze({...t})])));function te(e,t){if(!t.cssPath||!t.backgroundColor||!t.i18nName||!t.i18nMode)throw new Error(`theme-registry: theme "${e}" is missing required fields (cssPath / backgroundColor / i18nName / i18nMode)`);if(!/^#[0-9A-F]{6}$/i.test(t.backgroundColor))throw new Error(`theme-registry: theme "${e}" has invalid backgroundColor "${t.backgroundColor}" (must be 6-digit hex)`);if(!$.includes(t.appearance))throw new Error(`theme-registry: theme "${e}" has invalid appearance "${t.appearance}" (must be ${$.join(" or ")})`)}for(const[e,t]of Object.entries(_))te(e,t);const ne="custom:",Ge=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;function oe(e){return typeof e=="string"&&e.startsWith(ne)&&Ge.test(e.slice(ne.length))}function re(e){return e==="auto"?"auto":typeof e!="string"||e.length===0?B:oe(e)?e:G[e]?G[e]:e in _?e:B}function He(e,t){const n=re(e);return n==="auto"?{stored:n,concrete:t?Z:Q}:{stored:n,concrete:n}}function ae(){return Object.keys(_)}function je(){return[...ae().map(t=>({id:t,i18nName:_[t].i18nName,i18nMode:_[t].i18nMode})),{...ee}]}function Ye(e){const t=typeof e=="string"?_[e]:void 0;return t?t.appearance:null}const M={STORAGE_KEY:Be,DEFAULT_THEME:B,AUTO_LIGHT_DEFAULT:Q,AUTO_DARK_DEFAULT:Z,AUTO_OPTION:ee,LEGACY_THEME_ALIASES:G,THEMES:_,THEME_APPEARANCES:$,assertThemeEntry:te,migrateSavedTheme:re,resolveSavedTheme:He,getThemeIds:ae,getAllUIOptions:je,themeAppearance:Ye,isCustomThemeSelection:oe},We="lxgw-wenkai",ze="lxgw-wenkai-screen",Ke="serif",qe="sans",Xe=Object.freeze(["PT Serif","Noto Serif SC","Source Han Serif SC","Songti SC","STSong","serif"]),Ve=Object.freeze(["-apple-system","BlinkMacSystemFont","Segoe UI","system-ui","PingFang SC","Microsoft YaHei","sans-serif"]),Je=new Set(["serif","sans-serif","monospace","cursive","fantasy","system-ui","ui-serif","ui-sans-serif","ui-monospace","-apple-system"]);function se(e){return e.map(t=>Je.has(t)?t:JSON.stringify(t)).join(", ")}const Qe=/^custom:[a-f0-9]{64}$/;function Ze(e){return e===Ke||e===qe||e===We||e===ze||typeof e=="string"&&Qe.test(e)}const et="hana-reduce-card-buttons",tt="reduce-card-buttons";function nt(e=window.localStorage){return!0}function ie(e,t=document.body){t.classList.toggle(tt,e)}function ot(e,t=window.localStorage,n=document.body){ie(!0,n),t.setItem(et,"1")}function rt(e=window.localStorage,t=document.body){const n=nt(e);return ie(n,t),n}const at="hana-show-card-titles",st="show-card-titles";function it(e=window.localStorage){return!1}function ce(e,t=document.body){t.classList.remove(st)}function ct(e,t=window.localStorage,n=document.body){ce(!1,n),t.setItem(at,"0")}function ut(e=window.localStorage,t=document.body){const n=it(e);return ce(n,t),n}const ue="custom:",de="custom-preview:",dt=0,lt=32,mt=1,ft=8,ht=80;function i(e,t,n,o=!1){return{name:e,type:"color",group:t,label:n,required:!0,...o?{opaque:!0}:{}}}function L(e,t,n){return{name:e,type:"length",group:t,label:n,required:!0,min:dt,max:lt}}function H(e,t,n){return{name:e,type:"font-family",group:t,label:n,required:!0,minItems:mt,maxItems:ft,itemMaxLength:ht}}const le=["black","red","green","yellow","blue","magenta","cyan","white"],x=Object.freeze([i("--bg","background","Background",!0),i("--bg-card","background","Card background",!0),i("--bg-glass","background","Glass background"),i("--sidebar-bg","background","Sidebar background"),i("--accent","accent","Accent",!0),i("--accent-hover","accent","Accent hover"),i("--accent-light","accent","Accent tint"),i("--link","accent","Link",!0),i("--link-hover","accent","Link hover"),i("--text","text","Text"),i("--text-light","text","Secondary text"),i("--text-muted","text","Muted text"),i("--hana-text","text","Chat text"),i("--border","structural","Border"),i("--shadow","structural","Shadow"),i("--green","structural","Success",!0),i("--coral","structural","Coral",!0),i("--danger","structural","Danger",!0),i("--jian-note-bg","note","Note background"),i("--jian-note-border","note","Note border"),i("--mood-bg","chat","Mood background"),i("--mood-text","chat","Mood text"),i("--mood-border","chat","Mood border"),i("--tool-bg","chat","Tool background"),i("--tool-text","chat","Tool text"),i("--user-bg","chat","User bubble background"),i("--drop-overlay-bg","chat","Drop overlay background"),i("--attach-bg","chat","Attachment background"),i("--overlay-subtle","overlay","Overlay subtle"),i("--overlay-light","overlay","Overlay light"),i("--overlay-medium","overlay","Overlay medium"),i("--overlay-strong","overlay","Overlay strong"),i("--tab-slider-bg","overlay","Tab slider background"),i("--term-bg","terminal","Terminal background"),i("--term-fg","terminal","Terminal foreground"),i("--term-cursor","terminal","Terminal cursor"),i("--term-cursor-accent","terminal","Terminal cursor accent"),i("--term-selection-bg","terminal","Terminal selection"),...le.map(e=>i(`--term-ansi-${e}`,"terminal",`Terminal ANSI ${e}`)),...le.map(e=>i(`--term-ansi-bright-${e}`,"terminal",`Terminal ANSI bright ${e}`)),L("--radius-input","shape","Input radius"),L("--radius-card","shape","Card radius"),L("--radius-chat-card","shape","Chat card radius"),L("--radius-chat-surface","shape","Chat surface radius"),H("--font-ui","typography","UI font stack"),H("--font-serif","typography","Serif font stack"),H("--font-mono","typography","Monospace font stack")]);Object.freeze(x.map(e=>e.name)),new Map(x.map(e=>[e.name,e])),Object.freeze(x.filter(e=>e.type==="color"&&e.opaque).map(e=>e.name));const gt=Object.freeze(["--accent","--link","--green","--coral","--danger"]),me=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;function pt(e){return typeof e!="string"||!e.startsWith(ue)?!1:me.test(e.slice(ue.length))}function bt(e){return typeof e!="string"||!e.startsWith(de)?!1:me.test(e.slice(de.length))}function fe(e){return[Number.parseInt(e.slice(1,3),16),Number.parseInt(e.slice(3,5),16),Number.parseInt(e.slice(5,7),16)]}function Et(e){return`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${`%23${e.slice(1,7).toUpperCase()}`}' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`}function St(e){return e.map(t=>JSON.stringify(t)).join(", ")}function Tt(e){const t=e.variables,n=[];for(const r of x){const c=t[r.name];r.type==="color"?n.push(`${r.name}: ${String(c)};`):r.type==="length"?n.push(`${r.name}: ${c}px;`):n.push(`${r.name}: ${St(c)};`)}for(const r of gt){const[c,u,d]=fe(String(t[r]));n.push(`${r}-rgb: ${c}, ${u}, ${d};`)}const[o,a,s]=fe(String(t["--overlay-medium"]));return n.push(`--input-card-border-color: rgba(${o}, ${a}, ${s}, 0.12);`),n.push(`--input-card-active-border-color: rgba(${o}, ${a}, ${s}, 0.16);`),n.push("--bg-texture: none;"),n.push("--tab-slider-shadow: none;"),n.push(`--select-arrow: ${Et(String(t["--text-muted"]))};`),n}function wt(e){return`:root {
${Tt(e).map(t=>`  ${t}`).join(`
`)}
}
`}const j=[9,11,13,15,17],w=13,Y="data-content-contrast";function yt(e){return typeof e=="number"&&j.includes(e)}function Ct(e){return yt(e)?e:w}const h=1e-6,he=1e-9,ge=1e-6,pe=1024,R=256,_t=48,be=256,Mt=/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;function N(e,t){const n=typeof e=="string"?e.trim():"";if(!Mt.test(n))throw new TypeError(`content contrast: ${t} must be #RRGGBB or #RRGGBBAA, received ${JSON.stringify(e)}`);const o=a=>Number.parseInt(n.slice(a,a+2),16);return{r:o(1),g:o(3),b:o(5),a:n.length===9?o(7)/255:1}}function Ee(e,t){if(e.a>=1)return e;const n=e.a;return{r:e.r*n+t.r*(1-n),g:e.g*n+t.g*(1-n),b:e.b*n+t.b*(1-n),a:1}}function W(e){const t=(n,o)=>{if(!Number.isFinite(n))throw new TypeError(`content contrast: non-finite ${o} channel`);if(n<-ge||n>255+ge)throw new RangeError(`content contrast: ${o} channel ${n} is outside sRGB`);return n<=0?0:n>=255?255:Math.round(n)};return`#${[t(e.r,"red"),t(e.g,"green"),t(e.b,"blue")].map(n=>n.toString(16).padStart(2,"0")).join("").toUpperCase()}`}function A(e){const t=e/255;return t<=.04045?t/12.92:((t+.055)/1.055)**2.4}function k({r:e,g:t,b:n}){return .2126*A(e)+.7152*A(t)+.0722*A(n)}function I(e,t){const n=k(e),o=k(t),a=Math.max(n,o),s=Math.min(n,o);return(a+.05)/(s+.05)}function v(e,t){const n=N(t,"background");if(n.a<1)throw new TypeError("content contrast: background must be opaque (#RRGGBB)");const o=Ee(N(e,"foreground"),n);return I(o,n)}function Se(e){const t=A(e.r),n=A(e.g),o=A(e.b),a=.4122214708*t+.5363325363*n+.0514459929*o,s=.2119034982*t+.6806995451*n+.1073969566*o,r=.0883024619*t+.2817188376*n+.6299787005*o,c=Math.cbrt(a),u=Math.cbrt(s),d=Math.cbrt(r);return{L:.2104542553*c+.793617785*u-.0040720468*d,a:1.9779984951*c-2.428592205*u+.4505937099*d,b:.0259040371*c+.7827717662*u-.808675766*d}}function Te(e,t,n){const o=e+.3963377774*t+.2158037573*n,a=e-.1055613458*t-.0638541728*n,s=e-.0894841775*t-1.291485548*n,r=o**3,c=a**3,u=s**3;return[4.0767416621*r-3.3077115913*c+.2309699292*u,-1.2684380046*r+2.6097574011*c-.3413193965*u,-.0041960863*r-.7034186147*c+1.707614701*u]}function O(e,t,n){const[o,a,s]=Te(e,t,n);return o>=-h&&o<=1+h&&a>=-h&&a<=1+h&&s>=-h&&s<=1+h}function kt(e){return e<=.0031308?12.92*e:1.055*e**(1/2.4)-.055}function z(e){return e>=-h&&e<=h?0:e>=1-h&&e<=1+h?255:kt(e)*255}function y(e,t,n){const[o,a,s]=Te(e,t,n);return{r:z(o),g:z(a),b:z(s),a:1}}function we(e,t,n){return W(y(e,t,n))}function Nt(e,t,n){let o=Number.NaN,a=Number.NaN;for(let s=0;s<=pe;s+=1){const r=s/pe;O(r,e,t)&&(Number.isNaN(o)&&(o=r),a=r)}return Number.isNaN(o)?[n,n]:[Math.min(o,n),Math.max(a,n)]}function At(e,t,n,o,a){const s=k(y(n,e,t)),r=k(y(o,e,t));if(a<=s)return n;if(a>=r)return o;let c=n,u=o;for(let d=0;d<60;d+=1){const l=(c+u)/2;k(y(l,e,t))<a?c=l:u=l}return(c+u)/2}function It(e,t){const n=Ee(N(e,"ink"),t),o=Se(n),[a,s]=Nt(o.a,o.b,o.L),r=I(n,t),c=k(n),u=k(t),d=c<u-he?-1:c>u+he||u<.18?1:-1,l=At(o.a,o.b,a,s,u);let g=d===1?Math.max(a,l):a,m=d===1?s:Math.min(s,l);g=Math.min(g,o.L),m=Math.max(m,o.L);const T=d===1?m:g;let b=r;for(let f=0;f<=R;f+=1){const p=o.L+(T-o.L)*f/R;if(!O(p,o.a,o.b))continue;const S=I(y(p,o.a,o.b),t);S>b&&(b=S)}return{background:t,baseline:r,direction:d,a:o.a,b:o.b,seed:o.L,lowBound:g,highBound:m,blend:l,outer:T,top:b}}function vt(e,t,n,o){const a=Math.min(n,o),s=Math.max(n,o);let r=Math.min(Math.max(e.seed,a),s),c=I(y(r,e.a,e.b),e.background),u=Math.abs(c-t);for(let l=0;l<=R;l+=1){const g=a+(s-a)*l/R;if(!O(g,e.a,e.b))continue;const m=I(y(g,e.a,e.b),e.background),T=Math.abs(m-t);T<u-1e-12&&(u=T,r=g,c=m)}let d=(s-a)/R;for(let l=0;l<_t;l+=1){let g=!1;for(const m of[r-d,r+d]){if(m<a||m>s||!O(m,e.a,e.b))continue;const T=I(y(m,e.a,e.b),e.background);Math.abs(T-t)<Math.abs(c-t)-1e-12&&(r=m,c=T,g=!0)}g||(d/=2)}return{hex:we(r,e.a,e.b),ratio:c}}function ye(e,t,n,o,a){const s=Se(N(t,"ink")).L,r=o-s;if(Math.abs(r)<h)return null;const c=r/be,u=W(e.background);for(let d=1;d<=be;d+=1){const l=s+c*d;if(!O(l,e.a,e.b))break;const g=we(l,e.a,e.b),m=v(g,u);if(a==="atMost"?m<=n+h:m>=n-h)return g}return null}function Ce(e,t){const n=It(e,t),o=Math.min(n.baseline*17/13,n.top),a=n.direction===1?Math.min(n.blend,n.seed):Math.max(n.blend,n.seed),s=new Map([[9,n.baseline*9/13],[11,n.baseline*11/13],[13,n.baseline],[15,n.baseline+(o-n.baseline)/2],[17,o]]),r=new Map;r.set(w,e);for(const b of j){if(b===w)continue;const f=Math.max(1,s.get(b)),p=n.seed,S=b<w?a:n.outer;r.set(b,vt(n,f,p,S).hex)}const c=W(t),u=r.get(w),d=v(u,c);let l=d,g=u;for(const b of[11,9]){let f=r.get(b),p=v(f,c);if(p>l+h){const S=ye(n,f,l,a,"atMost");S&&(f=S,p=v(S,c)),p>l+h&&(f=g,p=l),r.set(b,f)}l=p,g=f}let m=d,T=u;for(const b of[15,17]){let f=r.get(b),p=v(f,c);if(p<m-h){const S=ye(n,f,m,n.outer,"atLeast");S&&(f=S,p=v(S,c)),p<m-h&&(f=T,p=m),r.set(b,f)}m=p,T=f}return r}function Rt(e){const t=N(e.chatBackground,"chatBackground"),n=N(e.documentBackground,"documentBackground");if(t.a<1||n.a<1)throw new TypeError("content contrast: backgrounds must be opaque (#RRGGBB)");const o=Ce(e.chatInk,t),a=Ce(e.documentInk,n);return j.map(s=>({level:s,chatInk:o.get(s),documentInk:a.get(s)}))}function Ot(e,t){return[`${(typeof e=="string"?[e]:[...e]).join(`,
`)} {`,`    --content-chat-ink: ${t.chatInk};`,`    --content-document-ink: ${t.documentInk};`,"}"].join(`
`)}const K="hana-user-theme",_e="data-theme-revision";let D=null;function q(){typeof window>"u"||(window.getAppliedUserTheme=()=>D?{...D}:null)}function X(e){return pt(e)||bt(e)}function Ft(e){if(!e||typeof e!="object")return!1;const t=e;return X(t.id)&&(t.appearance==="light"||t.appearance==="dark")&&typeof t.backgroundColor=="string"&&typeof t.revision=="number"&&!!t.variables&&typeof t.variables=="object"}function Lt(e){let t=e.getElementById(K);return t||(t=e.createElement("style"),t.id=K,e.head.appendChild(t)),t}function xt(e){return{formatVersion:1,name:"user",appearance:e.appearance,variables:e.variables}}function Dt(e){const t=e.variables;return Rt({chatInk:String(t["--hana-text"]),documentInk:String(t["--text"]),chatBackground:String(t["--bg"]),documentBackground:String(t["--bg-card"])}).filter(o=>o.level!==w).map(o=>Ot(`:root[${Y}="${o.level}"]`,o)).join(`

`)}function Pt(e,t={}){if(typeof document>"u")return;const n=document.documentElement,o=xt(e),a=`${wt(o)}
${Dt(o)}
`;Lt(document).textContent=a,n.setAttribute("data-theme",e.id),n.setAttribute(_e,String(e.revision)),D=e,q(),t.notifyNative!==!1&&window.hana?.syncWindowTheme?.(e.id,e,t.selection??e.id),typeof window<"u"&&window.dispatchEvent(new CustomEvent("hana-theme-applied",{detail:{id:e.id,revision:e.revision}}))}function Ut(){typeof document<"u"&&(document.getElementById(K)?.remove(),document.documentElement?.removeAttribute(_e)),D=null,q(),typeof window<"u"&&window.dispatchEvent(new CustomEvent("hana-theme-applied",{detail:{id:null,revision:null}}))}const Me="hana-content-contrast",ke="hana-content-contrast-changed";function Ne(){return typeof document>"u"?null:document.documentElement}function Ae(e,t=Ne()){t&&(e===w?t.removeAttribute(Y):t.setAttribute(Y,String(e)))}function Ie(e=window.localStorage){const t=e.getItem(Me);return t===null||t.trim()===""?w:Ct(Number(t))}function $t(e=window.localStorage,t=Ne()){Ae(Ie(e),t)}function Bt(e){const t=n=>{n.key!==Me&&n.key!==null||Ae(Ie())};return window.addEventListener(ke,e),window.addEventListener("storage",t),()=>{window.removeEventListener(ke,e),window.removeEventListener("storage",t)}}function Gt(){return Bt(()=>{})}const E=document.getElementById("themeSheet"),ve="hana-reading-font",Ht=se(Xe),jt=se(Ve);function Yt(e){return Ze(e)?e:"serif"}function Re(){return window.matchMedia("(prefers-color-scheme: dark)").matches}let Oe=!1,V=0,Fe=0;function Le(e,t,n){document.documentElement.setAttribute("data-theme",e),t&&window.hana?.syncWindowTheme?.(e,void 0,n)}function xe(e,t=!0,n=e){const o=M.THEMES[e];if(!o)return;const a=++V,s=new URL(o.cssPath+HANA_SKIN_CSS_V,document.baseURI).href;if(!Oe||!E||E.href===s){Oe=!0,E&&E.href!==s&&(E.href=o.cssPath+HANA_SKIN_CSS_V),Le(e,t,n);return}const r=document.createElement("link");r.rel="stylesheet",r.href=o.cssPath+HANA_SKIN_CSS_V;const c=()=>{if(a!==V){r.remove();return}Le(e,t,n),E.addEventListener("load",()=>r.remove(),{once:!0}),E.addEventListener("error",()=>r.remove(),{once:!0}),E.href=o.cssPath+HANA_SKIN_CSS_V};r.addEventListener("load",c,{once:!0}),r.addEventListener("error",c,{once:!0}),E.after(r)}let F=null;function P(e,t={}){V+=1,Fe+=1;const n=t.notifyNative!==!1,o=window.matchMedia("(prefers-color-scheme: dark)");F&&(o.removeEventListener("change",F),F=null);const a=t.customTheme??null;if(a&&X(a.id)){E&&(E.disabled=!0),Pt(a,{notifyNative:n,selection:a.id}),t.persist!==!1&&localStorage.setItem(M.STORAGE_KEY,a.id);return}E&&(E.disabled=!1),Ut();const{stored:s,concrete:r}=M.resolveSavedTheme(e,Re());xe(r,n,s),s==="auto"&&(F=()=>{xe(M.resolveSavedTheme("auto",Re()).concrete,n,"auto")},o.addEventListener("change",F)),localStorage.setItem(M.STORAGE_KEY,s)}function De(){const e=localStorage.getItem(M.STORAGE_KEY);X(e)||P(M.migrateSavedTheme(e),{notifyNative:!1})}function U(e,t){const n=Yt(e),o=n==="sans",a=n!=="serif"&&n!=="sans",s=document.documentElement;if(document.body.dataset.readingFont=n,document.body.classList.toggle("font-sans",o),!a||t){const r=a?t.fontFamily:o?jt:Ht;s.style.setProperty("--reading-font-family",r),s.style.setProperty("--font-serif","var(--reading-font-family)"),s.style.setProperty("--font-serif-text","var(--reading-font-family)"),t?.synthesisWeight==="none"?s.style.setProperty("font-synthesis-weight","none"):s.style.removeProperty("font-synthesis-weight")}localStorage.setItem(ve,n),localStorage.setItem("hana-font-serif",o?"0":"1")}function Wt(e){U(e?"serif":"sans")}function Pe(){const e=localStorage.getItem(ve);if(e){U(e);return}U(localStorage.getItem("hana-font-serif")==="0"?"sans":"serif")}function zt(e){ot()}function Ue(){rt()}function Kt(e){ct()}function $e(){ut()}window.setTheme=P,window.applyTheme=P,window.setReadingFont=U,window.loadSavedTheme=De,window.setSerifFont=Wt,window.loadSavedFont=Pe,window.setReduceCardButtons=zt,window.loadSavedReduceCardButtons=Ue,window.setShowCardTitles=Kt,window.loadSavedShowCardTitles=$e,q(),window.getThemeApplicationEpoch=()=>Fe;const J=window.hanaTheme;J&&typeof J.onChanged=="function"&&J.onChanged(e=>{if(!e||typeof e!="object")return;const t=e;typeof t.theme!="string"||!t.theme||P(t.theme,{customTheme:Ft(t.descriptor)?t.descriptor:null,persist:t.persistent!==!1,notifyNative:!1})}),De(),Pe(),Ue(),$e(),$t(),Gt()})();
//# sourceMappingURL=theme.js.map
/* hana-panel-frame */
/*
 * 浮层面板 · 取景框 —— 给面板的 ::before 提供几何与背景图。
 *
 * 由 scripts/apply.ps1 追加到 renderer 树 lib/theme.js 的末尾（幂等，见该脚本的
 * 「步骤 10c」）。视觉在 src/panel-frame/dark.css 里。
 *
 * ── 本文件只做三件事 ─────────────────────────────────────────────────────
 *   1. 从 [data-chalkboard-root] 的计算样式反推「背景图那一层」的显示尺寸与原点；
 *   2. 把两个 scrim 层与图片层的局部几何写成 CSS 变量（::before 继承）；
 *   3. 把背景图（3.9 MB 的 data URI）注入一条只设 background-image 的样式表。
 *
 * ── 为什么不再逐帧补偿动画 ───────────────────────────────────────────────
 *   曾经的实现：JS 每帧读 getComputedStyle(el).transform，算补偿值写进 CSS 变量。
 *   两个问题，第二个致命：
 *     1) 写变量会改 background-position → 主线程必须重绘那张 3.9 MB 的图；
 *     2) 入场动画跑在**合成器**线程，主线程一边重绘大图一边追，必然落后，
 *        于是背景按「上一帧的面板位置」补偿 → 真机表现为**朝反方向漂移**
 *        （用户反馈：「还是有抖动，这次是从右向左移了」）。
 *   现在改成：面板的入场动画与 ::before 的**反相动画**同时间轴、同样跑在合成器上
 *   （见 dark.css），合成后恒等，背景钉在屏幕上。JS 只在面板出现 / 视口变化时
 *   写一次**静态**几何，之后完全不参与 —— 没有「追」这回事，也就不会失步。
 *
 * ── 四个实测结论（决定了本文件与 dark.css 的形状）────────────────────────
 *   (1) 不能用 background-attachment: fixed
 *       元素带 transform 时 fixed 背景会被锚到**元素自己**而不是视口。
 *       （探针 probe/bg-attach-test.mjs：坐标编码图 + 像素解码。）
 *   (2) 图不能走 CSS 变量
 *       Chromium 对自定义属性的**值**有长度上限（1.5~2 MB），3.9 MB 的 data URI
 *       会被**静默丢弃**。故由本文件注入样式表提供。
 *       （探针 probe/len-limit.mjs / len-limit-js.mjs。）
 *   (3) 面板的图必须复现**主背景自己的渲染几何**，不能另立一套
 *       主背景是 `cover` + `center` + 视口坐标；第一版按「1:1 不缩放 + 屏幕坐标」
 *       定位，差三处（缩放 / 原点 / 基准），真机错位。
 *       （探针 probe/panel-bg-align.mjs。）
 *   (4) 主背景那串 background-image **不能每次重读**（工单 45）
 *       `getComputedStyle(root).backgroundImage` 读一次 ≈ 19 ms（4 MB 串序列化进 JS），
 *       对它跑一遍 splitBgList ≈ 190~206 ms。而 apply() 原本每帧都做这两件事 ——
 *       设置页/浮层面板一打开，滚动就变成每帧 0.25 s 主线程阻塞。故缓存，见 rootCache。
 *       （真机读数 .scratch/t45-jank/probe1.mjs；本机 Node 交叉验证 bench-split.mjs。）
 *
 * ── 变量（写在**可见圆角面**上，::before 继承）────────────────────────────
 *   --hana-scrim-w / -h / -x / -y   两个 scrim 层：铺满主背景容器
 *   --hana-img-w / -h / -x / -y     图片层：主背景的显示尺寸与原点
 *   四组都是**元素局部**值（相对 ::before 的盒子 = 面板的 padding box）。
 *   后者的语义是「图的 n% 点对齐容器的 n% 点」，与我们要的「绝对对齐」不是一回事。
 *
 * ── 主背景几何怎么算（与 [data-chalkboard-root] 的声明一一对应）──────────
 *   background-size: cover    -> scale = max(rw/W, rh/H)，显示 = (W*scale, H*scale)
 *                   contain  -> scale = min(rw/W, rh/H)
 *                   具体值    -> 直接用（% 按容器换算）
 *   background-position: center / 50%  -> 偏移 = (容器 - 显示) / 2
 *                        left/top    -> 0；right/bottom -> 容器 - 显示
 *                        n%          -> (容器 - 显示) * n%
 *
 * PoC 阶段做「卡片中心」#chalkboardCardCenterPanel；工单 31 扩到
 * 能力 #capabilitiesPanel / 自动化 #automationHubPanel 两个同组件面板，
 * 以及扩展（市场）模态与设置模态两张卡（面不是 floatingPanelInner）。
 * 每个目标的「面选择器」必须与 src/panel-frame/dark.css 的规则**保持一致**。
 */
(function () {
  // ⚠️ 守卫键**必须按主题区分**（2026-10-19 修）：apply.ps1 步骤 10c 把每个主题那段
  //    **链式追加**到同一个 lib/theme.js 末尾，各段若共用同一个 window 标记，
  //    **后追加的那段一进门就 return、整段永不执行**。真机症状：先贴的月满庭有背景图，
  //    后加的紫夜那五个面板全是实色（`::before` 的 background-image 读到 `none`）。
  var GUARD = '__hanaPanelFrame:hana-moonlit-court';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  // 目标表：kind 决定怎么找「可见圆角面」。面 = 背景 ::before 的宿主元素，
  // 也是几何变量的写入点（::before 继承）。
  //   panel    —— 浮层面板：外壳 id + 直接子 [class*="floatingPanelInner"]
  //   market   —— 扩展/市场模态：popup 壳（data-testid）+ 直接子 [class*="container"]
  //   settings —— 设置模态：data-input-ctx-zone="settings" 那张 zone 的**父**卡
  var TARGETS = [
    { kind: 'panel', id: 'chalkboardCardCenterPanel' },
    { kind: 'panel', id: 'capabilitiesPanel' },
    { kind: 'panel', id: 'automationHubPanel' },
    { kind: 'market' },
    { kind: 'settings' },
    { kind: 'confirm' }
  ];
  // 本段只服务这一个主题（另一个主题那段同驻同一个文件，靠 THEME_ID 与上面的 GUARD 区分）。
  var THEME_ID = 'hana-moonlit-court';
  var THEME = ':is([data-theme="' + THEME_ID + '"]) ';
  // 背景图的自然像素尺寸（本皮肤的固定资产：src/background/assets/moonlit-night.png）。
  var IMG_W = 1920;
  var IMG_H = 1080;
  var STYLE_ID = 'hana-panel-frame-bg';

  var raf = 0;
  // 已 observe 的面元素（避免重复 observe）。WeakSet：节点卸载后自动回收。
  var observedFaces = (typeof WeakSet === 'function') ? new WeakSet() : null;
  // 每个面元素「上一帧看到的尺寸」（工单 33）。只用于判定**第一次**就绪时尺寸是否已定型。
  var faceSize = (typeof WeakMap === 'function') ? new WeakMap() : null;
  // ResizeObserver：尺寸一变就重算。
  // ⚠️ 这里为什么**排 rAF**（`schedule()`）而不是同步 `apply()`（工单 34 实测过两版）：
  //   同步重算会让「连续两次 apply 尺寸相同」提前在**面板长大之前**的尺寸上满足，
  //   于是第一次就绪落早了 —— 图会带着中间态几何（imgX=-384px）被贴上。
  //   探针 t33-render 的「有图帧位置恒为终值」判据从 0/20 变成 **20/20 失败**。
  //   同步重算确实能在「布局之后、绘制之前」修正变量（按渲染步骤规范），
  //   但这一层节流下的采样粒度**证明不了**（rAF 与 setTimeout 双采样都分辨不出），
  //   而本项目不接受「按规范应该没问题」。故退回 rAF。
  var resizeObs = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { schedule(); }) : null;

  // 取直接子元素里的目标面（用 children 遍历，不用 querySelector ——
  // 后者可能返回后代，与 CSS 规则的直接子选择器选到不同节点）。
  function directChildMatching(shell, needle) {
    var kids = shell.children;
    for (var i = 0; i < kids.length; i++) {
      if (String(kids[i].className).indexOf(needle) >= 0) { return kids[i]; }
    }
    return null;
  }

  // 按目标类型找「面」。找不到返回 null。
  function findFace(t) {
    if (t.kind === 'panel') {
      var shell = document.getElementById(t.id);
      return shell ? directChildMatching(shell, 'floatingPanelInner') : null;
    }
    if (t.kind === 'market') {
      var popup = document.querySelector('[data-testid="market-modal-overlay"]');
      return popup ? directChildMatching(popup, 'container') : null;
    }
    if (t.kind === 'settings') {
      var zone = document.querySelector('[data-input-ctx-zone="settings"]');
      return zone ? zone.parentElement : null;
    }
    if (t.kind === 'confirm') {
      // 通用确认框（Us.confirm / base-ui AlertDialog）：面是 popup 壳的直接子元素。
      // 2026-10-24：用户要求这个弹窗也走取景框（「改成设置页面那种底」）。
      var ad = document.querySelector('[role="alertdialog"]');
      return ad ? directChildMatching(ad, '_dialog_') : null;
    }
    return null;
  }

  // 该目标面的 ::before 选择器（与 dark.css 里写的一致）。
  // ⚠️ 带 `[data-hana-frame-ready]`（工单 33）：图只对**已经写好几何变量**的面生效，
  // 保证「图出现」与「位置变量就绪」同一时刻，不会出现「图已贴、位置还是兜底 0px」的错位窗口。
  var READY = '[data-hana-frame-ready]';
  function beforeSelector(t) {
    if (t.kind === 'panel') {
      return THEME + '#' + t.id + ' > [class*="floatingPanelInner"]' + READY + '::before';
    }
    if (t.kind === 'market') {
      return THEME + '[data-testid="market-modal-overlay"] > [class*="container"]' + READY + '::before';
    }
    if (t.kind === 'confirm') {
      return THEME + '[role="alertdialog"] > [class*="_dialog_"]' + READY + '::before';
    }
    return THEME + ':has(> [data-input-ctx-zone="settings"])' + READY + '::before';
  }

  // 解析 background-size / background-position 的单个分量，返回 CSS px。
  function sizeOf(token, container, natural) {
    var t = String(token || '').trim();
    if (t === 'cover' || t === 'contain') { return null; }   // 交给调用方按两轴一起算
    if (t === 'auto') { return natural; }
    if (t.charAt(t.length - 1) === '%') { return container * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? natural : n;
  }

  function posOffsetOf(token, container, disp) {
    var t = String(token || 'center').trim();
    if (t === 'center' || t === '50%') { return (container - disp) / 2; }
    if (t === 'left' || t === 'top') { return 0; }
    if (t === 'right' || t === 'bottom') { return container - disp; }
    if (t.charAt(t.length - 1) === '%') { return (container - disp) * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? (container - disp) / 2 : n;
  }

  // 拆分 background-image / -size / -position 的**顶层**逗号列表。
  // 括号与引号内的逗号不算分隔符：gradient 里的 rgba()、url("data:...") 都带逗号。
  // 【工单 44】以前这里不用拆，全靠「主背景第 2 层是照片」这个硬编码假设 —— 层数一变
  //   就错位（见 dark.css 里那段关于「层下标」的注释）。现在改成逐层映射，不再数下标。
  function splitBgList(v) {
    var out = [], depth = 0, quote = null, cur = '';
    var s = String(v || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (quote) {
        cur += ch;
        if (ch === quote && s.charAt(i - 1) !== '\\') { quote = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) { out.push(cur.trim()); }
    return out;
  }

  // 列表项按下标取，不足时按 CSS 规则循环（值比层数少就重复）。
  function pick(list, i) {
    if (!list || list.length === 0) { return ''; }
    return list[i % list.length];
  }

  // ── 主背景数据缓存（工单 45）─────────────────────────────────────────────
  // 【为什么必须有】主背景的 background-image 里内联着 3.9 MB 的壁纸 data URI。实测两笔账：
  //   * `getComputedStyle(root).backgroundImage` 读一次 ≈ **19 ms**（把 4 MB 串序列化进 JS）；
  //   * 对它跑一遍 `splitBgList` ≈ **206 ms**（真机读数；本机 Node 跑同一份实现 190 ms）。
  //   而 apply() 原本**每次**都做这两件事。设置模态本身就是本文件的 5 个目标之一 ——
  //   它一打开「面」就存在，于是**任何** scroll（`scroll` 不冒泡，但窗口的**捕获**监听
  //   照样收得到内层滚动）或 DOM 变更都会触发 rAF 里的 apply()，每帧最多 0.25 s 主线程阻塞。
  //   用户 2026-10-18 报的「设置页滑动卡顿、自带皮肤不卡」就是这一条。
  //
  // 【失效判据】背景图只在**主题切换**时变，而主题切换必然至少改其中一项：
  //   documentElement 的 data-theme / data-appearance / data-appearance-mode，
  //   或 #themeSheet 的 href（apply.ps1 每次贴入都会换 ?v=）。故拿这三项 + 注入样式表
  //   是否还在做 key；key 变了才重读那 4 MB。
  //
  // 【为什么不加「签名不变就跳过整个 apply」的闸门】缓存在手后，一次 apply() 的剩余成本
  //   只有几次 getBoundingClientRect + 每面十来个 CSS 变量写入（亚毫秒），远低于一帧预算；
  //   再加一道签名闸门只会多一处「漏判则整块背景不更新」的风险。能证明够用了就停在这里。
  var rootCache = { el: null, key: '', image: '', kinds: null, sizeTok: null, posTok: null };

  function rootCacheKey() {
    var de = document.documentElement;
    var link = document.getElementById('themeSheet');
    return [
      de.getAttribute('data-theme') || '',
      de.getAttribute('data-appearance') || '',
      de.getAttribute('data-appearance-mode') || '',
      link ? (link.getAttribute('href') || '') : '',
      document.getElementById(STYLE_ID) ? 'sty' : 'nosty'
    ].join('|');
  }

  // 读一次重活（那 4 MB）并缓存。只有首次 / 主题或注入态变化时才真的读。
  function ensureRootBgCache(root) {
    var key = rootCacheKey();
    if (rootCache.el === root && rootCache.key === key && rootCache.kinds) { return rootCache; }

    var cs = null;
    try { cs = getComputedStyle(root); } catch (e) { return rootCache; }
    var raw = cs.backgroundImage || '';

    // 逐层分类：带 url( 的那层是照片，其余（渐变）是 scrim。
    // 照片层的下标必须**现找**，不能假设它总在固定位置。
    var layers = (raw && raw !== 'none') ? splitBgList(raw) : [];
    var kinds = [];
    var photoIdx = -1;
    for (var li = 0; li < layers.length; li++) {
      var isPhoto = layers[li].indexOf('url(') >= 0;
      kinds.push(isPhoto);
      if (isPhoto && photoIdx < 0) { photoIdx = li; }
    }
    if (layers.length === 0) { kinds = [true]; photoIdx = 0; }
    else if (photoIdx < 0) { photoIdx = 0; }

    rootCache.el = root;
    rootCache.key = key;
    rootCache.image = (raw !== 'none' && raw.indexOf('url(') >= 0) ? raw : '';
    rootCache.kinds = kinds;
    rootCache.sizeTok = String(pick(splitBgList(cs.backgroundSize), photoIdx) || 'cover').trim().split(/\s+/);
    rootCache.posTok = String(pick(splitBgList(cs.backgroundPosition), photoIdx) || 'center').trim().split(/\s+/);
    return rootCache;
  }

  // 从缓存的主背景数据 + root 当前矩形，算「图片那一层」的显示尺寸与原点（视口坐标）。
  // 原 readRootBgImage() 已删除：它唯一的用途是把那串 4 MB 交给注入样式表，
  // 现在那份串由 rootCache.image 提供（同一个字符串对象，`!==` 比较是常数时间）。
  function readRootGeom(root, c) {
    var r = root.getBoundingClientRect();
    var sizeTok = c.sizeTok;
    var posTok = c.posTok;
    var dw, dh;

    var s0 = sizeTok[0], s1 = sizeTok[1] || sizeTok[0];
    if (s0 === 'cover' || s1 === 'cover') {
      var sc = Math.max(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc; dh = IMG_H * sc;
    }
    else if (s0 === 'contain' || s1 === 'contain') {
      var sc2 = Math.min(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc2; dh = IMG_H * sc2;
    }
    else {
      dw = sizeOf(s0, r.width, IMG_W);
      dh = sizeOf(s1, r.height, IMG_H);
    }

    var ox = r.left + posOffsetOf(posTok[0], r.width, dw);
    var oy = r.top + posOffsetOf(posTok[1] || posTok[0], r.height, dh);

    return { rootRect: r, dw: dw, dh: dh, ox: ox, oy: oy, kinds: c.kinds };
  }

  // 解析 transform-origin（返回布局坐标下的 px 偏移）。
  function readOrigin(el, layoutW, layoutH) {
    var raw = '';
    try { raw = getComputedStyle(el).transformOrigin || ''; } catch (e) { return { x: layoutW / 2, y: layoutH / 2 }; }
    var parts = raw.trim().split(/\s+/);
    function one(tok, dim) {
      if (!tok) { return dim / 2; }
      if (tok.charAt(tok.length - 1) === '%') { return dim * (parseFloat(tok) / 100); }
      var n = parseFloat(tok);
      return isNaN(n) ? dim / 2 : n;
    }
    return { x: one(parts[0], layoutW), y: one(parts[1] || parts[0], layoutH) };
  }

  // 从计算样式的 transform 矩阵里取出 translate 与缩放分量。
  function readTransform(el) {
    var t = '';
    try { t = getComputedStyle(el).transform || ''; } catch (e) { return null; }
    if (!t || t === 'none') { return { tx: 0, ty: 0, s: 1 }; }
    var m = t.match(/^matrix\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(',').map(function (v) { return parseFloat(v); });
      if (p.length < 6 || p.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: p[4], ty: p[5], s: Math.abs(p[0]) || 1 };
    }
    var m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var q = m3[1].split(',').map(function (v) { return parseFloat(v); });
      if (q.length < 16 || q.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: q[12], ty: q[13], s: Math.abs(q[0]) || 1 };
    }
    return null;
  }

  // 取**布局**矩形（去掉入场动画的 transform）。
  // 为什么必须是布局矩形而不是视觉矩形：背景由 ::before 的**反相动画**补偿，
  // 合成后等价于「面板处在布局位置、没有 transform」—— 所以几何要按布局位置算。
  // 推导（origin 为 O，缩放 S，平移 T）：visualTopLeft = layoutTopLeft + T + O*(1-S)。
  function layoutRectOf(el) {
    var vr = el.getBoundingClientRect();
    var lw = el.offsetWidth || vr.width;
    var lh = el.offsetHeight || vr.height;
    var tf = readTransform(el);
    if (!tf) { return { left: vr.left, top: vr.top, width: vr.width, height: vr.height }; }
    var o = readOrigin(el, lw, lh);
    var k = 1 - tf.s;
    return {
      left: vr.left - tf.tx - o.x * k,
      top: vr.top - tf.ty - o.y * k,
      width: lw,
      height: lh,
    };
  }

  // 把背景图注入一条只设 background-image 的样式表（::before 无法设内联样式）。
  // 为什么不写进主题 CSS：那是 3.9 MB 的 data URI，写两份会让主题文件翻倍。
  function injectBgImage(bgImage) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      if (document.head) { document.head.appendChild(el); }
      else { return; }
    }
    var sel = TARGETS.map(beforeSelector).join(', ');
    var css = sel + ' { background-image: ' + bgImage + '; }';
    if (el.textContent !== css) { el.textContent = css; }
  }

  function apply() {
    // 主题门（2026-10-19）：本段只在自己主题下动手。
    // 为什么不能「两段都跑」：每段注入的图取自**当前 root 的背景图**，
    // 主题不匹配的那段会把别人的图写进自己的选择器里，切回自己主题时就是错图；
    // 两段的几何变量还同名（--hana-img-*），底图尺寸不同时会互相打架。
    if (document.documentElement.getAttribute('data-theme') !== THEME_ID) { return false; }
    var open = false;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 只在真有目标面要贴时才去读根节点的计算样式（getComputedStyle 不便宜）。
    var faces = [];
    for (var k = 0; k < TARGETS.length; k++) {
      var f = findFace(TARGETS[k]);
      if (f) { faces.push(f); }
    }
    if (faces.length === 0) { return false; }

    var root = document.querySelector('[data-chalkboard-root]');
    var c = root ? ensureRootBgCache(root) : null;
    if (c && c.image) { injectBgImage(c.image); }

    // c.kinds 为 null = 缓存没建起来（getComputedStyle 抛错 / 还没读到背景），
    // 这时和原实现一样返回 g = null，绝不让 sizeTok=null 漏进 readRootGeom。
    var g = (root && c && c.kinds) ? readRootGeom(root, c) : null;

    for (var i = 0; i < faces.length; i++) {
      var el = faces[i];
      // 尺寸一变就重算（自动化面板插入时尺寸会从中间态长到终态）。
      if (resizeObs && observedFaces && !observedFaces.has(el)) {
        observedFaces.add(el);
        resizeObs.observe(el);
      }

      var r = layoutRectOf(el);
      if (r.width === 0 || r.height === 0) {
        el.removeAttribute('data-hana-frame-ready');
        continue;
      }
      open = true;

      // 尺寸是否已定型（与上一帧相同）。**只用于第一次就绪的闸门**，见下方的就绪门。
      var sizeKey = el.offsetWidth + 'x' + el.offsetHeight;
      var settled = faceSize ? (faceSize.get(el) === sizeKey) : true;
      if (faceSize) { faceSize.set(el, sizeKey); }

      // ⚠️ ::before 的包含块是** padding box**（border 之内），而 layoutRectOf 给的是
      // border box（getBoundingClientRect）。面板外壳带 1px border 时（实测：自动化面板、
      // 设置卡、市场卡都有），变量必须再减掉 border 宽度，否则整张图偏 1px
      // （在照片底部渐变陡处会放大成 20+ 色阶的可见错位）。
      var bl = el.clientLeft || 0;   // = borderLeftWidth（clientLeft 就是 border 宽度）
      var bt = el.clientTop || 0;
      var originLeft = r.left + bl;
      var originTop = r.top + bt;

      // 量化到 0.01px，抹掉浮点噪声。
      function q(v) { return Math.round(v * 100) / 100; }

      if (g) {
        // 下面四个仍是「单层」语义的值，留着**仅供诊断**（CSS 已不再直接读它们，
        // 改由 --hana-before-size / --hana-before-pos 整体下发，见下）。
        el.style.setProperty('--hana-scrim-w', q(g.rootRect.width) + 'px');
        el.style.setProperty('--hana-scrim-h', q(g.rootRect.height) + 'px');
        el.style.setProperty('--hana-scrim-x', q(g.rootRect.left - originLeft) + 'px');
        el.style.setProperty('--hana-scrim-y', q(g.rootRect.top - originTop) + 'px');
        el.style.setProperty('--hana-img-w', q(g.dw) + 'px');
        el.style.setProperty('--hana-img-h', q(g.dh) + 'px');
        el.style.setProperty('--hana-img-x', q(g.ox - originLeft) + 'px');
        el.style.setProperty('--hana-img-y', q(g.oy - originTop) + 'px');

        // ── 逐层下发 background-size / -position（工单 44）──────────────────
        // 为什么不再写成 CSS 里那串固定 3 项的声明：
        //   原先 dark.css 写死「[scrim][scrim][图]」三组值去对主背景的
        //   「[左列 scrim][照片]」两层 —— 值是**按位置**对应的。2026-10-14 删掉主背景
        //   的底部 scrim 后层数从 3 降到 2，::before 却还是三项，于是第 2 个图（照片）
        //   取到第 2 项几何（= 视口 1920×1032），而照片自己的显示尺寸是 1920×1080：
        //   同一张图在面板里被纵向放大 4.65%，月亮跨面板边缘就错位一戟。
        //   实测：::before 算出 1920px 1032px / -481px -97px，变量里却是 1080px / -121px。
        //   现在直接按**主背景真实层数与类型**逐层生成，面板与主背景永远同构，
        //   以后增删背景层不需要再回来改这里（这是本坑第二次复发，不再靠“记得改第三处”）。
        var sizeParts = [], posParts = [];
        for (var gi = 0; gi < g.kinds.length; gi++) {
          if (g.kinds[gi]) {
            // 照片层：主背景的显示尺寸与原点
            sizeParts.push(q(g.dw) + 'px ' + q(g.dh) + 'px');
            posParts.push(q(g.ox - originLeft) + 'px ' + q(g.oy - originTop) + 'px');
          }
          else {
            // scrim（渐变）层：铺满主背景容器
            sizeParts.push(q(g.rootRect.width) + 'px ' + q(g.rootRect.height) + 'px');
            posParts.push(q(g.rootRect.left - originLeft) + 'px ' + q(g.rootRect.top - originTop) + 'px');
          }
        }
        el.style.setProperty('--hana-before-size', sizeParts.join(', '));
        el.style.setProperty('--hana-before-pos', posParts.join(', '));
      }

      // ── 原子就绪（工单 33 / 工单 34）─────────────────────────────────
      // 【工单 33 要解决的问题】图由 injectBgImage 注入的样式表提供，选择器是**全局**的 ——
      //   面一被找到就会被贴上；而几何变量要等 `g`（根几何）拿得到才写得出来。
      //   两者不同步时会出现「图已贴、位置变量还没写」的窗口，那一瞬 `::before` 用 CSS 兜底值
      //   `0px 0px` 定位 → 背景先错位、再跳到正确位置。
      //   解法：图只对带 `data-hana-frame-ready` 的面生效，该属性只在**本次已写好几何变量**时打上。
      //   于是「看得见图」⟺「变量是对的」，错位窗口不存在。
      //
      // 【工单 34】原实现错在两个字：**双向**。
      //   自动化是 `_stagePanelFramed` 变体，内层面插入后尺寸从 1120x960 长到 1318x996，
      //   而每一次「不就绪」的分支都会 `removeAttribute` —— 实测一次开面摘两次。
      //   更要紧的是**就绪之后**：真机上自动化面板的异步内容晚到，会再触发一次尺寸变化，
      //   于是标记被摘 → 图消失 → 下一帧又贴上 = **有图 → 空白 → 有图**。
      //   用户 2026-10-12 截的三张图就是这一幕（序列由他标定，上一张有图、中间一张整片平色、
      //   第三张又有图，且三张里壁纸位置逐像素重合）。
      //   复现与修复：探针 probe/t34-late.mjs（就绪后改尺寸）。
      //     旧：4/4 轮摘掉标记（`remove[有]`）+ 1 个无图帧；新：**0/4**。
      //   就绪应当是**单向闩锁**：原子性只在「图第一次生效」那一瞬需要；图已贴上之后，
      //   变量重写与图本来就在同一帧的样式重算里生效，摘图只会白造一次闪断。
      //
      //   而「尺寸已定型」这个闸门**保留**（只用于第一次就绪）—— 它管的是另一件事：
      //   面板成长中的几何算的是 1120x960 那一版（实测 imgX=-384px，终值 -361px，差 23px，
      //   因为尺寸变化时布局左边缘同时挪了 24px）。
      //   工单 34 试过「不等定型、先贴图」（同步 RO 让就绪落早），结果 t33-render 从 0/20
      //   变成 20/20 失败（有图帧带着中间态几何）—— 否决，见 resizeObs 处注释。
      if (g && (settled || el.hasAttribute('data-hana-frame-ready'))) {
        // 只写一次（闩锁语义写清楚，也免掉每次重算都发一条同值属性变更）。
        if (!el.hasAttribute('data-hana-frame-ready')) {
          el.setAttribute('data-hana-frame-ready', '');
        }
      }
      else {
        el.removeAttribute('data-hana-frame-ready');
        schedule();
      }
    }
    return open;
  }

  function tick() {
    raf = 0;
    apply();
  }

  // 面板出现 / 消失是 DOM 变化；视口变化要重算几何。
  // 注意：这里**没有**逐帧循环 —— 动画完全由 CSS 负责（见 dark.css），JS 不参与。
  function schedule() {
    if (raf) { return; }
    raf = window.requestAnimationFrame(tick);
  }

  // 重算时机（工单 31 / 32 反复踩出来的，顺序即优先级）：
  //   1) ResizeObserver（**最关键**，工单 32 新增）：面元素尺寸变化就重算。
  //      自动化面板插入时尺寸从 0 长到满，而 transform-origin 随尺寸变 —— 用旧 origin 反解
  //      会算出错的 layoutLeft，且之后无人重算（framed 变体外壳 `transition:none`，
  //      `transitionend` 不触发；`animationend` 要等 375ms）→ 背景偏 24px 并**跳变**一次，
  //      就是用户看到的「背景从左上往右下移动」。这一条直接对准根因。
  //   2) transitionend / animationend：兜底（另两个面板尺寸写死，第一帧就正确，用不上）。
  //   3) resize / scroll（视口）与 MutationObserver（面板出现 / 消失）。
  // 全部只重算、不逐帧，不会退回「追合成器」那条老路。
  function onSettle() { schedule(); }
  window.addEventListener('transitionend', onSettle, true);
  window.addEventListener('animationend', onSettle, true);

  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);

  if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  // 切主题只是改 <html data-theme>（上游 applyTheme 走 setAttribute，**不发事件**），
  // 属性变化不进上面那条 childList/subtree 观察 —— 必须单独盯属性，否则切到本主题后
  // 要等下一次滚动 / 开面板才重算，那期间面板上贴的还是上一个主题的图。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  schedule();
})();
/* hana-panel-frame:hana-violet-dusk */
/*
 * 浮层面板 · 取景框 —— 给面板的 ::before 提供几何与背景图。
 *
 * 由 scripts/apply.ps1 追加到 renderer 树 lib/theme.js 的末尾（幂等，见该脚本的
 * 「步骤 10c」）。视觉在 src/panel-frame/dark.css 里。
 *
 * ── 本文件只做三件事 ─────────────────────────────────────────────────────
 *   1. 从 [data-chalkboard-root] 的计算样式反推「背景图那一层」的显示尺寸与原点；
 *   2. 把两个 scrim 层与图片层的局部几何写成 CSS 变量（::before 继承）；
 *   3. 把背景图（3.9 MB 的 data URI）注入一条只设 background-image 的样式表。
 *
 * ── 为什么不再逐帧补偿动画 ───────────────────────────────────────────────
 *   曾经的实现：JS 每帧读 getComputedStyle(el).transform，算补偿值写进 CSS 变量。
 *   两个问题，第二个致命：
 *     1) 写变量会改 background-position → 主线程必须重绘那张 3.9 MB 的图；
 *     2) 入场动画跑在**合成器**线程，主线程一边重绘大图一边追，必然落后，
 *        于是背景按「上一帧的面板位置」补偿 → 真机表现为**朝反方向漂移**
 *        （用户反馈：「还是有抖动，这次是从右向左移了」）。
 *   现在改成：面板的入场动画与 ::before 的**反相动画**同时间轴、同样跑在合成器上
 *   （见 dark.css），合成后恒等，背景钉在屏幕上。JS 只在面板出现 / 视口变化时
 *   写一次**静态**几何，之后完全不参与 —— 没有「追」这回事，也就不会失步。
 *
 * ── 四个实测结论（决定了本文件与 dark.css 的形状）────────────────────────
 *   (1) 不能用 background-attachment: fixed
 *       元素带 transform 时 fixed 背景会被锚到**元素自己**而不是视口。
 *       （探针 probe/bg-attach-test.mjs：坐标编码图 + 像素解码。）
 *   (2) 图不能走 CSS 变量
 *       Chromium 对自定义属性的**值**有长度上限（1.5~2 MB），3.9 MB 的 data URI
 *       会被**静默丢弃**。故由本文件注入样式表提供。
 *       （探针 probe/len-limit.mjs / len-limit-js.mjs。）
 *   (3) 面板的图必须复现**主背景自己的渲染几何**，不能另立一套
 *       主背景是 `cover` + `center` + 视口坐标；第一版按「1:1 不缩放 + 屏幕坐标」
 *       定位，差三处（缩放 / 原点 / 基准），真机错位。
 *       （探针 probe/panel-bg-align.mjs。）
 *   (4) 主背景那串 background-image **不能每次重读**（工单 45）
 *       `getComputedStyle(root).backgroundImage` 读一次 ≈ 19 ms（4 MB 串序列化进 JS），
 *       对它跑一遍 splitBgList ≈ 190~206 ms。而 apply() 原本每帧都做这两件事 ——
 *       设置页/浮层面板一打开，滚动就变成每帧 0.25 s 主线程阻塞。故缓存，见 rootCache。
 *       （真机读数 .scratch/t45-jank/probe1.mjs；本机 Node 交叉验证 bench-split.mjs。）
 *
 * ── 变量（写在**可见圆角面**上，::before 继承）────────────────────────────
 *   --hana-scrim-w / -h / -x / -y   两个 scrim 层：铺满主背景容器
 *   --hana-img-w / -h / -x / -y     图片层：主背景的显示尺寸与原点
 *   四组都是**元素局部**值（相对 ::before 的盒子 = 面板的 padding box）。
 *   后者的语义是「图的 n% 点对齐容器的 n% 点」，与我们要的「绝对对齐」不是一回事。
 *
 * ── 主背景几何怎么算（与 [data-chalkboard-root] 的声明一一对应）──────────
 *   background-size: cover    -> scale = max(rw/W, rh/H)，显示 = (W*scale, H*scale)
 *                   contain  -> scale = min(rw/W, rh/H)
 *                   具体值    -> 直接用（% 按容器换算）
 *   background-position: center / 50%  -> 偏移 = (容器 - 显示) / 2
 *                        left/top    -> 0；right/bottom -> 容器 - 显示
 *                        n%          -> (容器 - 显示) * n%
 *
 * PoC 阶段做「卡片中心」#chalkboardCardCenterPanel；工单 31 扩到
 * 能力 #capabilitiesPanel / 自动化 #automationHubPanel 两个同组件面板，
 * 以及扩展（市场）模态与设置模态两张卡（面不是 floatingPanelInner）。
 * 每个目标的「面选择器」必须与 src/panel-frame/dark.css 的规则**保持一致**。
 */
(function () {
  // ⚠️ 守卫键**必须按主题区分**（2026-10-19 修）：apply.ps1 步骤 10c 把每个主题那段
  //    **链式追加**到同一个 lib/theme.js 末尾，各段若共用同一个 window 标记，
  //    **后追加的那段一进门就 return、整段永不执行** —— 本主题（紫夜）就踩了这个：
  //    月满庭那段先跑并把标记置 true，于是这整段从未执行，五个面板一点图都没有。
  var GUARD = '__hanaPanelFrame:hana-violet-dusk';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  // 目标表：kind 决定怎么找「可见圆角面」。面 = 背景 ::before 的宿主元素，
  // 也是几何变量的写入点（::before 继承）。
  //   panel    —— 浮层面板：外壳 id + 直接子 [class*="floatingPanelInner"]
  //   market   —— 扩展/市场模态：popup 壳（data-testid）+ 直接子 [class*="container"]
  //   settings —— 设置模态：data-input-ctx-zone="settings" 那张 zone 的**父**卡
  var TARGETS = [
    { kind: 'panel', id: 'chalkboardCardCenterPanel' },
    { kind: 'panel', id: 'capabilitiesPanel' },
    { kind: 'panel', id: 'automationHubPanel' },
    { kind: 'market' },
    { kind: 'settings' },
    { kind: 'confirm' }
  ];
  // 本段只服务这一个主题（另一个主题那段同驻同一个文件，靠 THEME_ID 与上面的 GUARD 区分）。
  var THEME_ID = 'hana-violet-dusk';
  var THEME = ':is([data-theme="' + THEME_ID + '"]) ';
  // 背景图的自然像素尺寸（本主题自己的底图：src/background-violet/assets/violet-aurora.png，
  // 1920×1080）。⚠️ 换底图必须同步改这两个数：面板取景框要靠它反推 cover 几何，
  // 尺寸不对会让浮层面板里的背景错位。
  var IMG_W = 1920;
  var IMG_H = 1080;
  // ⚠️ 必须与月满庭那份 bg.js 用**不同的** STYLE_ID：两份 JS 都是独立 IIFE、都跑在
  //    同一个文档里，而 injectBgImage 是 `el.textContent = css`（整体替换）。
  //    若共用同一个 id，后跑的那份会把先跑那份的规则抹掉（只剩一个主题的面板有背景图）。
  //    2026-10-18 双主题化时发现并修掉。
  var STYLE_ID = 'hana-panel-frame-bg-violet';

  var raf = 0;
  // 已 observe 的面元素（避免重复 observe）。WeakSet：节点卸载后自动回收。
  var observedFaces = (typeof WeakSet === 'function') ? new WeakSet() : null;
  // 每个面元素「上一帧看到的尺寸」（工单 33）。只用于判定**第一次**就绪时尺寸是否已定型。
  var faceSize = (typeof WeakMap === 'function') ? new WeakMap() : null;
  // ResizeObserver：尺寸一变就重算。
  // ⚠️ 这里为什么**排 rAF**（`schedule()`）而不是同步 `apply()`（工单 34 实测过两版）：
  //   同步重算会让「连续两次 apply 尺寸相同」提前在**面板长大之前**的尺寸上满足，
  //   于是第一次就绪落早了 —— 图会带着中间态几何（imgX=-384px）被贴上。
  //   探针 t33-render 的「有图帧位置恒为终值」判据从 0/20 变成 **20/20 失败**。
  //   同步重算确实能在「布局之后、绘制之前」修正变量（按渲染步骤规范），
  //   但这一层节流下的采样粒度**证明不了**（rAF 与 setTimeout 双采样都分辨不出），
  //   而本项目不接受「按规范应该没问题」。故退回 rAF。
  var resizeObs = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { schedule(); }) : null;

  // 取直接子元素里的目标面（用 children 遍历，不用 querySelector ——
  // 后者可能返回后代，与 CSS 规则的直接子选择器选到不同节点）。
  function directChildMatching(shell, needle) {
    var kids = shell.children;
    for (var i = 0; i < kids.length; i++) {
      if (String(kids[i].className).indexOf(needle) >= 0) { return kids[i]; }
    }
    return null;
  }

  // 按目标类型找「面」。找不到返回 null。
  function findFace(t) {
    if (t.kind === 'panel') {
      var shell = document.getElementById(t.id);
      return shell ? directChildMatching(shell, 'floatingPanelInner') : null;
    }
    if (t.kind === 'market') {
      var popup = document.querySelector('[data-testid="market-modal-overlay"]');
      return popup ? directChildMatching(popup, 'container') : null;
    }
    if (t.kind === 'settings') {
      var zone = document.querySelector('[data-input-ctx-zone="settings"]');
      return zone ? zone.parentElement : null;
    }
    if (t.kind === 'confirm') {
      // 通用确认框（Us.confirm / base-ui AlertDialog）：面是 popup 壳的直接子元素。
      // 2026-10-24：用户要求这个弹窗也走取景框（「改成设置页面那种底」）。
      var ad = document.querySelector('[role="alertdialog"]');
      return ad ? directChildMatching(ad, '_dialog_') : null;
    }
    return null;
  }

  // 该目标面的 ::before 选择器（与 dark.css 里写的一致）。
  // ⚠️ 带 `[data-hana-frame-ready]`（工单 33）：图只对**已经写好几何变量**的面生效，
  // 保证「图出现」与「位置变量就绪」同一时刻，不会出现「图已贴、位置还是兜底 0px」的错位窗口。
  var READY = '[data-hana-frame-ready]';
  function beforeSelector(t) {
    if (t.kind === 'panel') {
      return THEME + '#' + t.id + ' > [class*="floatingPanelInner"]' + READY + '::before';
    }
    if (t.kind === 'market') {
      return THEME + '[data-testid="market-modal-overlay"] > [class*="container"]' + READY + '::before';
    }
    if (t.kind === 'confirm') {
      return THEME + '[role="alertdialog"] > [class*="_dialog_"]' + READY + '::before';
    }
    return THEME + ':has(> [data-input-ctx-zone="settings"])' + READY + '::before';
  }

  // 解析 background-size / background-position 的单个分量，返回 CSS px。
  function sizeOf(token, container, natural) {
    var t = String(token || '').trim();
    if (t === 'cover' || t === 'contain') { return null; }   // 交给调用方按两轴一起算
    if (t === 'auto') { return natural; }
    if (t.charAt(t.length - 1) === '%') { return container * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? natural : n;
  }

  function posOffsetOf(token, container, disp) {
    var t = String(token || 'center').trim();
    if (t === 'center' || t === '50%') { return (container - disp) / 2; }
    if (t === 'left' || t === 'top') { return 0; }
    if (t === 'right' || t === 'bottom') { return container - disp; }
    if (t.charAt(t.length - 1) === '%') { return (container - disp) * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? (container - disp) / 2 : n;
  }

  // 拆分 background-image / -size / -position 的**顶层**逗号列表。
  // 括号与引号内的逗号不算分隔符：gradient 里的 rgba()、url("data:...") 都带逗号。
  // 【工单 44】以前这里不用拆，全靠「主背景第 2 层是照片」这个硬编码假设 —— 层数一变
  //   就错位（见 dark.css 里那段关于「层下标」的注释）。现在改成逐层映射，不再数下标。
  function splitBgList(v) {
    var out = [], depth = 0, quote = null, cur = '';
    var s = String(v || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (quote) {
        cur += ch;
        if (ch === quote && s.charAt(i - 1) !== '\\') { quote = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) { out.push(cur.trim()); }
    return out;
  }

  // 列表项按下标取，不足时按 CSS 规则循环（值比层数少就重复）。
  function pick(list, i) {
    if (!list || list.length === 0) { return ''; }
    return list[i % list.length];
  }

  // ── 主背景数据缓存（工单 45）─────────────────────────────────────────────
  // 【为什么必须有】主背景的 background-image 里内联着 3.9 MB 的壁纸 data URI。实测两笔账：
  //   * `getComputedStyle(root).backgroundImage` 读一次 ≈ **19 ms**（把 4 MB 串序列化进 JS）；
  //   * 对它跑一遍 `splitBgList` ≈ **206 ms**（真机读数；本机 Node 跑同一份实现 190 ms）。
  //   而 apply() 原本**每次**都做这两件事。设置模态本身就是本文件的 5 个目标之一 ——
  //   它一打开「面」就存在，于是**任何** scroll（`scroll` 不冒泡，但窗口的**捕获**监听
  //   照样收得到内层滚动）或 DOM 变更都会触发 rAF 里的 apply()，每帧最多 0.25 s 主线程阻塞。
  //   用户 2026-10-18 报的「设置页滑动卡顿、自带皮肤不卡」就是这一条。
  //
  // 【失效判据】背景图只在**主题切换**时变，而主题切换必然至少改其中一项：
  //   documentElement 的 data-theme / data-appearance / data-appearance-mode，
  //   或 #themeSheet 的 href（apply.ps1 每次贴入都会换 ?v=）。故拿这三项 + 注入样式表
  //   是否还在做 key；key 变了才重读那 4 MB。
  //
  // 【为什么不加「签名不变就跳过整个 apply」的闸门】缓存在手后，一次 apply() 的剩余成本
  //   只有几次 getBoundingClientRect + 每面十来个 CSS 变量写入（亚毫秒），远低于一帧预算；
  //   再加一道签名闸门只会多一处「漏判则整块背景不更新」的风险。能证明够用了就停在这里。
  var rootCache = { el: null, key: '', image: '', kinds: null, sizeTok: null, posTok: null };

  function rootCacheKey() {
    var de = document.documentElement;
    var link = document.getElementById('themeSheet');
    return [
      de.getAttribute('data-theme') || '',
      de.getAttribute('data-appearance') || '',
      de.getAttribute('data-appearance-mode') || '',
      link ? (link.getAttribute('href') || '') : '',
      document.getElementById(STYLE_ID) ? 'sty' : 'nosty'
    ].join('|');
  }

  // 读一次重活（那 4 MB）并缓存。只有首次 / 主题或注入态变化时才真的读。
  function ensureRootBgCache(root) {
    var key = rootCacheKey();
    if (rootCache.el === root && rootCache.key === key && rootCache.kinds) { return rootCache; }

    var cs = null;
    try { cs = getComputedStyle(root); } catch (e) { return rootCache; }
    var raw = cs.backgroundImage || '';

    // 逐层分类：带 url( 的那层是照片，其余（渐变）是 scrim。
    // 照片层的下标必须**现找**，不能假设它总在固定位置。
    var layers = (raw && raw !== 'none') ? splitBgList(raw) : [];
    var kinds = [];
    var photoIdx = -1;
    for (var li = 0; li < layers.length; li++) {
      var isPhoto = layers[li].indexOf('url(') >= 0;
      kinds.push(isPhoto);
      if (isPhoto && photoIdx < 0) { photoIdx = li; }
    }
    if (layers.length === 0) { kinds = [true]; photoIdx = 0; }
    else if (photoIdx < 0) { photoIdx = 0; }

    rootCache.el = root;
    rootCache.key = key;
    rootCache.image = (raw !== 'none' && raw.indexOf('url(') >= 0) ? raw : '';
    rootCache.kinds = kinds;
    rootCache.sizeTok = String(pick(splitBgList(cs.backgroundSize), photoIdx) || 'cover').trim().split(/\s+/);
    rootCache.posTok = String(pick(splitBgList(cs.backgroundPosition), photoIdx) || 'center').trim().split(/\s+/);
    return rootCache;
  }

  // 从缓存的主背景数据 + root 当前矩形，算「图片那一层」的显示尺寸与原点（视口坐标）。
  // 原 readRootBgImage() 已删除：它唯一的用途是把那串 4 MB 交给注入样式表，
  // 现在那份串由 rootCache.image 提供（同一个字符串对象，`!==` 比较是常数时间）。
  function readRootGeom(root, c) {
    var r = root.getBoundingClientRect();
    var sizeTok = c.sizeTok;
    var posTok = c.posTok;
    var dw, dh;

    var s0 = sizeTok[0], s1 = sizeTok[1] || sizeTok[0];
    if (s0 === 'cover' || s1 === 'cover') {
      var sc = Math.max(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc; dh = IMG_H * sc;
    }
    else if (s0 === 'contain' || s1 === 'contain') {
      var sc2 = Math.min(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc2; dh = IMG_H * sc2;
    }
    else {
      dw = sizeOf(s0, r.width, IMG_W);
      dh = sizeOf(s1, r.height, IMG_H);
    }

    var ox = r.left + posOffsetOf(posTok[0], r.width, dw);
    var oy = r.top + posOffsetOf(posTok[1] || posTok[0], r.height, dh);

    return { rootRect: r, dw: dw, dh: dh, ox: ox, oy: oy, kinds: c.kinds };
  }

  // 解析 transform-origin（返回布局坐标下的 px 偏移）。
  function readOrigin(el, layoutW, layoutH) {
    var raw = '';
    try { raw = getComputedStyle(el).transformOrigin || ''; } catch (e) { return { x: layoutW / 2, y: layoutH / 2 }; }
    var parts = raw.trim().split(/\s+/);
    function one(tok, dim) {
      if (!tok) { return dim / 2; }
      if (tok.charAt(tok.length - 1) === '%') { return dim * (parseFloat(tok) / 100); }
      var n = parseFloat(tok);
      return isNaN(n) ? dim / 2 : n;
    }
    return { x: one(parts[0], layoutW), y: one(parts[1] || parts[0], layoutH) };
  }

  // 从计算样式的 transform 矩阵里取出 translate 与缩放分量。
  function readTransform(el) {
    var t = '';
    try { t = getComputedStyle(el).transform || ''; } catch (e) { return null; }
    if (!t || t === 'none') { return { tx: 0, ty: 0, s: 1 }; }
    var m = t.match(/^matrix\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(',').map(function (v) { return parseFloat(v); });
      if (p.length < 6 || p.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: p[4], ty: p[5], s: Math.abs(p[0]) || 1 };
    }
    var m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var q = m3[1].split(',').map(function (v) { return parseFloat(v); });
      if (q.length < 16 || q.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: q[12], ty: q[13], s: Math.abs(q[0]) || 1 };
    }
    return null;
  }

  // 取**布局**矩形（去掉入场动画的 transform）。
  // 为什么必须是布局矩形而不是视觉矩形：背景由 ::before 的**反相动画**补偿，
  // 合成后等价于「面板处在布局位置、没有 transform」—— 所以几何要按布局位置算。
  // 推导（origin 为 O，缩放 S，平移 T）：visualTopLeft = layoutTopLeft + T + O*(1-S)。
  function layoutRectOf(el) {
    var vr = el.getBoundingClientRect();
    var lw = el.offsetWidth || vr.width;
    var lh = el.offsetHeight || vr.height;
    var tf = readTransform(el);
    if (!tf) { return { left: vr.left, top: vr.top, width: vr.width, height: vr.height }; }
    var o = readOrigin(el, lw, lh);
    var k = 1 - tf.s;
    return {
      left: vr.left - tf.tx - o.x * k,
      top: vr.top - tf.ty - o.y * k,
      width: lw,
      height: lh,
    };
  }

  // 把背景图注入一条只设 background-image 的样式表（::before 无法设内联样式）。
  // 为什么不写进主题 CSS：那是 3.9 MB 的 data URI，写两份会让主题文件翻倍。
  function injectBgImage(bgImage) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      if (document.head) { document.head.appendChild(el); }
      else { return; }
    }
    var sel = TARGETS.map(beforeSelector).join(', ');
    var css = sel + ' { background-image: ' + bgImage + '; }';
    if (el.textContent !== css) { el.textContent = css; }
  }

  function apply() {
    // 主题门（2026-10-19）：本段只在自己主题下动手。
    // 为什么不能「两段都跑」：每段注入的图取自**当前 root 的背景图**，
    // 主题不匹配的那段会把别人的图写进自己的选择器里，切回自己主题时就是错图；
    // 两段的几何变量还同名（--hana-img-*），底图尺寸不同时会互相打架。
    if (document.documentElement.getAttribute('data-theme') !== THEME_ID) { return false; }
    var open = false;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 只在真有目标面要贴时才去读根节点的计算样式（getComputedStyle 不便宜）。
    var faces = [];
    for (var k = 0; k < TARGETS.length; k++) {
      var f = findFace(TARGETS[k]);
      if (f) { faces.push(f); }
    }
    if (faces.length === 0) { return false; }

    var root = document.querySelector('[data-chalkboard-root]');
    var c = root ? ensureRootBgCache(root) : null;
    if (c && c.image) { injectBgImage(c.image); }

    // c.kinds 为 null = 缓存没建起来（getComputedStyle 抛错 / 还没读到背景），
    // 这时和原实现一样返回 g = null，绝不让 sizeTok=null 漏进 readRootGeom。
    var g = (root && c && c.kinds) ? readRootGeom(root, c) : null;

    for (var i = 0; i < faces.length; i++) {
      var el = faces[i];
      // 尺寸一变就重算（自动化面板插入时尺寸会从中间态长到终态）。
      if (resizeObs && observedFaces && !observedFaces.has(el)) {
        observedFaces.add(el);
        resizeObs.observe(el);
      }

      var r = layoutRectOf(el);
      if (r.width === 0 || r.height === 0) {
        el.removeAttribute('data-hana-frame-ready');
        continue;
      }
      open = true;

      // 尺寸是否已定型（与上一帧相同）。**只用于第一次就绪的闸门**，见下方的就绪门。
      var sizeKey = el.offsetWidth + 'x' + el.offsetHeight;
      var settled = faceSize ? (faceSize.get(el) === sizeKey) : true;
      if (faceSize) { faceSize.set(el, sizeKey); }

      // ⚠️ ::before 的包含块是** padding box**（border 之内），而 layoutRectOf 给的是
      // border box（getBoundingClientRect）。面板外壳带 1px border 时（实测：自动化面板、
      // 设置卡、市场卡都有），变量必须再减掉 border 宽度，否则整张图偏 1px
      // （在照片底部渐变陡处会放大成 20+ 色阶的可见错位）。
      var bl = el.clientLeft || 0;   // = borderLeftWidth（clientLeft 就是 border 宽度）
      var bt = el.clientTop || 0;
      var originLeft = r.left + bl;
      var originTop = r.top + bt;

      // 量化到 0.01px，抹掉浮点噪声。
      function q(v) { return Math.round(v * 100) / 100; }

      if (g) {
        // 下面四个仍是「单层」语义的值，留着**仅供诊断**（CSS 已不再直接读它们，
        // 改由 --hana-before-size / --hana-before-pos 整体下发，见下）。
        el.style.setProperty('--hana-scrim-w', q(g.rootRect.width) + 'px');
        el.style.setProperty('--hana-scrim-h', q(g.rootRect.height) + 'px');
        el.style.setProperty('--hana-scrim-x', q(g.rootRect.left - originLeft) + 'px');
        el.style.setProperty('--hana-scrim-y', q(g.rootRect.top - originTop) + 'px');
        el.style.setProperty('--hana-img-w', q(g.dw) + 'px');
        el.style.setProperty('--hana-img-h', q(g.dh) + 'px');
        el.style.setProperty('--hana-img-x', q(g.ox - originLeft) + 'px');
        el.style.setProperty('--hana-img-y', q(g.oy - originTop) + 'px');

        // ── 逐层下发 background-size / -position（工单 44）──────────────────
        // 为什么不再写成 CSS 里那串固定 3 项的声明：
        //   原先 dark.css 写死「[scrim][scrim][图]」三组值去对主背景的
        //   「[左列 scrim][照片]」两层 —— 值是**按位置**对应的。2026-10-14 删掉主背景
        //   的底部 scrim 后层数从 3 降到 2，::before 却还是三项，于是第 2 个图（照片）
        //   取到第 2 项几何（= 视口 1920×1032），而照片自己的显示尺寸是 1920×1080：
        //   同一张图在面板里被纵向放大 4.65%，月亮跨面板边缘就错位一戟。
        //   实测：::before 算出 1920px 1032px / -481px -97px，变量里却是 1080px / -121px。
        //   现在直接按**主背景真实层数与类型**逐层生成，面板与主背景永远同构，
        //   以后增删背景层不需要再回来改这里（这是本坑第二次复发，不再靠“记得改第三处”）。
        var sizeParts = [], posParts = [];
        for (var gi = 0; gi < g.kinds.length; gi++) {
          if (g.kinds[gi]) {
            // 照片层：主背景的显示尺寸与原点
            sizeParts.push(q(g.dw) + 'px ' + q(g.dh) + 'px');
            posParts.push(q(g.ox - originLeft) + 'px ' + q(g.oy - originTop) + 'px');
          }
          else {
            // scrim（渐变）层：铺满主背景容器
            sizeParts.push(q(g.rootRect.width) + 'px ' + q(g.rootRect.height) + 'px');
            posParts.push(q(g.rootRect.left - originLeft) + 'px ' + q(g.rootRect.top - originTop) + 'px');
          }
        }
        el.style.setProperty('--hana-before-size', sizeParts.join(', '));
        el.style.setProperty('--hana-before-pos', posParts.join(', '));
      }

      // ── 原子就绪（工单 33 / 工单 34）─────────────────────────────────
      // 【工单 33 要解决的问题】图由 injectBgImage 注入的样式表提供，选择器是**全局**的 ——
      //   面一被找到就会被贴上；而几何变量要等 `g`（根几何）拿得到才写得出来。
      //   两者不同步时会出现「图已贴、位置变量还没写」的窗口，那一瞬 `::before` 用 CSS 兜底值
      //   `0px 0px` 定位 → 背景先错位、再跳到正确位置。
      //   解法：图只对带 `data-hana-frame-ready` 的面生效，该属性只在**本次已写好几何变量**时打上。
      //   于是「看得见图」⟺「变量是对的」，错位窗口不存在。
      //
      // 【工单 34】原实现错在两个字：**双向**。
      //   自动化是 `_stagePanelFramed` 变体，内层面插入后尺寸从 1120x960 长到 1318x996，
      //   而每一次「不就绪」的分支都会 `removeAttribute` —— 实测一次开面摘两次。
      //   更要紧的是**就绪之后**：真机上自动化面板的异步内容晚到，会再触发一次尺寸变化，
      //   于是标记被摘 → 图消失 → 下一帧又贴上 = **有图 → 空白 → 有图**。
      //   用户 2026-10-12 截的三张图就是这一幕（序列由他标定，上一张有图、中间一张整片平色、
      //   第三张又有图，且三张里壁纸位置逐像素重合）。
      //   复现与修复：探针 probe/t34-late.mjs（就绪后改尺寸）。
      //     旧：4/4 轮摘掉标记（`remove[有]`）+ 1 个无图帧；新：**0/4**。
      //   就绪应当是**单向闩锁**：原子性只在「图第一次生效」那一瞬需要；图已贴上之后，
      //   变量重写与图本来就在同一帧的样式重算里生效，摘图只会白造一次闪断。
      //
      //   而「尺寸已定型」这个闸门**保留**（只用于第一次就绪）—— 它管的是另一件事：
      //   面板成长中的几何算的是 1120x960 那一版（实测 imgX=-384px，终值 -361px，差 23px，
      //   因为尺寸变化时布局左边缘同时挪了 24px）。
      //   工单 34 试过「不等定型、先贴图」（同步 RO 让就绪落早），结果 t33-render 从 0/20
      //   变成 20/20 失败（有图帧带着中间态几何）—— 否决，见 resizeObs 处注释。
      if (g && (settled || el.hasAttribute('data-hana-frame-ready'))) {
        // 只写一次（闩锁语义写清楚，也免掉每次重算都发一条同值属性变更）。
        if (!el.hasAttribute('data-hana-frame-ready')) {
          el.setAttribute('data-hana-frame-ready', '');
        }
      }
      else {
        el.removeAttribute('data-hana-frame-ready');
        schedule();
      }
    }
    return open;
  }

  function tick() {
    raf = 0;
    apply();
  }

  // 面板出现 / 消失是 DOM 变化；视口变化要重算几何。
  // 注意：这里**没有**逐帧循环 —— 动画完全由 CSS 负责（见 dark.css），JS 不参与。
  function schedule() {
    if (raf) { return; }
    raf = window.requestAnimationFrame(tick);
  }

  // 重算时机（工单 31 / 32 反复踩出来的，顺序即优先级）：
  //   1) ResizeObserver（**最关键**，工单 32 新增）：面元素尺寸变化就重算。
  //      自动化面板插入时尺寸从 0 长到满，而 transform-origin 随尺寸变 —— 用旧 origin 反解
  //      会算出错的 layoutLeft，且之后无人重算（framed 变体外壳 `transition:none`，
  //      `transitionend` 不触发；`animationend` 要等 375ms）→ 背景偏 24px 并**跳变**一次，
  //      就是用户看到的「背景从左上往右下移动」。这一条直接对准根因。
  //   2) transitionend / animationend：兜底（另两个面板尺寸写死，第一帧就正确，用不上）。
  //   3) resize / scroll（视口）与 MutationObserver（面板出现 / 消失）。
  // 全部只重算、不逐帧，不会退回「追合成器」那条老路。
  function onSettle() { schedule(); }
  window.addEventListener('transitionend', onSettle, true);
  window.addEventListener('animationend', onSettle, true);

  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);

  if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  // 切主题只是改 <html data-theme>（上游 applyTheme 走 setAttribute，**不发事件**），
  // 属性变化不进上面那条 childList/subtree 观察 —— 必须单独盯属性，否则切到本主题后
  // 要等下一次滚动 / 开面板才重算，那期间面板上贴的还是上一个主题的图。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  schedule();
})();
/* hana-panel-frame:hana-deepsleep */
/*
 * 浮层面板 · 取景框 —— 给面板的 ::before 提供几何与背景图。
 *
 * 由 scripts/apply.ps1 追加到 renderer 树 lib/theme.js 的末尾（幂等，见该脚本的
 * 「步骤 10c」）。视觉在 src/panel-frame/dark.css 里。
 *
 * ── 本文件只做三件事 ─────────────────────────────────────────────────────
 *   1. 从 [data-chalkboard-root] 的计算样式反推「背景图那一层」的显示尺寸与原点；
 *   2. 把两个 scrim 层与图片层的局部几何写成 CSS 变量（::before 继承）；
 *   3. 把背景图（3.9 MB 的 data URI）注入一条只设 background-image 的样式表。
 *
 * ── 为什么不再逐帧补偿动画 ───────────────────────────────────────────────
 *   曾经的实现：JS 每帧读 getComputedStyle(el).transform，算补偿值写进 CSS 变量。
 *   两个问题，第二个致命：
 *     1) 写变量会改 background-position → 主线程必须重绘那张 3.9 MB 的图；
 *     2) 入场动画跑在**合成器**线程，主线程一边重绘大图一边追，必然落后，
 *        于是背景按「上一帧的面板位置」补偿 → 真机表现为**朝反方向漂移**
 *        （用户反馈：「还是有抖动，这次是从右向左移了」）。
 *   现在改成：面板的入场动画与 ::before 的**反相动画**同时间轴、同样跑在合成器上
 *   （见 dark.css），合成后恒等，背景钉在屏幕上。JS 只在面板出现 / 视口变化时
 *   写一次**静态**几何，之后完全不参与 —— 没有「追」这回事，也就不会失步。
 *
 * ── 四个实测结论（决定了本文件与 dark.css 的形状）────────────────────────
 *   (1) 不能用 background-attachment: fixed
 *       元素带 transform 时 fixed 背景会被锚到**元素自己**而不是视口。
 *       （探针 probe/bg-attach-test.mjs：坐标编码图 + 像素解码。）
 *   (2) 图不能走 CSS 变量
 *       Chromium 对自定义属性的**值**有长度上限（1.5~2 MB），3.9 MB 的 data URI
 *       会被**静默丢弃**。故由本文件注入样式表提供。
 *       （探针 probe/len-limit.mjs / len-limit-js.mjs。）
 *   (3) 面板的图必须复现**主背景自己的渲染几何**，不能另立一套
 *       主背景是 `cover` + `center` + 视口坐标；第一版按「1:1 不缩放 + 屏幕坐标」
 *       定位，差三处（缩放 / 原点 / 基准），真机错位。
 *       （探针 probe/panel-bg-align.mjs。）
 *   (4) 主背景那串 background-image **不能每次重读**（工单 45）
 *       `getComputedStyle(root).backgroundImage` 读一次 ≈ 19 ms（4 MB 串序列化进 JS），
 *       对它跑一遍 splitBgList ≈ 190~206 ms。而 apply() 原本每帧都做这两件事 ——
 *       设置页/浮层面板一打开，滚动就变成每帧 0.25 s 主线程阻塞。故缓存，见 rootCache。
 *       （真机读数 .scratch/t45-jank/probe1.mjs；本机 Node 交叉验证 bench-split.mjs。）
 *
 * ── 变量（写在**可见圆角面**上，::before 继承）────────────────────────────
 *   --hana-scrim-w / -h / -x / -y   两个 scrim 层：铺满主背景容器
 *   --hana-img-w / -h / -x / -y     图片层：主背景的显示尺寸与原点
 *   四组都是**元素局部**值（相对 ::before 的盒子 = 面板的 padding box）。
 *   后者的语义是「图的 n% 点对齐容器的 n% 点」，与我们要的「绝对对齐」不是一回事。
 *
 * ── 主背景几何怎么算（与 [data-chalkboard-root] 的声明一一对应）──────────
 *   background-size: cover    -> scale = max(rw/W, rh/H)，显示 = (W*scale, H*scale)
 *                   contain  -> scale = min(rw/W, rh/H)
 *                   具体值    -> 直接用（% 按容器换算）
 *   background-position: center / 50%  -> 偏移 = (容器 - 显示) / 2
 *                        left/top    -> 0；right/bottom -> 容器 - 显示
 *                        n%          -> (容器 - 显示) * n%
 *
 * PoC 阶段做「卡片中心」#chalkboardCardCenterPanel；工单 31 扩到
 * 能力 #capabilitiesPanel / 自动化 #automationHubPanel 两个同组件面板，
 * 以及扩展（市场）模态与设置模态两张卡（面不是 floatingPanelInner）。
 * 每个目标的「面选择器」必须与 src/panel-frame/dark.css 的规则**保持一致**。
 */
(function () {
  // ⚠️ 守卫键**必须按主题区分**（2026-10-19 修）：apply.ps1 步骤 10c 把每个主题那段
  //    **链式追加**到同一个 lib/theme.js 末尾，各段若共用同一个 window 标记，
  //    **后追加的那段一进门就 return、整段永不执行**。真机症状：先贴的月满庭有背景图，
  //    后加的紫夜那五个面板全是实色（`::before` 的 background-image 读到 `none`）。
  var GUARD = '__hanaPanelFrame:hana-deepsleep';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  // 目标表：kind 决定怎么找「可见圆角面」。面 = 背景 ::before 的宿主元素，
  // 也是几何变量的写入点（::before 继承）。
  //   panel    —— 浮层面板：外壳 id + 直接子 [class*="floatingPanelInner"]
  //   market   —— 扩展/市场模态：popup 壳（data-testid）+ 直接子 [class*="container"]
  //   settings —— 设置模态：data-input-ctx-zone="settings" 那张 zone 的**父**卡
  var TARGETS = [
    { kind: 'panel', id: 'chalkboardCardCenterPanel' },
    { kind: 'panel', id: 'capabilitiesPanel' },
    { kind: 'panel', id: 'automationHubPanel' },
    { kind: 'market' },
    { kind: 'settings' },
    { kind: 'confirm' }
  ];
  // 本段只服务这一个主题（另一个主题那段同驻同一个文件，靠 THEME_ID 与上面的 GUARD 区分）。
  var THEME_ID = 'hana-deepsleep';
  var THEME = ':is([data-theme="' + THEME_ID + '"]) ';
  // 背景图的自然像素尺寸（本皮肤的固定资产：src/background/assets/moonlit-night.png）。
  var IMG_W = 1920;
  var IMG_H = 1080;
  var STYLE_ID = 'hana-panel-frame-bg';

  var raf = 0;
  // 已 observe 的面元素（避免重复 observe）。WeakSet：节点卸载后自动回收。
  var observedFaces = (typeof WeakSet === 'function') ? new WeakSet() : null;
  // 每个面元素「上一帧看到的尺寸」（工单 33）。只用于判定**第一次**就绪时尺寸是否已定型。
  var faceSize = (typeof WeakMap === 'function') ? new WeakMap() : null;
  // ResizeObserver：尺寸一变就重算。
  // ⚠️ 这里为什么**排 rAF**（`schedule()`）而不是同步 `apply()`（工单 34 实测过两版）：
  //   同步重算会让「连续两次 apply 尺寸相同」提前在**面板长大之前**的尺寸上满足，
  //   于是第一次就绪落早了 —— 图会带着中间态几何（imgX=-384px）被贴上。
  //   探针 t33-render 的「有图帧位置恒为终值」判据从 0/20 变成 **20/20 失败**。
  //   同步重算确实能在「布局之后、绘制之前」修正变量（按渲染步骤规范），
  //   但这一层节流下的采样粒度**证明不了**（rAF 与 setTimeout 双采样都分辨不出），
  //   而本项目不接受「按规范应该没问题」。故退回 rAF。
  var resizeObs = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { schedule(); }) : null;

  // 取直接子元素里的目标面（用 children 遍历，不用 querySelector ——
  // 后者可能返回后代，与 CSS 规则的直接子选择器选到不同节点）。
  function directChildMatching(shell, needle) {
    var kids = shell.children;
    for (var i = 0; i < kids.length; i++) {
      if (String(kids[i].className).indexOf(needle) >= 0) { return kids[i]; }
    }
    return null;
  }

  // 按目标类型找「面」。找不到返回 null。
  function findFace(t) {
    if (t.kind === 'panel') {
      var shell = document.getElementById(t.id);
      return shell ? directChildMatching(shell, 'floatingPanelInner') : null;
    }
    if (t.kind === 'market') {
      var popup = document.querySelector('[data-testid="market-modal-overlay"]');
      return popup ? directChildMatching(popup, 'container') : null;
    }
    if (t.kind === 'settings') {
      var zone = document.querySelector('[data-input-ctx-zone="settings"]');
      return zone ? zone.parentElement : null;
    }
    if (t.kind === 'confirm') {
      // 通用确认框（Us.confirm / base-ui AlertDialog）：面是 popup 壳的直接子元素。
      // 2026-10-24：用户要求这个弹窗也走取景框（「改成设置页面那种底」）。
      var ad = document.querySelector('[role="alertdialog"]');
      return ad ? directChildMatching(ad, '_dialog_') : null;
    }
    return null;
  }

  // 该目标面的 ::before 选择器（与 dark.css 里写的一致）。
  // ⚠️ 带 `[data-hana-frame-ready]`（工单 33）：图只对**已经写好几何变量**的面生效，
  // 保证「图出现」与「位置变量就绪」同一时刻，不会出现「图已贴、位置还是兜底 0px」的错位窗口。
  var READY = '[data-hana-frame-ready]';
  function beforeSelector(t) {
    if (t.kind === 'panel') {
      return THEME + '#' + t.id + ' > [class*="floatingPanelInner"]' + READY + '::before';
    }
    if (t.kind === 'market') {
      return THEME + '[data-testid="market-modal-overlay"] > [class*="container"]' + READY + '::before';
    }
    if (t.kind === 'confirm') {
      return THEME + '[role="alertdialog"] > [class*="_dialog_"]' + READY + '::before';
    }
    return THEME + ':has(> [data-input-ctx-zone="settings"])' + READY + '::before';
  }

  // 解析 background-size / background-position 的单个分量，返回 CSS px。
  function sizeOf(token, container, natural) {
    var t = String(token || '').trim();
    if (t === 'cover' || t === 'contain') { return null; }   // 交给调用方按两轴一起算
    if (t === 'auto') { return natural; }
    if (t.charAt(t.length - 1) === '%') { return container * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? natural : n;
  }

  function posOffsetOf(token, container, disp) {
    var t = String(token || 'center').trim();
    if (t === 'center' || t === '50%') { return (container - disp) / 2; }
    if (t === 'left' || t === 'top') { return 0; }
    if (t === 'right' || t === 'bottom') { return container - disp; }
    if (t.charAt(t.length - 1) === '%') { return (container - disp) * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? (container - disp) / 2 : n;
  }

  // 拆分 background-image / -size / -position 的**顶层**逗号列表。
  // 括号与引号内的逗号不算分隔符：gradient 里的 rgba()、url("data:...") 都带逗号。
  // 【工单 44】以前这里不用拆，全靠「主背景第 2 层是照片」这个硬编码假设 —— 层数一变
  //   就错位（见 dark.css 里那段关于「层下标」的注释）。现在改成逐层映射，不再数下标。
  function splitBgList(v) {
    var out = [], depth = 0, quote = null, cur = '';
    var s = String(v || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (quote) {
        cur += ch;
        if (ch === quote && s.charAt(i - 1) !== '\\') { quote = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) { out.push(cur.trim()); }
    return out;
  }

  // 列表项按下标取，不足时按 CSS 规则循环（值比层数少就重复）。
  function pick(list, i) {
    if (!list || list.length === 0) { return ''; }
    return list[i % list.length];
  }

  // ── 主背景数据缓存（工单 45）─────────────────────────────────────────────
  // 【为什么必须有】主背景的 background-image 里内联着 3.9 MB 的壁纸 data URI。实测两笔账：
  //   * `getComputedStyle(root).backgroundImage` 读一次 ≈ **19 ms**（把 4 MB 串序列化进 JS）；
  //   * 对它跑一遍 `splitBgList` ≈ **206 ms**（真机读数；本机 Node 跑同一份实现 190 ms）。
  //   而 apply() 原本**每次**都做这两件事。设置模态本身就是本文件的 5 个目标之一 ——
  //   它一打开「面」就存在，于是**任何** scroll（`scroll` 不冒泡，但窗口的**捕获**监听
  //   照样收得到内层滚动）或 DOM 变更都会触发 rAF 里的 apply()，每帧最多 0.25 s 主线程阻塞。
  //   用户 2026-10-18 报的「设置页滑动卡顿、自带皮肤不卡」就是这一条。
  //
  // 【失效判据】背景图只在**主题切换**时变，而主题切换必然至少改其中一项：
  //   documentElement 的 data-theme / data-appearance / data-appearance-mode，
  //   或 #themeSheet 的 href（apply.ps1 每次贴入都会换 ?v=）。故拿这三项 + 注入样式表
  //   是否还在做 key；key 变了才重读那 4 MB。
  //
  // 【为什么不加「签名不变就跳过整个 apply」的闸门】缓存在手后，一次 apply() 的剩余成本
  //   只有几次 getBoundingClientRect + 每面十来个 CSS 变量写入（亚毫秒），远低于一帧预算；
  //   再加一道签名闸门只会多一处「漏判则整块背景不更新」的风险。能证明够用了就停在这里。
  var rootCache = { el: null, key: '', image: '', kinds: null, sizeTok: null, posTok: null };

  function rootCacheKey() {
    var de = document.documentElement;
    var link = document.getElementById('themeSheet');
    return [
      de.getAttribute('data-theme') || '',
      de.getAttribute('data-appearance') || '',
      de.getAttribute('data-appearance-mode') || '',
      link ? (link.getAttribute('href') || '') : '',
      document.getElementById(STYLE_ID) ? 'sty' : 'nosty'
    ].join('|');
  }

  // 读一次重活（那 4 MB）并缓存。只有首次 / 主题或注入态变化时才真的读。
  function ensureRootBgCache(root) {
    var key = rootCacheKey();
    if (rootCache.el === root && rootCache.key === key && rootCache.kinds) { return rootCache; }

    var cs = null;
    try { cs = getComputedStyle(root); } catch (e) { return rootCache; }
    var raw = cs.backgroundImage || '';

    // 逐层分类：带 url( 的那层是照片，其余（渐变）是 scrim。
    // 照片层的下标必须**现找**，不能假设它总在固定位置。
    var layers = (raw && raw !== 'none') ? splitBgList(raw) : [];
    var kinds = [];
    var photoIdx = -1;
    for (var li = 0; li < layers.length; li++) {
      var isPhoto = layers[li].indexOf('url(') >= 0;
      kinds.push(isPhoto);
      if (isPhoto && photoIdx < 0) { photoIdx = li; }
    }
    if (layers.length === 0) { kinds = [true]; photoIdx = 0; }
    else if (photoIdx < 0) { photoIdx = 0; }

    rootCache.el = root;
    rootCache.key = key;
    rootCache.image = (raw !== 'none' && raw.indexOf('url(') >= 0) ? raw : '';
    rootCache.kinds = kinds;
    rootCache.sizeTok = String(pick(splitBgList(cs.backgroundSize), photoIdx) || 'cover').trim().split(/\s+/);
    rootCache.posTok = String(pick(splitBgList(cs.backgroundPosition), photoIdx) || 'center').trim().split(/\s+/);
    return rootCache;
  }

  // 从缓存的主背景数据 + root 当前矩形，算「图片那一层」的显示尺寸与原点（视口坐标）。
  // 原 readRootBgImage() 已删除：它唯一的用途是把那串 4 MB 交给注入样式表，
  // 现在那份串由 rootCache.image 提供（同一个字符串对象，`!==` 比较是常数时间）。
  function readRootGeom(root, c) {
    var r = root.getBoundingClientRect();
    var sizeTok = c.sizeTok;
    var posTok = c.posTok;
    var dw, dh;

    var s0 = sizeTok[0], s1 = sizeTok[1] || sizeTok[0];
    if (s0 === 'cover' || s1 === 'cover') {
      var sc = Math.max(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc; dh = IMG_H * sc;
    }
    else if (s0 === 'contain' || s1 === 'contain') {
      var sc2 = Math.min(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc2; dh = IMG_H * sc2;
    }
    else {
      dw = sizeOf(s0, r.width, IMG_W);
      dh = sizeOf(s1, r.height, IMG_H);
    }

    var ox = r.left + posOffsetOf(posTok[0], r.width, dw);
    var oy = r.top + posOffsetOf(posTok[1] || posTok[0], r.height, dh);

    return { rootRect: r, dw: dw, dh: dh, ox: ox, oy: oy, kinds: c.kinds };
  }

  // 解析 transform-origin（返回布局坐标下的 px 偏移）。
  function readOrigin(el, layoutW, layoutH) {
    var raw = '';
    try { raw = getComputedStyle(el).transformOrigin || ''; } catch (e) { return { x: layoutW / 2, y: layoutH / 2 }; }
    var parts = raw.trim().split(/\s+/);
    function one(tok, dim) {
      if (!tok) { return dim / 2; }
      if (tok.charAt(tok.length - 1) === '%') { return dim * (parseFloat(tok) / 100); }
      var n = parseFloat(tok);
      return isNaN(n) ? dim / 2 : n;
    }
    return { x: one(parts[0], layoutW), y: one(parts[1] || parts[0], layoutH) };
  }

  // 从计算样式的 transform 矩阵里取出 translate 与缩放分量。
  function readTransform(el) {
    var t = '';
    try { t = getComputedStyle(el).transform || ''; } catch (e) { return null; }
    if (!t || t === 'none') { return { tx: 0, ty: 0, s: 1 }; }
    var m = t.match(/^matrix\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(',').map(function (v) { return parseFloat(v); });
      if (p.length < 6 || p.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: p[4], ty: p[5], s: Math.abs(p[0]) || 1 };
    }
    var m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var q = m3[1].split(',').map(function (v) { return parseFloat(v); });
      if (q.length < 16 || q.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: q[12], ty: q[13], s: Math.abs(q[0]) || 1 };
    }
    return null;
  }

  // 取**布局**矩形（去掉入场动画的 transform）。
  // 为什么必须是布局矩形而不是视觉矩形：背景由 ::before 的**反相动画**补偿，
  // 合成后等价于「面板处在布局位置、没有 transform」—— 所以几何要按布局位置算。
  // 推导（origin 为 O，缩放 S，平移 T）：visualTopLeft = layoutTopLeft + T + O*(1-S)。
  function layoutRectOf(el) {
    var vr = el.getBoundingClientRect();
    var lw = el.offsetWidth || vr.width;
    var lh = el.offsetHeight || vr.height;
    var tf = readTransform(el);
    if (!tf) { return { left: vr.left, top: vr.top, width: vr.width, height: vr.height }; }
    var o = readOrigin(el, lw, lh);
    var k = 1 - tf.s;
    return {
      left: vr.left - tf.tx - o.x * k,
      top: vr.top - tf.ty - o.y * k,
      width: lw,
      height: lh,
    };
  }

  // 把背景图注入一条只设 background-image 的样式表（::before 无法设内联样式）。
  // 为什么不写进主题 CSS：那是 3.9 MB 的 data URI，写两份会让主题文件翻倍。
  function injectBgImage(bgImage) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      if (document.head) { document.head.appendChild(el); }
      else { return; }
    }
    var sel = TARGETS.map(beforeSelector).join(', ');
    var css = sel + ' { background-image: ' + bgImage + '; }';
    if (el.textContent !== css) { el.textContent = css; }
  }

  function apply() {
    // 主题门（2026-10-19）：本段只在自己主题下动手。
    // 为什么不能「两段都跑」：每段注入的图取自**当前 root 的背景图**，
    // 主题不匹配的那段会把别人的图写进自己的选择器里，切回自己主题时就是错图；
    // 两段的几何变量还同名（--hana-img-*），底图尺寸不同时会互相打架。
    if (document.documentElement.getAttribute('data-theme') !== THEME_ID) { return false; }
    var open = false;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 只在真有目标面要贴时才去读根节点的计算样式（getComputedStyle 不便宜）。
    var faces = [];
    for (var k = 0; k < TARGETS.length; k++) {
      var f = findFace(TARGETS[k]);
      if (f) { faces.push(f); }
    }
    if (faces.length === 0) { return false; }

    var root = document.querySelector('[data-chalkboard-root]');
    var c = root ? ensureRootBgCache(root) : null;
    if (c && c.image) { injectBgImage(c.image); }

    // c.kinds 为 null = 缓存没建起来（getComputedStyle 抛错 / 还没读到背景），
    // 这时和原实现一样返回 g = null，绝不让 sizeTok=null 漏进 readRootGeom。
    var g = (root && c && c.kinds) ? readRootGeom(root, c) : null;

    for (var i = 0; i < faces.length; i++) {
      var el = faces[i];
      // 尺寸一变就重算（自动化面板插入时尺寸会从中间态长到终态）。
      if (resizeObs && observedFaces && !observedFaces.has(el)) {
        observedFaces.add(el);
        resizeObs.observe(el);
      }

      var r = layoutRectOf(el);
      if (r.width === 0 || r.height === 0) {
        el.removeAttribute('data-hana-frame-ready');
        continue;
      }
      open = true;

      // 尺寸是否已定型（与上一帧相同）。**只用于第一次就绪的闸门**，见下方的就绪门。
      var sizeKey = el.offsetWidth + 'x' + el.offsetHeight;
      var settled = faceSize ? (faceSize.get(el) === sizeKey) : true;
      if (faceSize) { faceSize.set(el, sizeKey); }

      // ⚠️ ::before 的包含块是** padding box**（border 之内），而 layoutRectOf 给的是
      // border box（getBoundingClientRect）。面板外壳带 1px border 时（实测：自动化面板、
      // 设置卡、市场卡都有），变量必须再减掉 border 宽度，否则整张图偏 1px
      // （在照片底部渐变陡处会放大成 20+ 色阶的可见错位）。
      var bl = el.clientLeft || 0;   // = borderLeftWidth（clientLeft 就是 border 宽度）
      var bt = el.clientTop || 0;
      var originLeft = r.left + bl;
      var originTop = r.top + bt;

      // 量化到 0.01px，抹掉浮点噪声。
      function q(v) { return Math.round(v * 100) / 100; }

      if (g) {
        // 下面四个仍是「单层」语义的值，留着**仅供诊断**（CSS 已不再直接读它们，
        // 改由 --hana-before-size / --hana-before-pos 整体下发，见下）。
        el.style.setProperty('--hana-scrim-w', q(g.rootRect.width) + 'px');
        el.style.setProperty('--hana-scrim-h', q(g.rootRect.height) + 'px');
        el.style.setProperty('--hana-scrim-x', q(g.rootRect.left - originLeft) + 'px');
        el.style.setProperty('--hana-scrim-y', q(g.rootRect.top - originTop) + 'px');
        el.style.setProperty('--hana-img-w', q(g.dw) + 'px');
        el.style.setProperty('--hana-img-h', q(g.dh) + 'px');
        el.style.setProperty('--hana-img-x', q(g.ox - originLeft) + 'px');
        el.style.setProperty('--hana-img-y', q(g.oy - originTop) + 'px');

        // ── 逐层下发 background-size / -position（工单 44）──────────────────
        // 为什么不再写成 CSS 里那串固定 3 项的声明：
        //   原先 dark.css 写死「[scrim][scrim][图]」三组值去对主背景的
        //   「[左列 scrim][照片]」两层 —— 值是**按位置**对应的。2026-10-14 删掉主背景
        //   的底部 scrim 后层数从 3 降到 2，::before 却还是三项，于是第 2 个图（照片）
        //   取到第 2 项几何（= 视口 1920×1032），而照片自己的显示尺寸是 1920×1080：
        //   同一张图在面板里被纵向放大 4.65%，月亮跨面板边缘就错位一戟。
        //   实测：::before 算出 1920px 1032px / -481px -97px，变量里却是 1080px / -121px。
        //   现在直接按**主背景真实层数与类型**逐层生成，面板与主背景永远同构，
        //   以后增删背景层不需要再回来改这里（这是本坑第二次复发，不再靠“记得改第三处”）。
        var sizeParts = [], posParts = [];
        for (var gi = 0; gi < g.kinds.length; gi++) {
          if (g.kinds[gi]) {
            // 照片层：主背景的显示尺寸与原点
            sizeParts.push(q(g.dw) + 'px ' + q(g.dh) + 'px');
            posParts.push(q(g.ox - originLeft) + 'px ' + q(g.oy - originTop) + 'px');
          }
          else {
            // scrim（渐变）层：铺满主背景容器
            sizeParts.push(q(g.rootRect.width) + 'px ' + q(g.rootRect.height) + 'px');
            posParts.push(q(g.rootRect.left - originLeft) + 'px ' + q(g.rootRect.top - originTop) + 'px');
          }
        }
        el.style.setProperty('--hana-before-size', sizeParts.join(', '));
        el.style.setProperty('--hana-before-pos', posParts.join(', '));
      }

      // ── 原子就绪（工单 33 / 工单 34）─────────────────────────────────
      // 【工单 33 要解决的问题】图由 injectBgImage 注入的样式表提供，选择器是**全局**的 ——
      //   面一被找到就会被贴上；而几何变量要等 `g`（根几何）拿得到才写得出来。
      //   两者不同步时会出现「图已贴、位置变量还没写」的窗口，那一瞬 `::before` 用 CSS 兜底值
      //   `0px 0px` 定位 → 背景先错位、再跳到正确位置。
      //   解法：图只对带 `data-hana-frame-ready` 的面生效，该属性只在**本次已写好几何变量**时打上。
      //   于是「看得见图」⟺「变量是对的」，错位窗口不存在。
      //
      // 【工单 34】原实现错在两个字：**双向**。
      //   自动化是 `_stagePanelFramed` 变体，内层面插入后尺寸从 1120x960 长到 1318x996，
      //   而每一次「不就绪」的分支都会 `removeAttribute` —— 实测一次开面摘两次。
      //   更要紧的是**就绪之后**：真机上自动化面板的异步内容晚到，会再触发一次尺寸变化，
      //   于是标记被摘 → 图消失 → 下一帧又贴上 = **有图 → 空白 → 有图**。
      //   用户 2026-10-12 截的三张图就是这一幕（序列由他标定，上一张有图、中间一张整片平色、
      //   第三张又有图，且三张里壁纸位置逐像素重合）。
      //   复现与修复：探针 probe/t34-late.mjs（就绪后改尺寸）。
      //     旧：4/4 轮摘掉标记（`remove[有]`）+ 1 个无图帧；新：**0/4**。
      //   就绪应当是**单向闩锁**：原子性只在「图第一次生效」那一瞬需要；图已贴上之后，
      //   变量重写与图本来就在同一帧的样式重算里生效，摘图只会白造一次闪断。
      //
      //   而「尺寸已定型」这个闸门**保留**（只用于第一次就绪）—— 它管的是另一件事：
      //   面板成长中的几何算的是 1120x960 那一版（实测 imgX=-384px，终值 -361px，差 23px，
      //   因为尺寸变化时布局左边缘同时挪了 24px）。
      //   工单 34 试过「不等定型、先贴图」（同步 RO 让就绪落早），结果 t33-render 从 0/20
      //   变成 20/20 失败（有图帧带着中间态几何）—— 否决，见 resizeObs 处注释。
      if (g && (settled || el.hasAttribute('data-hana-frame-ready'))) {
        // 只写一次（闩锁语义写清楚，也免掉每次重算都发一条同值属性变更）。
        if (!el.hasAttribute('data-hana-frame-ready')) {
          el.setAttribute('data-hana-frame-ready', '');
        }
      }
      else {
        el.removeAttribute('data-hana-frame-ready');
        schedule();
      }
    }
    return open;
  }

  function tick() {
    raf = 0;
    apply();
  }

  // 面板出现 / 消失是 DOM 变化；视口变化要重算几何。
  // 注意：这里**没有**逐帧循环 —— 动画完全由 CSS 负责（见 dark.css），JS 不参与。
  function schedule() {
    if (raf) { return; }
    raf = window.requestAnimationFrame(tick);
  }

  // 重算时机（工单 31 / 32 反复踩出来的，顺序即优先级）：
  //   1) ResizeObserver（**最关键**，工单 32 新增）：面元素尺寸变化就重算。
  //      自动化面板插入时尺寸从 0 长到满，而 transform-origin 随尺寸变 —— 用旧 origin 反解
  //      会算出错的 layoutLeft，且之后无人重算（framed 变体外壳 `transition:none`，
  //      `transitionend` 不触发；`animationend` 要等 375ms）→ 背景偏 24px 并**跳变**一次，
  //      就是用户看到的「背景从左上往右下移动」。这一条直接对准根因。
  //   2) transitionend / animationend：兜底（另两个面板尺寸写死，第一帧就正确，用不上）。
  //   3) resize / scroll（视口）与 MutationObserver（面板出现 / 消失）。
  // 全部只重算、不逐帧，不会退回「追合成器」那条老路。
  function onSettle() { schedule(); }
  window.addEventListener('transitionend', onSettle, true);
  window.addEventListener('animationend', onSettle, true);

  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);

  if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  // 切主题只是改 <html data-theme>（上游 applyTheme 走 setAttribute，**不发事件**），
  // 属性变化不进上面那条 childList/subtree 观察 —— 必须单独盯属性，否则切到本主题后
  // 要等下一次滚动 / 开面板才重算，那期间面板上贴的还是上一个主题的图。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  schedule();
})();

/* hana-thinking-level: start */
/* 思考档位 -> 鲸鱼动作的信号源（2026-10-20，只服务 hana-deepsleep）
 * ---------------------------------------------------------------------------
 * 为什么需要这段 JS：CSS 只能对 DOM 上已经存在的东西做反应，而聊天区里
 * 没有「当前思考档位」这个信号（档位只存在应用的 store 与设置弹窗里，
 * [data-thinking-bloom] 附近没有任何档位属性）。所以这里把档位写到
 * <html data-hana-think="...">，视觉在 src/background-deepseek/dark.css 里按它换遮罩。
 *
 * 怎么拿档位：**不发自己的请求**，只嗅探应用自己打的
 *   GET/POST /api/session-thinking-level
 * 的响应（输入区在会话切换、打开设置时本来就会打它）。这样既不用碰鉴权，
 * 也不用猜 sessionPath —— 应用拿什么，我们就跟着拿什么。
 * 嗅探不到就一直不写属性，CSS 的默认分支（官方那条 APNG）照常工作。
 *
 * 失败/降级：wrap 出任何异常都吞掉并原样返回原来的 Response；
 * 档位不在白名单里（未来新增档位）一律忽略。 */
(function () {
  var GUARD = '__hanaThinkingLevel:hana-deepsleep';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  var THEME_ID = 'hana-deepsleep';
  var ATTR = 'data-hana-think';
  var KNOWN = { off: 1, auto: 1, low: 1, medium: 1, high: 1, xhigh: 1, max: 1 };
  var seen = null;

  function isOurTheme() {
    return document.documentElement.getAttribute('data-theme') === THEME_ID;
  }
  function apply(level) {
    if (typeof level !== 'string') { return; }
    var v = level.toLowerCase();
    if (!KNOWN[v] || v === seen) { return; }
    seen = v;
    if (isOurTheme()) { document.documentElement.setAttribute(ATTR, v); }
  }

  // 切主题只改 <html data-theme>（不发事件）：切到本主题时补写，切走时摘掉。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function () {
      var root = document.documentElement;
      if (root.getAttribute('data-theme') === THEME_ID) {
        if (seen) { root.setAttribute(ATTR, seen); }
      }
      else { root.removeAttribute(ATTR); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var p = origFetch.apply(this, arguments);
      try {
        var url = typeof input === 'string' ? input : ((input && input.url) || '');
        if (url.indexOf('/api/session-thinking-level') !== -1 && p && typeof p.then === 'function') {
          p.then(function (res) {
            try {
              res.clone().json().then(function (j) {
                if (j && j.thinkingLevel) { apply(String(j.thinkingLevel)); }
              }, function () {});
            } catch (e) { }
          }, function () { });
        }
      } catch (e) { }
      return p;
    };
  }
})();
/* hana-thinking-level: end */
/* hana-panel-frame:hana-claude-clay */
/*
 * 浮层面板 · 取景框 —— 给面板的 ::before 提供几何与背景图。
 *
 * 由 scripts/apply.ps1 追加到 renderer 树 lib/theme.js 的末尾（幂等，见该脚本的
 * 「步骤 10c」）。视觉在 src/panel-frame/dark.css 里。
 *
 * ── 本文件只做三件事 ─────────────────────────────────────────────────────
 *   1. 从 [data-chalkboard-root] 的计算样式反推「背景图那一层」的显示尺寸与原点；
 *   2. 把两个 scrim 层与图片层的局部几何写成 CSS 变量（::before 继承）；
 *   3. 把背景图（3.9 MB 的 data URI）注入一条只设 background-image 的样式表。
 *
 * ── 为什么不再逐帧补偿动画 ───────────────────────────────────────────────
 *   曾经的实现：JS 每帧读 getComputedStyle(el).transform，算补偿值写进 CSS 变量。
 *   两个问题，第二个致命：
 *     1) 写变量会改 background-position → 主线程必须重绘那张 3.9 MB 的图；
 *     2) 入场动画跑在**合成器**线程，主线程一边重绘大图一边追，必然落后，
 *        于是背景按「上一帧的面板位置」补偿 → 真机表现为**朝反方向漂移**
 *        （用户反馈：「还是有抖动，这次是从右向左移了」）。
 *   现在改成：面板的入场动画与 ::before 的**反相动画**同时间轴、同样跑在合成器上
 *   （见 dark.css），合成后恒等，背景钉在屏幕上。JS 只在面板出现 / 视口变化时
 *   写一次**静态**几何，之后完全不参与 —— 没有「追」这回事，也就不会失步。
 *
 * ── 四个实测结论（决定了本文件与 dark.css 的形状）────────────────────────
 *   (1) 不能用 background-attachment: fixed
 *       元素带 transform 时 fixed 背景会被锚到**元素自己**而不是视口。
 *       （探针 probe/bg-attach-test.mjs：坐标编码图 + 像素解码。）
 *   (2) 图不能走 CSS 变量
 *       Chromium 对自定义属性的**值**有长度上限（1.5~2 MB），3.9 MB 的 data URI
 *       会被**静默丢弃**。故由本文件注入样式表提供。
 *       （探针 probe/len-limit.mjs / len-limit-js.mjs。）
 *   (3) 面板的图必须复现**主背景自己的渲染几何**，不能另立一套
 *       主背景是 `cover` + `center` + 视口坐标；第一版按「1:1 不缩放 + 屏幕坐标」
 *       定位，差三处（缩放 / 原点 / 基准），真机错位。
 *       （探针 probe/panel-bg-align.mjs。）
 *   (4) 主背景那串 background-image **不能每次重读**（工单 45）
 *       `getComputedStyle(root).backgroundImage` 读一次 ≈ 19 ms（4 MB 串序列化进 JS），
 *       对它跑一遍 splitBgList ≈ 190~206 ms。而 apply() 原本每帧都做这两件事 ——
 *       设置页/浮层面板一打开，滚动就变成每帧 0.25 s 主线程阻塞。故缓存，见 rootCache。
 *       （真机读数 .scratch/t45-jank/probe1.mjs；本机 Node 交叉验证 bench-split.mjs。）
 *
 * ── 变量（写在**可见圆角面**上，::before 继承）────────────────────────────
 *   --hana-scrim-w / -h / -x / -y   两个 scrim 层：铺满主背景容器
 *   --hana-img-w / -h / -x / -y     图片层：主背景的显示尺寸与原点
 *   四组都是**元素局部**值（相对 ::before 的盒子 = 面板的 padding box）。
 *   后者的语义是「图的 n% 点对齐容器的 n% 点」，与我们要的「绝对对齐」不是一回事。
 *
 * ── 主背景几何怎么算（与 [data-chalkboard-root] 的声明一一对应）──────────
 *   background-size: cover    -> scale = max(rw/W, rh/H)，显示 = (W*scale, H*scale)
 *                   contain  -> scale = min(rw/W, rh/H)
 *                   具体值    -> 直接用（% 按容器换算）
 *   background-position: center / 50%  -> 偏移 = (容器 - 显示) / 2
 *                        left/top    -> 0；right/bottom -> 容器 - 显示
 *                        n%          -> (容器 - 显示) * n%
 *
 * PoC 阶段做「卡片中心」#chalkboardCardCenterPanel；工单 31 扩到
 * 能力 #capabilitiesPanel / 自动化 #automationHubPanel 两个同组件面板，
 * 以及扩展（市场）模态与设置模态两张卡（面不是 floatingPanelInner）。
 * 每个目标的「面选择器」必须与 src/panel-frame/dark.css 的规则**保持一致**。
 */
(function () {
  // ⚠️ 守卫键**必须按主题区分**（2026-10-19 修）：apply.ps1 步骤 10c 把每个主题那段
  //    **链式追加**到同一个 lib/theme.js 末尾，各段若共用同一个 window 标记，
  //    **后追加的那段一进门就 return、整段永不执行**。真机症状：先贴的月满庭有背景图，
  //    后加的紫夜那五个面板全是实色（`::before` 的 background-image 读到 `none`）。
  var GUARD = '__hanaPanelFrame:hana-claude-clay';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  // 目标表：kind 决定怎么找「可见圆角面」。面 = 背景 ::before 的宿主元素，
  // 也是几何变量的写入点（::before 继承）。
  //   panel    —— 浮层面板：外壳 id + 直接子 [class*="floatingPanelInner"]
  //   market   —— 扩展/市场模态：popup 壳（data-testid）+ 直接子 [class*="container"]
  //   settings —— 设置模态：data-input-ctx-zone="settings" 那张 zone 的**父**卡
  var TARGETS = [
    { kind: 'panel', id: 'chalkboardCardCenterPanel' },
    { kind: 'panel', id: 'capabilitiesPanel' },
    { kind: 'panel', id: 'automationHubPanel' },
    { kind: 'market' },
    { kind: 'settings' },
    { kind: 'confirm' }
  ];
  // 本段只服务这一个主题（另一个主题那段同驻同一个文件，靠 THEME_ID 与上面的 GUARD 区分）。
  var THEME_ID = 'hana-claude-clay';
  var THEME = ':is([data-theme="' + THEME_ID + '"]) ';
  // 背景图的自然像素尺寸（本皮肤的固定资产：src/background/assets/moonlit-night.png）。
  var IMG_W = 1920;
  var IMG_H = 1080;
  var STYLE_ID = 'hana-panel-frame-bg';

  var raf = 0;
  // 已 observe 的面元素（避免重复 observe）。WeakSet：节点卸载后自动回收。
  var observedFaces = (typeof WeakSet === 'function') ? new WeakSet() : null;
  // 每个面元素「上一帧看到的尺寸」（工单 33）。只用于判定**第一次**就绪时尺寸是否已定型。
  var faceSize = (typeof WeakMap === 'function') ? new WeakMap() : null;
  // ResizeObserver：尺寸一变就重算。
  // ⚠️ 这里为什么**排 rAF**（`schedule()`）而不是同步 `apply()`（工单 34 实测过两版）：
  //   同步重算会让「连续两次 apply 尺寸相同」提前在**面板长大之前**的尺寸上满足，
  //   于是第一次就绪落早了 —— 图会带着中间态几何（imgX=-384px）被贴上。
  //   探针 t33-render 的「有图帧位置恒为终值」判据从 0/20 变成 **20/20 失败**。
  //   同步重算确实能在「布局之后、绘制之前」修正变量（按渲染步骤规范），
  //   但这一层节流下的采样粒度**证明不了**（rAF 与 setTimeout 双采样都分辨不出），
  //   而本项目不接受「按规范应该没问题」。故退回 rAF。
  var resizeObs = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { schedule(); }) : null;

  // 取直接子元素里的目标面（用 children 遍历，不用 querySelector ——
  // 后者可能返回后代，与 CSS 规则的直接子选择器选到不同节点）。
  function directChildMatching(shell, needle) {
    var kids = shell.children;
    for (var i = 0; i < kids.length; i++) {
      if (String(kids[i].className).indexOf(needle) >= 0) { return kids[i]; }
    }
    return null;
  }

  // 按目标类型找「面」。找不到返回 null。
  function findFace(t) {
    if (t.kind === 'panel') {
      var shell = document.getElementById(t.id);
      return shell ? directChildMatching(shell, 'floatingPanelInner') : null;
    }
    if (t.kind === 'market') {
      var popup = document.querySelector('[data-testid="market-modal-overlay"]');
      return popup ? directChildMatching(popup, 'container') : null;
    }
    if (t.kind === 'settings') {
      var zone = document.querySelector('[data-input-ctx-zone="settings"]');
      return zone ? zone.parentElement : null;
    }
    if (t.kind === 'confirm') {
      // 通用确认框（Us.confirm / base-ui AlertDialog）：面是 popup 壳的直接子元素。
      // 2026-10-24：用户要求这个弹窗也走取景框（「改成设置页面那种底」）。
      var ad = document.querySelector('[role="alertdialog"]');
      return ad ? directChildMatching(ad, '_dialog_') : null;
    }
    return null;
  }

  // 该目标面的 ::before 选择器（与 dark.css 里写的一致）。
  // ⚠️ 带 `[data-hana-frame-ready]`（工单 33）：图只对**已经写好几何变量**的面生效，
  // 保证「图出现」与「位置变量就绪」同一时刻，不会出现「图已贴、位置还是兜底 0px」的错位窗口。
  var READY = '[data-hana-frame-ready]';
  function beforeSelector(t) {
    if (t.kind === 'panel') {
      return THEME + '#' + t.id + ' > [class*="floatingPanelInner"]' + READY + '::before';
    }
    if (t.kind === 'market') {
      return THEME + '[data-testid="market-modal-overlay"] > [class*="container"]' + READY + '::before';
    }
    if (t.kind === 'confirm') {
      return THEME + '[role="alertdialog"] > [class*="_dialog_"]' + READY + '::before';
    }
    return THEME + ':has(> [data-input-ctx-zone="settings"])' + READY + '::before';
  }

  // 解析 background-size / background-position 的单个分量，返回 CSS px。
  function sizeOf(token, container, natural) {
    var t = String(token || '').trim();
    if (t === 'cover' || t === 'contain') { return null; }   // 交给调用方按两轴一起算
    if (t === 'auto') { return natural; }
    if (t.charAt(t.length - 1) === '%') { return container * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? natural : n;
  }

  function posOffsetOf(token, container, disp) {
    var t = String(token || 'center').trim();
    if (t === 'center' || t === '50%') { return (container - disp) / 2; }
    if (t === 'left' || t === 'top') { return 0; }
    if (t === 'right' || t === 'bottom') { return container - disp; }
    if (t.charAt(t.length - 1) === '%') { return (container - disp) * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? (container - disp) / 2 : n;
  }

  // 拆分 background-image / -size / -position 的**顶层**逗号列表。
  // 括号与引号内的逗号不算分隔符：gradient 里的 rgba()、url("data:...") 都带逗号。
  // 【工单 44】以前这里不用拆，全靠「主背景第 2 层是照片」这个硬编码假设 —— 层数一变
  //   就错位（见 dark.css 里那段关于「层下标」的注释）。现在改成逐层映射，不再数下标。
  function splitBgList(v) {
    var out = [], depth = 0, quote = null, cur = '';
    var s = String(v || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (quote) {
        cur += ch;
        if (ch === quote && s.charAt(i - 1) !== '\\') { quote = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) { out.push(cur.trim()); }
    return out;
  }

  // 列表项按下标取，不足时按 CSS 规则循环（值比层数少就重复）。
  function pick(list, i) {
    if (!list || list.length === 0) { return ''; }
    return list[i % list.length];
  }

  // ── 主背景数据缓存（工单 45）─────────────────────────────────────────────
  // 【为什么必须有】主背景的 background-image 里内联着 3.9 MB 的壁纸 data URI。实测两笔账：
  //   * `getComputedStyle(root).backgroundImage` 读一次 ≈ **19 ms**（把 4 MB 串序列化进 JS）；
  //   * 对它跑一遍 `splitBgList` ≈ **206 ms**（真机读数；本机 Node 跑同一份实现 190 ms）。
  //   而 apply() 原本**每次**都做这两件事。设置模态本身就是本文件的 5 个目标之一 ——
  //   它一打开「面」就存在，于是**任何** scroll（`scroll` 不冒泡，但窗口的**捕获**监听
  //   照样收得到内层滚动）或 DOM 变更都会触发 rAF 里的 apply()，每帧最多 0.25 s 主线程阻塞。
  //   用户 2026-10-18 报的「设置页滑动卡顿、自带皮肤不卡」就是这一条。
  //
  // 【失效判据】背景图只在**主题切换**时变，而主题切换必然至少改其中一项：
  //   documentElement 的 data-theme / data-appearance / data-appearance-mode，
  //   或 #themeSheet 的 href（apply.ps1 每次贴入都会换 ?v=）。故拿这三项 + 注入样式表
  //   是否还在做 key；key 变了才重读那 4 MB。
  //
  // 【为什么不加「签名不变就跳过整个 apply」的闸门】缓存在手后，一次 apply() 的剩余成本
  //   只有几次 getBoundingClientRect + 每面十来个 CSS 变量写入（亚毫秒），远低于一帧预算；
  //   再加一道签名闸门只会多一处「漏判则整块背景不更新」的风险。能证明够用了就停在这里。
  var rootCache = { el: null, key: '', image: '', kinds: null, sizeTok: null, posTok: null };

  function rootCacheKey() {
    var de = document.documentElement;
    var link = document.getElementById('themeSheet');
    return [
      de.getAttribute('data-theme') || '',
      de.getAttribute('data-appearance') || '',
      de.getAttribute('data-appearance-mode') || '',
      link ? (link.getAttribute('href') || '') : '',
      document.getElementById(STYLE_ID) ? 'sty' : 'nosty'
    ].join('|');
  }

  // 读一次重活（那 4 MB）并缓存。只有首次 / 主题或注入态变化时才真的读。
  function ensureRootBgCache(root) {
    var key = rootCacheKey();
    if (rootCache.el === root && rootCache.key === key && rootCache.kinds) { return rootCache; }

    var cs = null;
    try { cs = getComputedStyle(root); } catch (e) { return rootCache; }
    var raw = cs.backgroundImage || '';

    // 逐层分类：带 url( 的那层是照片，其余（渐变）是 scrim。
    // 照片层的下标必须**现找**，不能假设它总在固定位置。
    var layers = (raw && raw !== 'none') ? splitBgList(raw) : [];
    var kinds = [];
    var photoIdx = -1;
    for (var li = 0; li < layers.length; li++) {
      var isPhoto = layers[li].indexOf('url(') >= 0;
      kinds.push(isPhoto);
      if (isPhoto && photoIdx < 0) { photoIdx = li; }
    }
    if (layers.length === 0) { kinds = [true]; photoIdx = 0; }
    else if (photoIdx < 0) { photoIdx = 0; }

    rootCache.el = root;
    rootCache.key = key;
    rootCache.image = (raw !== 'none' && raw.indexOf('url(') >= 0) ? raw : '';
    rootCache.kinds = kinds;
    rootCache.sizeTok = String(pick(splitBgList(cs.backgroundSize), photoIdx) || 'cover').trim().split(/\s+/);
    rootCache.posTok = String(pick(splitBgList(cs.backgroundPosition), photoIdx) || 'center').trim().split(/\s+/);
    return rootCache;
  }

  // 从缓存的主背景数据 + root 当前矩形，算「图片那一层」的显示尺寸与原点（视口坐标）。
  // 原 readRootBgImage() 已删除：它唯一的用途是把那串 4 MB 交给注入样式表，
  // 现在那份串由 rootCache.image 提供（同一个字符串对象，`!==` 比较是常数时间）。
  function readRootGeom(root, c) {
    var r = root.getBoundingClientRect();
    var sizeTok = c.sizeTok;
    var posTok = c.posTok;
    var dw, dh;

    var s0 = sizeTok[0], s1 = sizeTok[1] || sizeTok[0];
    if (s0 === 'cover' || s1 === 'cover') {
      var sc = Math.max(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc; dh = IMG_H * sc;
    }
    else if (s0 === 'contain' || s1 === 'contain') {
      var sc2 = Math.min(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc2; dh = IMG_H * sc2;
    }
    else {
      dw = sizeOf(s0, r.width, IMG_W);
      dh = sizeOf(s1, r.height, IMG_H);
    }

    var ox = r.left + posOffsetOf(posTok[0], r.width, dw);
    var oy = r.top + posOffsetOf(posTok[1] || posTok[0], r.height, dh);

    return { rootRect: r, dw: dw, dh: dh, ox: ox, oy: oy, kinds: c.kinds };
  }

  // 解析 transform-origin（返回布局坐标下的 px 偏移）。
  function readOrigin(el, layoutW, layoutH) {
    var raw = '';
    try { raw = getComputedStyle(el).transformOrigin || ''; } catch (e) { return { x: layoutW / 2, y: layoutH / 2 }; }
    var parts = raw.trim().split(/\s+/);
    function one(tok, dim) {
      if (!tok) { return dim / 2; }
      if (tok.charAt(tok.length - 1) === '%') { return dim * (parseFloat(tok) / 100); }
      var n = parseFloat(tok);
      return isNaN(n) ? dim / 2 : n;
    }
    return { x: one(parts[0], layoutW), y: one(parts[1] || parts[0], layoutH) };
  }

  // 从计算样式的 transform 矩阵里取出 translate 与缩放分量。
  function readTransform(el) {
    var t = '';
    try { t = getComputedStyle(el).transform || ''; } catch (e) { return null; }
    if (!t || t === 'none') { return { tx: 0, ty: 0, s: 1 }; }
    var m = t.match(/^matrix\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(',').map(function (v) { return parseFloat(v); });
      if (p.length < 6 || p.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: p[4], ty: p[5], s: Math.abs(p[0]) || 1 };
    }
    var m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var q = m3[1].split(',').map(function (v) { return parseFloat(v); });
      if (q.length < 16 || q.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: q[12], ty: q[13], s: Math.abs(q[0]) || 1 };
    }
    return null;
  }

  // 取**布局**矩形（去掉入场动画的 transform）。
  // 为什么必须是布局矩形而不是视觉矩形：背景由 ::before 的**反相动画**补偿，
  // 合成后等价于「面板处在布局位置、没有 transform」—— 所以几何要按布局位置算。
  // 推导（origin 为 O，缩放 S，平移 T）：visualTopLeft = layoutTopLeft + T + O*(1-S)。
  function layoutRectOf(el) {
    var vr = el.getBoundingClientRect();
    var lw = el.offsetWidth || vr.width;
    var lh = el.offsetHeight || vr.height;
    var tf = readTransform(el);
    if (!tf) { return { left: vr.left, top: vr.top, width: vr.width, height: vr.height }; }
    var o = readOrigin(el, lw, lh);
    var k = 1 - tf.s;
    return {
      left: vr.left - tf.tx - o.x * k,
      top: vr.top - tf.ty - o.y * k,
      width: lw,
      height: lh,
    };
  }

  // 把背景图注入一条只设 background-image 的样式表（::before 无法设内联样式）。
  // 为什么不写进主题 CSS：那是 3.9 MB 的 data URI，写两份会让主题文件翻倍。
  function injectBgImage(bgImage) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      if (document.head) { document.head.appendChild(el); }
      else { return; }
    }
    var sel = TARGETS.map(beforeSelector).join(', ');
    var css = sel + ' { background-image: ' + bgImage + '; }';
    if (el.textContent !== css) { el.textContent = css; }
  }

  function apply() {
    // 主题门（2026-10-19）：本段只在自己主题下动手。
    // 为什么不能「两段都跑」：每段注入的图取自**当前 root 的背景图**，
    // 主题不匹配的那段会把别人的图写进自己的选择器里，切回自己主题时就是错图；
    // 两段的几何变量还同名（--hana-img-*），底图尺寸不同时会互相打架。
    if (document.documentElement.getAttribute('data-theme') !== THEME_ID) { return false; }
    var open = false;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 只在真有目标面要贴时才去读根节点的计算样式（getComputedStyle 不便宜）。
    var faces = [];
    for (var k = 0; k < TARGETS.length; k++) {
      var f = findFace(TARGETS[k]);
      if (f) { faces.push(f); }
    }
    if (faces.length === 0) { return false; }

    var root = document.querySelector('[data-chalkboard-root]');
    var c = root ? ensureRootBgCache(root) : null;
    if (c && c.image) { injectBgImage(c.image); }

    // c.kinds 为 null = 缓存没建起来（getComputedStyle 抛错 / 还没读到背景），
    // 这时和原实现一样返回 g = null，绝不让 sizeTok=null 漏进 readRootGeom。
    var g = (root && c && c.kinds) ? readRootGeom(root, c) : null;

    for (var i = 0; i < faces.length; i++) {
      var el = faces[i];
      // 尺寸一变就重算（自动化面板插入时尺寸会从中间态长到终态）。
      if (resizeObs && observedFaces && !observedFaces.has(el)) {
        observedFaces.add(el);
        resizeObs.observe(el);
      }

      var r = layoutRectOf(el);
      if (r.width === 0 || r.height === 0) {
        el.removeAttribute('data-hana-frame-ready');
        continue;
      }
      open = true;

      // 尺寸是否已定型（与上一帧相同）。**只用于第一次就绪的闸门**，见下方的就绪门。
      var sizeKey = el.offsetWidth + 'x' + el.offsetHeight;
      var settled = faceSize ? (faceSize.get(el) === sizeKey) : true;
      if (faceSize) { faceSize.set(el, sizeKey); }

      // ⚠️ ::before 的包含块是** padding box**（border 之内），而 layoutRectOf 给的是
      // border box（getBoundingClientRect）。面板外壳带 1px border 时（实测：自动化面板、
      // 设置卡、市场卡都有），变量必须再减掉 border 宽度，否则整张图偏 1px
      // （在照片底部渐变陡处会放大成 20+ 色阶的可见错位）。
      var bl = el.clientLeft || 0;   // = borderLeftWidth（clientLeft 就是 border 宽度）
      var bt = el.clientTop || 0;
      var originLeft = r.left + bl;
      var originTop = r.top + bt;

      // 量化到 0.01px，抹掉浮点噪声。
      function q(v) { return Math.round(v * 100) / 100; }

      if (g) {
        // 下面四个仍是「单层」语义的值，留着**仅供诊断**（CSS 已不再直接读它们，
        // 改由 --hana-before-size / --hana-before-pos 整体下发，见下）。
        el.style.setProperty('--hana-scrim-w', q(g.rootRect.width) + 'px');
        el.style.setProperty('--hana-scrim-h', q(g.rootRect.height) + 'px');
        el.style.setProperty('--hana-scrim-x', q(g.rootRect.left - originLeft) + 'px');
        el.style.setProperty('--hana-scrim-y', q(g.rootRect.top - originTop) + 'px');
        el.style.setProperty('--hana-img-w', q(g.dw) + 'px');
        el.style.setProperty('--hana-img-h', q(g.dh) + 'px');
        el.style.setProperty('--hana-img-x', q(g.ox - originLeft) + 'px');
        el.style.setProperty('--hana-img-y', q(g.oy - originTop) + 'px');

        // ── 逐层下发 background-size / -position（工单 44）──────────────────
        // 为什么不再写成 CSS 里那串固定 3 项的声明：
        //   原先 dark.css 写死「[scrim][scrim][图]」三组值去对主背景的
        //   「[左列 scrim][照片]」两层 —— 值是**按位置**对应的。2026-10-14 删掉主背景
        //   的底部 scrim 后层数从 3 降到 2，::before 却还是三项，于是第 2 个图（照片）
        //   取到第 2 项几何（= 视口 1920×1032），而照片自己的显示尺寸是 1920×1080：
        //   同一张图在面板里被纵向放大 4.65%，月亮跨面板边缘就错位一戟。
        //   实测：::before 算出 1920px 1032px / -481px -97px，变量里却是 1080px / -121px。
        //   现在直接按**主背景真实层数与类型**逐层生成，面板与主背景永远同构，
        //   以后增删背景层不需要再回来改这里（这是本坑第二次复发，不再靠“记得改第三处”）。
        var sizeParts = [], posParts = [];
        for (var gi = 0; gi < g.kinds.length; gi++) {
          if (g.kinds[gi]) {
            // 照片层：主背景的显示尺寸与原点
            sizeParts.push(q(g.dw) + 'px ' + q(g.dh) + 'px');
            posParts.push(q(g.ox - originLeft) + 'px ' + q(g.oy - originTop) + 'px');
          }
          else {
            // scrim（渐变）层：铺满主背景容器
            sizeParts.push(q(g.rootRect.width) + 'px ' + q(g.rootRect.height) + 'px');
            posParts.push(q(g.rootRect.left - originLeft) + 'px ' + q(g.rootRect.top - originTop) + 'px');
          }
        }
        el.style.setProperty('--hana-before-size', sizeParts.join(', '));
        el.style.setProperty('--hana-before-pos', posParts.join(', '));
      }

      // ── 原子就绪（工单 33 / 工单 34）─────────────────────────────────
      // 【工单 33 要解决的问题】图由 injectBgImage 注入的样式表提供，选择器是**全局**的 ——
      //   面一被找到就会被贴上；而几何变量要等 `g`（根几何）拿得到才写得出来。
      //   两者不同步时会出现「图已贴、位置变量还没写」的窗口，那一瞬 `::before` 用 CSS 兜底值
      //   `0px 0px` 定位 → 背景先错位、再跳到正确位置。
      //   解法：图只对带 `data-hana-frame-ready` 的面生效，该属性只在**本次已写好几何变量**时打上。
      //   于是「看得见图」⟺「变量是对的」，错位窗口不存在。
      //
      // 【工单 34】原实现错在两个字：**双向**。
      //   自动化是 `_stagePanelFramed` 变体，内层面插入后尺寸从 1120x960 长到 1318x996，
      //   而每一次「不就绪」的分支都会 `removeAttribute` —— 实测一次开面摘两次。
      //   更要紧的是**就绪之后**：真机上自动化面板的异步内容晚到，会再触发一次尺寸变化，
      //   于是标记被摘 → 图消失 → 下一帧又贴上 = **有图 → 空白 → 有图**。
      //   用户 2026-10-12 截的三张图就是这一幕（序列由他标定，上一张有图、中间一张整片平色、
      //   第三张又有图，且三张里壁纸位置逐像素重合）。
      //   复现与修复：探针 probe/t34-late.mjs（就绪后改尺寸）。
      //     旧：4/4 轮摘掉标记（`remove[有]`）+ 1 个无图帧；新：**0/4**。
      //   就绪应当是**单向闩锁**：原子性只在「图第一次生效」那一瞬需要；图已贴上之后，
      //   变量重写与图本来就在同一帧的样式重算里生效，摘图只会白造一次闪断。
      //
      //   而「尺寸已定型」这个闸门**保留**（只用于第一次就绪）—— 它管的是另一件事：
      //   面板成长中的几何算的是 1120x960 那一版（实测 imgX=-384px，终值 -361px，差 23px，
      //   因为尺寸变化时布局左边缘同时挪了 24px）。
      //   工单 34 试过「不等定型、先贴图」（同步 RO 让就绪落早），结果 t33-render 从 0/20
      //   变成 20/20 失败（有图帧带着中间态几何）—— 否决，见 resizeObs 处注释。
      if (g && (settled || el.hasAttribute('data-hana-frame-ready'))) {
        // 只写一次（闩锁语义写清楚，也免掉每次重算都发一条同值属性变更）。
        if (!el.hasAttribute('data-hana-frame-ready')) {
          el.setAttribute('data-hana-frame-ready', '');
        }
      }
      else {
        el.removeAttribute('data-hana-frame-ready');
        schedule();
      }
    }
    return open;
  }

  function tick() {
    raf = 0;
    apply();
  }

  // 面板出现 / 消失是 DOM 变化；视口变化要重算几何。
  // 注意：这里**没有**逐帧循环 —— 动画完全由 CSS 负责（见 dark.css），JS 不参与。
  function schedule() {
    if (raf) { return; }
    raf = window.requestAnimationFrame(tick);
  }

  // 重算时机（工单 31 / 32 反复踩出来的，顺序即优先级）：
  //   1) ResizeObserver（**最关键**，工单 32 新增）：面元素尺寸变化就重算。
  //      自动化面板插入时尺寸从 0 长到满，而 transform-origin 随尺寸变 —— 用旧 origin 反解
  //      会算出错的 layoutLeft，且之后无人重算（framed 变体外壳 `transition:none`，
  //      `transitionend` 不触发；`animationend` 要等 375ms）→ 背景偏 24px 并**跳变**一次，
  //      就是用户看到的「背景从左上往右下移动」。这一条直接对准根因。
  //   2) transitionend / animationend：兜底（另两个面板尺寸写死，第一帧就正确，用不上）。
  //   3) resize / scroll（视口）与 MutationObserver（面板出现 / 消失）。
  // 全部只重算、不逐帧，不会退回「追合成器」那条老路。
  function onSettle() { schedule(); }
  window.addEventListener('transitionend', onSettle, true);
  window.addEventListener('animationend', onSettle, true);

  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);

  if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  // 切主题只是改 <html data-theme>（上游 applyTheme 走 setAttribute，**不发事件**），
  // 属性变化不进上面那条 childList/subtree 观察 —— 必须单独盯属性，否则切到本主题后
  // 要等下一次滚动 / 开面板才重算，那期间面板上贴的还是上一个主题的图。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  schedule();
})();

/* hana-thinking-level: start */
/* 思考档位 -> 鲸鱼动作的信号源（2026-10-20，只服务 hana-claude-clay）
 * ---------------------------------------------------------------------------
 * 为什么需要这段 JS：CSS 只能对 DOM 上已经存在的东西做反应，而聊天区里
 * 没有「当前思考档位」这个信号（档位只存在应用的 store 与设置弹窗里，
 * [data-thinking-bloom] 附近没有任何档位属性）。所以这里把档位写到
 * <html data-hana-think="...">，视觉在 src/background-deepseek/dark.css 里按它换遮罩。
 *
 * 怎么拿档位：**不发自己的请求**，只嗅探应用自己打的
 *   GET/POST /api/session-thinking-level
 * 的响应（输入区在会话切换、打开设置时本来就会打它）。这样既不用碰鉴权，
 * 也不用猜 sessionPath —— 应用拿什么，我们就跟着拿什么。
 * 嗅探不到就一直不写属性，CSS 的默认分支（官方那条 APNG）照常工作。
 *
 * 失败/降级：wrap 出任何异常都吞掉并原样返回原来的 Response；
 * 档位不在白名单里（未来新增档位）一律忽略。 */
(function () {
  var GUARD = '__hanaThinkingLevel:hana-claude-clay';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  var THEME_ID = 'hana-claude-clay';
  var ATTR = 'data-hana-think';
  var KNOWN = { off: 1, auto: 1, low: 1, medium: 1, high: 1, xhigh: 1, max: 1 };
  var seen = null;

  function isOurTheme() {
    return document.documentElement.getAttribute('data-theme') === THEME_ID;
  }
  function apply(level) {
    if (typeof level !== 'string') { return; }
    var v = level.toLowerCase();
    if (!KNOWN[v] || v === seen) { return; }
    seen = v;
    if (isOurTheme()) { document.documentElement.setAttribute(ATTR, v); }
  }

  // 切主题只改 <html data-theme>（不发事件）：切到本主题时补写，切走时摘掉。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function () {
      var root = document.documentElement;
      if (root.getAttribute('data-theme') === THEME_ID) {
        if (seen) { root.setAttribute(ATTR, seen); }
      }
      else { root.removeAttribute(ATTR); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var p = origFetch.apply(this, arguments);
      try {
        var url = typeof input === 'string' ? input : ((input && input.url) || '');
        if (url.indexOf('/api/session-thinking-level') !== -1 && p && typeof p.then === 'function') {
          p.then(function (res) {
            try {
              res.clone().json().then(function (j) {
                if (j && j.thinkingLevel) { apply(String(j.thinkingLevel)); }
              }, function () {});
            } catch (e) { }
          }, function () { });
        }
      } catch (e) { }
      return p;
    };
  }
})();
/* hana-thinking-level: end */
/* hana-panel-frame:hana-luna */
/*
 * 浮层面板 · 取景框 —— 给面板的 ::before 提供几何与背景图。
 *
 * 由 scripts/apply.ps1 追加到 renderer 树 lib/theme.js 的末尾（幂等，见该脚本的
 * 「步骤 10c」）。视觉在 src/panel-frame/dark.css 里。
 *
 * ── 本文件只做三件事 ─────────────────────────────────────────────────────
 *   1. 从 [data-chalkboard-root] 的计算样式反推「背景图那一层」的显示尺寸与原点；
 *   2. 把两个 scrim 层与图片层的局部几何写成 CSS 变量（::before 继承）；
 *   3. 把背景图（3.9 MB 的 data URI）注入一条只设 background-image 的样式表。
 *
 * ── 为什么不再逐帧补偿动画 ───────────────────────────────────────────────
 *   曾经的实现：JS 每帧读 getComputedStyle(el).transform，算补偿值写进 CSS 变量。
 *   两个问题，第二个致命：
 *     1) 写变量会改 background-position → 主线程必须重绘那张 3.9 MB 的图；
 *     2) 入场动画跑在**合成器**线程，主线程一边重绘大图一边追，必然落后，
 *        于是背景按「上一帧的面板位置」补偿 → 真机表现为**朝反方向漂移**
 *        （用户反馈：「还是有抖动，这次是从右向左移了」）。
 *   现在改成：面板的入场动画与 ::before 的**反相动画**同时间轴、同样跑在合成器上
 *   （见 dark.css），合成后恒等，背景钉在屏幕上。JS 只在面板出现 / 视口变化时
 *   写一次**静态**几何，之后完全不参与 —— 没有「追」这回事，也就不会失步。
 *
 * ── 四个实测结论（决定了本文件与 dark.css 的形状）────────────────────────
 *   (1) 不能用 background-attachment: fixed
 *       元素带 transform 时 fixed 背景会被锚到**元素自己**而不是视口。
 *       （探针 probe/bg-attach-test.mjs：坐标编码图 + 像素解码。）
 *   (2) 图不能走 CSS 变量
 *       Chromium 对自定义属性的**值**有长度上限（1.5~2 MB），3.9 MB 的 data URI
 *       会被**静默丢弃**。故由本文件注入样式表提供。
 *       （探针 probe/len-limit.mjs / len-limit-js.mjs。）
 *   (3) 面板的图必须复现**主背景自己的渲染几何**，不能另立一套
 *       主背景是 `cover` + `center` + 视口坐标；第一版按「1:1 不缩放 + 屏幕坐标」
 *       定位，差三处（缩放 / 原点 / 基准），真机错位。
 *       （探针 probe/panel-bg-align.mjs。）
 *   (4) 主背景那串 background-image **不能每次重读**（工单 45）
 *       `getComputedStyle(root).backgroundImage` 读一次 ≈ 19 ms（4 MB 串序列化进 JS），
 *       对它跑一遍 splitBgList ≈ 190~206 ms。而 apply() 原本每帧都做这两件事 ——
 *       设置页/浮层面板一打开，滚动就变成每帧 0.25 s 主线程阻塞。故缓存，见 rootCache。
 *       （真机读数 .scratch/t45-jank/probe1.mjs；本机 Node 交叉验证 bench-split.mjs。）
 *
 * ── 变量（写在**可见圆角面**上，::before 继承）────────────────────────────
 *   --hana-scrim-w / -h / -x / -y   两个 scrim 层：铺满主背景容器
 *   --hana-img-w / -h / -x / -y     图片层：主背景的显示尺寸与原点
 *   四组都是**元素局部**值（相对 ::before 的盒子 = 面板的 padding box）。
 *   后者的语义是「图的 n% 点对齐容器的 n% 点」，与我们要的「绝对对齐」不是一回事。
 *
 * ── 主背景几何怎么算（与 [data-chalkboard-root] 的声明一一对应）──────────
 *   background-size: cover    -> scale = max(rw/W, rh/H)，显示 = (W*scale, H*scale)
 *                   contain  -> scale = min(rw/W, rh/H)
 *                   具体值    -> 直接用（% 按容器换算）
 *   background-position: center / 50%  -> 偏移 = (容器 - 显示) / 2
 *                        left/top    -> 0；right/bottom -> 容器 - 显示
 *                        n%          -> (容器 - 显示) * n%
 *
 * PoC 阶段做「卡片中心」#chalkboardCardCenterPanel；工单 31 扩到
 * 能力 #capabilitiesPanel / 自动化 #automationHubPanel 两个同组件面板，
 * 以及扩展（市场）模态与设置模态两张卡（面不是 floatingPanelInner）。
 * 每个目标的「面选择器」必须与 src/panel-frame/dark.css 的规则**保持一致**。
 */
(function () {
  // ⚠️ 守卫键**必须按主题区分**（2026-10-19 修）：apply.ps1 步骤 10c 把每个主题那段
  //    **链式追加**到同一个 lib/theme.js 末尾，各段若共用同一个 window 标记，
  //    **后追加的那段一进门就 return、整段永不执行**。真机症状：先贴的月满庭有背景图，
  //    后加的紫夜那五个面板全是实色（`::before` 的 background-image 读到 `none`）。
  var GUARD = '__hanaPanelFrame:hana-luna';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  // 目标表：kind 决定怎么找「可见圆角面」。面 = 背景 ::before 的宿主元素，
  // 也是几何变量的写入点（::before 继承）。
  //   panel    —— 浮层面板：外壳 id + 直接子 [class*="floatingPanelInner"]
  //   market   —— 扩展/市场模态：popup 壳（data-testid）+ 直接子 [class*="container"]
  //   settings —— 设置模态：data-input-ctx-zone="settings" 那张 zone 的**父**卡
  var TARGETS = [
    { kind: 'panel', id: 'chalkboardCardCenterPanel' },
    { kind: 'panel', id: 'capabilitiesPanel' },
    { kind: 'panel', id: 'automationHubPanel' },
    { kind: 'market' },
    { kind: 'settings' },
    { kind: 'confirm' }
  ];
  // 本段只服务这一个主题（另一个主题那段同驻同一个文件，靠 THEME_ID 与上面的 GUARD 区分）。
  var THEME_ID = 'hana-luna';
  var THEME = ':is([data-theme="' + THEME_ID + '"]) ';
  // 背景图的自然像素尺寸（本皮肤的固定资产：src/background/assets/moonlit-night.png）。
  var IMG_W = 1920;
  var IMG_H = 1080;
  var STYLE_ID = 'hana-panel-frame-bg';

  var raf = 0;
  // 已 observe 的面元素（避免重复 observe）。WeakSet：节点卸载后自动回收。
  var observedFaces = (typeof WeakSet === 'function') ? new WeakSet() : null;
  // 每个面元素「上一帧看到的尺寸」（工单 33）。只用于判定**第一次**就绪时尺寸是否已定型。
  var faceSize = (typeof WeakMap === 'function') ? new WeakMap() : null;
  // ResizeObserver：尺寸一变就重算。
  // ⚠️ 这里为什么**排 rAF**（`schedule()`）而不是同步 `apply()`（工单 34 实测过两版）：
  //   同步重算会让「连续两次 apply 尺寸相同」提前在**面板长大之前**的尺寸上满足，
  //   于是第一次就绪落早了 —— 图会带着中间态几何（imgX=-384px）被贴上。
  //   探针 t33-render 的「有图帧位置恒为终值」判据从 0/20 变成 **20/20 失败**。
  //   同步重算确实能在「布局之后、绘制之前」修正变量（按渲染步骤规范），
  //   但这一层节流下的采样粒度**证明不了**（rAF 与 setTimeout 双采样都分辨不出），
  //   而本项目不接受「按规范应该没问题」。故退回 rAF。
  var resizeObs = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { schedule(); }) : null;

  // 取直接子元素里的目标面（用 children 遍历，不用 querySelector ——
  // 后者可能返回后代，与 CSS 规则的直接子选择器选到不同节点）。
  function directChildMatching(shell, needle) {
    var kids = shell.children;
    for (var i = 0; i < kids.length; i++) {
      if (String(kids[i].className).indexOf(needle) >= 0) { return kids[i]; }
    }
    return null;
  }

  // 按目标类型找「面」。找不到返回 null。
  function findFace(t) {
    if (t.kind === 'panel') {
      var shell = document.getElementById(t.id);
      return shell ? directChildMatching(shell, 'floatingPanelInner') : null;
    }
    if (t.kind === 'market') {
      var popup = document.querySelector('[data-testid="market-modal-overlay"]');
      return popup ? directChildMatching(popup, 'container') : null;
    }
    if (t.kind === 'settings') {
      var zone = document.querySelector('[data-input-ctx-zone="settings"]');
      return zone ? zone.parentElement : null;
    }
    if (t.kind === 'confirm') {
      // 通用确认框（Us.confirm / base-ui AlertDialog）：面是 popup 壳的直接子元素。
      // 2026-10-24：用户要求这个弹窗也走取景框（「改成设置页面那种底」）。
      var ad = document.querySelector('[role="alertdialog"]');
      return ad ? directChildMatching(ad, '_dialog_') : null;
    }
    return null;
  }

  // 该目标面的 ::before 选择器（与 dark.css 里写的一致）。
  // ⚠️ 带 `[data-hana-frame-ready]`（工单 33）：图只对**已经写好几何变量**的面生效，
  // 保证「图出现」与「位置变量就绪」同一时刻，不会出现「图已贴、位置还是兜底 0px」的错位窗口。
  var READY = '[data-hana-frame-ready]';
  function beforeSelector(t) {
    if (t.kind === 'panel') {
      return THEME + '#' + t.id + ' > [class*="floatingPanelInner"]' + READY + '::before';
    }
    if (t.kind === 'market') {
      return THEME + '[data-testid="market-modal-overlay"] > [class*="container"]' + READY + '::before';
    }
    if (t.kind === 'confirm') {
      return THEME + '[role="alertdialog"] > [class*="_dialog_"]' + READY + '::before';
    }
    return THEME + ':has(> [data-input-ctx-zone="settings"])' + READY + '::before';
  }

  // 解析 background-size / background-position 的单个分量，返回 CSS px。
  function sizeOf(token, container, natural) {
    var t = String(token || '').trim();
    if (t === 'cover' || t === 'contain') { return null; }   // 交给调用方按两轴一起算
    if (t === 'auto') { return natural; }
    if (t.charAt(t.length - 1) === '%') { return container * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? natural : n;
  }

  function posOffsetOf(token, container, disp) {
    var t = String(token || 'center').trim();
    if (t === 'center' || t === '50%') { return (container - disp) / 2; }
    if (t === 'left' || t === 'top') { return 0; }
    if (t === 'right' || t === 'bottom') { return container - disp; }
    if (t.charAt(t.length - 1) === '%') { return (container - disp) * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? (container - disp) / 2 : n;
  }

  // 拆分 background-image / -size / -position 的**顶层**逗号列表。
  // 括号与引号内的逗号不算分隔符：gradient 里的 rgba()、url("data:...") 都带逗号。
  // 【工单 44】以前这里不用拆，全靠「主背景第 2 层是照片」这个硬编码假设 —— 层数一变
  //   就错位（见 dark.css 里那段关于「层下标」的注释）。现在改成逐层映射，不再数下标。
  function splitBgList(v) {
    var out = [], depth = 0, quote = null, cur = '';
    var s = String(v || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (quote) {
        cur += ch;
        if (ch === quote && s.charAt(i - 1) !== '\\') { quote = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) { out.push(cur.trim()); }
    return out;
  }

  // 列表项按下标取，不足时按 CSS 规则循环（值比层数少就重复）。
  function pick(list, i) {
    if (!list || list.length === 0) { return ''; }
    return list[i % list.length];
  }

  // ── 主背景数据缓存（工单 45）─────────────────────────────────────────────
  // 【为什么必须有】主背景的 background-image 里内联着 3.9 MB 的壁纸 data URI。实测两笔账：
  //   * `getComputedStyle(root).backgroundImage` 读一次 ≈ **19 ms**（把 4 MB 串序列化进 JS）；
  //   * 对它跑一遍 `splitBgList` ≈ **206 ms**（真机读数；本机 Node 跑同一份实现 190 ms）。
  //   而 apply() 原本**每次**都做这两件事。设置模态本身就是本文件的 5 个目标之一 ——
  //   它一打开「面」就存在，于是**任何** scroll（`scroll` 不冒泡，但窗口的**捕获**监听
  //   照样收得到内层滚动）或 DOM 变更都会触发 rAF 里的 apply()，每帧最多 0.25 s 主线程阻塞。
  //   用户 2026-10-18 报的「设置页滑动卡顿、自带皮肤不卡」就是这一条。
  //
  // 【失效判据】背景图只在**主题切换**时变，而主题切换必然至少改其中一项：
  //   documentElement 的 data-theme / data-appearance / data-appearance-mode，
  //   或 #themeSheet 的 href（apply.ps1 每次贴入都会换 ?v=）。故拿这三项 + 注入样式表
  //   是否还在做 key；key 变了才重读那 4 MB。
  //
  // 【为什么不加「签名不变就跳过整个 apply」的闸门】缓存在手后，一次 apply() 的剩余成本
  //   只有几次 getBoundingClientRect + 每面十来个 CSS 变量写入（亚毫秒），远低于一帧预算；
  //   再加一道签名闸门只会多一处「漏判则整块背景不更新」的风险。能证明够用了就停在这里。
  var rootCache = { el: null, key: '', image: '', kinds: null, sizeTok: null, posTok: null };

  function rootCacheKey() {
    var de = document.documentElement;
    var link = document.getElementById('themeSheet');
    return [
      de.getAttribute('data-theme') || '',
      de.getAttribute('data-appearance') || '',
      de.getAttribute('data-appearance-mode') || '',
      link ? (link.getAttribute('href') || '') : '',
      document.getElementById(STYLE_ID) ? 'sty' : 'nosty'
    ].join('|');
  }

  // 读一次重活（那 4 MB）并缓存。只有首次 / 主题或注入态变化时才真的读。
  function ensureRootBgCache(root) {
    var key = rootCacheKey();
    if (rootCache.el === root && rootCache.key === key && rootCache.kinds) { return rootCache; }

    var cs = null;
    try { cs = getComputedStyle(root); } catch (e) { return rootCache; }
    var raw = cs.backgroundImage || '';

    // 逐层分类：带 url( 的那层是照片，其余（渐变）是 scrim。
    // 照片层的下标必须**现找**，不能假设它总在固定位置。
    var layers = (raw && raw !== 'none') ? splitBgList(raw) : [];
    var kinds = [];
    var photoIdx = -1;
    for (var li = 0; li < layers.length; li++) {
      var isPhoto = layers[li].indexOf('url(') >= 0;
      kinds.push(isPhoto);
      if (isPhoto && photoIdx < 0) { photoIdx = li; }
    }
    if (layers.length === 0) { kinds = [true]; photoIdx = 0; }
    else if (photoIdx < 0) { photoIdx = 0; }

    rootCache.el = root;
    rootCache.key = key;
    rootCache.image = (raw !== 'none' && raw.indexOf('url(') >= 0) ? raw : '';
    rootCache.kinds = kinds;
    rootCache.sizeTok = String(pick(splitBgList(cs.backgroundSize), photoIdx) || 'cover').trim().split(/\s+/);
    rootCache.posTok = String(pick(splitBgList(cs.backgroundPosition), photoIdx) || 'center').trim().split(/\s+/);
    return rootCache;
  }

  // 从缓存的主背景数据 + root 当前矩形，算「图片那一层」的显示尺寸与原点（视口坐标）。
  // 原 readRootBgImage() 已删除：它唯一的用途是把那串 4 MB 交给注入样式表，
  // 现在那份串由 rootCache.image 提供（同一个字符串对象，`!==` 比较是常数时间）。
  function readRootGeom(root, c) {
    var r = root.getBoundingClientRect();
    var sizeTok = c.sizeTok;
    var posTok = c.posTok;
    var dw, dh;

    var s0 = sizeTok[0], s1 = sizeTok[1] || sizeTok[0];
    if (s0 === 'cover' || s1 === 'cover') {
      var sc = Math.max(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc; dh = IMG_H * sc;
    }
    else if (s0 === 'contain' || s1 === 'contain') {
      var sc2 = Math.min(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc2; dh = IMG_H * sc2;
    }
    else {
      dw = sizeOf(s0, r.width, IMG_W);
      dh = sizeOf(s1, r.height, IMG_H);
    }

    var ox = r.left + posOffsetOf(posTok[0], r.width, dw);
    var oy = r.top + posOffsetOf(posTok[1] || posTok[0], r.height, dh);

    return { rootRect: r, dw: dw, dh: dh, ox: ox, oy: oy, kinds: c.kinds };
  }

  // 解析 transform-origin（返回布局坐标下的 px 偏移）。
  function readOrigin(el, layoutW, layoutH) {
    var raw = '';
    try { raw = getComputedStyle(el).transformOrigin || ''; } catch (e) { return { x: layoutW / 2, y: layoutH / 2 }; }
    var parts = raw.trim().split(/\s+/);
    function one(tok, dim) {
      if (!tok) { return dim / 2; }
      if (tok.charAt(tok.length - 1) === '%') { return dim * (parseFloat(tok) / 100); }
      var n = parseFloat(tok);
      return isNaN(n) ? dim / 2 : n;
    }
    return { x: one(parts[0], layoutW), y: one(parts[1] || parts[0], layoutH) };
  }

  // 从计算样式的 transform 矩阵里取出 translate 与缩放分量。
  function readTransform(el) {
    var t = '';
    try { t = getComputedStyle(el).transform || ''; } catch (e) { return null; }
    if (!t || t === 'none') { return { tx: 0, ty: 0, s: 1 }; }
    var m = t.match(/^matrix\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(',').map(function (v) { return parseFloat(v); });
      if (p.length < 6 || p.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: p[4], ty: p[5], s: Math.abs(p[0]) || 1 };
    }
    var m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var q = m3[1].split(',').map(function (v) { return parseFloat(v); });
      if (q.length < 16 || q.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: q[12], ty: q[13], s: Math.abs(q[0]) || 1 };
    }
    return null;
  }

  // 取**布局**矩形（去掉入场动画的 transform）。
  // 为什么必须是布局矩形而不是视觉矩形：背景由 ::before 的**反相动画**补偿，
  // 合成后等价于「面板处在布局位置、没有 transform」—— 所以几何要按布局位置算。
  // 推导（origin 为 O，缩放 S，平移 T）：visualTopLeft = layoutTopLeft + T + O*(1-S)。
  function layoutRectOf(el) {
    var vr = el.getBoundingClientRect();
    var lw = el.offsetWidth || vr.width;
    var lh = el.offsetHeight || vr.height;
    var tf = readTransform(el);
    if (!tf) { return { left: vr.left, top: vr.top, width: vr.width, height: vr.height }; }
    var o = readOrigin(el, lw, lh);
    var k = 1 - tf.s;
    return {
      left: vr.left - tf.tx - o.x * k,
      top: vr.top - tf.ty - o.y * k,
      width: lw,
      height: lh,
    };
  }

  // 把背景图注入一条只设 background-image 的样式表（::before 无法设内联样式）。
  // 为什么不写进主题 CSS：那是 3.9 MB 的 data URI，写两份会让主题文件翻倍。
  function injectBgImage(bgImage) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      if (document.head) { document.head.appendChild(el); }
      else { return; }
    }
    var sel = TARGETS.map(beforeSelector).join(', ');
    var css = sel + ' { background-image: ' + bgImage + '; }';
    if (el.textContent !== css) { el.textContent = css; }
  }

  function apply() {
    // 主题门（2026-10-19）：本段只在自己主题下动手。
    // 为什么不能「两段都跑」：每段注入的图取自**当前 root 的背景图**，
    // 主题不匹配的那段会把别人的图写进自己的选择器里，切回自己主题时就是错图；
    // 两段的几何变量还同名（--hana-img-*），底图尺寸不同时会互相打架。
    if (document.documentElement.getAttribute('data-theme') !== THEME_ID) { return false; }
    var open = false;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 只在真有目标面要贴时才去读根节点的计算样式（getComputedStyle 不便宜）。
    var faces = [];
    for (var k = 0; k < TARGETS.length; k++) {
      var f = findFace(TARGETS[k]);
      if (f) { faces.push(f); }
    }
    if (faces.length === 0) { return false; }

    var root = document.querySelector('[data-chalkboard-root]');
    var c = root ? ensureRootBgCache(root) : null;
    if (c && c.image) { injectBgImage(c.image); }

    // c.kinds 为 null = 缓存没建起来（getComputedStyle 抛错 / 还没读到背景），
    // 这时和原实现一样返回 g = null，绝不让 sizeTok=null 漏进 readRootGeom。
    var g = (root && c && c.kinds) ? readRootGeom(root, c) : null;

    for (var i = 0; i < faces.length; i++) {
      var el = faces[i];
      // 尺寸一变就重算（自动化面板插入时尺寸会从中间态长到终态）。
      if (resizeObs && observedFaces && !observedFaces.has(el)) {
        observedFaces.add(el);
        resizeObs.observe(el);
      }

      var r = layoutRectOf(el);
      if (r.width === 0 || r.height === 0) {
        el.removeAttribute('data-hana-frame-ready');
        continue;
      }
      open = true;

      // 尺寸是否已定型（与上一帧相同）。**只用于第一次就绪的闸门**，见下方的就绪门。
      var sizeKey = el.offsetWidth + 'x' + el.offsetHeight;
      var settled = faceSize ? (faceSize.get(el) === sizeKey) : true;
      if (faceSize) { faceSize.set(el, sizeKey); }

      // ⚠️ ::before 的包含块是** padding box**（border 之内），而 layoutRectOf 给的是
      // border box（getBoundingClientRect）。面板外壳带 1px border 时（实测：自动化面板、
      // 设置卡、市场卡都有），变量必须再减掉 border 宽度，否则整张图偏 1px
      // （在照片底部渐变陡处会放大成 20+ 色阶的可见错位）。
      var bl = el.clientLeft || 0;   // = borderLeftWidth（clientLeft 就是 border 宽度）
      var bt = el.clientTop || 0;
      var originLeft = r.left + bl;
      var originTop = r.top + bt;

      // 量化到 0.01px，抹掉浮点噪声。
      function q(v) { return Math.round(v * 100) / 100; }

      if (g) {
        // 下面四个仍是「单层」语义的值，留着**仅供诊断**（CSS 已不再直接读它们，
        // 改由 --hana-before-size / --hana-before-pos 整体下发，见下）。
        el.style.setProperty('--hana-scrim-w', q(g.rootRect.width) + 'px');
        el.style.setProperty('--hana-scrim-h', q(g.rootRect.height) + 'px');
        el.style.setProperty('--hana-scrim-x', q(g.rootRect.left - originLeft) + 'px');
        el.style.setProperty('--hana-scrim-y', q(g.rootRect.top - originTop) + 'px');
        el.style.setProperty('--hana-img-w', q(g.dw) + 'px');
        el.style.setProperty('--hana-img-h', q(g.dh) + 'px');
        el.style.setProperty('--hana-img-x', q(g.ox - originLeft) + 'px');
        el.style.setProperty('--hana-img-y', q(g.oy - originTop) + 'px');

        // ── 逐层下发 background-size / -position（工单 44）──────────────────
        // 为什么不再写成 CSS 里那串固定 3 项的声明：
        //   原先 dark.css 写死「[scrim][scrim][图]」三组值去对主背景的
        //   「[左列 scrim][照片]」两层 —— 值是**按位置**对应的。2026-10-14 删掉主背景
        //   的底部 scrim 后层数从 3 降到 2，::before 却还是三项，于是第 2 个图（照片）
        //   取到第 2 项几何（= 视口 1920×1032），而照片自己的显示尺寸是 1920×1080：
        //   同一张图在面板里被纵向放大 4.65%，月亮跨面板边缘就错位一戟。
        //   实测：::before 算出 1920px 1032px / -481px -97px，变量里却是 1080px / -121px。
        //   现在直接按**主背景真实层数与类型**逐层生成，面板与主背景永远同构，
        //   以后增删背景层不需要再回来改这里（这是本坑第二次复发，不再靠“记得改第三处”）。
        var sizeParts = [], posParts = [];
        for (var gi = 0; gi < g.kinds.length; gi++) {
          if (g.kinds[gi]) {
            // 照片层：主背景的显示尺寸与原点
            sizeParts.push(q(g.dw) + 'px ' + q(g.dh) + 'px');
            posParts.push(q(g.ox - originLeft) + 'px ' + q(g.oy - originTop) + 'px');
          }
          else {
            // scrim（渐变）层：铺满主背景容器
            sizeParts.push(q(g.rootRect.width) + 'px ' + q(g.rootRect.height) + 'px');
            posParts.push(q(g.rootRect.left - originLeft) + 'px ' + q(g.rootRect.top - originTop) + 'px');
          }
        }
        el.style.setProperty('--hana-before-size', sizeParts.join(', '));
        el.style.setProperty('--hana-before-pos', posParts.join(', '));
      }

      // ── 原子就绪（工单 33 / 工单 34）─────────────────────────────────
      // 【工单 33 要解决的问题】图由 injectBgImage 注入的样式表提供，选择器是**全局**的 ——
      //   面一被找到就会被贴上；而几何变量要等 `g`（根几何）拿得到才写得出来。
      //   两者不同步时会出现「图已贴、位置变量还没写」的窗口，那一瞬 `::before` 用 CSS 兜底值
      //   `0px 0px` 定位 → 背景先错位、再跳到正确位置。
      //   解法：图只对带 `data-hana-frame-ready` 的面生效，该属性只在**本次已写好几何变量**时打上。
      //   于是「看得见图」⟺「变量是对的」，错位窗口不存在。
      //
      // 【工单 34】原实现错在两个字：**双向**。
      //   自动化是 `_stagePanelFramed` 变体，内层面插入后尺寸从 1120x960 长到 1318x996，
      //   而每一次「不就绪」的分支都会 `removeAttribute` —— 实测一次开面摘两次。
      //   更要紧的是**就绪之后**：真机上自动化面板的异步内容晚到，会再触发一次尺寸变化，
      //   于是标记被摘 → 图消失 → 下一帧又贴上 = **有图 → 空白 → 有图**。
      //   用户 2026-10-12 截的三张图就是这一幕（序列由他标定，上一张有图、中间一张整片平色、
      //   第三张又有图，且三张里壁纸位置逐像素重合）。
      //   复现与修复：探针 probe/t34-late.mjs（就绪后改尺寸）。
      //     旧：4/4 轮摘掉标记（`remove[有]`）+ 1 个无图帧；新：**0/4**。
      //   就绪应当是**单向闩锁**：原子性只在「图第一次生效」那一瞬需要；图已贴上之后，
      //   变量重写与图本来就在同一帧的样式重算里生效，摘图只会白造一次闪断。
      //
      //   而「尺寸已定型」这个闸门**保留**（只用于第一次就绪）—— 它管的是另一件事：
      //   面板成长中的几何算的是 1120x960 那一版（实测 imgX=-384px，终值 -361px，差 23px，
      //   因为尺寸变化时布局左边缘同时挪了 24px）。
      //   工单 34 试过「不等定型、先贴图」（同步 RO 让就绪落早），结果 t33-render 从 0/20
      //   变成 20/20 失败（有图帧带着中间态几何）—— 否决，见 resizeObs 处注释。
      if (g && (settled || el.hasAttribute('data-hana-frame-ready'))) {
        // 只写一次（闩锁语义写清楚，也免掉每次重算都发一条同值属性变更）。
        if (!el.hasAttribute('data-hana-frame-ready')) {
          el.setAttribute('data-hana-frame-ready', '');
        }
      }
      else {
        el.removeAttribute('data-hana-frame-ready');
        schedule();
      }
    }
    return open;
  }

  function tick() {
    raf = 0;
    apply();
  }

  // 面板出现 / 消失是 DOM 变化；视口变化要重算几何。
  // 注意：这里**没有**逐帧循环 —— 动画完全由 CSS 负责（见 dark.css），JS 不参与。
  function schedule() {
    if (raf) { return; }
    raf = window.requestAnimationFrame(tick);
  }

  // 重算时机（工单 31 / 32 反复踩出来的，顺序即优先级）：
  //   1) ResizeObserver（**最关键**，工单 32 新增）：面元素尺寸变化就重算。
  //      自动化面板插入时尺寸从 0 长到满，而 transform-origin 随尺寸变 —— 用旧 origin 反解
  //      会算出错的 layoutLeft，且之后无人重算（framed 变体外壳 `transition:none`，
  //      `transitionend` 不触发；`animationend` 要等 375ms）→ 背景偏 24px 并**跳变**一次，
  //      就是用户看到的「背景从左上往右下移动」。这一条直接对准根因。
  //   2) transitionend / animationend：兜底（另两个面板尺寸写死，第一帧就正确，用不上）。
  //   3) resize / scroll（视口）与 MutationObserver（面板出现 / 消失）。
  // 全部只重算、不逐帧，不会退回「追合成器」那条老路。
  function onSettle() { schedule(); }
  window.addEventListener('transitionend', onSettle, true);
  window.addEventListener('animationend', onSettle, true);

  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);

  if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  // 切主题只是改 <html data-theme>（上游 applyTheme 走 setAttribute，**不发事件**），
  // 属性变化不进上面那条 childList/subtree 观察 —— 必须单独盯属性，否则切到本主题后
  // 要等下一次滚动 / 开面板才重算，那期间面板上贴的还是上一个主题的图。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  schedule();
})();
