/* =====================================================================
   Mirage v0.4
   - model is integer grid cells {cx,cy,cw,ch}
   - export reads the live CSSOM so output matches the preview exactly
   - text is edited in the preview, not in a side panel
   - projects persist in IndexedDB, no account, no server
   ===================================================================== */
(() => {
'use strict';

const TYPES = [
  ['nav','Nav bar'],['hero','Hero'],['cards','Card grid'],['text','Text block'],
  ['image','Image'],['gallery','Gallery'],['sidebar','Side nav'],['stats','Stat row'],
  ['logos','Logo row'],['quote','Quote'],['form','Form'],['table','Table'],
  ['tabs','Tabs'],['price','Pricing'],['banner','CTA banner'],['code','Code block'],
  ['button','Button'],['footer','Footer'],
];
const NICE  = Object.fromEntries(TYPES);
const MULTI = ['cards','stats','logos','gallery','price'];
const SHAPED = ['cards','image','gallery','price'];

const SHAPES = [['rect','Square'],['round','Rounded'],['pill','Pill'],
                ['circle','Circle'],['squircle','Squircle'],['cut','Cut corner']];
const VARIANTS = [['primary','Primary'],['secondary','Secondary'],['ghost','Ghost'],
                  ['pill','Pill'],['link','Link'],['group','Button group']];

let boxes = [], COLS = 12, MINROWS = 26, sel = -1;
let showLabels = true, dark = false, theme = '', devW = 0, fmt = 'html';
let hist = [], hi = -1;
let project = { id:null, name:'Untitled sketch' };
let saveTimer = null, suppressRender = false;

const $ = id => document.getElementById(id);
const clone = v => JSON.parse(JSON.stringify(v));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ============================================================ history */
function push(){
  hist = hist.slice(0, hi+1);
  hist.push(clone(boxes));
  if(hist.length > 90) hist.shift();
  hi = hist.length-1;
  syncHist(); scheduleSave();
}
function syncHist(){
  $('bUndo').disabled = hi <= 0;
  $('bRedo').disabled = hi >= hist.length-1;
}
function undo(){ if(hi>0){ hi--; boxes=clone(hist[hi]); sel=-1; commit(false); syncHist(); } }
function redo(){ if(hi<hist.length-1){ hi++; boxes=clone(hist[hi]); sel=-1; commit(false); syncHist(); } }

/* ============================================================ geometry */
function bottomMost(){ return boxes.reduce((m,b)=>Math.max(m,b.cy+b.ch), 0); }
function surfaceRows(){ return Math.max(MINROWS, bottomMost()+6); }
function overlaps(a,b){
  return a.cx < b.cx+b.cw && b.cx < a.cx+a.cw && a.cy < b.cy+b.ch && b.cy < a.cy+a.ch;
}
function collides(rect, skip){
  for(let i=0;i<boxes.length;i++){ if(i===skip) continue; if(overlaps(rect,boxes[i])) return true; }
  return false;
}
function tryPlace(idx, want){
  const b = boxes[idx];
  for(const a of [want,
      {cx:want.cx, cy:b.cy, cw:want.cw, ch:want.ch},
      {cx:b.cx, cy:want.cy, cw:want.cw, ch:want.ch}]){
    if(a.cx<0 || a.cy<0 || a.cx+a.cw>COLS || a.cw<1 || a.ch<1) continue;
    if(!collides(a, idx)){ Object.assign(b,a); return true; }
  }
  return false;
}

/* ============================================================ canvas */
const cv = $('sk'), ctx = cv.getContext('2d'), scroller = $('scroll');
let W=0,H=0,cell=0,DPR=Math.min(devicePixelRatio||1,2);

function resize(){
  const r = scroller.getBoundingClientRect();
  W = r.width; cell = W/COLS; H = surfaceRows()*cell;
  cv.style.height = H+'px';
  cv.width  = Math.max(1, Math.round(W*DPR));
  cv.height = Math.max(1, Math.round(H*DPR));
  ctx.setTransform(DPR,0,0,DPR,0,0);
  paint();
}
new ResizeObserver(resize).observe(scroller);
const px = b => ({x:b.cx*cell, y:b.cy*cell, w:b.cw*cell, h:b.ch*cell});
function cssv(v){ return getComputedStyle(document.body).getPropertyValue(v).trim(); }
function jit(i,s){ return ((Math.sin(i*12.9898+s*78.233)*43758.5453)%1)*1.6; }
function shaky(x,y,w,h){
  ctx.beginPath();
  const p=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
  for(let e=0;e<4;e++){
    const a=p[e], b=p[e+1];
    const seg=Math.max(2, Math.hypot(b[0]-a[0], b[1]-a[1])/24|0);
    if(e===0) ctx.moveTo(a[0],a[1]);
    for(let i=1;i<=seg;i++){
      const t=i/seg;
      ctx.lineTo(a[0]+(b[0]-a[0])*t+(i<seg?jit(i,a[0]+e):0),
                 a[1]+(b[1]-a[1])*t+(i<seg?jit(i,a[1]+e):0));
    }
  }
  ctx.stroke();
}
let drawing=null, guides=[];

function paint(){
  const g1=cssv('--sk-g1'), g2=cssv('--sk-g2'), inkc=cssv('--sk-ink');
  ctx.clearRect(0,0,W,H);
  const rows=Math.ceil(H/cell), M=4;

  ctx.globalAlpha=.45; ctx.strokeStyle=g2; ctx.lineWidth=1; ctx.beginPath();
  for(let r=1;r<rows;r++){ if(r%M===0) continue; const y=Math.round(r*cell)+.5; ctx.moveTo(0,y); ctx.lineTo(W,y); }
  for(let c=1;c<COLS;c++){ if(c%M===0) continue; const x=Math.round(c*cell)+.5; ctx.moveTo(x,0); ctx.lineTo(x,H); }
  ctx.stroke();
  ctx.globalAlpha=.9; ctx.strokeStyle=g1; ctx.beginPath();
  for(let r=M;r<rows;r+=M){ const y=Math.round(r*cell)+.5; ctx.moveTo(0,y); ctx.lineTo(W,y); }
  for(let c=M;c<COLS;c+=M){ const x=Math.round(c*cell)+.5; ctx.moveTo(x,0); ctx.lineTo(x,H); }
  ctx.stroke();
  ctx.globalAlpha=1; ctx.fillStyle=g1;
  for(let r=0;r<=rows;r++) for(let c=0;c<=COLS;c++){
    const x=Math.round(c*cell), y=Math.round(r*cell), mj=(r%M===0&&c%M===0);
    ctx.fillRect(x-(mj?1:.5), y-(mj?1:.5), mj?2:1, mj?2:1);
  }
  ctx.globalAlpha=.55; ctx.strokeStyle=g1; ctx.strokeRect(.5,.5,W-1,H-1);
  ctx.globalAlpha=1;

  const info = classify();
  info.rows.forEach(row=>{
    if(row.items.length<2) return;
    const t=row.top*cell, b=row.bottom*cell;
    ctx.fillStyle='rgba(31,95,139,.05)'; ctx.fillRect(0,t-3,W,(b-t)+6);
    ctx.strokeStyle='rgba(31,95,139,.30)'; ctx.setLineDash([4,4]); ctx.beginPath();
    ctx.moveTo(0,t-3); ctx.lineTo(W,t-3); ctx.moveTo(0,b+3); ctx.lineTo(W,b+3); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(31,95,139,.75)'; ctx.font='500 9px "IBM Plex Mono", monospace';
    ctx.textAlign='right'; ctx.fillText('ROW · '+row.items.length+' across', W-6, t+10);
    ctx.textAlign='left';
  });

  info.list.forEach((b,i)=>{
    const g=px(b), isSel=i===sel;
    ctx.fillStyle = isSel?'rgba(239,196,74,.22)':'rgba(31,95,139,.09)';
    ctx.fillRect(g.x,g.y,g.w,g.h);
    ctx.strokeStyle = isSel?'#EFC44A':(b.locked?'#1F5F8B':inkc);
    ctx.lineWidth   = isSel?2.2:(b.locked?1.8:1.4);
    if(b.shape==='circle' || b.shape==='pill'){
      ctx.beginPath();
      const rr = b.shape==='circle' ? Math.min(g.w,g.h)/2 : Math.min(g.w,g.h)/2;
      if(b.shape==='circle') ctx.ellipse(g.x+g.w/2,g.y+g.h/2,g.w/2,g.h/2,0,0,6.283);
      else { ctx.roundRect ? ctx.roundRect(g.x,g.y,g.w,g.h,rr) : ctx.rect(g.x,g.y,g.w,g.h); }
      ctx.stroke();
    } else shaky(g.x,g.y,g.w,g.h);

    if(b.cells>1){
      ctx.strokeStyle='rgba(127,140,155,.85)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
      for(let k=1;k<b.cells;k++){ ctx.beginPath(); const x=g.x+(g.w/b.cells)*k;
        ctx.moveTo(x,g.y+5); ctx.lineTo(x,g.y+g.h-5); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    if(!b.locked && b.conf<.55){
      ctx.fillStyle='#D9843F'; ctx.beginPath(); ctx.arc(g.x+g.w-9,g.y+9,3.2,0,6.283); ctx.fill();
    }
    if(showLabels && g.h>18){
      const lb=NICE[b.type]+(b.cells>1?' \u00d7'+b.cells:'');
      ctx.font='500 10px "IBM Plex Mono", monospace';
      const tw=ctx.measureText(lb).width, ly=Math.max(0,g.y-15);
      ctx.fillStyle=isSel?'#EFC44A':(b.locked?'#1F5F8B':inkc);
      ctx.fillRect(g.x,ly,tw+12,15);
      ctx.fillStyle=isSel?'#141C22':(dark?'#0E1418':'#E2E7EB');
      ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText(lb,g.x+6,ly+7.5);
      ctx.fillStyle='rgba(127,140,155,.95)'; ctx.font='400 9px "IBM Plex Mono", monospace';
      ctx.textAlign='right'; ctx.fillText(b.cw+'\u00d7'+b.ch, g.x+g.w-5, g.y+g.h-6);
      ctx.textAlign='left';
    }
    if(isSel){
      ctx.fillStyle='#EFC44A'; ctx.strokeStyle=inkc; ctx.lineWidth=1;
      handles(b).forEach(h=>{ ctx.fillRect(h.x-4,h.y-4,8,8); ctx.strokeRect(h.x-4,h.y-4,8,8); });
    }
  });

  guides.forEach(gd=>{
    ctx.strokeStyle='#EFC44A'; ctx.lineWidth=1; ctx.setLineDash([3,3]); ctx.beginPath();
    if(gd.v){ ctx.moveTo(gd.p,0); ctx.lineTo(gd.p,H); } else { ctx.moveTo(0,gd.p); ctx.lineTo(W,gd.p); }
    ctx.stroke(); ctx.setLineDash([]);
  });
  if(drawing){
    const r=drawRect();
    ctx.strokeStyle='#EFC44A'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
    ctx.strokeRect(r.cx*cell,r.cy*cell,r.cw*cell,r.ch*cell); ctx.setLineDash([]);
    ctx.fillStyle='rgba(127,140,155,.95)'; ctx.font='400 9px "IBM Plex Mono", monospace';
    ctx.fillText(r.cw+'\u00d7'+r.ch, r.cx*cell+4, Math.max(9,r.cy*cell-5));
  }
}
function handles(b){
  const g=px(b);
  return [{id:'nw',x:g.x,y:g.y},{id:'n',x:g.x+g.w/2,y:g.y},{id:'ne',x:g.x+g.w,y:g.y},
    {id:'e',x:g.x+g.w,y:g.y+g.h/2},{id:'se',x:g.x+g.w,y:g.y+g.h},
    {id:'s',x:g.x+g.w/2,y:g.y+g.h},{id:'sw',x:g.x,y:g.y+g.h},{id:'w',x:g.x,y:g.y+g.h/2}];
}

/* ============================================================ rows + classifier */
function buildRows(list){
  const rows=[];
  list.map((b,i)=>({b,i}))
    .sort((p,q)=> p.b.cy-q.b.cy || p.b.cx-q.b.cx)
    .forEach(o=>{
      const top=o.b.cy, bot=o.b.cy+o.b.ch;
      const r=rows.find(r=> top<r.bottom && r.top<bot);
      if(r){ r.items.push(o); r.top=Math.min(r.top,top); r.bottom=Math.max(r.bottom,bot); }
      else rows.push({top,bottom:bot,items:[o]});
    });
  rows.forEach(r=>r.items.sort((a,b)=>a.b.cx-b.b.cx));
  return rows.sort((a,b)=>a.top-b.top);
}
function classify(){
  const list = boxes.map(b=>({...b}));
  const rows = buildRows(list);
  const n = rows.length;
  rows.forEach((row,ri)=>{
    const first=ri===0, last=ri===n-1;
    row.items.forEach(o=>{
      const b=list[o.i]; b.row=ri;
      if(b.locked){ b.conf=1; if(MULTI.indexOf(b.type)>=0 && !b.cells) b.cells=3; return; }
      const full=b.cw>=COLS*0.78, ratio=b.ch/b.cw, alone=row.items.length===1;
      const widest = row.items.every(o2=>list[o2.i].cw<=b.cw);
      let t='text', c=.5;
      if(first && full && b.ch<=2)                     { t='nav';     c=.95; }
      else if(last && full && b.ch<=3 && n>1)          { t='footer';  c=.90; }
      else if(ri<=1 && full && b.ch>=5)                { t='hero';    c=.88; }
      /* a tall, dominant box in the opening rows is still a hero even when it
         shares the row with something else, which is the hero + photo case */
      else if(ri<=1 && !alone && widest && b.ch>=5 && b.cw>=COLS*0.42){ t='hero'; c=.80; }
      else if(!alone && ratio>=0.85 && b.cw<=COLS*0.5) { t='image';   c=.74; }
      else if(!alone && b.cw<=COLS*0.3 && ratio>1.3)   { t='sidebar'; c=.84; }
      else if(!alone && b.ch>=4)                       { t='text';    c=.70; }
      else if(full && b.ch<=2)                         { t='stats';   c=.58; b.cells=b.cells||3; }
      else if(b.cw<=COLS*0.3 && ratio>1.4)             { t='sidebar'; c=.84; }
      else if(b.cw<=COLS*0.28 && b.ch<=2)              { t='button';  c=.80; }
      else if(ratio>=0.75 && b.cw<COLS*0.72)           { t='image';   c=.68; }
      else if(full && b.ch>=3 && b.ch<=4)              { t='banner';  c=.52; }
      else                                             { t='text';    c=full?.74:.56; }
      b.type=t; b.conf=c;
    });
    const it=row.items.map(o=>list[o.i]);
    if(it.length>=2 && !it.some(b=>b.locked)){
      const ws=it.map(b=>b.cw);
      const uniform=Math.max.apply(null,ws)-Math.min.apply(null,ws)<=1;
      const same=it.every(b=>b.type===it[0].type);
      if(uniform && same && it[0].cw<=COLS*0.5){
        const short=row.bottom-row.top<=2;
        const t=(it.length>=4&&short)?'logos':(short?'stats':'cards');
        it.forEach(b=>{ b.type=t; b.conf=.86; });
        it[0].cells=it.length; it[0].lead=true;
        it.slice(1).forEach(b=>b.merged=true);
      }
    }
  });
  return {list, rows};
}

/* ============================================================ copy */
const DEF = {
  brand:'Mirage', navLinks:['Docs','Components','Roadmap'],
  heroH:'Everything you draw becomes real',
  heroB:'Mirage reads the geometry of a wireframe the way a person does, then builds the page it implies.',
  textH:'How the classifier reads a box',
  textB:'A box near the top edge that spans the full width is a nav bar. The same box halfway down the page, given more height, is a hero. Width relative to the page and height relative to width carry almost all the meaning in a wireframe.',
  cards:[['Position','Where it sits','Vertical position separates a nav from a footer.'],
    ['Proportion','How tall for its width','A tall narrow box is a rail, a wide short one a bar.'],
    ['Company','What sits beside it','Boxes sharing a row are built side by side.'],
    ['Span','How wide it runs','Width snaps to the column grid before anything is built.'],
    ['Order','What comes before','Reading order follows the vertical axis.'],
    ['Override','What you corrected','A box you set by hand is never re-read.']],
  stats:[['18','components'],['12','columns'],['0','dependencies'],['MIT','licence'],['3','targets'],['90','undo steps']],
  logos:['Northwind','Cassini','Half Measure','Bellwether','Ordinal'],
  quote:'I drew the page on a napkin, photographed the napkin, and had the layout before the coffee arrived.',
  who:'\u2014 an optimistic description of the roadmap',
  tabs:['Geometry','Overrides','Export'],
  table:[['Nav bar','first row','full width','0.95'],['Hero','top rows','tall, full','0.88'],
    ['Card grid','shared row','uniform','0.86'],['Side nav','narrow','tall','0.84']],
  price:[['Free','$0','Everything. It is open source.'],['Also free','$0','There is no second tier.'],
    ['Still free','$0','Self host it anywhere.']],
  code:'<section class="c-row">\n  <header class="c-hero">…</header>\n  <figure class="c-img">…</figure>\n</section>',
};

/* ============================================================ render */
const sheet = $('sheet');
function ed(field, text){
  return '<span class="edit" contenteditable="true" spellcheck="false" data-f="'+field+'">'+text+'</span>';
}
function render(){
  if(suppressRender) return;
  const {list, rows} = classify();
  sheet.className = theme ? 'th-'+theme : '';
  sheet.style.maxWidth = devW ? devW+'px' : '100%';
  if(!rows.length){
    sheet.innerHTML='<div class="void"><div class="t1">The page renders here</div>'+
      '<div class="t2">Click any text in the preview to edit it. Boxes that share a row are built side by side.</div></div>';
    return;
  }
  sheet.innerHTML=''; let k=0;
  rows.forEach(row=>{
    const pairs = row.items.map(o=>({b:list[o.i], i:o.i})).filter(p=>!p.b.merged);
    if(!pairs.length) return;
    if(pairs.length===1){
      const el=build(pairs[0].b, pairs[0].i);
      if(el){ el.classList.add('cx'); el.style.animationDelay=(k++*34)+'ms'; sheet.appendChild(el); }
      return;
    }
    const wrap=document.createElement('div');
    wrap.className='c-row cx';
    wrap.style.animationDelay=(k++*34)+'ms';
    wrap.style.setProperty('--cols', pairs.map(p=>p.b.cw+'fr').join(' '));
    wrap.style.gridTemplateColumns=pairs.map(p=>p.b.cw+'fr').join(' ');
    pairs.forEach(p=>{ const el=build(p.b,p.i); if(el) wrap.appendChild(el); });
    sheet.appendChild(wrap);
  });
}

function shapeClass(b){ return b.shape && b.shape!=='rect' ? ' sh-'+b.shape : ''; }

function build(b, idx){
  const d=document.createElement('div');
  d.dataset.box = idx;
  const hpx=Math.max(60,b.ch*46), n=clamp(b.cells||3,2,6);
  const H1=b.head?esc(b.head):null, B1=b.body?esc(b.body):null;
  const sc=shapeClass(b);

  switch(b.type){
    case 'nav':
      d.className='c-nav';
      d.innerHTML='<span class="lg">'+ed('head',H1||DEF.brand)+'</span><span class="ln">'+
        (B1?B1.split(',').map(s=>'<span>'+s.trim()+'</span>').join(''):
             DEF.navLinks.map(l=>'<span>'+l+'</span>').join(''))+
        '</span><button class="cta">Get started</button>'; break;
    case 'hero':
      d.className='c-hero';
      d.innerHTML='<h1>'+ed('head',H1||DEF.heroH)+'</h1><p>'+ed('body',B1||DEF.heroB)+'</p>'+
        '<div class="bs"><button class="b1">Start drawing</button><button class="b2">Read the docs</button></div>'; break;
    case 'cards':
      d.className='c-grid'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=DEF.cards.slice(0,n).map(c=>'<div class="c-card'+sc+'"><div class="k">'+c[0]+
        '</div><h4>'+c[1]+'</h4><p>'+c[2]+'</p></div>').join(''); break;
    case 'text':
      d.className='c-text';
      d.innerHTML='<h3>'+ed('head',H1||DEF.textH)+'</h3><p>'+ed('body',B1||DEF.textB)+'</p>'; break;
    case 'image':
      d.className='c-img'+sc; d.style.minHeight=hpx+'px';
      d.innerHTML=ed('head', H1||'IMAGE'); break;
    case 'gallery':
      d.className='c-gal'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=Array.from({length:n},()=>'<div class="c-img'+sc+'" style="min-height:'+
        Math.max(70,hpx/1.6)+'px">IMAGE</div>').join(''); break;
    case 'sidebar':
      d.className='c-side';
      d.innerHTML=(B1?B1.split(','):['Overview','Reading a box','The column grid','Overrides','Export'])
        .map((t,i)=>'<div class="it'+(i===0?' a':'')+'">'+t.trim()+'</div>').join(''); break;
    case 'stats':
      d.className='c-stats'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=DEF.stats.slice(0,n).map(s=>'<div class="s"><div class="n">'+s[0]+
        '</div><div class="l">'+s[1]+'</div></div>').join(''); break;
    case 'logos':
      d.className='c-logos';
      d.innerHTML=DEF.logos.slice(0,Math.max(n,4)).map(l=>'<span class="lo">'+l+'</span>').join(''); break;
    case 'quote':
      d.className='c-quote';
      d.innerHTML='<blockquote>'+ed('head',H1||DEF.quote)+'</blockquote><div class="who">'+
        ed('body',B1||DEF.who)+'</div>'; break;
    case 'form':
      d.className='c-form';
      d.innerHTML='<div class="inp">Name</div><div class="inp">Email address</div>'+
        '<div class="inp" style="height:70px">Message</div><div class="sb">Send</div>'; break;
    case 'table':
      d.className='c-table';
      d.innerHTML='<table><thead><tr><th>Component</th><th>Signal</th><th>Shape</th><th>Conf.</th></tr></thead><tbody>'+
        DEF.table.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>'; break;
    case 'tabs':
      d.className='c-tabs';
      d.innerHTML='<div class="tl">'+DEF.tabs.map((t,i)=>'<span class="tb'+(i===0?' a':'')+'">'+t+
        '</span>').join('')+'</div><p>'+ed('body',B1||DEF.textB)+'</p>'; break;
    case 'price':
      d.className='c-price'; d.style.gridTemplateColumns='repeat('+Math.min(n,3)+',minmax(0,1fr))';
      d.innerHTML=DEF.price.slice(0,Math.min(n,3)).map(p=>'<div class="p'+sc+'"><div class="tn">'+p[0]+
        '</div><div class="am">'+p[1]+'</div><ul><li>'+p[2]+'</li><li>Unlimited sketches</li><li>Self host it</li></ul></div>').join(''); break;
    case 'banner':
      d.className='c-banner';
      d.innerHTML='<h3>'+ed('head',H1||'Draw the page. Ship the page.')+'</h3><span class="b">Open the editor</span>'; break;
    case 'code':
      d.className='c-code'; d.innerHTML='<pre>'+esc(b.body||DEF.code)+'</pre>'; break;
    case 'button': {
      const v=b.variant||'primary';
      d.className='c-btn';
      if(v==='group'){
        d.innerHTML='<div class="bgroup"><button class="bt bt-primary">'+ed('head',H1||'Start drawing')+
          '</button><button class="bt bt-secondary">Read the docs</button><button class="bt bt-ghost">Learn more</button></div>';
      } else {
        d.innerHTML='<button class="bt bt-'+v+'">'+ed('head',H1||'Start drawing')+'</button>';
      }
      break;
    }
    case 'footer':
      d.className='c-foot';
      d.innerHTML='<span>'+ed('head',H1||DEF.brand)+'</span><span class="sp">'+
        ed('body',B1||'Drawn, not configured')+'</span>'; break;
    default: return null;
  }
  return d;
}

/* ---- inline editing in the preview ---- */
sheet.addEventListener('input', e=>{
  const el = e.target.closest('.edit'); if(!el) return;
  const host = el.closest('[data-box]'); if(!host) return;
  const b = boxes[+host.dataset.box]; if(!b) return;
  suppressRender = true;                    // never re-render mid-keystroke
  b[el.dataset.f] = el.textContent;
});
sheet.addEventListener('blur', e=>{
  const el = e.target.closest && e.target.closest('.edit'); if(!el) return;
  suppressRender = false;
  push(); syncSel(); render();
}, true);
sheet.addEventListener('keydown', e=>{
  const el = e.target.closest && e.target.closest('.edit'); if(!el) return;
  if(e.key==='Enter'){ e.preventDefault(); el.blur(); }
  if(e.key==='Escape'){ e.preventDefault(); el.blur(); }
  e.stopPropagation();
});
sheet.addEventListener('focusin', e=>{
  const host = e.target.closest && e.target.closest('[data-box]');
  if(host){ sel = +host.dataset.box; syncSel(); paint(); }
});

/* ============================================================ export */
/* Read the live CSSOM so the exported page is styled identically to the
   preview, including every per-theme accent rule. */
function collectCSS(){
  const cur = theme ? 'th-'+theme : null;
  const keep = [], frames = [];
  const wanted = sel => {
    if(sel.indexOf('.th-') >= 0) return cur ? sel.indexOf('.'+cur) >= 0 : false;
    return sel.indexOf('#sheet')>=0 || sel.indexOf('.c-')>=0 || sel.indexOf('.sh-')>=0 || sel.indexOf('.bt')>=0;
  };
  const rewrite = sel => sel.split(',').map(s=>{
    s = s.trim()
         .replace(/#sheet\.th-([a-z0-9-]+)/g, '.page.th-$1')
         .replace(/#sheet/g, '.page');
    if(s.indexOf('.page')!==0 && (s.indexOf('.c-')===0 || s.indexOf('.sh-')===0 || s.indexOf('.bt')===0))
      s = '.page '+s;
    return s;
  }).join(', ');

  const walk = list => {
    for(const r of list){
      if(r.constructor && /Keyframes/.test(r.constructor.name)){ frames.push(r.cssText); continue; }
      if(r.media){
        const inner=[];
        for(const ir of r.cssRules||[]) if(ir.selectorText && wanted(ir.selectorText))
          inner.push(rewrite(ir.selectorText)+'{'+ir.style.cssText+'}');
        if(inner.length) keep.push('@media '+r.media.mediaText+'{\n  '+inner.join('\n  ')+'\n}');
        continue;
      }
      if(!r.selectorText) continue;
      if(r.selectorText.indexOf('.cx')>=0 || r.selectorText.indexOf('.void')>=0) continue;
      if(!wanted(r.selectorText)) continue;
      keep.push(rewrite(r.selectorText)+'{'+r.style.cssText+'}');
    }
  };
  for(const ss of document.styleSheets){
    let rules; try{ rules = ss.cssRules; }catch(_){ continue; }
    if(rules) walk(rules);
  }
  return {rules:keep, frames};
}

/* Work out which webfonts this theme needs, straight from the tokens. */
function fontImport(){
  const cs = getComputedStyle(sheet);
  const names = new Set();
  ['--c-fd','--c-fb'].forEach(v=>{
    (cs.getPropertyValue(v)||'').split(',').forEach(part=>{
      const nm = part.trim().replace(/^["']|["']$/g,'');
      if(/^[A-Z]/.test(nm) && !/^(Georgia|Arial|Helvetica|Didot|Bodoni|Times)/.test(nm)) names.add(nm);
    });
  });
  names.add('IBM Plex Mono');
  if(!names.size) return '';
  const fam = [...names].map(n=>'family='+n.replace(/ /g,'+')+':wght@400;500;600;700;800;900').join('&');
  return "@import url('https://fonts.googleapis.com/css2?"+fam+"&display=swap');\n\n";
}

function laidRows(){
  const {list, rows} = classify();
  return rows.map(r=>({items:r.items.map(o=>list[o.i]).filter(b=>!b.merged)}))
             .filter(r=>r.items.length);
}

const TAG = {nav:'nav',hero:'header',footer:'footer',image:'figure',quote:'figure',
  form:'form',sidebar:'aside',code:'pre',table:'div'};

/* Emit the same class names the preview uses, so the collected CSS applies. */
function markupFor(b, pad){
  const n=clamp(b.cells||3,2,6), sc=shapeClass(b);
  const t=TAG[b.type]||'section';
  const P=s=>pad+s;
  const wrap=(cls,inner)=>P('<'+t+' class="'+cls+'">')+'\n'+inner.split('\n').map(l=>pad+'  '+l).join('\n')+'\n'+P('</'+t+'>');
  switch(b.type){
    case 'nav': return wrap('c-nav','<span class="lg">'+(b.head||DEF.brand)+'</span>\n'+
      '<span class="ln"><span>Docs</span><span>Components</span></span>\n<button class="cta">Get started</button>');
    case 'hero': return wrap('c-hero','<h1>'+(b.head||DEF.heroH)+'</h1>\n<p>'+(b.body||DEF.heroB)+'</p>\n'+
      '<div class="bs"><button class="b1">Start drawing</button><button class="b2">Read the docs</button></div>');
    case 'cards': return P('<section class="c-grid" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
      DEF.cards.slice(0,n).map(c=>pad+'  <div class="c-card'+sc+'"><div class="k">'+c[0]+'</div><h4>'+c[1]+'</h4><p>'+c[2]+'</p></div>').join('\n')+
      '\n'+P('</section>');
    case 'text': return wrap('c-text','<h3>'+(b.head||DEF.textH)+'</h3>\n<p>'+(b.body||DEF.textB)+'</p>');
    case 'image': return P('<figure class="c-img'+sc+'">'+(b.head||'IMAGE')+'</figure>');
    case 'gallery': return P('<section class="c-gal" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
      Array.from({length:n},()=>pad+'  <div class="c-img'+sc+'">IMAGE</div>').join('\n')+'\n'+P('</section>');
    case 'sidebar': return wrap('c-side','<div class="it a">Overview</div>\n<div class="it">Reading a box</div>');
    case 'stats': return P('<section class="c-stats" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
      DEF.stats.slice(0,n).map(s=>pad+'  <div class="s"><div class="n">'+s[0]+'</div><div class="l">'+s[1]+'</div></div>').join('\n')+
      '\n'+P('</section>');
    case 'logos': return P('<section class="c-logos">')+'\n'+
      DEF.logos.slice(0,Math.max(n,4)).map(l=>pad+'  <span class="lo">'+l+'</span>').join('\n')+'\n'+P('</section>');
    case 'quote': return wrap('c-quote','<blockquote>'+(b.head||DEF.quote)+'</blockquote>\n<div class="who">'+(b.body||DEF.who)+'</div>');
    case 'form': return wrap('c-form','<div class="inp">Name</div>\n<div class="inp">Email address</div>\n<div class="sb">Send</div>');
    case 'table': return P('<div class="c-table"><table><thead><tr><th>Component</th><th>Signal</th></tr></thead>'+
      '<tbody><tr><td>Nav bar</td><td>first row</td></tr></tbody></table></div>');
    case 'tabs': return wrap('c-tabs','<div class="tl"><span class="tb a">Geometry</span><span class="tb">Overrides</span></div>\n<p>'+(b.body||DEF.textB)+'</p>');
    case 'price': return P('<section class="c-price" style="grid-template-columns:repeat('+Math.min(n,3)+',minmax(0,1fr))">')+'\n'+
      DEF.price.slice(0,Math.min(n,3)).map(p=>pad+'  <div class="p'+sc+'"><div class="tn">'+p[0]+'</div><div class="am">'+p[1]+'</div></div>').join('\n')+
      '\n'+P('</section>');
    case 'banner': return wrap('c-banner','<h3>'+(b.head||'Draw the page. Ship the page.')+'</h3>\n<span class="b">Open the editor</span>');
    case 'code': return P('<pre class="c-code"><code>…</code></pre>');
    case 'button': {
      const v=b.variant||'primary';
      if(v==='group') return P('<div class="c-btn"><div class="bgroup">'+
        '<button class="bt bt-primary">'+(b.head||'Start drawing')+'</button>'+
        '<button class="bt bt-secondary">Read the docs</button>'+
        '<button class="bt bt-ghost">Learn more</button></div></div>');
      return P('<div class="c-btn"><button class="bt bt-'+v+'">'+(b.head||'Start drawing')+'</button></div>');
    }
    case 'footer': return wrap('c-foot','<span>'+(b.head||DEF.brand)+'</span>\n<span class="sp">'+(b.body||'Drawn, not configured')+'</span>');
  }
  return P('<div></div>');
}

function exHTML(){
  const R = laidRows();
  if(!R.length) return '<!-- nothing drawn yet -->';
  const body = R.map(row=>{
    if(row.items.length===1) return markupFor(row.items[0],'  ');
    const cols = row.items.map(b=>b.cw+'fr').join(' ');
    return '  <section class="c-row" style="--cols:'+cols+';grid-template-columns:'+cols+'">\n'+
           row.items.map(b=>markupFor(b,'    ')).join('\n')+'\n  </section>';
  }).join('\n\n');

  const {rules, frames} = collectCSS();
  const cls = 'page'+(theme?' th-'+theme:'');
  return '<!-- generated by Mirage · style: '+(theme||'plain')+' -->\n'+
    '<main class="'+cls+'">\n'+body+'\n</main>\n\n<style>\n'+
    fontImport()+
    rules.join('\n')+
    (frames.length ? '\n\n'+frames.join('\n') : '')+
    '\n</style>';
}

const RMAP = {nav:'Nav',hero:'Hero',cards:'CardGrid',text:'Prose',image:'Figure',gallery:'Gallery',
  sidebar:'Rail',stats:'Stats',logos:'LogoRow',quote:'Quote',form:'Form',table:'DataTable',
  tabs:'Tabs',price:'Pricing',banner:'Banner',code:'CodeBlock',button:'Button',footer:'Footer'};

function exReact(){
  const R=laidRows(); if(!R.length) return '// nothing drawn yet';
  const one=(b,pad)=>{
    const n=clamp(b.cells||3,2,6), C=RMAP[b.type];
    const extra = b.shape&&b.shape!=='rect' ? ' shape="'+b.shape+'"' : '';
    const props={
      nav:'brand="'+(b.head||DEF.brand)+'" links={nav}',
      hero:'title="'+(b.head||DEF.heroH)+'" body={copy.hero}',
      cards:'columns={'+n+'} items={items}', text:'heading="'+(b.head||DEF.textH)+'"',
      image:'src={img} alt=""', gallery:'columns={'+n+'}', sidebar:'items={nav}',
      stats:'columns={'+n+'} data={stats}', logos:'logos={logos}', quote:'attribution={copy.who}',
      form:'fields={["email"]}', table:'columns={cols} rows={rows}', tabs:'items={tabs}',
      price:'tiers={tiers} columns={'+Math.min(n,3)+'}',
      banner:'title="'+(b.head||'Draw the page. Ship the page.')+'"', code:'language="html"',
      button:'variant="'+(b.variant||'primary')+'"', footer:'brand="'+(b.head||DEF.brand)+'"',
    }[b.type]||'';
    return pad+'<'+C+(props?' '+props:'')+extra+' />';
  };
  const body=R.map(row=>{
    if(row.items.length===1) return one(row.items[0],'      ');
    return '      <Row cols={['+row.items.map(b=>b.cw).join(',')+']}>\n'+
      row.items.map(b=>one(b,'        ')).join('\n')+'\n      </Row>';
  }).join('\n');
  const used=[]; R.forEach(r=>r.items.forEach(b=>{ const c=RMAP[b.type]; if(c&&used.indexOf(c)<0) used.push(c); }));
  if(R.some(r=>r.items.length>1)) used.unshift('Row');
  return "// generated by Mirage\nimport { "+used.join(', ')+" } from '@mirage/ui'\n"+
    "import '@mirage/ui/themes/"+(theme||'plain')+".css'\n\n"+
    "export default function Page() {\n  return (\n    <main className=\"page\">\n"+body+"\n    </main>\n  )\n}";
}

function exTW(){
  const R=laidRows(); if(!R.length) return '<!-- nothing drawn yet -->';
  const SH={round:'rounded-lg',pill:'rounded-full',circle:'rounded-full aspect-square',
    squircle:'rounded-3xl',cut:'[clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]'};
  const BT={primary:'bg-neutral-900 text-white px-5 py-2.5 rounded',
    secondary:'border-2 border-neutral-900 px-5 py-2.5 rounded',
    ghost:'text-neutral-900 px-5 py-2.5 hover:bg-neutral-100 rounded',
    pill:'bg-neutral-900 text-white px-6 py-2.5 rounded-full',
    link:'text-neutral-900 underline underline-offset-4', group:'flex gap-2'};
  const base={nav:'flex items-center gap-5 px-6 py-3.5 border-b border-neutral-200',
    hero:'px-6 py-14', cards:'grid gap-3 p-6', text:'p-6 max-w-prose',
    image:'bg-neutral-100 min-h-[180px] grid place-items-center', gallery:'grid gap-2 p-6',
    sidebar:'p-6 space-y-1', stats:'grid gap-px bg-neutral-200 p-6',
    logos:'flex flex-wrap items-center justify-between gap-3 p-6 opacity-70',
    quote:'px-6 py-10', form:'p-6 grid gap-2 max-w-md', table:'p-6 overflow-x-auto',
    tabs:'p-6', price:'grid gap-3 p-6', banner:'px-6 py-12 bg-neutral-900 text-white',
    code:'m-6 p-4 bg-neutral-900 text-neutral-100 rounded text-xs', button:'p-6',
    footer:'p-6 border-t border-neutral-200 text-sm text-neutral-500'};
  const one=(b,pad)=>{
    const n=clamp(b.cells||3,2,6);
    let cls=base[b.type]||'p-6';
    if(['cards','gallery','stats','price'].indexOf(b.type)>=0) cls+=' grid-cols-1 md:grid-cols-'+n;
    if(SHAPED.indexOf(b.type)>=0 && b.shape && SH[b.shape]) cls+=' '+SH[b.shape];
    if(b.type==='button') return pad+'<div class="'+cls+'"><button class="'+
      (BT[b.variant||'primary'])+'">'+(b.head||'Start drawing')+'</button></div>';
    const t=TAG[b.type]||'section';
    return pad+'<'+t+' class="'+cls+'">'+NICE[b.type]+'</'+t+'>';
  };
  const body=R.map(row=>{
    if(row.items.length===1) return one(row.items[0],'  ');
    return '  <section class="grid grid-cols-1 md:grid-cols-['+row.items.map(b=>b.cw+'fr').join('_')+']">\n'+
      row.items.map(b=>one(b,'    ')).join('\n')+'\n  </section>';
  }).join('\n\n');
  return '<!-- generated by Mirage · Tailwind -->\n<main>\n'+body+'\n</main>';
}

function exJSON(){
  return JSON.stringify({version:4, name:project.name, cols:COLS, theme, boxes}, null, 2);
}
const EXPORTS={html:exHTML, react:exReact, tw:exTW, json:exJSON};
const EXT={html:'html', react:'jsx', tw:'html', json:'json'};

/* ============================================================ projects (IndexedDB) */
const STORE = (() => {
  let db=null, mem=new Map(), useMem=false;
  function open(){
    return new Promise(res=>{
      if(db) return res(db);
      if(useMem || !window.indexedDB){ useMem=true; return res(null); }
      let rq;
      try{ rq = indexedDB.open('mirage', 1); }catch(_){ useMem=true; return res(null); }
      rq.onupgradeneeded = () => {
        const d=rq.result;
        if(!d.objectStoreNames.contains('projects'))
          d.createObjectStore('projects', {keyPath:'id'});
      };
      rq.onsuccess = () => { db=rq.result; res(db); };
      rq.onerror   = () => { useMem=true; res(null); };
      setTimeout(()=>{ if(!db){ useMem=true; res(null); } }, 1500);
    });
  }
  const tx = (mode, fn) => open().then(d=>{
    if(!d) return fn(null);
    return new Promise((res,rej)=>{
      const t=d.transaction('projects', mode);
      const r=fn(t.objectStore('projects'));
      t.oncomplete=()=>res(r && r.result !== undefined ? r.result : r);
      t.onerror=()=>rej(t.error);
    });
  });
  return {
    isMemory: () => useMem,
    all(){
      return tx('readonly', s => s ? s.getAll() : [...mem.values()])
        .then(v => (v||[]).sort((a,b)=>b.updated-a.updated))
        .catch(()=>[...mem.values()]);
    },
    put(p){
      if(useMem){ mem.set(p.id,p); return Promise.resolve(p); }
      return tx('readwrite', s => s ? s.put(p) : mem.set(p.id,p)).then(()=>p).catch(()=>{ mem.set(p.id,p); return p; });
    },
    get(id){
      if(useMem) return Promise.resolve(mem.get(id));
      return tx('readonly', s => s ? s.get(id) : mem.get(id)).catch(()=>mem.get(id));
    },
    del(id){
      if(useMem){ mem.delete(id); return Promise.resolve(); }
      return tx('readwrite', s => s ? s.delete(id) : mem.delete(id)).catch(()=>{ mem.delete(id); });
    },
  };
})();

const uid = () => 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);

function snapshot(){
  return {id:project.id, name:project.name, cols:COLS, theme, boxes:clone(boxes), updated:Date.now()};
}
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
}
function saveNow(){
  if(!project.id) project.id = uid();
  const p = snapshot();
  STORE.put(p).then(()=>{ $('savedAt').textContent = 'saved'; setTimeout(()=>{
    if($('savedAt').textContent==='saved') $('savedAt').textContent=''; }, 1400); });
}
function loadProject(p){
  project = {id:p.id, name:p.name};
  boxes = p.boxes||[]; COLS = p.cols||12; theme = p.theme||'';
  Array.prototype.forEach.call($('segCols').children,x=>x.classList.toggle('on',+x.dataset.cols===COLS));
  $('themeSel').value = theme; $('ovCols').textContent = COLS;
  $('projName').textContent = project.name;
  sel=-1; hist=[clone(boxes)]; hi=0; syncHist(); resize(); commit(false);
}
function newProject(){
  project = {id:uid(), name:'Untitled sketch'};
  boxes=[]; sel=-1;
  $('projName').textContent=project.name;
  hist=[[]]; hi=0; syncHist(); resize(); commit(true);
  toast('New project');
}

function renderProjects(){
  const list=$('projList');
  list.innerHTML='<div class="none">Loading…</div>';
  STORE.all().then(all=>{
    $('storeNote').textContent = STORE.isMemory()
      ? 'This browser blocked local storage, so projects last only for this session.'
      : 'Stored in this browser with IndexedDB. No account, nothing leaves your device.';
    if(!all.length){ list.innerHTML='<div class="none">No saved projects yet. Everything you draw autosaves.</div>'; return; }
    list.innerHTML='';
    all.forEach(p=>{
      const row=document.createElement('div');
      row.className='prj'+(p.id===project.id?' on':'');
      const when=new Date(p.updated);
      row.innerHTML='<div class="pi"><b>'+esc(p.name)+'</b>'+
        '<span>'+(p.boxes?p.boxes.length:0)+' boxes · '+(p.theme||'plain')+' · '+
        when.toLocaleDateString()+' '+when.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span></div>'+
        '<div class="pa">'+
        '<button data-a="open">Open</button>'+
        '<button data-a="dupe">Duplicate</button>'+
        '<button data-a="del" class="dg">Delete</button></div>';
      row.querySelector('[data-a=open]').onclick=()=>{
        loadProject(p); $('mProj').classList.remove('on'); toast('Opened '+p.name);
      };
      row.querySelector('[data-a=dupe]').onclick=()=>{
        const c={...clone(p), id:uid(), name:p.name+' copy', updated:Date.now()};
        STORE.put(c).then(renderProjects);
      };
      row.querySelector('[data-a=del]').onclick=()=>{
        STORE.del(p.id).then(()=>{
          if(p.id===project.id){ project.id=null; }
          renderProjects();
        });
      };
      list.appendChild(row);
    });
  });
}

/* ============================================================ pointer */
function cellAt(e){
  const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)/cell, y:(e.clientY-r.top)/cell};
}
function drawRect(){
  const x0=Math.floor(Math.min(drawing.x0,drawing.x1)), x1=Math.ceil(Math.max(drawing.x0,drawing.x1));
  const y0=Math.floor(Math.min(drawing.y0,drawing.y1)), y1=Math.ceil(Math.max(drawing.y0,drawing.y1));
  return {cx:clamp(x0,0,COLS-1), cy:Math.max(0,y0), cw:clamp(x1-x0,1,COLS), ch:Math.max(1,y1-y0)};
}
function hit(p){
  for(let i=boxes.length-1;i>=0;i--){
    const b=boxes[i];
    if(p.x>=b.cx&&p.x<=b.cx+b.cw&&p.y>=b.cy&&p.y<=b.cy+b.ch) return i;
  }
  return -1;
}
function hitHandle(p){
  if(sel<0||!boxes[sel]) return null;
  const tol=9/cell;
  for(const h of handles(boxes[sel]))
    if(Math.abs(h.x/cell-p.x)<tol && Math.abs(h.y/cell-p.y)<tol) return h.id;
  return null;
}
function snapEdges(rect, idx){
  const S=1; guides=[];
  boxes.forEach((o,i)=>{
    if(i===idx) return;
    if(Math.abs(rect.cy-(o.cy+o.ch))<=S){ rect.cy=o.cy+o.ch; guides.push({v:false,p:rect.cy*cell}); }
    else if(Math.abs(rect.cy-o.cy)<=S){ rect.cy=o.cy; guides.push({v:false,p:rect.cy*cell}); }
    if(Math.abs(rect.cx-(o.cx+o.cw))<=S){ rect.cx=o.cx+o.cw; guides.push({v:true,p:rect.cx*cell}); }
    else if(Math.abs(rect.cx-o.cx)<=S){ rect.cx=o.cx; guides.push({v:true,p:rect.cx*cell}); }
  });
  return rect;
}
let mode=null, anchor=null, orig=null, hnd=null, moved=false;

cv.addEventListener('pointerdown', e=>{
  if(e.button===2) return;
  const p=cellAt(e); anchor=p; moved=false;
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  const h=hitHandle(p);
  if(h){ mode='resize'; hnd=h; orig={...boxes[sel]}; return; }
  const i=hit(p);
  if(i>=0){ if(sel!==i){ sel=i; syncSel(); } mode='move'; orig={...boxes[i]}; paint(); return; }
  sel=-1; syncSel(); mode='draw'; drawing={x0:p.x,y0:p.y,x1:p.x,y1:p.y};
});
cv.addEventListener('pointermove', e=>{
  const p=cellAt(e);
  if(!mode){ cv.style.cursor = hitHandle(p)?'nwse-resize':(hit(p)>=0?'move':'crosshair'); return; }
  const dx=p.x-anchor.x, dy=p.y-anchor.y;
  if(Math.abs(dx)>0.25||Math.abs(dy)>0.25) moved=true;
  if(mode==='draw'){ drawing.x1=p.x; drawing.y1=p.y; paint(); return; }
  if(mode==='move'){
    let want={cx:orig.cx+Math.round(dx), cy:Math.max(0,orig.cy+Math.round(dy)), cw:orig.cw, ch:orig.ch};
    want.cx=clamp(want.cx,0,COLS-want.cw);
    want=snapEdges(want,sel);
    want.cx=clamp(want.cx,0,COLS-want.cw);
    tryPlace(sel,want); grow(); paint(); render(); return;
  }
  if(mode==='resize'){
    let {cx,cy,cw,ch}=orig;
    const rx=Math.round(dx), ry=Math.round(dy);
    if(hnd.indexOf('e')>=0) cw=orig.cw+rx;
    if(hnd.indexOf('w')>=0){ cx=orig.cx+rx; cw=orig.cw-rx; }
    if(hnd.indexOf('s')>=0) ch=orig.ch+ry;
    if(hnd.indexOf('n')>=0){ cy=orig.cy+ry; ch=orig.ch-ry; }
    if(cw<1){ cw=1; if(hnd.indexOf('w')>=0) cx=orig.cx+orig.cw-1; }
    if(ch<1){ ch=1; if(hnd.indexOf('n')>=0) cy=orig.cy+orig.ch-1; }
    cx=clamp(cx,0,COLS-1); cy=Math.max(0,cy); cw=clamp(cw,1,COLS-cx);
    const want={cx,cy,cw,ch};
    if(!collides(want,sel)) Object.assign(boxes[sel],want);
    grow(); paint(); render(); return;
  }
});
function grow(){
  const need=surfaceRows()*cell;
  if(Math.abs(need-H)>0.5){ H=need; cv.style.height=H+'px';
    cv.height=Math.max(1,Math.round(H*DPR)); ctx.setTransform(DPR,0,0,DPR,0,0); }
}
function endPointer(){
  guides=[];
  if(mode==='draw'){
    const r=drawRect(); drawing=null;
    if(collides(r,-1)){ toast('That space is taken'); paint(); mode=null; return; }
    boxes.push(r); sel=boxes.length-1; resize(); commit(true);
  } else if(mode==='move'||mode==='resize'){
    if(moved){ resize(); commit(true); } else { paint(); syncSel(); }
  }
  mode=null; hnd=null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', e=>{
  e.preventDefault();
  const i=hit(cellAt(e));
  if(i>=0){ boxes.splice(i,1); sel=-1; resize(); commit(true); }
});

/* ============================================================ UI */
function toast(m){
  const t=$('toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('on'),1600);
}
function commit(record){
  if(record) push();
  $('blank').classList.toggle('gone', boxes.length>0);
  paint(); render(); syncSel(); syncStats();
  if($('mExport').classList.contains('on')) refreshExport();
}
function syncLayers(){
  const {list, rows}=classify(), el=$('layers');
  if(!boxes.length){ el.innerHTML='<div class="none">Nothing drawn yet. Drag a box on the surface.</div>'; return; }
  el.innerHTML='';
  rows.forEach((row,ri)=>{
    const sep=document.createElement('div');
    sep.className='rowsep';
    sep.innerHTML='<span>ROW '+String(ri+1).padStart(2,'0')+'</span><s></s>'+
      (row.items.length>1?'<span>'+row.items.length+' across</span>':'');
    el.appendChild(sep);
    row.items.forEach(o=>{
      const b=boxes[o.i], c=list[o.i];
      const d=document.createElement('div');
      d.className='lay'+(o.i===sel?' on':'');
      d.innerHTML='<span class="ix">'+String(o.i+1).padStart(2,'0')+'</span>'+
        '<span class="nm">'+NICE[c.type]+(c.merged?' (merged)':'')+'</span>'+
        (b.locked?'<span class="lk">SET</span>':'')+
        '<span class="sp">'+b.cw+'\u00d7'+b.ch+'</span>';
      d.onclick=()=>{ sel=o.i; syncSel(); paint(); };
      el.appendChild(d);
    });
  });
}
function syncStats(){
  const {rows}=classify();
  $('stBox').textContent=boxes.length;
  $('stComp').textContent=laidRows().reduce((n,r)=>n+r.items.length,0);
  $('stRows').textContent=rows.length;
  $('stLock').textContent=boxes.filter(b=>b.locked).length;
}

const typeGrid=$('typeGrid');
TYPES.forEach(t=>{
  const b=document.createElement('button');
  b.dataset.t=t[0]; b.textContent=t[1];
  b.onclick=()=>{
    const x=boxes[sel]; if(!x) return;
    x.type=t[0]; x.locked=true;
    if(MULTI.indexOf(t[0])>=0 && !x.cells) x.cells=3;
    if(t[0]==='button' && !x.variant) x.variant='primary';
    commit(true);
  };
  typeGrid.appendChild(b);
});
const shapeGrid=$('shapeGrid');
SHAPES.forEach(s=>{
  const b=document.createElement('button');
  b.dataset.s=s[0]; b.textContent=s[1];
  b.onclick=()=>{ const x=boxes[sel]; if(!x) return; x.shape=s[0]; commit(true); };
  shapeGrid.appendChild(b);
});
const varGrid=$('varGrid');
VARIANTS.forEach(v=>{
  const b=document.createElement('button');
  b.dataset.v=v[0]; b.textContent=v[1];
  b.onclick=()=>{ const x=boxes[sel]; if(!x) return; x.variant=v[0]; x.type='button'; x.locked=true; commit(true); };
  varGrid.appendChild(b);
});

function syncSel(){
  const has = sel>=0 && !!boxes[sel];
  $('paneLayers').classList.toggle('on', !has);
  $('paneInsp').classList.toggle('on', has);
  $('ftSel').textContent = has ? ('box '+(sel+1)+' of '+boxes.length) : 'no selection';
  syncLayers();
  if(!has) return;
  const b=boxes[sel], c=classify().list[sel];
  $('inspHead').textContent='Box '+(sel+1)+' \u2014 '+NICE[c.type];
  Array.prototype.forEach.call(typeGrid.children, el=>el.classList.toggle('on', el.dataset.t===c.type));
  const pct=Math.round((b.locked?1:c.conf)*100);
  $('cfLab').textContent = b.locked?'set by hand':'auto';
  $('cfPct').textContent = pct+'%';
  const bar=$('cfBar'); bar.style.width=pct+'%';
  bar.classList.toggle('low', !b.locked && c.conf<.55);
  $('fW').max=COLS; $('fW').value=b.cw; $('fWV').textContent=b.cw;
  $('fH').value=Math.min(b.ch,24); $('fHV').textContent=b.ch;
  const showCells=MULTI.indexOf(c.type)>=0;
  $('fldCells').hidden=!showCells;
  if(showCells){ const v=b.cells||c.cells||3; $('fCells').value=v; $('fCellsV').textContent=v; }
  const showShape=SHAPED.indexOf(c.type)>=0;
  $('fldShape').hidden=!showShape;
  Array.prototype.forEach.call(shapeGrid.children,
    el=>el.classList.toggle('on', el.dataset.s===(b.shape||'rect')));
  const showVar=c.type==='button';
  $('fldVar').hidden=!showVar;
  Array.prototype.forEach.call(varGrid.children,
    el=>el.classList.toggle('on', el.dataset.v===(b.variant||'primary')));
}
function sizeInput(id, apply){
  $(id).addEventListener('input', ()=>{
    const b=boxes[sel]; if(!b) return;
    const v=+$(id).value, want={cx:b.cx,cy:b.cy,cw:b.cw,ch:b.ch};
    apply(want,v,b);
    if(collides(want,sel)){ toast('That would overlap another box'); syncSel(); return; }
    Object.assign(b,want); resize(); paint(); render(); syncStats();
    $(id==='fW'?'fWV':'fHV').textContent=v;
  });
  $(id).addEventListener('change', ()=>{ push(); syncSel(); });
}
sizeInput('fW',(w,v,b)=>{ w.cw=clamp(v,1,COLS-b.cx); });
sizeInput('fH',(w,v)=>{ w.ch=Math.max(1,v); });
$('fCells').addEventListener('input', ()=>{
  const b=boxes[sel]; if(!b) return;
  b.cells=+$('fCells').value; b.locked=true;
  $('fCellsV').textContent=$('fCells').value; render();
});
$('fCells').addEventListener('change', ()=>push());

$('bAuto').onclick=()=>{ const b=boxes[sel]; if(!b) return;
  delete b.locked; delete b.type; delete b.cells; commit(true); toast('Re-read from geometry'); };
$('bDupe').onclick=()=>{ const b=boxes[sel]; if(!b) return;
  boxes.push({...b, cy:b.cy+b.ch+1}); sel=boxes.length-1; resize(); commit(true); };
$('bDel').onclick=()=>{ if(sel<0) return; boxes.splice(sel,1); sel=-1; resize(); commit(true); };
$('bUndo').onclick=undo; $('bRedo').onclick=redo;
$('bClear').onclick=()=>{ boxes=[]; sel=-1; resize(); commit(true); };
$('bLabels').onclick=()=>{ showLabels=!showLabels; $('bLabels').classList.toggle('on',showLabels); paint(); };
$('bTheme').onclick=()=>{ dark=!dark; document.body.classList.toggle('dark',dark);
  $('bTheme').classList.toggle('on',dark); requestAnimationFrame(paint); };
$('bFull').onclick=()=>{
  const o=$('out'); o.classList.toggle('full');
  const on=o.classList.contains('full');
  $('bFull').classList.toggle('on',on);
  $('bFull').title = on?'Collapse preview':'Expand preview';
};
$('bTidy').onclick=()=>{
  if(!boxes.length) return;
  const {rows}=classify(); let y=0;
  rows.forEach(r=>{
    const h=r.items.reduce((m,o)=>Math.max(m,boxes[o.i].ch),0);
    let x=0;
    r.items.forEach(o=>{ boxes[o.i].cy=y; boxes[o.i].ch=h; boxes[o.i].cx=x; x+=boxes[o.i].cw; });
    y+=h+1;
  });
  sel=-1; resize(); commit(true); toast('Tidied into rows');
};
Array.prototype.forEach.call($('segCols').children, b=>{
  b.onclick=()=>{
    Array.prototype.forEach.call($('segCols').children,x=>x.classList.remove('on'));
    b.classList.add('on');
    const old=COLS; COLS=+b.dataset.cols; $('ovCols').textContent=COLS;
    const k=COLS/old;
    boxes.forEach(x=>{ x.cx=clamp(Math.round(x.cx*k),0,COLS-1); x.cw=clamp(Math.round(x.cw*k),1,COLS-x.cx); });
    for(let i=boxes.length-1;i>=0;i--) if(collides(boxes[i],i)) boxes.splice(i,1);
    sel=-1; resize(); commit(true);
  };
});
Array.prototype.forEach.call($('segDev').children, b=>{
  b.onclick=()=>{ Array.prototype.forEach.call($('segDev').children,x=>x.classList.remove('on'));
    b.classList.add('on'); devW=+b.dataset.w; render(); };
});
$('themeSel').addEventListener('change', e=>{
  theme=e.target.value; render(); scheduleSave();
  if($('mExport').classList.contains('on')) refreshExport();
});

const PRESETS={
  landing:[{cx:0,cy:0,cw:12,ch:2},{cx:0,cy:2,cw:12,ch:6},
    {cx:0,cy:8,cw:4,ch:4},{cx:4,cy:8,cw:4,ch:4},{cx:8,cy:8,cw:4,ch:4},
    {cx:0,cy:12,cw:6,ch:5},{cx:6,cy:12,cw:6,ch:5},
    {cx:0,cy:17,cw:12,ch:3},{cx:0,cy:20,cw:12,ch:2}],
  split:[{cx:0,cy:0,cw:12,ch:2},{cx:0,cy:2,cw:7,ch:7},{cx:7,cy:2,cw:5,ch:7},
    {cx:0,cy:9,cw:5,ch:6},{cx:5,cy:9,cw:7,ch:6},{cx:0,cy:15,cw:12,ch:2}],
  docs:[{cx:0,cy:0,cw:12,ch:2},{cx:0,cy:2,cw:3,ch:14},{cx:3,cy:2,cw:9,ch:5},
    {cx:3,cy:7,cw:9,ch:4},{cx:3,cy:11,cw:9,ch:5}],
  dash:[{cx:0,cy:0,cw:12,ch:2},{cx:0,cy:2,cw:2,ch:15},{cx:2,cy:2,cw:10,ch:2},
    {cx:2,cy:4,cw:5,ch:6},{cx:7,cy:4,cw:5,ch:6},{cx:2,cy:10,cw:10,ch:7}],
};
document.querySelectorAll('[data-preset]').forEach(b=>{
  b.onclick=()=>{ boxes=PRESETS[b.dataset.preset].map(o=>({...o})); sel=-1; resize(); commit(true); };
});

function refreshExport(){
  $('codeOut').textContent=EXPORTS[fmt]();
  $('exNote').textContent={
    html:'Styles read from the live preview, so this renders identically.',
    react:'Assumes a component library. Row takes a cols array.',
    tw:'Utility classes with responsive row collapse.',
    json:'Reload this exact sketch with Load.',
  }[fmt];
}
$('bExport').onclick=()=>{ $('mExport').classList.add('on'); refreshExport(); };
$('xExport').onclick=()=>$('mExport').classList.remove('on');
Array.prototype.forEach.call($('segFmt').children, b=>{
  b.onclick=()=>{ Array.prototype.forEach.call($('segFmt').children,x=>x.classList.remove('on'));
    b.classList.add('on'); fmt=b.dataset.f; refreshExport(); };
});
function fallbackCopy(t){
  const ta=document.createElement('textarea');
  ta.value=t; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('Copied'); }catch(_){ toast('Select and copy manually'); }
  ta.remove();
}
$('bCopy').onclick=()=>{
  const t=$('codeOut').textContent;
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(t).then(()=>toast('Copied'),()=>fallbackCopy(t));
  else fallbackCopy(t);
};
$('bDownload').onclick=()=>{
  const blob=new Blob([$('codeOut').textContent],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(project.name||'mirage-page').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'.'+EXT[fmt];
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Downloaded');
};

/* projects UI */
$('bProjects').onclick=()=>{ $('mProj').classList.add('on'); renderProjects(); };
$('xProj').onclick=()=>$('mProj').classList.remove('on');
$('bNewProj').onclick=()=>{ newProject(); renderProjects(); };
$('projName').addEventListener('blur', ()=>{
  const v=$('projName').textContent.trim() || 'Untitled sketch';
  $('projName').textContent=v; project.name=v; saveNow();
});
$('projName').addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); $('projName').blur(); }
  e.stopPropagation();
});
$('bImport').onclick=()=>$('mLoad').classList.add('on');
$('xLoad').onclick=()=>$('mLoad').classList.remove('on');
$('bLoadGo').onclick=()=>{
  try{
    const d=JSON.parse($('loadBox').value);
    if(!d||!Array.isArray(d.boxes)) throw new Error('bad');
    boxes=d.boxes.map(b=>{
      if(typeof b.cx==='number') return b;
      return {cx:Math.round((b.x||0)*(d.cols||12)), cy:Math.round((b.y||0)*30),
        cw:Math.max(1,Math.round((b.w||1)*(d.cols||12))), ch:Math.max(1,Math.round((b.h||.1)*30)),
        type:b.type, cells:b.cells, head:b.head, body:b.body, locked:b.locked};
    });
    COLS=d.cols||12; theme=d.theme||'';
    project={id:uid(), name:d.name||'Imported sketch'};
    $('projName').textContent=project.name;
    Array.prototype.forEach.call($('segCols').children,x=>x.classList.toggle('on',+x.dataset.cols===COLS));
    $('themeSel').value=theme; $('ovCols').textContent=COLS;
    for(let i=boxes.length-1;i>=0;i--) if(collides(boxes[i],i)) boxes.splice(i,1);
    sel=-1; $('mLoad').classList.remove('on'); resize(); commit(true); toast('Sketch imported');
  }catch(_){ toast('That is not a Mirage sketch'); }
};

const KEYS=[['Draw a box','drag'],['Move a box','drag it'],['Resize','drag a handle'],
  ['Delete box','right-click / Del'],['Edit text','click it in the preview'],['Undo','\u2318Z'],
  ['Redo','\u21e7\u2318Z'],['Duplicate','\u2318D'],['Projects','\u2318P'],['Tidy rows','T'],
  ['Toggle labels','L'],['Dark mode','D'],['Fullscreen preview','F'],['Export','\u2318E']];
$('keyList').innerHTML=KEYS.map(k=>'<div><span>'+k[0]+'</span><kbd>'+k[1]+'</kbd></div>').join('');
$('bKeys').onclick=()=>$('mKeys').classList.add('on');
$('xKeys').onclick=()=>$('mKeys').classList.remove('on');
document.querySelectorAll('.modal').forEach(m=>{
  m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('on'); });
});

document.addEventListener('keydown', e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  if(e.key==='Escape'){
    const open=document.querySelectorAll('.modal.on');
    if(open.length){ open.forEach(m=>m.classList.remove('on')); return; }
    if($('out').classList.contains('full')){ $('bFull').click(); return; }
    if(typing){ e.target.blur(); return; }
    sel=-1; syncSel(); paint(); return;
  }
  if(typing) return;
  const m=e.metaKey||e.ctrlKey, k=e.key.toLowerCase();
  if(m && k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if(m && k==='d'){ e.preventDefault(); $('bDupe').click(); return; }
  if(m && k==='e'){ e.preventDefault(); $('bExport').click(); return; }
  if(m && k==='p'){ e.preventDefault(); $('bProjects').click(); return; }
  if(m) return;
  if(k==='t') $('bTidy').click();
  if(k==='l') $('bLabels').click();
  if(k==='d') $('bTheme').click();
  if(k==='f') $('bFull').click();
  if((k==='delete'||k==='backspace') && sel>=0){ e.preventDefault(); $('bDel').click(); }
  if(k.indexOf('arrow')===0 && sel>=0){
    e.preventDefault();
    const b=boxes[sel], want={cx:b.cx,cy:b.cy,cw:b.cw,ch:b.ch};
    if(k==='arrowleft')  want.cx=Math.max(0,b.cx-1);
    if(k==='arrowright') want.cx=Math.min(COLS-b.cw,b.cx+1);
    if(k==='arrowup')    want.cy=Math.max(0,b.cy-1);
    if(k==='arrowdown')  want.cy=b.cy+1;
    if(!collides(want,sel)){ Object.assign(b,want); resize(); render(); syncSel(); push(); }
  }
});

/* ============================================================ boot */
resize();
hist=[[]]; hi=0; syncHist();
commit(false);
/* reopen the most recent project if there is one */
STORE.all().then(all=>{
  if(all && all.length){
    loadProject(all[0]);
    toast('Reopened "'+all[0].name+'"');
  } else {
    project.id = uid();
    $('projName').textContent = project.name;
  }
}).catch(()=>{ project.id=uid(); });
})();
