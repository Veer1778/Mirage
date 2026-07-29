/* =====================================================================
   Mirage v0.3
   Model is integer grid cells: {cx, cy, cw, ch} measured in columns/rows.
   Cells are square, so a box's aspect ratio is literally ch/cw. That one
   change makes square grid, vertical snapping, collision and side-by-side
   layout all fall out of the same arithmetic.
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
const NICE = Object.fromEntries(TYPES);
const MULTI = ['cards','stats','logos','gallery','price'];

let boxes = [];
let COLS = 12, MINROWS = 26;
let sel = -1;
let showLabels = true, dark = false, theme = '', devW = 0, fmt = 'html';
let hist = [], hi = -1;

const $ = id => document.getElementById(id);
const clone = v => JSON.parse(JSON.stringify(v));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ history */
function push(){
  hist = hist.slice(0, hi+1);
  hist.push(clone(boxes));
  if(hist.length > 90) hist.shift();
  hi = hist.length-1;
  syncHist();
}
function syncHist(){
  $('bUndo').disabled = hi <= 0;
  $('bRedo').disabled = hi >= hist.length-1;
}
function undo(){ if(hi>0){ hi--; boxes = clone(hist[hi]); sel=-1; commit(false); syncHist(); } }
function redo(){ if(hi<hist.length-1){ hi++; boxes = clone(hist[hi]); sel=-1; commit(false); syncHist(); } }

/* ------------------------------------------------------------------ geometry */
function bottomMost(){ return boxes.reduce((m,b)=>Math.max(m, b.cy+b.ch), 0); }
function surfaceRows(){ return Math.max(MINROWS, bottomMost()+6); }

function overlaps(a,b){
  return a.cx < b.cx+b.cw && b.cx < a.cx+a.cw &&
         a.cy < b.cy+b.ch && b.cy < a.cy+a.ch;
}
function collides(rect, skipIdx){
  for(let i=0;i<boxes.length;i++){
    if(i===skipIdx) continue;
    if(overlaps(rect, boxes[i])) return true;
  }
  return false;
}
/* try the full move; if blocked, slide along whichever axis is free */
function tryPlace(idx, want){
  const b = boxes[idx];
  const attempts = [
    want,
    {cx:want.cx, cy:b.cy, cw:want.cw, ch:want.ch},
    {cx:b.cx,    cy:want.cy, cw:want.cw, ch:want.ch},
  ];
  for(const a of attempts){
    if(a.cx<0 || a.cy<0 || a.cx+a.cw>COLS || a.cw<1 || a.ch<1) continue;
    if(!collides(a, idx)){ Object.assign(b, a); return true; }
  }
  return false;
}

/* ------------------------------------------------------------------ canvas */
const cv = $('sk'), ctx = cv.getContext('2d');
const scroller = $('scroll');
let W=0, H=0, cell=0, DPR=Math.min(devicePixelRatio||1,2);

function resize(){
  const r = scroller.getBoundingClientRect();
  W = r.width;
  cell = W / COLS;                       // square cells
  H = surfaceRows() * cell;
  cv.style.height = H + 'px';
  cv.width  = Math.max(1, Math.round(W*DPR));
  cv.height = Math.max(1, Math.round(H*DPR));
  ctx.setTransform(DPR,0,0,DPR,0,0);
  paint();
}
new ResizeObserver(resize).observe(scroller);

const px = b => ({x:b.cx*cell, y:b.cy*cell, w:b.cw*cell, h:b.ch*cell});

function jit(i,s){ return ((Math.sin(i*12.9898 + s*78.233)*43758.5453)%1)*1.6; }
function shaky(x,y,w,h){
  ctx.beginPath();
  const p=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
  for(let e=0;e<4;e++){
    const a=p[e], b=p[e+1];
    const seg=Math.max(2, Math.hypot(b[0]-a[0], b[1]-a[1])/24|0);
    if(e===0) ctx.moveTo(a[0],a[1]);
    for(let i=1;i<=seg;i++){
      const t=i/seg;
      ctx.lineTo(a[0]+(b[0]-a[0])*t + (i<seg?jit(i,a[0]+e):0),
                 a[1]+(b[1]-a[1])*t + (i<seg?jit(i,a[1]+e):0));
    }
  }
  ctx.stroke();
}

let drawing = null, guides = [];

function css(v){ return getComputedStyle(document.body).getPropertyValue(v).trim(); }

function paint(){
  const g1=css('--sk-g1'), g2=css('--sk-g2'), inkc=css('--sk-ink');
  ctx.clearRect(0,0,W,H);

  const rows = Math.ceil(H/cell);
  const MAJOR = 4;                       // emphasise every fourth line

  /* minor cell hairlines, kept very quiet */
  ctx.globalAlpha = .45; ctx.strokeStyle = g2; ctx.lineWidth = 1;
  ctx.beginPath();
  for(let r=1;r<rows;r++){ if(r%MAJOR===0) continue;
    const y=Math.round(r*cell)+.5; ctx.moveTo(0,y); ctx.lineTo(W,y); }
  for(let c=1;c<COLS;c++){ if(c%MAJOR===0) continue;
    const x=Math.round(c*cell)+.5; ctx.moveTo(x,0); ctx.lineTo(x,H); }
  ctx.stroke();

  /* major lines every four cells */
  ctx.globalAlpha = .9; ctx.strokeStyle = g1;
  ctx.beginPath();
  for(let r=MAJOR;r<rows;r+=MAJOR){ const y=Math.round(r*cell)+.5; ctx.moveTo(0,y); ctx.lineTo(W,y); }
  for(let c=MAJOR;c<COLS;c+=MAJOR){ const x=Math.round(c*cell)+.5; ctx.moveTo(x,0); ctx.lineTo(x,H); }
  ctx.stroke();

  /* intersection ticks: what makes it read as drafting paper rather than a table */
  ctx.globalAlpha = 1; ctx.fillStyle = g1;
  for(let r=0;r<=rows;r++){
    for(let c=0;c<=COLS;c++){
      const x=Math.round(c*cell), y=Math.round(r*cell);
      const major = (r%MAJOR===0 && c%MAJOR===0);
      ctx.fillRect(x-(major?1:0.5), y-(major?1:0.5), major?2:1, major?2:1);
    }
  }

  /* outer margin rule */
  ctx.globalAlpha = .55; ctx.strokeStyle = g1; ctx.lineWidth = 1;
  ctx.strokeRect(.5,.5,W-1,H-1);
  ctx.globalAlpha = 1;

  const info = classify();

  /* row bands behind the boxes so multi-box rows read as one unit */
  info.rows.forEach(row=>{
    if(row.items.length<2) return;
    const top=row.top*cell, bot=row.bottom*cell;
    ctx.fillStyle='rgba(31,95,139,.05)';
    ctx.fillRect(0, top-3, W, (bot-top)+6);
    ctx.strokeStyle='rgba(31,95,139,.30)'; ctx.setLineDash([4,4]); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,top-3); ctx.lineTo(W,top-3);
    ctx.moveTo(0,bot+3); ctx.lineTo(W,bot+3); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(31,95,139,.75)';
    ctx.font='500 9px "IBM Plex Mono", monospace'; ctx.textAlign='right';
    ctx.fillText('ROW · '+row.items.length+' across', W-6, top+10);
    ctx.textAlign='left';
  });

  info.list.forEach((b,i)=>{
    const g=px(b), isSel=i===sel;
    ctx.fillStyle = isSel ? 'rgba(239,196,74,.22)' : 'rgba(31,95,139,.09)';
    ctx.fillRect(g.x,g.y,g.w,g.h);
    ctx.strokeStyle = isSel ? '#EFC44A' : (b.locked ? '#1F5F8B' : inkc);
    ctx.lineWidth   = isSel ? 2.2 : (b.locked ? 1.8 : 1.4);
    shaky(g.x,g.y,g.w,g.h);

    if(b.cells>1){
      ctx.strokeStyle='rgba(127,140,155,.85)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
      for(let k=1;k<b.cells;k++){
        ctx.beginPath();
        const x=g.x+(g.w/b.cells)*k;
        ctx.moveTo(x,g.y+5); ctx.lineTo(x,g.y+g.h-5); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if(!b.locked && b.conf<.55){
      ctx.fillStyle='#D9843F'; ctx.beginPath(); ctx.arc(g.x+g.w-9,g.y+9,3.2,0,6.283); ctx.fill();
    }

    if(showLabels && g.h>18){
      const lb = NICE[b.type] + (b.cells>1 ? ' \u00d7'+b.cells : '');
      ctx.font='500 10px "IBM Plex Mono", monospace';
      const tw=ctx.measureText(lb).width;
      const ly=Math.max(0,g.y-15);
      ctx.fillStyle = isSel?'#EFC44A':(b.locked?'#1F5F8B':inkc);
      ctx.fillRect(g.x, ly, tw+12, 15);
      ctx.fillStyle = isSel ? '#141C22' : (dark ? '#0E1418' : '#E2E7EB');
      ctx.textBaseline='middle'; ctx.textAlign='left';
      ctx.fillText(lb, g.x+6, ly+7.5);
      ctx.fillStyle='rgba(127,140,155,.95)';
      ctx.font='400 9px "IBM Plex Mono", monospace'; ctx.textAlign='right';
      ctx.fillText(b.cw+'\u00d7'+b.ch, g.x+g.w-5, g.y+g.h-6);
      ctx.textAlign='left';
    }
    if(isSel){
      ctx.fillStyle='#EFC44A'; ctx.strokeStyle=inkc; ctx.lineWidth=1;
      handles(b).forEach(h=>{
        ctx.fillRect(h.x-4,h.y-4,8,8); ctx.strokeRect(h.x-4,h.y-4,8,8);
      });
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
    ctx.strokeRect(r.cx*cell, r.cy*cell, r.cw*cell, r.ch*cell);
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(127,140,155,.95)';
    ctx.font='400 9px "IBM Plex Mono", monospace';
    ctx.fillText(r.cw+'\u00d7'+r.ch, r.cx*cell+4, Math.max(9, r.cy*cell-5));
  }
}

function handles(b){
  const g=px(b);
  return [{id:'nw',x:g.x,y:g.y},{id:'n',x:g.x+g.w/2,y:g.y},{id:'ne',x:g.x+g.w,y:g.y},
          {id:'e',x:g.x+g.w,y:g.y+g.h/2},{id:'se',x:g.x+g.w,y:g.y+g.h},
          {id:'s',x:g.x+g.w/2,y:g.y+g.h},{id:'sw',x:g.x,y:g.y+g.h},{id:'w',x:g.x,y:g.y+g.h/2}];
}

/* ------------------------------------------------------------------ rows */
/* Boxes whose vertical spans overlap belong to the same row, and a row is
   rendered as a horizontal band. This is what allows an image beside a hero. */
function buildRows(list){
  const rows = [];
  list.map((b,i)=>({b,i}))
      .sort((p,q)=> p.b.cy - q.b.cy || p.b.cx - q.b.cx)
      .forEach(o=>{
        const top=o.b.cy, bot=o.b.cy+o.b.ch;
        const r = rows.find(r => top < r.bottom && r.top < bot);
        if(r){ r.items.push(o); r.top=Math.min(r.top,top); r.bottom=Math.max(r.bottom,bot); }
        else rows.push({top, bottom:bot, items:[o]});
      });
  rows.forEach(r=>r.items.sort((a,b)=>a.b.cx-b.b.cx));
  return rows.sort((a,b)=>a.top-b.top);
}

/* ------------------------------------------------------------------ classifier */
function classify(){
  const list = boxes.map(b=>({...b}));
  const rows = buildRows(list);
  const n = rows.length;

  rows.forEach((row, ri)=>{
    const first = ri===0, last = ri===n-1;
    row.items.forEach(o=>{
      const b = list[o.i];
      b.row = ri;
      if(b.locked){
        b.conf = 1;
        if(MULTI.indexOf(b.type)>=0 && !b.cells) b.cells = 3;
        return;
      }
      const full  = b.cw >= COLS*0.78;
      const ratio = b.ch / b.cw;
      const alone = row.items.length === 1;
      let t='text', c=.5;

      if(first && full && b.ch<=2)                    { t='nav';     c=.95; }
      else if(last && full && b.ch<=3 && n>1)         { t='footer';  c=.90; }
      else if(ri<=1 && full && b.ch>=5)               { t='hero';    c=.88; }
      else if(!alone && ratio>=0.85 && b.cw<=COLS*0.5){ t='image';   c=.74; }
      else if(!alone && b.cw<=COLS*0.3 && ratio>1.3)  { t='sidebar'; c=.84; }
      else if(!alone && b.ch>=4)                      { t='text';    c=.70; }
      else if(full && b.ch<=2)                        { t='stats';   c=.58; b.cells=b.cells||3; }
      else if(b.cw<=COLS*0.3 && ratio>1.4)            { t='sidebar'; c=.84; }
      else if(b.cw<=COLS*0.28 && b.ch<=2)             { t='button';  c=.80; }
      else if(ratio>=0.75 && b.cw<COLS*0.72)          { t='image';   c=.68; }
      else if(full && b.ch>=3 && b.ch<=4)             { t='banner';  c=.52; }
      else                                            { t='text';    c= full?.74:.56; }
      b.type=t; b.conf=c;
    });

    /* a row of same-width, same-type boxes is one repeating component */
    const it = row.items.map(o=>list[o.i]);
    if(it.length>=2 && !it.some(b=>b.locked)){
      const ws = it.map(b=>b.cw);
      const uniform = Math.max.apply(null,ws)-Math.min.apply(null,ws) <= 1;
      const sameType = it.every(b=>b.type===it[0].type);
      if(uniform && sameType && it[0].cw <= COLS*0.5){
        const short = row.bottom-row.top <= 2;
        const t = (it.length>=4 && short) ? 'logos' : (short ? 'stats' : 'cards');
        it.forEach(b=>{ b.type=t; b.conf=.86; });
        it[0].cells = it.length; it[0].lead = true;
        it.slice(1).forEach(b=>b.merged=true);
        row.merged = true;
      }
    }
  });
  return {list, rows};
}

/* ------------------------------------------------------------------ copy */
const DEF = {
  brand:'Mirage',
  navLinks:['Docs','Components','Roadmap'],
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
  code:'<section class="row">\n  <header class="hero">…</header>\n  <figure class="media">…</figure>\n</section>',
};

/* ------------------------------------------------------------------ render */
const sheet = $('sheet');
function esc(s){ return String(s).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function render(){
  const {list, rows} = classify();
  sheet.className = theme ? 'th-'+theme : '';
  sheet.style.maxWidth = devW ? devW+'px' : '100%';

  if(!rows.length){
    sheet.innerHTML = '<div class="void"><div class="t1">The page renders here</div>'+
      '<div class="t2">Boxes that share a row are built side by side. Boxes stacked vertically become sections.</div></div>';
    return;
  }
  sheet.innerHTML = '';
  let k = 0;
  rows.forEach(row=>{
    const items = row.items.map(o=>list[o.i]).filter(b=>!b.merged);
    if(!items.length) return;

    if(items.length === 1){
      const el = build(items[0]);
      if(el){ el.classList.add('cx'); el.style.animationDelay=(k++*34)+'ms'; sheet.appendChild(el); }
      return;
    }
    /* genuine side-by-side row */
    const wrap = document.createElement('div');
    wrap.className = 'c-row cx';
    wrap.style.animationDelay = (k++*34)+'ms';
    wrap.style.gridTemplateColumns = items.map(b=>b.cw+'fr').join(' ');
    items.forEach(b=>{ const el=build(b); if(el) wrap.appendChild(el); });
    sheet.appendChild(wrap);
  });
}

function build(b){
  const d = document.createElement('div');
  const hpx = Math.max(60, b.ch*46);
  const n = clamp(b.cells||3, 2, 6);
  const H1 = b.head ? esc(b.head) : null;
  const B1 = b.body ? esc(b.body) : null;

  switch(b.type){
    case 'nav':
      d.className='c-nav';
      d.innerHTML='<span class="lg">'+(H1||DEF.brand)+'</span><span class="ln">'+
        (B1?B1.split(',').map(s=>'<span>'+s.trim()+'</span>').join(''):
             DEF.navLinks.map(l=>'<span>'+l+'</span>').join(''))+
        '</span><button class="cta">Get started</button>'; break;
    case 'hero':
      d.className='c-hero';
      d.innerHTML='<h1>'+(H1||DEF.heroH)+'</h1><p>'+(B1||DEF.heroB)+'</p>'+
        '<div class="bs"><button class="b1">Start drawing</button><button class="b2">Read the docs</button></div>'; break;
    case 'cards':
      d.className='c-grid'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=DEF.cards.slice(0,n).map(c=>'<div class="c-card"><div class="k">'+c[0]+
        '</div><h4>'+c[1]+'</h4><p>'+c[2]+'</p></div>').join(''); break;
    case 'text':
      d.className='c-text'; d.innerHTML='<h3>'+(H1||DEF.textH)+'</h3><p>'+(B1||DEF.textB)+'</p>'; break;
    case 'image':
      d.className='c-img'; d.style.minHeight=hpx+'px'; d.textContent=(b.head||'IMAGE'); break;
    case 'gallery':
      d.className='c-gal'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=Array.from({length:n},()=>'<div class="c-img" style="min-height:'+
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
      d.innerHTML='<blockquote>'+(H1||DEF.quote)+'</blockquote><div class="who">'+(B1||DEF.who)+'</div>'; break;
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
        '</span>').join('')+'</div><p>'+(B1||DEF.textB)+'</p>'; break;
    case 'price':
      d.className='c-price'; d.style.gridTemplateColumns='repeat('+Math.min(n,3)+',minmax(0,1fr))';
      d.innerHTML=DEF.price.slice(0,Math.min(n,3)).map(p=>'<div class="p"><div class="tn">'+p[0]+
        '</div><div class="am">'+p[1]+'</div><ul><li>'+p[2]+'</li><li>Unlimited sketches</li><li>Self host it</li></ul></div>').join(''); break;
    case 'banner':
      d.className='c-banner';
      d.innerHTML='<h3>'+(H1||'Draw the page. Ship the page.')+'</h3><span class="b">Open the editor</span>'; break;
    case 'code':
      d.className='c-code'; d.innerHTML='<pre>'+esc(b.body||DEF.code)+'</pre>'; break;
    case 'button':
      d.className='c-btn'; d.innerHTML='<button>'+(H1||'Start drawing')+'</button>'; break;
    case 'footer':
      d.className='c-foot';
      d.innerHTML='<span>'+(H1||DEF.brand)+'</span><span class="sp">'+(B1||'Drawn, not configured')+'</span>'; break;
    default: return null;
  }
  return d;
}

/* ------------------------------------------------------------------ export */
const TOK = {
  '':                 {bg:'#FBFCFD',fg:'#141C22',mut:'#5A6873',line:'#E4E9ED',acc:'#1F5F8B',rad:'2px',pad:'26px',fd:'system-ui, sans-serif'},
  'editorial':        {bg:'#FCFBF7',fg:'#1A1714',mut:'#6B635A',line:'#E6E1D6',acc:'#8A5A2B',rad:'0',pad:'26px',fd:'"Instrument Serif", Georgia, serif'},
  'brutal':           {bg:'#F2F0EA',fg:'#0B0B0B',mut:'#3A3A3A',line:'#0B0B0B',acc:'#0B0B0B',rad:'0',pad:'26px',fd:'system-ui, sans-serif'},
  'soft':             {bg:'#FAFAFC',fg:'#1B1E2B',mut:'#6E7488',line:'#EBECF2',acc:'#5B5BD6',rad:'12px',pad:'30px',fd:'system-ui, sans-serif'},
  'terminal':         {bg:'#0D1117',fg:'#D6DEE4',mut:'#7C8B96',line:'#1E262E',acc:'#4FE0B0',rad:'0',pad:'26px',fd:'"JetBrains Mono", monospace'},
  'monochrome':       {bg:'#FFFFFF',fg:'#000000',mut:'#333333',line:'#000000',acc:'#000000',rad:'0',pad:'32px',fd:'"Playfair Display", Didot, serif'},
  'newsprint':        {bg:'#F4EFE4',fg:'#161310',mut:'#5A5147',line:'#161310',acc:'#8A1E1E',rad:'0',pad:'26px',fd:'"Playfair Display", Georgia, serif'},
  'luxury':           {bg:'#F5F1EA',fg:'#1A1611',mut:'#6C5F4A',line:'#D9CDB4',acc:'#8A6D3B',rad:'0',pad:'34px',fd:'"Cormorant Garamond", Georgia, serif'},
  'academia':         {bg:'#F1EAD8',fg:'#2B1F14',mut:'#6B5942',line:'#C8B994',acc:'#5B2A1E',rad:'0',pad:'28px',fd:'"EB Garamond", Georgia, serif'},
  'botanical':        {bg:'#F1EFE6',fg:'#2A2E23',mut:'#5F6B54',line:'#CFD1BE',acc:'#4C6B3D',rad:'4px',pad:'28px',fd:'Fraunces, Georgia, serif'},
  'organic':          {bg:'#F6F1EA',fg:'#2C221A',mut:'#6D604F',line:'#E1D6C4',acc:'#B76E3D',rad:'22px',pad:'30px',fd:'Fraunces, Georgia, serif'},
  'bauhaus':          {bg:'#F2ECDA',fg:'#111111',mut:'#3A3A3A',line:'#111111',acc:'#D3212C',rad:'0',pad:'26px',fd:'"Archivo Black", sans-serif'},
  'saas':             {bg:'#FFFFFF',fg:'#0F1730',mut:'#6B7488',line:'#EDEFF5',acc:'#4F46E5',rad:'8px',pad:'30px',fd:'Inter, system-ui, sans-serif'},
  'swiss-minimalist': {bg:'#FFFFFF',fg:'#000000',mut:'#4A4A4A',line:'#000000',acc:'#E30613',rad:'0',pad:'28px',fd:'"Helvetica Neue", Inter, Arial, sans-serif'},
  'flat-design':      {bg:'#F5F7FA',fg:'#2D3E50',mut:'#7F8C8D',line:'#DFE6E9',acc:'#E74C3C',rad:'4px',pad:'26px',fd:'Inter, system-ui, sans-serif'},
  'material-design':  {bg:'#FAFAFA',fg:'#212121',mut:'#616161',line:'#E0E0E0',acc:'#1976D2',rad:'4px',pad:'24px',fd:'Roboto, sans-serif'},
  'neo-brutalism':    {bg:'#F5F0E5',fg:'#0B0B0B',mut:'#3A3A3A',line:'#0B0B0B',acc:'#FF5A1F',rad:'0',pad:'26px',fd:'"Space Grotesk", sans-serif'},
  'playful-geometric':{bg:'#FFF5E7',fg:'#2A1E4A',mut:'#6E5A94',line:'#F4C6D0',acc:'#F76C6C',rad:'18px',pad:'28px',fd:'"Space Grotesk", sans-serif'},
  'claymorphism':     {bg:'#E8E4F5',fg:'#2F2A5B',mut:'#6E68A0',line:'#D6D0EB',acc:'#7F6BD6',rad:'24px',pad:'28px',fd:'Nunito, sans-serif'},
  'professional':     {bg:'#FFFFFF',fg:'#1B2733',mut:'#5F6C7B',line:'#E4E9EE',acc:'#0B5FFF',rad:'3px',pad:'26px',fd:'Inter, system-ui, sans-serif'},
  'enterprise':       {bg:'#F8F9FB',fg:'#0F1419',mut:'#5B6572',line:'#DDE2E8',acc:'#0057B7',rad:'2px',pad:'22px',fd:'"IBM Plex Sans", sans-serif'},
  'sketch':           {bg:'#FCFAF3',fg:'#1F1B14',mut:'#6B6350',line:'#1F1B14',acc:'#D66D3C',rad:'6px',pad:'26px',fd:'Caveat, cursive'},
  'industrial':       {bg:'#DFDCD5',fg:'#1A1A1A',mut:'#4A4744',line:'#3A3735',acc:'#C24A2C',rad:'0',pad:'26px',fd:'Oswald, sans-serif'},
  'neumorphism':      {bg:'#E4E9EF',fg:'#2A3140',mut:'#5F6B7C',line:'#D4DAE2',acc:'#4F7BE8',rad:'18px',pad:'28px',fd:'Inter, system-ui, sans-serif'},
  'maximalism':       {bg:'#FFF3D6',fg:'#1A1A1A',mut:'#4A2A5A',line:'#1A1A1A',acc:'#E5197A',rad:'8px',pad:'26px',fd:'"Space Grotesk", sans-serif'},
  'retro':            {bg:'#F0E5C9',fg:'#1E1810',mut:'#6A5C41',line:'#C9B98A',acc:'#B5471E',rad:'0',pad:'26px',fd:'VT323, monospace'},
  'modern-dark':      {bg:'#0B0B0F',fg:'#F4F5F7',mut:'#8A8F9A',line:'#1E2028',acc:'#7C5CFF',rad:'8px',pad:'28px',fd:'Inter, system-ui, sans-serif'},
  'kinetic':          {bg:'#000000',fg:'#FFFFFF',mut:'#A0A0A0',line:'#1A1A1A',acc:'#00E5A0',rad:'0',pad:'28px',fd:'"Space Grotesk", sans-serif'},
  'bold-typography':  {bg:'#0A0A0A',fg:'#F5F5F0',mut:'#9C9C95',line:'#1A1A1A',acc:'#F5F5F0',rad:'0',pad:'28px',fd:'"Archivo Black", sans-serif'},
  'web3':             {bg:'#0A0715',fg:'#EFEBFF',mut:'#8479B0',line:'#1F1735',acc:'#B67AFF',rad:'12px',pad:'28px',fd:'"Space Grotesk", sans-serif'},
  'minimal-dark':     {bg:'#0E0E10',fg:'#EDEEF0',mut:'#7A7C82',line:'#1F2124',acc:'#EDEEF0',rad:'2px',pad:'30px',fd:'Inter, system-ui, sans-serif'},
  'vaporwave':        {bg:'#1A0A2E',fg:'#FF71CE',mut:'#B79FD4',line:'#3A1A5A',acc:'#01CDFE',rad:'0',pad:'26px',fd:'VT323, monospace'},
  'art-deco':         {bg:'#141428',fg:'#D4AF37',mut:'#A8913F',line:'#D4AF37',acc:'#E94560',rad:'0',pad:'30px',fd:'"Poiret One", serif'},
  'terminal-dp':      {bg:'#0D1117',fg:'#00FF66',mut:'#3A8A5A',line:'#1E262E',acc:'#FFCC00',rad:'0',pad:'26px',fd:'"JetBrains Mono", monospace'},
  'cyberpunk':        {bg:'#0A0A0F',fg:'#FF00FF',mut:'#B07FC4',line:'#2A0F3A',acc:'#00FFFF',rad:'0',pad:'26px',fd:'Orbitron, monospace'},
};

function laidRows(){
  const {list, rows} = classify();
  return rows.map(r=>({
    items: r.items.map(o=>list[o.i]).filter(b=>!b.merged)
  })).filter(r=>r.items.length);
}

function tagFor(b){
  const n = clamp(b.cells||3,2,6);
  switch(b.type){
    case 'nav':    return ['<nav class="nav">','  <a class="brand" href="/">'+(b.head||DEF.brand)+'</a>\n  <ul class="nav-links"><li><a href="#">Docs</a></li></ul>','</nav>'];
    case 'hero':   return ['<header class="hero">','  <h1>'+(b.head||DEF.heroH)+'</h1>\n  <p>'+(b.body||'Supporting sentence.')+'</p>\n  <a class="btn" href="#">Start drawing</a>','</header>'];
    case 'cards':  return ['<section class="grid cols-'+n+'">', Array.from({length:n},()=>'  <article class="card"><h3>Heading</h3><p>Body copy.</p></article>').join('\n'),'</section>'];
    case 'text':   return ['<section class="prose">','  <h2>'+(b.head||DEF.textH)+'</h2>\n  <p>Body copy.</p>','</section>'];
    case 'image':  return ['<figure class="media">','  <img src="" alt="">','</figure>'];
    case 'gallery':return ['<section class="gallery cols-'+n+'">', Array.from({length:n},()=>'  <figure><img src="" alt=""></figure>').join('\n'),'</section>'];
    case 'sidebar':return ['<aside class="rail">','  <nav><a class="is-active" href="#">Overview</a></nav>','</aside>'];
    case 'stats':  return ['<section class="stats cols-'+n+'">', Array.from({length:n},()=>'  <div class="stat"><strong>00</strong><span>label</span></div>').join('\n'),'</section>'];
    case 'logos':  return ['<section class="logos">','  <img src="" alt="">','</section>'];
    case 'quote':  return ['<figure class="quote">','  <blockquote>'+(b.head||'Quotation.')+'</blockquote>\n  <figcaption>'+(b.body||'Attribution')+'</figcaption>','</figure>'];
    case 'form':   return ['<form class="form">','  <label>Email <input type="email" name="email"></label>\n  <button type="submit">Send</button>','</form>'];
    case 'table':  return ['<table class="table">','  <thead><tr><th>Column</th></tr></thead>\n  <tbody><tr><td>Cell</td></tr></tbody>','</table>'];
    case 'tabs':   return ['<div class="tabs" role="tablist">','  <button role="tab" aria-selected="true">One</button>','</div>'];
    case 'price':  return ['<section class="pricing cols-'+Math.min(n,3)+'">','  <div class="tier"><h3>Free</h3><p class="amount">$0</p></div>','</section>'];
    case 'banner': return ['<section class="banner">','  <h2>'+(b.head||'Draw the page. Ship the page.')+'</h2>\n  <a class="btn" href="#">Open the editor</a>','</section>'];
    case 'code':   return ['<pre class="code">','  <code>…</code>','</pre>'];
    case 'button': return ['<a class="btn" href="#">'+(b.head||'Start drawing')+'</a>', null, null];
    case 'footer': return ['<footer class="foot">','  <small>'+(b.head||DEF.brand)+'</small>','</footer>'];
  }
  return ['<div>',null,'</div>'];
}

function exHTML(){
  const R = laidRows();
  if(!R.length) return '<!-- nothing drawn yet -->';
  const ind = (s,p) => s.split('\n').map(l=>p+l).join('\n');

  const body = R.map(row=>{
    if(row.items.length===1){
      const [o,inner,c] = tagFor(row.items[0]);
      return c ? ind(o+'\n'+inner+'\n'+c,'  ') : ind(o,'  ');
    }
    const cols = row.items.map(b=>b.cw+'fr').join(' ');
    const kids = row.items.map(b=>{
      const [o,inner,c] = tagFor(b);
      return c ? ind(o+'\n'+inner+'\n'+c,'    ') : ind(o,'    ');
    }).join('\n');
    return '  <section class="row" style="--cols:'+cols+'">\n'+kids+'\n  </section>';
  }).join('\n\n');

  const tk = TOK[theme] || TOK[''];
  const css = [
    ':root{',
    '  --bg:'+tk.bg+'; --fg:'+tk.fg+'; --mut:'+tk.mut+'; --line:'+tk.line+';',
    '  --acc:'+tk.acc+'; --pad:'+tk.pad+'; --radius:'+tk.rad+';',
    '  --font:'+tk.fd+';',
    '}',
    '.page{background:var(--bg);color:var(--fg);font-family:var(--font)}',
    '',
    '/* rows: this is what puts components side by side */',
    '.row{display:grid;grid-template-columns:var(--cols);align-items:stretch;',
    '     border-bottom:1px solid var(--line)}',
    '.row > * + *{border-left:1px solid var(--line)}',
    '',
    '.nav{display:flex;align-items:center;gap:18px;padding:14px var(--pad);',
    '     border-bottom:1px solid var(--line)}',
    '.nav-links{display:flex;gap:14px;margin-left:auto;list-style:none}',
    '.hero{padding:calc(var(--pad)*1.8) var(--pad)}',
    '.hero h1{font-size:clamp(26px,4vw,42px);line-height:1.04;letter-spacing:-.03em;max-width:15ch}',
    '.prose,.stats,.grid,.gallery,.pricing,.rail{padding:var(--pad)}',
    '.grid,.gallery,.stats,.pricing{display:grid;gap:11px}',
    Array.from({length:5},(_,i)=>'.cols-'+(i+2)+'{grid-template-columns:repeat('+(i+2)+',minmax(0,1fr))}').join('\n'),
    '.card{border:1px solid var(--line);padding:15px;border-radius:var(--radius)}',
    '.btn{background:var(--acc);color:var(--bg);padding:10px 17px;border-radius:var(--radius);',
    '     text-decoration:none;display:inline-block}',
    '.media{background:var(--line);min-height:180px;margin:0;display:grid;place-items:center}',
    '.banner{padding:calc(var(--pad)*1.4) var(--pad);background:var(--acc);color:var(--bg)}',
    '.foot{padding:var(--pad);border-top:1px solid var(--line);color:var(--mut)}',
    '',
    '@media (max-width:720px){',
    '  .row{grid-template-columns:1fr}',
    '  .row > * + *{border-left:none;border-top:1px solid var(--line)}',
    '  .grid,.gallery,.stats,.pricing{grid-template-columns:1fr}',
    '}',
  ].join('\n');

  return '<!-- generated by Mirage -->\n<main class="page">\n'+body+'\n</main>\n\n<style>\n'+css+'\n</style>';
}

const RMAP = {nav:'Nav',hero:'Hero',cards:'CardGrid',text:'Prose',image:'Figure',gallery:'Gallery',
  sidebar:'Rail',stats:'Stats',logos:'LogoRow',quote:'Quote',form:'Form',table:'DataTable',
  tabs:'Tabs',price:'Pricing',banner:'Banner',code:'CodeBlock',button:'Button',footer:'Footer'};

function exReact(){
  const R = laidRows();
  if(!R.length) return '// nothing drawn yet';
  const one = (b,pad) => {
    const n = clamp(b.cells||3,2,6), C = RMAP[b.type];
    const props = {
      nav:'brand="'+(b.head||DEF.brand)+'" links={nav}', hero:'title="'+(b.head||DEF.heroH)+'" body={copy.hero}',
      cards:'columns={'+n+'} items={items}', text:'heading="'+(b.head||DEF.textH)+'"',
      image:'src={img} alt="" ', gallery:'columns={'+n+'}', sidebar:'items={nav}',
      stats:'columns={'+n+'} data={stats}', logos:'logos={logos}', quote:'attribution={copy.who}',
      form:'fields={["email"]} onSubmit={onSubmit}', table:'columns={cols} rows={rows}',
      tabs:'items={tabs}', price:'tiers={tiers} columns={'+Math.min(n,3)+'}',
      banner:'title="'+(b.head||'Draw the page. Ship the page.')+'"', code:'language="html"',
      button:'', footer:'brand="'+(b.head||DEF.brand)+'"',
    }[b.type] || '';
    return pad+'<'+C+(props?' '+props:'')+' />';
  };
  const body = R.map(row=>{
    if(row.items.length===1) return one(row.items[0],'      ');
    const cols = row.items.map(b=>b.cw).join(',');
    return '      <Row cols={['+cols+']}>\n'+row.items.map(b=>one(b,'        ')).join('\n')+'\n      </Row>';
  }).join('\n');
  const used = [];
  R.forEach(r=>r.items.forEach(b=>{ const c=RMAP[b.type]; if(c && used.indexOf(c)<0) used.push(c); }));
  if(R.some(r=>r.items.length>1)) used.unshift('Row');
  return "// generated by Mirage\nimport { "+used.join(', ')+" } from '@mirage/ui'\n\n"+
         "export default function Page() {\n  return (\n    <main className=\"page\">\n"+body+"\n    </main>\n  )\n}";
}

function exTW(){
  const R = laidRows();
  if(!R.length) return '<!-- nothing drawn yet -->';
  const TW = {
    nav:'flex items-center gap-5 px-6 py-3.5 border-b border-neutral-200',
    hero:'px-6 py-14', cards:'grid gap-3 p-6', text:'p-6 max-w-prose',
    image:'bg-neutral-100 min-h-[180px] grid place-items-center', gallery:'grid gap-2 p-6',
    sidebar:'p-6 space-y-1', stats:'grid gap-px bg-neutral-200 p-6',
    logos:'flex flex-wrap items-center justify-between gap-3 p-6 opacity-70',
    quote:'px-6 py-10', form:'p-6 grid gap-2 max-w-md', table:'p-6 overflow-x-auto',
    tabs:'p-6', price:'grid gap-3 p-6', banner:'px-6 py-12 bg-neutral-900 text-white',
    code:'m-6 p-4 bg-neutral-900 text-neutral-100 rounded text-xs overflow-auto',
    button:'p-6', footer:'p-6 border-t border-neutral-200 text-sm text-neutral-500',
  };
  const TAG = {nav:'nav',hero:'header',image:'figure',quote:'figure',form:'form',
    code:'pre',footer:'footer',sidebar:'aside'};
  const one = (b,pad) => {
    const n = clamp(b.cells||3,2,6);
    let cls = TW[b.type]||'p-6';
    if(['cards','gallery','stats','price'].indexOf(b.type)>=0) cls += ' grid-cols-1 md:grid-cols-'+n;
    const t = TAG[b.type]||'section';
    return pad+'<'+t+' class="'+cls+'">'+NICE[b.type]+'</'+t+'>';
  };
  const body = R.map(row=>{
    if(row.items.length===1) return one(row.items[0],'  ');
    const md = row.items.map(b=>b.cw+'fr').join('_');
    return '  <section class="grid grid-cols-1 md:grid-cols-['+md+']">\n'+
           row.items.map(b=>one(b,'    ')).join('\n')+'\n  </section>';
  }).join('\n\n');
  return '<!-- generated by Mirage · Tailwind -->\n<main>\n'+body+'\n</main>';
}

function exJSON(){ return JSON.stringify({version:3, cols:COLS, theme, boxes}, null, 2); }
const EXPORTS = {html:exHTML, react:exReact, tw:exTW, json:exJSON};
const EXT = {html:'html', react:'jsx', tw:'html', json:'json'};

/* ------------------------------------------------------------------ pointer */
function cellAt(e){
  const r = cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)/cell, y:(e.clientY-r.top)/cell };
}
function drawRect(){
  const x0=Math.floor(Math.min(drawing.x0,drawing.x1)), x1=Math.ceil(Math.max(drawing.x0,drawing.x1));
  const y0=Math.floor(Math.min(drawing.y0,drawing.y1)), y1=Math.ceil(Math.max(drawing.y0,drawing.y1));
  return {cx:clamp(x0,0,COLS-1), cy:Math.max(0,y0),
          cw:clamp(x1-x0,1,COLS), ch:Math.max(1,y1-y0)};
}
function hit(p){
  for(let i=boxes.length-1;i>=0;i--){
    const b=boxes[i];
    if(p.x>=b.cx && p.x<=b.cx+b.cw && p.y>=b.cy && p.y<=b.cy+b.ch) return i;
  }
  return -1;
}
function hitHandle(p){
  if(sel<0 || !boxes[sel]) return null;
  const tol = 9/cell;
  for(const h of handles(boxes[sel])){
    if(Math.abs(h.x/cell-p.x)<tol && Math.abs(h.y/cell-p.y)<tol) return h.id;
  }
  return null;
}
/* snap edges to neighbouring boxes so rows form cleanly */
function snapEdges(rect, idx){
  const SNAP = 1;
  guides = [];
  boxes.forEach((o,i)=>{
    if(i===idx) return;
    if(Math.abs(rect.cy-(o.cy+o.ch))<=SNAP){ rect.cy=o.cy+o.ch; guides.push({v:false,p:rect.cy*cell}); }
    else if(Math.abs(rect.cy-o.cy)<=SNAP){ rect.cy=o.cy; guides.push({v:false,p:rect.cy*cell}); }
    if(Math.abs(rect.cx-(o.cx+o.cw))<=SNAP){ rect.cx=o.cx+o.cw; guides.push({v:true,p:rect.cx*cell}); }
    else if(Math.abs(rect.cx-o.cx)<=SNAP){ rect.cx=o.cx; guides.push({v:true,p:rect.cx*cell}); }
  });
  return rect;
}

let mode=null, anchor=null, orig=null, hnd=null, moved=false;

cv.addEventListener('pointerdown', e=>{
  if(e.button===2) return;
  const p = cellAt(e);
  anchor = p; moved = false;
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}

  const h = hitHandle(p);
  if(h){ mode='resize'; hnd=h; orig={...boxes[sel]}; return; }
  const i = hit(p);
  if(i>=0){ if(sel!==i){ sel=i; syncSel(); } mode='move'; orig={...boxes[i]}; paint(); return; }
  sel=-1; syncSel();
  mode='draw'; drawing={x0:p.x,y0:p.y,x1:p.x,y1:p.y};
});

cv.addEventListener('pointermove', e=>{
  const p = cellAt(e);
  if(!mode){
    cv.style.cursor = hitHandle(p) ? 'nwse-resize' : (hit(p)>=0 ? 'move' : 'crosshair');
    return;
  }
  const dx = p.x-anchor.x, dy = p.y-anchor.y;
  if(Math.abs(dx)>0.25 || Math.abs(dy)>0.25) moved = true;

  if(mode==='draw'){ drawing.x1=p.x; drawing.y1=p.y; paint(); return; }

  if(mode==='move'){
    let want = {cx:orig.cx+Math.round(dx), cy:Math.max(0,orig.cy+Math.round(dy)),
                cw:orig.cw, ch:orig.ch};
    want.cx = clamp(want.cx, 0, COLS-want.cw);
    want = snapEdges(want, sel);
    want.cx = clamp(want.cx, 0, COLS-want.cw);
    tryPlace(sel, want);
    resizeIfGrown(); paint(); render(); return;
  }

  if(mode==='resize'){
    let {cx,cy,cw,ch} = orig;
    const rdx = Math.round(dx), rdy = Math.round(dy);
    if(hnd.indexOf('e')>=0) cw = orig.cw+rdx;
    if(hnd.indexOf('w')>=0){ cx = orig.cx+rdx; cw = orig.cw-rdx; }
    if(hnd.indexOf('s')>=0) ch = orig.ch+rdy;
    if(hnd.indexOf('n')>=0){ cy = orig.cy+rdy; ch = orig.ch-rdy; }
    if(cw<1){ cw=1; if(hnd.indexOf('w')>=0) cx=orig.cx+orig.cw-1; }
    if(ch<1){ ch=1; if(hnd.indexOf('n')>=0) cy=orig.cy+orig.ch-1; }
    cx = clamp(cx, 0, COLS-1); cy = Math.max(0, cy);
    cw = clamp(cw, 1, COLS-cx);
    const want = {cx,cy,cw,ch};
    if(!collides(want, sel)) Object.assign(boxes[sel], want);
    resizeIfGrown(); paint(); render(); return;
  }
});

function resizeIfGrown(){
  const need = surfaceRows()*cell;
  if(Math.abs(need-H) > 0.5){ H=need; cv.style.height=H+'px';
    cv.height=Math.max(1,Math.round(H*DPR)); ctx.setTransform(DPR,0,0,DPR,0,0); }
}

function endPointer(){
  guides = [];
  if(mode==='draw'){
    const r = drawRect(); drawing=null;
    if(collides(r,-1)){ toast('That space is taken'); paint(); mode=null; return; }
    boxes.push(r); sel=boxes.length-1; resize(); commit(true);
  } else if(mode==='move' || mode==='resize'){
    if(moved){ resize(); commit(true); } else { paint(); syncSel(); }
  }
  mode=null; hnd=null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', e=>{
  e.preventDefault();
  const i = hit(cellAt(e));
  if(i>=0){ boxes.splice(i,1); sel=-1; resize(); commit(true); }
});
cv.addEventListener('dblclick', e=>{
  const i = hit(cellAt(e));
  if(i>=0){ sel=i; syncSel(); $('fHead').focus(); }
});

/* ------------------------------------------------------------------ UI */
function toast(m){
  const t=$('toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('on'), 1600);
}

function commit(record){
  if(record) push();
  $('blank').classList.toggle('gone', boxes.length>0);
  paint(); render(); syncSel(); syncStats();
  if($('mExport').classList.contains('on')) refreshExport();
}

function syncLayers(){
  const {list, rows} = classify();
  const el = $('layers');
  if(!boxes.length){
    el.innerHTML='<div class="none">Nothing drawn yet. Drag a box on the surface.</div>'; return;
  }
  el.innerHTML='';
  rows.forEach((row, ri)=>{
    const sep=document.createElement('div');
    sep.className='rowsep';
    sep.innerHTML='<span>ROW '+String(ri+1).padStart(2,'0')+'</span><s></s>'+
                  (row.items.length>1 ? '<span>'+row.items.length+' across</span>' : '');
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
  const {rows} = classify();
  $('stBox').textContent = boxes.length;
  $('stComp').textContent = laidRows().reduce((n,r)=>n+r.items.length,0);
  $('stRows').textContent = rows.length;
  $('stLock').textContent = boxes.filter(b=>b.locked).length;
}

const typeGrid = $('typeGrid');
TYPES.forEach(t=>{
  const b=document.createElement('button');
  b.dataset.t=t[0]; b.textContent=t[1];
  b.onclick=()=>{
    const x=boxes[sel]; if(!x) return;
    x.type=t[0]; x.locked=true;
    if(MULTI.indexOf(t[0])>=0 && !x.cells) x.cells=3;
    commit(true);
  };
  typeGrid.appendChild(b);
});

function syncSel(){
  const has = sel>=0 && !!boxes[sel];
  $('paneLayers').classList.toggle('on', !has);
  $('paneInsp').classList.toggle('on', has);
  $('ftSel').textContent = has ? ('box '+(sel+1)+' of '+boxes.length) : 'no selection';
  syncLayers();
  if(!has) return;

  const b = boxes[sel], c = classify().list[sel];
  $('inspHead').textContent = 'Box '+(sel+1)+' \u2014 '+NICE[c.type];
  Array.prototype.forEach.call(typeGrid.children, el=>el.classList.toggle('on', el.dataset.t===c.type));
  const pct = Math.round((b.locked?1:c.conf)*100);
  $('cfLab').textContent = b.locked ? 'set by hand' : 'auto';
  $('cfPct').textContent = pct+'%';
  const bar=$('cfBar'); bar.style.width=pct+'%';
  bar.classList.toggle('low', !b.locked && c.conf<.55);
  $('fW').max=COLS; $('fW').value=b.cw; $('fWV').textContent=b.cw;
  $('fH').value=Math.min(b.ch,24); $('fHV').textContent=b.ch;
  const showCells = MULTI.indexOf(c.type)>=0;
  $('fldCells').hidden = !showCells;
  if(showCells){ const v=b.cells||c.cells||3; $('fCells').value=v; $('fCellsV').textContent=v; }
  $('fHead').value=b.head||''; $('fBody').value=b.body||'';
}

function sizeInput(id, apply){
  $(id).addEventListener('input', ()=>{
    const b=boxes[sel]; if(!b) return;
    const v=+$(id).value;
    const want={cx:b.cx, cy:b.cy, cw:b.cw, ch:b.ch};
    apply(want, v, b);
    if(collides(want, sel)){ toast('That would overlap another box'); syncSel(); return; }
    Object.assign(b, want);
    resize(); paint(); render(); syncStats();
    $(id==='fW'?'fWV':'fHV').textContent=v;
  });
  $(id).addEventListener('change', ()=>{ push(); syncSel(); });
}
sizeInput('fW', (w,v,b)=>{ w.cw = clamp(v, 1, COLS-b.cx); });
sizeInput('fH', (w,v)=>{ w.ch = Math.max(1, v); });
$('fCells').addEventListener('input', ()=>{
  const b=boxes[sel]; if(!b) return;
  b.cells=+$('fCells').value; b.locked=true;
  $('fCellsV').textContent=$('fCells').value;
  render();
});
$('fCells').addEventListener('change', ()=>push());
$('fHead').addEventListener('input', ()=>{ const b=boxes[sel]; if(b){ b.head=$('fHead').value; render(); } });
$('fBody').addEventListener('input', ()=>{ const b=boxes[sel]; if(b){ b.body=$('fBody').value; render(); } });
$('fHead').addEventListener('change', ()=>push());
$('fBody').addEventListener('change', ()=>push());

$('bAuto').onclick=()=>{ const b=boxes[sel]; if(!b) return;
  delete b.locked; delete b.type; delete b.cells; commit(true); toast('Re-read from geometry'); };
$('bDupe').onclick=()=>{
  const b=boxes[sel]; if(!b) return;
  const c={...b, cy:b.cy+b.ch+1};
  boxes.push(c); sel=boxes.length-1; resize(); commit(true);
};
$('bDel').onclick=()=>{ if(sel<0) return; boxes.splice(sel,1); sel=-1; resize(); commit(true); };
$('bUndo').onclick=undo; $('bRedo').onclick=redo;
$('bClear').onclick=()=>{ boxes=[]; sel=-1; resize(); commit(true); };
$('bLabels').onclick=()=>{ showLabels=!showLabels; $('bLabels').classList.toggle('on',showLabels); paint(); };

$('bTheme').onclick=()=>{
  dark=!dark;
  document.body.classList.toggle('dark',dark);
  $('bTheme').classList.toggle('on',dark);
  requestAnimationFrame(paint);
};

$('bFull').onclick=()=>{
  const out=$('out');
  out.classList.toggle('full');
  $('bFull').classList.toggle('on', out.classList.contains('full'));
  $('bFull').title = out.classList.contains('full') ? 'Collapse preview' : 'Expand preview';
};

$('bTidy').onclick=()=>{
  if(!boxes.length) return;
  const {rows} = classify();
  let y=0;
  rows.forEach(r=>{
    const h = r.items.reduce((m,o)=>Math.max(m, boxes[o.i].ch), 0);
    r.items.forEach(o=>{ boxes[o.i].cy=y; boxes[o.i].ch=h; });
    /* close horizontal gaps inside the row */
    let x=0;
    r.items.forEach(o=>{ boxes[o.i].cx=x; x+=boxes[o.i].cw; });
    y += h + 1;
  });
  sel=-1; resize(); commit(true); toast('Tidied into rows');
};

Array.prototype.forEach.call($('segCols').children, b=>{
  b.onclick=()=>{
    Array.prototype.forEach.call($('segCols').children, x=>x.classList.remove('on'));
    b.classList.add('on');
    const old=COLS; COLS=+b.dataset.cols; $('ovCols').textContent=COLS;
    const k = COLS/old;
    boxes.forEach(x=>{
      x.cx = clamp(Math.round(x.cx*k), 0, COLS-1);
      x.cw = clamp(Math.round(x.cw*k), 1, COLS-x.cx);
    });
    /* drop any overlaps the rescale created */
    for(let i=boxes.length-1;i>=0;i--) if(collides(boxes[i],i)) boxes.splice(i,1);
    sel=-1; resize(); commit(true);
  };
});
Array.prototype.forEach.call($('segDev').children, b=>{
  b.onclick=()=>{ Array.prototype.forEach.call($('segDev').children,x=>x.classList.remove('on'));
    b.classList.add('on'); devW=+b.dataset.w; render(); };
});
$('themeSel').addEventListener('change', e=>{
  theme=e.target.value; render();
  if($('mExport').classList.contains('on')) refreshExport();
});

const PRESETS = {
  landing:[{cx:0,cy:0,cw:12,ch:2},{cx:0,cy:2,cw:12,ch:6},
    {cx:0,cy:8,cw:4,ch:4},{cx:4,cy:8,cw:4,ch:4},{cx:8,cy:8,cw:4,ch:4},
    {cx:0,cy:12,cw:6,ch:5},{cx:6,cy:12,cw:6,ch:5},
    {cx:0,cy:17,cw:12,ch:3},{cx:0,cy:20,cw:12,ch:2}],
  split:[{cx:0,cy:0,cw:12,ch:2},
    {cx:0,cy:2,cw:7,ch:7},{cx:7,cy:2,cw:5,ch:7},
    {cx:0,cy:9,cw:5,ch:6},{cx:5,cy:9,cw:7,ch:6},
    {cx:0,cy:15,cw:12,ch:2}],
  docs:[{cx:0,cy:0,cw:12,ch:2},
    {cx:0,cy:2,cw:3,ch:14},{cx:3,cy:2,cw:9,ch:5},
    {cx:3,cy:7,cw:9,ch:4},{cx:3,cy:11,cw:9,ch:5}],
  dash:[{cx:0,cy:0,cw:12,ch:2},{cx:0,cy:2,cw:2,ch:15},
    {cx:2,cy:2,cw:10,ch:2},
    {cx:2,cy:4,cw:5,ch:6},{cx:7,cy:4,cw:5,ch:6},
    {cx:2,cy:10,cw:10,ch:7}],
};
document.querySelectorAll('[data-preset]').forEach(b=>{
  b.onclick=()=>{ boxes=PRESETS[b.dataset.preset].map(o=>({...o})); sel=-1; resize(); commit(true); };
});

function refreshExport(){
  $('codeOut').textContent = EXPORTS[fmt]();
  $('exNote').textContent = {
    html:'Semantic markup, token stylesheet, rows collapse on mobile.',
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
    navigator.clipboard.writeText(t).then(()=>toast('Copied'), ()=>fallbackCopy(t));
  else fallbackCopy(t);
};
$('bDownload').onclick=()=>{
  const blob=new Blob([$('codeOut').textContent],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='mirage-page.'+EXT[fmt];
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Downloaded');
};
$('bSave').onclick=()=>{
  fmt='json';
  Array.prototype.forEach.call($('segFmt').children,x=>x.classList.toggle('on',x.dataset.f==='json'));
  $('mExport').classList.add('on'); refreshExport();
};
$('bLoad').onclick=()=>$('mLoad').classList.add('on');
$('xLoad').onclick=()=>$('mLoad').classList.remove('on');
$('bLoadGo').onclick=()=>{
  try{
    const d=JSON.parse($('loadBox').value);
    if(!d || !Array.isArray(d.boxes)) throw new Error('bad');
    /* accept v1/v2 normalised sketches too */
    boxes = d.boxes.map(b=>{
      if(typeof b.cx === 'number') return b;
      return {cx:Math.round((b.x||0)*(d.cols||12)), cy:Math.round((b.y||0)*30),
              cw:Math.max(1,Math.round((b.w||1)*(d.cols||12))), ch:Math.max(1,Math.round((b.h||.1)*30)),
              type:b.type, cells:b.cells, head:b.head, body:b.body, locked:b.locked};
    });
    COLS=d.cols||12; theme=d.theme||'';
    Array.prototype.forEach.call($('segCols').children,x=>x.classList.toggle('on',+x.dataset.cols===COLS));
    $('themeSel').value=theme; $('ovCols').textContent=COLS;
    for(let i=boxes.length-1;i>=0;i--) if(collides(boxes[i],i)) boxes.splice(i,1);
    sel=-1; $('mLoad').classList.remove('on'); resize(); commit(true); toast('Sketch loaded');
  }catch(_){ toast('That is not a Mirage sketch'); }
};

const KEYS=[['Draw a box','drag'],['Move a box','drag it'],['Resize','drag a handle'],
  ['Delete box','right-click / Del'],['Edit content','double-click'],['Undo','\u2318Z'],
  ['Redo','\u21e7\u2318Z'],['Duplicate','\u2318D'],['Tidy rows','T'],['Toggle labels','L'],
  ['Dark mode','D'],['Fullscreen preview','F'],['Export','\u2318E'],['Nudge','arrows']];
$('keyList').innerHTML = KEYS.map(k=>'<div><span>'+k[0]+'</span><kbd>'+k[1]+'</kbd></div>').join('');
$('bKeys').onclick=()=>$('mKeys').classList.add('on');
$('xKeys').onclick=()=>$('mKeys').classList.remove('on');
document.querySelectorAll('.modal').forEach(m=>{
  m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('on'); });
});

document.addEventListener('keydown', e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
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
  if(m) return;
  if(k==='t') $('bTidy').click();
  if(k==='l') $('bLabels').click();
  if(k==='d') $('bTheme').click();
  if(k==='f') $('bFull').click();
  if((k==='delete'||k==='backspace') && sel>=0){ e.preventDefault(); $('bDel').click(); }
  if(k.indexOf('arrow')===0 && sel>=0){
    e.preventDefault();
    const b=boxes[sel];
    const want={cx:b.cx, cy:b.cy, cw:b.cw, ch:b.ch};
    if(k==='arrowleft')  want.cx=Math.max(0,b.cx-1);
    if(k==='arrowright') want.cx=Math.min(COLS-b.cw,b.cx+1);
    if(k==='arrowup')    want.cy=Math.max(0,b.cy-1);
    if(k==='arrowdown')  want.cy=b.cy+1;
    if(!collides(want,sel)){ Object.assign(b,want); resize(); render(); syncSel(); push(); }
  }
});

/* ------------------------------------------------------------------ boot */
resize();
hist=[[]]; hi=0; syncHist();
commit(false);
})();
