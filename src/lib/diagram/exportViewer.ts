/**
 * A single HTML file that shows the exported pictures with tabs, pan and zoom, so a reviewer can look around
 * a large landscape without Building Block, an account or a network connection. The pictures are the SVG
 * exports, embedded as images (so nothing in a diagram can run as script in the page), and the page's own script
 * has no external references.
 */

import type { Branding } from "./types";

export interface ViewerPage {
  label: string;
  /** The exported SVG, as text. */
  svg: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The picture's size from its root element, which renderSvg always sets. */
function svgSize(svg: string): { width: number; height: number } {
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const read = (name: string) => Number(root.match(new RegExp(`\\s${name}="([\\d.]+)"`))?.[1]);
  const width = read("width");
  const height = read("height");
  return { width: width > 0 ? width : 800, height: height > 0 ? height : 600 };
}

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#171717;--muted:#52525b;--line:#d4d4d8;--panel:#f4f4f5}
:root.dark{--bg:#0a0a0a;--fg:#ededed;--muted:#a1a1aa;--line:#3f3f46;--panel:#18181b}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{display:flex;flex-direction:column;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
header{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--panel)}
h1{margin:0;font-size:15px}
nav{display:flex;flex-wrap:wrap;gap:4px}
button{font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:6px;padding:4px 10px;cursor:pointer}
button:hover{background:var(--bg)}
button[aria-selected=true]{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.zoom{margin-left:auto;display:flex;gap:4px;align-items:center}
.zoom span{min-width:3.5em;text-align:center;color:var(--muted)}
main{position:relative;flex:1;overflow:hidden;touch-action:none;cursor:grab}
main.dragging{cursor:grabbing}
main img{position:absolute;left:0;top:0;transform-origin:0 0;max-width:none;user-select:none;-webkit-user-drag:none}
.logo{height:28px;width:auto}
footer{padding:4px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
`;

// Plain strings only (no template placeholders), so the script reads as it runs.
const SCRIPT = `
(function(){
  var stage=document.querySelector('main');
  var tabs=[].slice.call(document.querySelectorAll('[role=tab]'));
  var imgs=[].slice.call(stage.querySelectorAll('img'));
  var label=document.getElementById('zoom-level');
  var views=imgs.map(function(){return null;});
  var current=0;
  function apply(){
    var v=views[current],img=imgs[current];
    img.style.transform='translate('+v.x+'px,'+v.y+'px) scale('+v.k+')';
    label.textContent=Math.round(v.k*100)+'%';
  }
  function fit(){
    var img=imgs[current],w=+img.getAttribute('width'),h=+img.getAttribute('height');
    var k=Math.min(stage.clientWidth/w,stage.clientHeight/h,1);
    views[current]={k:k,x:(stage.clientWidth-w*k)/2,y:(stage.clientHeight-h*k)/2};
    apply();
  }
  function zoomAt(factor,cx,cy){
    var v=views[current],k=Math.max(0.05,Math.min(8,v.k*factor));
    v.x=cx-(cx-v.x)*(k/v.k);v.y=cy-(cy-v.y)*(k/v.k);v.k=k;apply();
  }
  function show(i){
    current=i;
    imgs.forEach(function(img,n){img.hidden=n!==i;});
    tabs.forEach(function(tab,n){tab.setAttribute('aria-selected',String(n===i));});
    if(!views[i])fit();else apply();
  }
  tabs.forEach(function(tab,n){tab.addEventListener('click',function(){show(n);});});
  function centre(){var r=stage.getBoundingClientRect();return [r.width/2,r.height/2];}
  document.getElementById('zoom-in').addEventListener('click',function(){var c=centre();zoomAt(1.25,c[0],c[1]);});
  document.getElementById('zoom-out').addEventListener('click',function(){var c=centre();zoomAt(0.8,c[0],c[1]);});
  document.getElementById('zoom-fit').addEventListener('click',fit);
  stage.addEventListener('wheel',function(e){
    e.preventDefault();
    var r=stage.getBoundingClientRect();
    if(e.ctrlKey||e.metaKey){zoomAt(Math.exp(-e.deltaY*0.01),e.clientX-r.left,e.clientY-r.top);}
    else{var v=views[current];v.x-=e.deltaX;v.y-=e.deltaY;apply();}
  },{passive:false});
  var pointers={},last=null;
  stage.addEventListener('pointerdown',function(e){
    pointers[e.pointerId]={x:e.clientX,y:e.clientY};
    stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');last=null;
  });
  stage.addEventListener('pointermove',function(e){
    var p=pointers[e.pointerId];if(!p)return;
    var ids=Object.keys(pointers),v=views[current];
    if(ids.length===2){
      var o=pointers[ids[0]==e.pointerId?ids[1]:ids[0]];
      var before=Math.hypot(p.x-o.x,p.y-o.y);
      var after=Math.hypot(e.clientX-o.x,e.clientY-o.y);
      var r=stage.getBoundingClientRect();
      if(before>0)zoomAt(after/before,(e.clientX+o.x)/2-r.left,(e.clientY+o.y)/2-r.top);
    }else{v.x+=e.clientX-p.x;v.y+=e.clientY-p.y;apply();}
    p.x=e.clientX;p.y=e.clientY;
  });
  function release(e){delete pointers[e.pointerId];if(!Object.keys(pointers).length)stage.classList.remove('dragging');}
  stage.addEventListener('pointerup',release);
  stage.addEventListener('pointercancel',release);
  window.addEventListener('keydown',function(e){
    var c=centre();
    if(e.key==='+'||e.key==='=')zoomAt(1.25,c[0],c[1]);
    else if(e.key==='-')zoomAt(0.8,c[0],c[1]);
    else if(e.key==='0')fit();
    else if(e.key==='ArrowRight'&&tabs.length>1)show((current+1)%tabs.length);
    else if(e.key==='ArrowLeft'&&tabs.length>1)show((current+tabs.length-1)%tabs.length);
  });
  window.addEventListener('resize',fit);
  show(0);
})();
`;

/** The viewer page for `pages` (at least one), titled `title`; `dark` picks the page's colours. */
export function buildViewerHtml(title: string, pages: ViewerPage[], dark: boolean, branding?: Branding): string {
  const safeTitle = escapeHtml(title);
  // Both were checked when the diagram was read (a hex colour, a PNG/JPEG/WebP data address); this doesn't rely on that.
  const accent = branding?.color && /^#[0-9a-f]{6}$/i.test(branding.color) ? branding.color : null;
  const logo = branding?.logo && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(branding.logo) ? branding.logo : null;
  const tabs =
    pages.length > 1
      ? `<nav role="tablist" aria-label="Views">${pages
          .map((page, index) => `<button type="button" role="tab" aria-selected="${index === 0}">${escapeHtml(page.label)}</button>`)
          .join("")}</nav>`
      : `<nav role="tablist" hidden><button type="button" role="tab" aria-selected="true">${escapeHtml(pages[0].label)}</button></nav>`;
  const images = pages
    .map((page) => {
      const { width, height } = svgSize(page.svg);
      const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(page.svg)}`;
      return `<img alt="${escapeHtml(`${title}: ${page.label}`)}" width="${width}" height="${height}" src="${uri}" hidden>`;
    })
    .join("");
  return (
    `<!doctype html>\n<html lang="en"${dark ? ' class="dark"' : ""}>\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${safeTitle}</title>\n<style>${STYLE}</style>\n</head>\n<body>\n` +
    `<header${accent ? ` style="border-top:4px solid ${accent}"` : ""}>${logo ? `<img class="logo" alt="" src="${logo}">` : ""}<h1>${safeTitle}</h1>${tabs}` +
    `<div class="zoom"><button type="button" id="zoom-out" aria-label="Zoom out">−</button><span id="zoom-level" aria-live="polite">100%</span>` +
    `<button type="button" id="zoom-in" aria-label="Zoom in">+</button><button type="button" id="zoom-fit">Fit</button></div></header>\n` +
    `<main aria-label="Diagram">${images}</main>\n` +
    `<footer>Drag to move · scroll or pinch to zoom · + − 0 keys${pages.length > 1 ? " · ← → for the next view" : ""}</footer>\n` +
    `<script>${SCRIPT}</script>\n</body>\n</html>\n`
  );
}
