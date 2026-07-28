(() => {
'use strict';

const TYPES = [
  ['nav','Nav bar'],['hero','Hero'],['cards','Card grid'],['split','Two column'],
  ['text','Text block'],['image','Image'],['gallery','Gallery'],['sidebar','Side nav'],
  ['stats','Stat row'],['logos','Logo row'],['quote','Quote'],['form','Form'],
  ['table','Table'],['tabs','Tabs'],['price','Pricing'],['banner','CTA banner'],
  ['code','Code block'],['button','Button'],['footer','Footer'],
];
const NICE = Object.fromEntries(TYPES);
const MULTI = ['cards','stats','logos','gallery','price'];

let boxes = [], COLS = 12, sel = -1;
let showLabels = true, dark = false, theme = '', devW = 0, fmt = 'html';
let hist = [], hi = -1;

const $ = id => document.getElementById(id);
const clone = b => JSON.parse(JSON.stringify(b));

function push(){
  hist = hist.slice(0, hi+1);
  hist.push(clone(boxes));
  if(hist.length > 80){ hist.shift(); } else { hi++; }
  hi = hist.length-1;
  syncHist();
}
function syncHist(){
  $('bUndo').disabled = hi <= 0;
  $('bRedo').disabled = hi >= hist.length-1;
}
function undo(){ if(hi>0){ hi--; boxes = clone(hist[hi]); sel=-1; commit(false); syncHist(); } }
function redo(){ if(hi<hist.length-1){ hi++; boxes = clone(hist[hi]); sel=-1; commit(false); syncHist(); } }

// ============================================================ canvas
const cv = $('sk'), ctx = cv.getContext('2d');
let W=0,H=0,DPR=Math.min(devicePixelRatio||1,2);
function resize(){
  const r = cv.getBoundingClientRect();
  W=r.width;H=r.height;
  cv.width=Math.max(1,W*DPR);cv.height=Math.max(1,H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  paint();
}
new ResizeObserver(resize).observe($('draft'));

function jit(i,s){ return ((Math.sin(i*12.9898 + s*78.233)*43758.5453)%1)*1.7; }
function shaky(x,y,w,h){
  ctx.beginPath();
  const pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
  for(let e=0;e<4;e++){
    const p1=pts[e], p2=pts[e+1];
    const seg=Math.max(2,Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/24|0);
    if(e===0) ctx.moveTo(p1[0],p1[1]);
    for(let i=1;i<=seg;i++){
      const t=i/seg;
      ctx.lineTo(p1[0]+(p2[0]-p1[0])*t + (i<seg?jit(i,p1[0]+e):0),
                 p1[1]+(p2[1]-p1[1])*t + (i<seg?jit(i,p1[1]+e):0));
    }
  }
  ctx.stroke();
}

let drawing=null;
const HS=6;
function handles(b){
  const x=b.x*W,y=b.y*H,w=b.w*W,h=b.h*H;
  return [{id:'nw',x,y},{id:'n',x:x+w/2,y},{id:'ne',x:x+w,y},
          {id:'e',x:x+w,y:y+h/2},{id:'se',x:x+w,y:y+h},{id:'s',x:x+w/2,y:y+h},
          {id:'sw',x,y:y+h},{id:'w',x,y:y+h/2}];
}

function paint(){
  ctx.clearRect(0,0,W,H);
  const g1 = dark?'#1E2A33':'#CBD5DC', g2 = dark?'#18232B':'#D6DEE4', inkc = dark?'#C3CFD9':'#141C22';

  ctx.strokeStyle=g1;ctx.lineWidth=1;ctx.beginPath();
  for(let i=1;i<COLS;i++){const x=Math.round(W*i/COLS)+.5;ctx.moveTo(x,0);ctx.lineTo(x,H);}
  ctx.stroke();
  ctx.strokeStyle=g2;ctx.beginPath();
  for(let y=0;y<H;y+=28){const yy=Math.round(y)+.5;ctx.moveTo(0,yy);ctx.lineTo(W,yy);}
  ctx.stroke();

  const laid = classify(boxes);
  laid.forEach((b,i)=>{
    const x=b.x*W,y=b.y*H,w=b.w*W,h=b.h*H, isSel=i===sel;
    ctx.fillStyle = dark ? (isSel?'rgba(239,196,74,.13)':'rgba(31,95,139,.16)')
                         : (isSel?'rgba(239,196,74,.20)':'rgba(31,95,139,.055)');
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = isSel?'#EFC44A':(b.locked?'#1F5F8B':inkc);
    ctx.lineWidth = isSel?2.2:(b.locked?1.8:1.4);
    shaky(x,y,w,h);

    if(b.cells>1){
      ctx.strokeStyle=dark?'#5C6B78':'#7C8B96';ctx.lineWidth=1;ctx.setLineDash([3,4]);
      for(let k=1;k<b.cells;k++){ctx.beginPath();const cx=x+(w/b.cells)*k;ctx.moveTo(cx,y+5);ctx.lineTo(cx,y+h-5);ctx.stroke();}
      ctx.setLineDash([]);
    }
    if(b.conf<.55 && !b.locked){ ctx.fillStyle='#D9843F';ctx.beginPath();ctx.arc(x+w-8,y+8,3,0,6.283);ctx.fill(); }

    if(showLabels && h>16){
      const lb = NICE[b.type] + (b.cells>1?' ×'+b.cells:'');
      ctx.font='500 10px "IBM Plex Mono", monospace';
      const tw=ctx.measureText(lb).width;
      ctx.fillStyle = isSel?'#EFC44A':(b.locked?'#1F5F8B':inkc);
      ctx.fillRect(x, Math.max(0,y-15), tw+12, 15);
      ctx.fillStyle = isSel?'#141C22':(dark?'#141C22':'#E2E7EB');
      ctx.textBaseline='middle';ctx.textAlign='left';
      ctx.fillText(lb, x+6, Math.max(0,y-15)+7.5);
      ctx.fillStyle=dark?'#5C6B78':'#7C8B96';
      ctx.font='400 9px "IBM Plex Mono", monospace';ctx.textAlign='right';
      ctx.fillText(Math.round(b.w*COLS)+'/'+COLS, x+w-4, y+h-7);
      ctx.textAlign='left';
    }
    if(isSel){
      ctx.fillStyle='#EFC44A';ctx.strokeStyle=inkc;ctx.lineWidth=1;
      handles(b).forEach(hd=>{ctx.fillRect(hd.x-HS/2,hd.y-HS/2,HS,HS);ctx.strokeRect(hd.x-HS/2,hd.y-HS/2,HS,HS);});
    }
  });

  if(drawing){
    const r=norm(drawing);
    ctx.strokeStyle='#EFC44A';ctx.lineWidth=2;ctx.setLineDash([5,4]);
    ctx.strokeRect(r.x*W,r.y*H,r.w*W,r.h*H);ctx.setLineDash([]);
    ctx.fillStyle=dark?'#5C6B78':'#7C8B96';
    ctx.font='400 9px "IBM Plex Mono", monospace';
    ctx.fillText(Math.round(r.w*COLS)+'/'+COLS, r.x*W+4, Math.max(9,r.y*H-5));
  }
}

// ============================================================ classifier
function classify(list){
  const out = list.map(b=>({...b}));
  const rows = [];
  out.slice().sort((a,b)=>a.y-b.y).forEach(b=>{
    const r = rows.find(r=>Math.abs(r.y-b.y)<0.055 && Math.abs((r.y+r.h)-(b.y+b.h))<0.10);
    if(r){ r.items.push(b); r.y=Math.min(r.y,b.y); } else rows.push({y:b.y,h:b.h,items:[b]});
  });

  rows.forEach(row=>{
    const n=row.items.length, anyLocked=row.items.some(i=>i.locked);
    if(n>=2 && !anyLocked){
      const ws=row.items.map(i=>i.w);
      const similar = Math.max.apply(null,ws)-Math.min.apply(null,ws) < 0.09;
      const lead = row.items.slice().sort((a,b)=>a.x-b.x)[0];
      if(similar && row.items[0].w<0.62){
        const short = row.h<0.075;
        const t = (n>=4 && short) ? 'logos' : (short ? 'stats' : 'cards');
        row.items.forEach(i=>{ i.type=t; i.conf=.86; });
        lead.cells=n; lead.lead=true;
        row.items.forEach(i=>{ if(i!==lead) i.merged=true; });
        return;
      }
      if(n===2){
        row.items.forEach(i=>{ i.type='split'; i.conf=.72; });
        lead.lead=true; row.items.forEach(i=>{ if(i!==lead) i.merged=true; });
        return;
      }
    }
    row.items.forEach(b=>{
      b.lead=true;
      if(b.locked){ b.conf=1; if(!b.cells && MULTI.indexOf(b.type)>=0) b.cells=3; return; }
      const ratio=b.h/(b.w||.01), top=b.y<0.13, bot=b.y+b.h>0.87, full=b.w>0.78;
      let t='text', c=.5;
      if(top && full && b.h<0.10){ t='nav'; c=.95; }
      else if(bot && full && b.h<0.17){ t='footer'; c=.90; }
      else if(b.y<0.42 && full && b.h>=0.16){ t='hero'; c=.88; }
      else if(full && b.h<0.075){ t='stats'; c=.60; b.cells=b.cells||3; }
      else if(b.w<0.30 && ratio>1.6){ t='sidebar'; c=.84; }
      else if(b.w<0.28 && b.h<0.075){ t='button'; c=.80; }
      else if(ratio>0.55 && b.w<0.72){ t='image'; c=.66; }
      else if(full && b.h>=0.10 && b.h<0.18){ t='banner'; c=.52; }
      else { t='text'; c = b.w>0.6 ? .74 : .50; }
      b.type=t; b.conf=c;
    });
  });
  out.forEach(b=>{ if(b.conf==null) b.conf=.5; if(!b.type) b.type='text'; });
  return out;
}

// ============================================================ copy
const DEF = {
  brand:'Mirage',
  navLinks:['Docs','Components','Roadmap'],
  heroH:'Everything you draw becomes real',
  heroB:'Mirage reads the geometry of a wireframe the way a person does, then builds the page it implies. No prompt, no template picker.',
  textH:'How the classifier reads a box',
  textB:'A box near the top edge that spans the full width is a nav bar. The same box halfway down the page, given more height, is a hero. Width relative to the page and height relative to width carry almost all the meaning in a wireframe, which is why people can read each other\u2019s sketches without a legend.',
  cards:[['Position','Where it sits','Vertical position separates a nav from a footer with no other signal.'],
         ['Proportion','How tall for its width','A tall narrow box is a rail. A wide short one is a bar.'],
         ['Company','What it sits beside','Three similar boxes in a row are a grid, never three blocks.'],
         ['Span','How much width it takes','Width snaps to the column grid before anything is built.'],
         ['Order','What comes before it','Reading order follows the vertical axis, top to bottom.'],
         ['Override','What you corrected','Any box you set by hand is never re-read.']],
  stats:[['19','component types'],['12','column grid'],['0','config files'],['MIT','licence'],['3','export targets'],['80','undo steps']],
  logos:['Northwind','Cassini','Half Measure','Bellwether','Ordinal'],
  quote:'I drew the page on a napkin, photographed the napkin, and had the layout before the coffee arrived.',
  who:'— an optimistic description of the roadmap',
  tabs:['Geometry','Overrides','Export'],
  table:[['Nav bar','y < 0.13','full width','0.95'],['Hero','y < 0.42','tall, full','0.88'],
         ['Card grid','same row','2–6 similar','0.86'],['Side nav','narrow','tall','0.84']],
  price:[['Free','$0','Everything. It is open source.'],['Also free','$0','There is no second tier.'],['Still free','$0','Self host it anywhere.']],
  code:'<section class="grid cols-3">\n  <article class="card">…</article>\n  <article class="card">…</article>\n  <article class="card">…</article>\n</section>',
};

// ============================================================ render
const sheet = $('sheet');
function laidOut(){ return classify(boxes).filter(b=>!b.merged).sort((a,b)=>a.y-b.y); }
function esc(s){ return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function render(){
  const L = laidOut();
  sheet.className = theme ? 'th-'+theme : '';
  sheet.style.maxWidth = devW ? devW+'px' : '100%';
  if(!L.length){
    sheet.innerHTML = '<div class="void"><div class="t1">The page renders here</div><div class="t2">Every box is read for position, width and proportion, then built as a real component.</div></div>';
    return;
  }
  sheet.innerHTML='';
  L.forEach((b,i)=>{
    const el=build(b); if(!el) return;
    el.classList.add('cx'); el.style.animationDelay=(i*34)+'ms';
    sheet.appendChild(el);
  });
}

function build(b){
  const d=document.createElement('div');
  const h=Math.max(46,Math.round(b.h*600));
  const n=Math.min(Math.max(b.cells||3,2),6);
  const H1=b.head?esc(b.head):null, B1=b.body?esc(b.body):null;
  switch(b.type){
    case 'nav':
      d.className='c-nav';
      d.innerHTML='<span class="lg">'+(H1||DEF.brand)+'</span><span class="ln">'+
        (B1?B1.split(',').map(s=>'<span>'+s.trim()+'</span>').join(''):DEF.navLinks.map(l=>'<span>'+l+'</span>').join(''))+
        '</span><button class="cta">Get started</button>'; break;
    case 'hero':
      d.className='c-hero';
      d.innerHTML='<h1>'+(H1||DEF.heroH)+'</h1><p>'+(B1||DEF.heroB)+'</p><div class="bs"><button class="b1">Start drawing</button><button class="b2">Read the docs</button></div>'; break;
    case 'cards':
      d.className='c-grid'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=DEF.cards.slice(0,n).map(c=>'<div class="c-card"><div class="k">'+c[0]+'</div><h4>'+c[1]+'</h4><p>'+c[2]+'</p></div>').join(''); break;
    case 'split':
      d.className='c-split';
      d.innerHTML='<div><h3>'+(H1||DEF.textH)+'</h3><p>'+(B1||DEF.textB)+'</p></div><div class="c-img" style="min-height:'+h+'px">FIGURE</div>'; break;
    case 'text':
      d.className='c-text'; d.innerHTML='<h3>'+(H1||DEF.textH)+'</h3><p>'+(B1||DEF.textB)+'</p>'; break;
    case 'image':
      d.className='c-img'; d.style.height=h+'px'; d.style.margin='var(--c-pad)'; d.textContent=b.head||'IMAGE'; break;
    case 'gallery':
      d.className='c-gal'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=Array.from({length:n},()=>'<div class="c-img" style="height:'+Math.max(70,h/1.6)+'px">IMAGE</div>').join(''); break;
    case 'sidebar':
      d.className='c-side';
      d.innerHTML=(B1?B1.split(','):['Overview','Reading a box','The column grid','Overrides','Export'])
        .map((t,i)=>'<div class="it'+(i===0?' a':'')+'">'+t.trim()+'</div>').join(''); break;
    case 'stats':
      d.className='c-stats'; d.style.gridTemplateColumns='repeat('+n+',minmax(0,1fr))';
      d.innerHTML=DEF.stats.slice(0,n).map(s=>'<div class="s"><div class="n">'+s[0]+'</div><div class="l">'+s[1]+'</div></div>').join(''); break;
    case 'logos':
      d.className='c-logos';
      d.innerHTML=DEF.logos.slice(0,Math.max(n,4)).map(l=>'<span class="lo">'+l+'</span>').join(''); break;
    case 'quote':
      d.className='c-quote';
      d.innerHTML='<blockquote>'+(H1||DEF.quote)+'</blockquote><div class="who">'+(B1||DEF.who)+'</div>'; break;
    case 'form':
      d.className='c-form';
      d.innerHTML='<div class="inp">Name</div><div class="inp">Email address</div><div class="inp" style="height:70px">Message</div><div class="sb">Send</div>'; break;
    case 'table':
      d.className='c-table';
      d.innerHTML='<table><thead><tr><th>Component</th><th>Signal</th><th>Shape</th><th>Conf.</th></tr></thead><tbody>'+
        DEF.table.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>'; break;
    case 'tabs':
      d.className='c-tabs';
      d.innerHTML='<div class="tl">'+DEF.tabs.map((t,i)=>'<span class="tb'+(i===0?' a':'')+'">'+t+'</span>').join('')+'</div><p>'+(B1||DEF.textB)+'</p>'; break;
    case 'price':
      d.className='c-price'; d.style.gridTemplateColumns='repeat('+Math.min(n,3)+',minmax(0,1fr))';
      d.innerHTML=DEF.price.slice(0,Math.min(n,3)).map(p=>
        '<div class="p"><div class="tn">'+p[0]+'</div><div class="am">'+p[1]+'</div><ul><li>'+p[2]+'</li><li>Unlimited sketches</li><li>Self host it</li></ul></div>').join(''); break;
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

// ============================================================ export
function span(b){ return Math.round(b.w*COLS); }

function exHTML(){
  const L=laidOut();
  if(!L.length) return '<!-- nothing drawn yet -->';
  const body = L.map(b=>{
    const n=Math.min(Math.max(b.cells||3,2),6), s=span(b);
    switch(b.type){
      case 'nav': return '  <nav class="nav">\n    <a class="brand" href="/">'+(b.head||DEF.brand)+'</a>\n    <ul class="nav-links">\n      <li><a href="#">Docs</a></li>\n    </ul>\n    <a class="btn" href="#">Get started</a>\n  </nav>';
      case 'hero': return '  <header class="hero">\n    <h1>'+(b.head||DEF.heroH)+'</h1>\n    <p>'+(b.body||'Supporting sentence.')+'</p>\n    <a class="btn" href="#">Start drawing</a>\n  </header>';
      case 'cards': return '  <section class="grid cols-'+n+'">\n'+Array.from({length:n},()=>'    <article class="card">\n      <h3>Heading</h3>\n      <p>Body copy.</p>\n    </article>').join('\n')+'\n  </section>';
      case 'split': return '  <section class="split">\n    <div>\n      <h2>'+(b.head||DEF.textH)+'</h2>\n      <p>Body copy.</p>\n    </div>\n    <figure class="media"></figure>\n  </section>';
      case 'text': return '  <section class="prose span-'+s+'">\n    <h2>'+(b.head||DEF.textH)+'</h2>\n    <p>Body copy.</p>\n  </section>';
      case 'image': return '  <figure class="media span-'+s+'"><img src="" alt=""></figure>';
      case 'gallery': return '  <section class="gallery cols-'+n+'">\n'+Array.from({length:n},()=>'    <figure><img src="" alt=""></figure>').join('\n')+'\n  </section>';
      case 'sidebar': return '  <aside class="rail span-'+s+'">\n    <nav>\n      <a class="is-active" href="#">Overview</a>\n    </nav>\n  </aside>';
      case 'stats': return '  <section class="stats cols-'+n+'">\n'+Array.from({length:n},()=>'    <div class="stat"><strong>00</strong><span>label</span></div>').join('\n')+'\n  </section>';
      case 'logos': return '  <section class="logos">\n    <img src="" alt="">\n  </section>';
      case 'quote': return '  <figure class="quote">\n    <blockquote>'+(b.head||'Quotation.')+'</blockquote>\n    <figcaption>'+(b.body||'Attribution')+'</figcaption>\n  </figure>';
      case 'form': return '  <form class="form">\n    <label>Name <input name="name"></label>\n    <label>Email <input type="email" name="email"></label>\n    <button type="submit">Send</button>\n  </form>';
      case 'table': return '  <table class="table">\n    <thead><tr><th>Column</th></tr></thead>\n    <tbody><tr><td>Cell</td></tr></tbody>\n  </table>';
      case 'tabs': return '  <div class="tabs" role="tablist">\n    <button role="tab" aria-selected="true">One</button>\n  </div>';
      case 'price': return '  <section class="pricing cols-'+Math.min(n,3)+'">\n    <div class="tier"><h3>Free</h3><p class="amount">$0</p></div>\n  </section>';
      case 'banner': return '  <section class="banner">\n    <h2>'+(b.head||'Draw the page. Ship the page.')+'</h2>\n    <a class="btn" href="#">Open the editor</a>\n  </section>';
      case 'code': return '  <pre class="code"><code>…</code></pre>';
      case 'button': return '  <a class="btn" href="#">'+(b.head||'Start drawing')+'</a>';
      case 'footer': return '  <footer class="foot">\n    <small>'+(b.head||DEF.brand)+'</small>\n  </footer>';
    }
    return '';
  }).join('\n\n');

  const acc = theme==='soft'?'#5B5BD6':theme==='terminal'?'#4FE0B0':theme==='editorial'?'#8A5A2B':theme==='brutal'?'#0B0B0B':'#1F5F8B';
  const bg  = theme==='terminal'?'#0D1117':theme==='brutal'?'#F2F0EA':theme==='editorial'?'#FCFBF7':'#FBFCFD';
  const fg  = theme==='terminal'?'#D6DEE4':'#141C22';
  const rad = theme==='soft'?'12px':theme===''?'2px':'0';

  const css = [
    ':root{',
    '  --bg:'+bg+'; --fg:'+fg+'; --mut:#5A6873; --line:#E4E9ED;',
    '  --acc:'+acc+'; --pad:'+(theme==='soft'?'30px':'26px')+'; --radius:'+rad+';',
    '}',
    '.page{background:var(--bg);color:var(--fg);font-family:system-ui,sans-serif}',
    '.nav{display:flex;align-items:center;gap:18px;padding:14px var(--pad);border-bottom:1px solid var(--line)}',
    '.nav-links{display:flex;gap:14px;margin-left:auto;list-style:none}',
    '.hero{padding:calc(var(--pad)*1.9) var(--pad);border-bottom:1px solid var(--line)}',
    '.hero h1{font-size:clamp(28px,4.4vw,44px);line-height:1.04;letter-spacing:-.03em;max-width:14ch}',
    '.grid,.gallery,.stats,.pricing{display:grid;gap:11px;padding:var(--pad)}',
    Array.from({length:5},(_,i)=>'.cols-'+(i+2)+'{grid-template-columns:repeat('+(i+2)+',minmax(0,1fr))}').join('\n'),
    '.card{border:1px solid var(--line);padding:15px;border-radius:var(--radius)}',
    '.split{display:grid;grid-template-columns:1fr 1fr}',
    '.split>*{padding:var(--pad)}',
    '.btn{background:var(--acc);color:var(--bg);padding:10px 17px;border-radius:var(--radius);text-decoration:none;display:inline-block}',
    '.media{background:var(--line);min-height:180px;margin:0}',
    '.banner{padding:calc(var(--pad)*1.5) var(--pad);background:var(--acc);color:var(--bg)}',
    '.foot{padding:var(--pad);border-top:1px solid var(--line);color:var(--mut)}',
    Array.from({length:COLS},(_,i)=>'.span-'+(i+1)+'{--span:'+(i+1)+'}').join('\n'),
    '@media (max-width:720px){.grid,.split,.stats,.gallery,.pricing{grid-template-columns:1fr}}',
  ].join('\n');

  return '<!-- generated by Mirage -->\n<main class="page">\n'+body+'\n</main>\n\n<style>\n'+css+'\n</style>';
}

function exReact(){
  const L=laidOut();
  if(!L.length) return '// nothing drawn yet';
  const MAP={nav:'Nav',hero:'Hero',cards:'CardGrid',split:'Split',text:'Prose',image:'Figure',
    gallery:'Gallery',sidebar:'Rail',stats:'Stats',logos:'LogoRow',quote:'Quote',form:'Form',
    table:'DataTable',tabs:'Tabs',price:'Pricing',banner:'Banner',code:'CodeBlock',button:'Button',footer:'Footer'};
  const jsx = L.map(b=>{
    const n=Math.min(Math.max(b.cells||3,2),6), s=span(b);
    switch(b.type){
      case 'nav': return '      <Nav brand="'+(b.head||DEF.brand)+'" links={["Docs","Components","Roadmap"]} />';
      case 'hero': return '      <Hero\n        title="'+(b.head||DEF.heroH)+'"\n        body={copy.hero}\n      />';
      case 'cards': return '      <CardGrid columns={'+n+'} items={items} />';
      case 'split': return '      <Split media={<Figure />}>\n        <h2>'+(b.head||DEF.textH)+'</h2>\n      </Split>';
      case 'text': return '      <Prose span={'+s+'} heading="'+(b.head||DEF.textH)+'" />';
      case 'image': return '      <Figure span={'+s+'} />';
      case 'gallery': return '      <Gallery columns={'+n+'} />';
      case 'sidebar': return '      <Rail span={'+s+'} items={nav} />';
      case 'stats': return '      <Stats columns={'+n+'} data={stats} />';
      case 'logos': return '      <LogoRow logos={logos} />';
      case 'quote': return '      <Quote attribution={copy.who}>{copy.quote}</Quote>';
      case 'form': return '      <Form fields={["name","email","message"]} onSubmit={handleSubmit} />';
      case 'table': return '      <DataTable columns={columns} rows={rows} />';
      case 'tabs': return '      <Tabs items={tabs} />';
      case 'price': return '      <Pricing tiers={tiers} columns={'+Math.min(n,3)+'} />';
      case 'banner': return '      <Banner title="'+(b.head||'Draw the page. Ship the page.')+'" />';
      case 'code': return '      <CodeBlock language="html">{snippet}</CodeBlock>';
      case 'button': return '      <Button>'+(b.head||'Start drawing')+'</Button>';
      case 'footer': return '      <Footer brand="'+(b.head||DEF.brand)+'" />';
    }
    return '';
  }).join('\n');
  const used=[];
  L.forEach(b=>{ const m=MAP[b.type]; if(m && used.indexOf(m)<0) used.push(m); });
  if(L.some(b=>b.type==='split') && used.indexOf('Figure')<0) used.push('Figure');
  return "// generated by Mirage\nimport { "+used.join(', ')+" } from '@mirage/ui'\n\nexport default function Page() {\n  return (\n    <main className=\"page\">\n"+jsx+"\n    </main>\n  )\n}";
}

function exTW(){
  const L=laidOut();
  if(!L.length) return '<!-- nothing drawn yet -->';
  const rows=L.map(b=>{
    const n=Math.min(Math.max(b.cells||3,2),6);
    switch(b.type){
      case 'nav': return '  <nav class="flex items-center gap-5 px-6 py-3.5 border-b border-neutral-200">\n    <span class="font-bold tracking-tight">'+(b.head||DEF.brand)+'</span>\n    <div class="ml-auto flex gap-4 text-sm text-neutral-500">Docs</div>\n  </nav>';
      case 'hero': return '  <header class="px-6 py-14 border-b border-neutral-200">\n    <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight leading-none max-w-[14ch]">'+(b.head||DEF.heroH)+'</h1>\n    <p class="mt-3 text-neutral-500 max-w-[46ch] leading-relaxed">Supporting sentence.</p>\n  </header>';
      case 'cards': return '  <section class="grid grid-cols-1 md:grid-cols-'+n+' gap-3 p-6">\n'+Array.from({length:n},()=>'    <article class="border border-neutral-200 rounded p-4">Card</article>').join('\n')+'\n  </section>';
      case 'split': return '  <section class="grid md:grid-cols-2 border-b border-neutral-200">\n    <div class="p-6">Copy</div>\n    <div class="p-6 bg-neutral-100">Figure</div>\n  </section>';
      case 'text': return '  <section class="p-6 max-w-prose"><h2 class="text-xl font-bold tracking-tight">'+(b.head||DEF.textH)+'</h2></section>';
      case 'image': return '  <figure class="m-6 aspect-video bg-neutral-100 rounded"></figure>';
      case 'gallery': return '  <section class="grid grid-cols-2 md:grid-cols-'+n+' gap-2 p-6">Images</section>';
      case 'sidebar': return '  <aside class="p-6 w-64 shrink-0 space-y-1">Nav</aside>';
      case 'stats': return '  <section class="grid grid-cols-2 md:grid-cols-'+n+' gap-px bg-neutral-200 p-6">Stats</section>';
      case 'logos': return '  <section class="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-neutral-200 opacity-70">Logos</section>';
      case 'quote': return '  <figure class="px-6 py-10 border-b border-neutral-200">\n    <blockquote class="text-2xl font-semibold tracking-tight max-w-[34ch]">Quotation.</blockquote>\n  </figure>';
      case 'form': return '  <form class="p-6 grid gap-2 max-w-md">Fields</form>';
      case 'table': return '  <div class="p-6 overflow-x-auto"><table class="w-full text-sm">Rows</table></div>';
      case 'tabs': return '  <div class="p-6"><div class="flex gap-1 border-b border-neutral-200">Tabs</div></div>';
      case 'price': return '  <section class="grid md:grid-cols-'+Math.min(n,3)+' gap-3 p-6">Tiers</section>';
      case 'banner': return '  <section class="px-6 py-12 bg-neutral-900 text-white flex items-center gap-4 flex-wrap">Banner</section>';
      case 'code': return '  <pre class="m-6 p-4 bg-neutral-900 text-neutral-100 rounded text-xs overflow-auto">Code</pre>';
      case 'button': return '  <div class="p-6"><button class="bg-neutral-900 text-white px-5 py-2.5 rounded">'+(b.head||'Start drawing')+'</button></div>';
      case 'footer': return '  <footer class="p-6 border-t border-neutral-200 text-sm text-neutral-500 flex gap-4">Footer</footer>';
    }
    return '';
  }).join('\n\n');
  return '<!-- generated by Mirage · Tailwind -->\n<main>\n'+rows+'\n</main>';
}

function exJSON(){ return JSON.stringify({version:1,cols:COLS,theme,boxes},null,2); }
const EXPORTS={html:exHTML,react:exReact,tw:exTW,json:exJSON};
const EXT={html:'html',react:'jsx',tw:'html',json:'json'};

// ============================================================ input
function pos(e){ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width, y:(e.clientY-r.top)/r.height}; }
function norm(d){ return {x:Math.min(d.x0,d.x1),y:Math.min(d.y0,d.y1),w:Math.abs(d.x1-d.x0),h:Math.abs(d.y1-d.y0)}; }
function snapX(v){ return Math.round(v*COLS)/COLS; }
function snapBox(b){
  const l=snapX(b.x), r=snapX(b.x+b.w);
  return {x:Math.max(0,l), y:Math.max(0,b.y), w:Math.max(1/COLS,r-l), h:Math.max(0.028,b.h)};
}
function hit(p){
  for(let i=boxes.length-1;i>=0;i--){
    const b=boxes[i];
    if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h) return i;
  }
  return -1;
}
function hitHandle(p){
  if(sel<0||!boxes[sel]) return null;
  for(const hd of handles(boxes[sel])){
    if(Math.abs(hd.x-p.x*W)<HS+4 && Math.abs(hd.y-p.y*H)<HS+4) return hd.id;
  }
  return null;
}

let mode=null,start=null,orig=null,hnd=null,movedFar=false;

cv.addEventListener('pointerdown', e=>{
  if(e.button===2) return;
  const p=pos(e); start=p; movedFar=false;
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  const h=hitHandle(p);
  if(h){ mode='resize'; hnd=h; orig=Object.assign({},boxes[sel]); return; }
  const i=hit(p);
  if(i>=0){
    if(sel!==i){ sel=i; syncSel(); }
    mode='move'; orig=Object.assign({},boxes[i]); paint(); return;
  }
  sel=-1; syncSel();
  mode='draw'; drawing={x0:p.x,y0:p.y,x1:p.x,y1:p.y};
});

cv.addEventListener('pointermove', e=>{
  const p=pos(e);
  if(!mode){
    cv.style.cursor = hitHandle(p) ? 'nwse-resize' : (hit(p)>=0 ? 'move' : 'crosshair');
    return;
  }
  const dx=p.x-start.x, dy=p.y-start.y;
  if(Math.abs(dx)>0.006||Math.abs(dy)>0.006) movedFar=true;

  if(mode==='draw'){ drawing.x1=p.x; drawing.y1=p.y; paint(); return; }
  if(mode==='move'){
    const b=boxes[sel]; if(!b) return;
    b.x=Math.max(0,Math.min(1-orig.w,snapX(orig.x+dx)));
    b.y=Math.max(0,Math.min(1-orig.h,orig.y+dy));
    paint(); render(); return;
  }
  if(mode==='resize'){
    const b=boxes[sel]; if(!b) return;
    let x=orig.x,y=orig.y,w=orig.w,h=orig.h;
    if(hnd.indexOf('e')>=0) w=orig.w+dx;
    if(hnd.indexOf('w')>=0){ x=orig.x+dx; w=orig.w-dx; }
    if(hnd.indexOf('s')>=0) h=orig.h+dy;
    if(hnd.indexOf('n')>=0){ y=orig.y+dy; h=orig.h-dy; }
    if(w<1/COLS){ w=1/COLS; if(hnd.indexOf('w')>=0) x=orig.x+orig.w-w; }
    if(h<0.028){ h=0.028; if(hnd.indexOf('n')>=0) y=orig.y+orig.h-h; }
    Object.assign(b, snapBox({x,y:Math.max(0,y),w,h}));
    paint(); render(); return;
  }
});

function endPointer(){
  if(mode==='draw'){
    const r=norm(drawing); drawing=null;
    if(r.w<0.030||r.h<0.020){ paint(); mode=null; return; }
    boxes.push(snapBox(r)); sel=boxes.length-1; commit(true);
  } else if(mode==='move'||mode==='resize'){
    if(movedFar) commit(true); else { paint(); syncSel(); }
  }
  mode=null; hnd=null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', e=>{
  e.preventDefault();
  const i=hit(pos(e));
  if(i>=0){ boxes.splice(i,1); sel=-1; commit(true); }
});
cv.addEventListener('dblclick', e=>{
  const i=hit(pos(e));
  if(i>=0){ sel=i; syncSel(); $('fHead').focus(); }
});

// ============================================================ UI
function toast(m){
  const t=$('toast'); t.textContent=m; t.classList.add('on');
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('on'),1500);
}

function commit(record){
  if(record) push();
  $('blank').classList.toggle('gone', boxes.length>0);
  paint(); render(); syncSel(); syncStats();
  if($('mExport').classList.contains('on')) refreshExport();
  scheduleAutosave();
}

function syncLayers(){
  const L=classify(boxes), el=$('layers');
  if(!boxes.length){ el.innerHTML='<div class="none">Nothing drawn yet. Drag a box on the surface.</div>'; return; }
  el.innerHTML='';
  boxes.map((b,i)=>({b,i,c:L[i]})).sort((a,z)=>a.b.y-z.b.y).forEach(o=>{
    const d=document.createElement('div');
    d.className='lay'+(o.i===sel?' on':'');
    d.innerHTML='<span class="ix">'+String(o.i+1).padStart(2,'0')+'</span>'+
      '<span class="nm">'+NICE[o.c.type]+'</span>'+
      (o.b.locked?'<span class="lk">set</span>':'')+
      '<span class="sp">'+Math.round(o.b.w*COLS)+'/'+COLS+'</span>';
    d.onclick=()=>{ sel=o.i; syncSel(); paint(); };
    el.appendChild(d);
  });
}

function syncStats(){
  $('stBox').textContent=boxes.length;
  $('stComp').textContent=laidOut().length;
  $('stLock').textContent=boxes.filter(b=>b.locked).length;
  $('stLines').textContent=exHTML().split('\n').length+' ln';
}

const typeGrid=$('typeGrid');
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
  const b=boxes[sel], c=classify(boxes)[sel];
  $('inspHead').textContent='Box '+(sel+1)+' — '+NICE[c.type];
  Array.prototype.forEach.call(typeGrid.children, el=>el.classList.toggle('on', el.dataset.t===c.type));
  const pct=Math.round((b.locked?1:c.conf)*100);
  $('cfLab').textContent = b.locked?'set by hand':'auto';
  $('cfPct').textContent = pct+'%';
  const bar=$('cfBar'); bar.style.width=pct+'%'; bar.classList.toggle('low', !b.locked && c.conf<.55);
  $('fSpan').max=COLS; $('fSpan').value=Math.round(b.w*COLS); $('fSpanV').textContent=Math.round(b.w*COLS);
  $('fH').value=Math.round(b.h*100); $('fHV').textContent=Math.round(b.h*100);
  $('fX').max=COLS-1; $('fX').value=Math.round(b.x*COLS); $('fXV').textContent=Math.round(b.x*COLS);
  const showCells = MULTI.indexOf(c.type)>=0;
  $('fldCells').style.display = showCells?'block':'none';
  if(showCells){ const v=b.cells||c.cells||3; $('fCells').value=v; $('fCellsV').textContent=v; }
  $('fHead').value=b.head||''; $('fBody').value=b.body||'';
}

function bindRange(id,vid,fn){
  $(id).addEventListener('input',()=>{
    const b=boxes[sel]; if(!b) return;
    $(vid).textContent=$(id).value;
    fn(b,+$(id).value);
    paint(); render(); syncStats();
  });
  $(id).addEventListener('change',()=>push());
}
bindRange('fSpan','fSpanV',(b,v)=>{ b.w=Math.min(v, COLS-Math.round(b.x*COLS))/COLS; });
bindRange('fH','fHV',(b,v)=>{ b.h=Math.min(v/100, 1-b.y); });
bindRange('fX','fXV',(b,v)=>{ b.x=Math.min(v, COLS-Math.round(b.w*COLS))/COLS; });
bindRange('fCells','fCellsV',(b,v)=>{ b.cells=v; b.locked=true; });

$('fHead').addEventListener('input',()=>{ const b=boxes[sel]; if(b){ b.head=$('fHead').value; render(); } });
$('fBody').addEventListener('input',()=>{ const b=boxes[sel]; if(b){ b.body=$('fBody').value; render(); } });
$('fHead').addEventListener('change',()=>push());
$('fBody').addEventListener('change',()=>push());

$('bAuto').onclick=()=>{ const b=boxes[sel]; if(!b) return; delete b.locked; delete b.type; delete b.cells; commit(true); toast('Re-read from geometry'); };
$('bDupe').onclick=()=>{ const b=boxes[sel]; if(!b) return; boxes.push(Object.assign({},b,{y:Math.min(0.94,b.y+b.h+0.02)})); sel=boxes.length-1; commit(true); };
$('bDel').onclick=()=>{ if(sel<0) return; boxes.splice(sel,1); sel=-1; commit(true); };
$('bUndo').onclick=undo; $('bRedo').onclick=redo;
$('bClear').onclick=()=>{ boxes=[]; sel=-1; commit(true); };
$('bLabels').onclick=()=>{ showLabels=!showLabels; $('bLabels').classList.toggle('on',showLabels); paint(); };
$('bDark').onclick=()=>{ dark=!dark; $('draft').classList.toggle('dark',dark); $('bDark').classList.toggle('on',dark); paint(); };

$('bTidy').onclick=()=>{
  if(!boxes.length) return;
  const rows=[];
  boxes.slice().sort((a,b)=>a.y-b.y).forEach(b=>{
    const r=rows.find(r=>Math.abs(r.y-b.y)<0.055);
    if(r) r.items.push(b); else rows.push({y:b.y,items:[b]});
  });
  let cy=0.02;
  rows.forEach(r=>{
    const h=Math.max.apply(null, r.items.map(i=>i.h));
    r.items.sort((a,b)=>a.x-b.x).forEach(i=>{ i.y=cy; i.h=h; });
    cy += h + 0.022;
  });
  if(cy>0.98){
    const k=0.96/(cy-0.02);
    boxes.forEach(b=>{ b.y=0.02+(b.y-0.02)*k; b.h*=k; });
  }
  commit(true); toast('Tidied into rows');
};

Array.prototype.forEach.call($('segCols').children, b=>{
  b.onclick=()=>{
    Array.prototype.forEach.call($('segCols').children, x=>x.classList.remove('on'));
    b.classList.add('on');
    COLS=+b.dataset.cols; $('ovCols').textContent=COLS;
    boxes.forEach(x=>Object.assign(x, snapBox(x)));
    commit(true);
  };
});
Array.prototype.forEach.call($('segDev').children, b=>{
  b.onclick=()=>{ Array.prototype.forEach.call($('segDev').children,x=>x.classList.remove('on')); b.classList.add('on'); devW=+b.dataset.w; render(); };
});
Array.prototype.forEach.call($('segTheme').children, b=>{
  b.onclick=()=>{
    Array.prototype.forEach.call($('segTheme').children,x=>x.classList.remove('on'));
    b.classList.add('on'); theme=b.dataset.th; render();
    if($('mExport').classList.contains('on')) refreshExport();
  };
});

const PRESETS={
  landing:[{x:0,y:.02,w:1,h:.06},{x:0,y:.10,w:1,h:.24},
    {x:.04,y:.36,w:.28,h:.13},{x:.36,y:.36,w:.28,h:.13},{x:.68,y:.36,w:.28,h:.13},
    {x:.04,y:.52,w:.44,h:.16},{x:.52,y:.52,w:.44,h:.16},
    {x:0,y:.71,w:1,h:.11},{x:0,y:.88,w:1,h:.08}],
  docs:[{x:0,y:.02,w:1,h:.06},{x:.02,y:.11,w:.22,h:.74},
    {x:.28,y:.11,w:.68,h:.10},{x:.28,y:.24,w:.68,h:.18},
    {x:.28,y:.45,w:.68,h:.14},{x:.28,y:.62,w:.68,h:.23}],
  dash:[{x:0,y:.02,w:1,h:.06},{x:.02,y:.11,w:.18,h:.84},
    {x:.23,y:.11,w:.17,h:.09},{x:.42,y:.11,w:.17,h:.09},{x:.61,y:.11,w:.17,h:.09},{x:.80,y:.11,w:.17,h:.09},
    {x:.23,y:.24,w:.74,h:.31},{x:.23,y:.58,w:.74,h:.37}],
  post:[{x:0,y:.02,w:1,h:.06},{x:.18,y:.11,w:.64,h:.16},
    {x:.18,y:.30,w:.64,h:.18},{x:.18,y:.51,w:.64,h:.12},
    {x:.18,y:.66,w:.64,h:.17},{x:0,y:.89,w:1,h:.08}],
};
document.querySelectorAll('[data-preset]').forEach(b=>{
  b.onclick=()=>{ boxes=PRESETS[b.dataset.preset].map(o=>Object.assign({},o)); sel=-1; commit(true); };
});

function refreshExport(){
  $('codeOut').textContent = EXPORTS[fmt]();
  $('exNote').textContent = {
    html:'Semantic markup plus a token-driven stylesheet.',
    react:'Assumes a component library. Swap the import for your own.',
    tw:'Utility classes, mobile-first breakpoints included.',
    json:'Reload this exact sketch with Load.',
  }[fmt];
}
$('bExport').onclick=()=>{ $('mExport').classList.add('on'); refreshExport(); };
$('xExport').onclick=()=>$('mExport').classList.remove('on');
Array.prototype.forEach.call($('segFmt').children, b=>{
  b.onclick=()=>{ Array.prototype.forEach.call($('segFmt').children,x=>x.classList.remove('on')); b.classList.add('on'); fmt=b.dataset.f; refreshExport(); };
});
$('bCopy').onclick=function(){
  const t=$('codeOut').textContent;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(()=>toast('Copied'),()=>fallbackCopy(t));
  } else fallbackCopy(t);
};
function fallbackCopy(t){
  const ta=document.createElement('textarea');
  ta.value=t; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('Copied'); }catch(_){ toast('Select and copy manually'); }
  ta.remove();
}
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
    boxes=d.boxes; COLS=d.cols||12; theme=d.theme||'';
    Array.prototype.forEach.call($('segCols').children,x=>x.classList.toggle('on',+x.dataset.cols===COLS));
    Array.prototype.forEach.call($('segTheme').children,x=>x.classList.toggle('on',x.dataset.th===theme));
    $('ovCols').textContent=COLS;
    sel=-1; $('mLoad').classList.remove('on'); commit(true); toast('Sketch loaded');
  }catch(_){ toast('That is not a Mirage sketch'); }
};

const KEYS=[['Draw a box','drag'],['Move a box','drag it'],['Resize','drag a handle'],
  ['Delete box','right-click / Del'],['Edit content','double-click'],['Undo','⌘Z'],['Redo','⇧⌘Z'],
  ['Duplicate','⌘D'],['Tidy rows','T'],['Toggle labels','L'],['Invert surface','I'],
  ['Export','⌘E'],['Deselect','Esc'],['Nudge','arrows']];
$('keyList').innerHTML = KEYS.map(k=>'<div><span>'+k[0]+'</span><kbd>'+k[1]+'</kbd></div>').join('');
$('bKeys').onclick=()=>$('mKeys').classList.add('on');
$('xKeys').onclick=()=>$('mKeys').classList.remove('on');
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('on'); }));

document.addEventListener('keydown', e=>{
  const typing=/INPUT|TEXTAREA/.test(e.target.tagName);
  if(e.key==='Escape'){
    document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on'));
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
  if(k==='i') $('bDark').click();
  if((k==='delete'||k==='backspace') && sel>=0){ e.preventDefault(); $('bDel').click(); }
  if(k.indexOf('arrow')===0 && sel>=0){
    e.preventDefault();
    const b=boxes[sel], stepY=e.shiftKey?0.02:0.006, stepX=e.shiftKey?1/COLS:0.006;
    if(k==='arrowleft') b.x=Math.max(0,b.x-stepX);
    if(k==='arrowright') b.x=Math.min(1-b.w,b.x+stepX);
    if(k==='arrowup') b.y=Math.max(0,b.y-stepY);
    if(k==='arrowdown') b.y=Math.min(1-b.h,b.y+stepY);
    paint(); render(); syncSel();
  }
});

// ============================================================ boot
resize();
hist=[[]]; hi=0; syncHist();
commit(false);
})();

/* ==============================================================
   MIRAGE — local persistence + live design.md
   Paste this block just BEFORE the closing `})();` in
   mirage (2).html, so it shares scope with `boxes`, `COLS`,
   `theme`, `devW`, `commit`, `$`, etc.
   ============================================================== */

/* ---------------------------------------------------------------
   1) LOCAL PERSISTENCE (IndexedDB) — "save like OpenCut"
   OpenCut keeps every project in IndexedDB so a reload (or losing
   the tab) never loses work. Same pattern here: every commit()
   is mirrored into IndexedDB in the background, and on load we
   silently restore the last sketch. The existing Save/Load modal
   (Sketch JSON) is untouched — that stays as the manual
   export/import path; this is the automatic one.
   --------------------------------------------------------------- */

const DB_NAME = 'mirage';
const DB_VERSION = 1;
const STORE_SKETCHES = 'sketches'; // autosave + named projects
const STORE_META = 'meta';         // misc, e.g. the design.md file handle

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SKETCHES)) {
        db.createObjectStore(STORE_SKETCHES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- autosave the working sketch ----
const AUTOSAVE_ID = 'current';
let autosaveTimer = null;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  // debounce: dragging a box fires commit() a lot, we don't want to
  // hit IndexedDB on every pixel of movement
  autosaveTimer = setTimeout(async () => {
    await idbPut(STORE_SKETCHES, {
      id: AUTOSAVE_ID,
      cols: COLS,
      theme,
      devW,
      boxes,
      updatedAt: Date.now(),
    });
  }, 400);
}

async function restoreAutosave() {
  const saved = await idbGet(STORE_SKETCHES, AUTOSAVE_ID);
  if (!saved) return false;
  boxes = saved.boxes || [];
  COLS = saved.cols || 12;
  theme = saved.theme || '';
  devW = saved.devW || 0;
  return true;
}

// ---- optional: named multi-project support (like OpenCut's project list) ----
async function saveNamedProject(name) {
  await idbPut(STORE_SKETCHES, {
    id: 'project:' + name,
    name,
    cols: COLS,
    theme,
    devW,
    boxes,
    updatedAt: Date.now(),
  });
}

async function listProjects() {
  const all = await idbAll(STORE_SKETCHES);
  return all.filter(s => s.id.startsWith('project:'));
}

async function loadNamedProject(name) {
  return idbGet(STORE_SKETCHES, 'project:' + name);
}

(async () => {
  const restored = await restoreAutosave();
  if (restored) toast('Restored your last sketch');
  commit(false);
  push();
})();

/* ---------------------------------------------------------------
   HOOK-IN POINTS for section 1 (edit these two spots in the file):

   a) Inside `function commit(record){ ... }` add:
        scheduleAutosave();

   b) At the very end of the IIFE (after all the const/function
      declarations, where the app currently boots), replace the
      startup with:

        (async () => {
          const restored = await restoreAutosave();
          if (restored) toast('Restored your last sketch');
          commit(false);
          push(); // seed undo history with the restored state
        })();

   That's it — no UI changes needed, it just works in the background.
   --------------------------------------------------------------- */


/* ---------------------------------------------------------------
   2) LIVE design.md — "actively save the imported theme"
   Whenever the active theme changes (user picks one from the
   Theme segmented control, OR a Sketch JSON is imported that
   carries a `theme` field), rewrite design.md with that theme's
   tokens. Uses the File System Access API to write to a real file
   on disk without re-downloading each time; falls back to a
   download for browsers that don't support it (Firefox, Safari).
   --------------------------------------------------------------- */

const THEME_TOKENS = {
  '':         { name: 'Plain',     bg: '#FBFCFD', fg: '#141C22', mut: '#5A6873', line: '#E4E9ED', acc: '#1F5F8B', radius: '2px',  font: 'Archivo' },
  editorial:  { name: 'Editorial', bg: '#FCFBF7', fg: '#1A1714', mut: '#6B635A', line: '#E6E1D6', acc: '#8A5A2B', radius: '0px',  font: 'Instrument Serif' },
  brutal:     { name: 'Brutal',    bg: '#F2F0EA', fg: '#0B0B0B', mut: '#3A3A3A', line: '#0B0B0B', acc: '#0B0B0B', radius: '0px',  font: 'Archivo' },
  soft:       { name: 'Soft',      bg: '#FAFAFC', fg: '#1B1E2B', mut: '#6E7488', line: '#EBECF2', acc: '#5B5BD6', radius: '12px', font: 'Archivo' },
  terminal:   { name: 'Terminal',  bg: '#0D1117', fg: '#D6DEE4', mut: '#7C8B96', line: '#1E262E', acc: '#4FE0B0', radius: '0px',  font: 'IBM Plex Mono' },
};

function themeToMarkdown(themeKey) {
  const t = THEME_TOKENS[themeKey] || THEME_TOKENS[''];
  return [
    '# Design tokens',
    '',
    '_Auto-generated by Mirage — rewritten whenever the theme changes._',
    '',
    '- **Theme:** ' + t.name,
    '- **Updated:** ' + new Date().toISOString(),
    '',
    '| Token | Value |',
    '|---|---|',
    '| Background | `' + t.bg + '` |',
    '| Foreground | `' + t.fg + '` |',
    '| Muted | `' + t.mut + '` |',
    '| Line / border | `' + t.line + '` |',
    '| Accent | `' + t.acc + '` |',
    '| Radius | `' + t.radius + '` |',
    '| Font | `' + t.font + '` |',
    '',
  ].join('\n');
}

// A File System Access handle can be structured-cloned, so we can
// stash it in IndexedDB and reuse it across reloads (permission
// still has to be re-granted by the browser on some visits).
let designFileHandle = null;

async function pickDesignFile() {
  if (!('showSaveFilePicker' in window)) return null;
  designFileHandle = await window.showSaveFilePicker({
    suggestedName: 'design.md',
    types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
  });
  await idbPut(STORE_META, { key: 'designFileHandle', handle: designFileHandle });
  return designFileHandle;
}

async function restoreDesignFileHandle() {
  const rec = await idbGet(STORE_META, 'designFileHandle');
  if (!rec) return null;
  const perm = await rec.handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') { designFileHandle = rec.handle; return rec.handle; }
  return null; // needs a fresh pickDesignFile() click — browsers require a user gesture
}

async function writeDesignFile(themeKey) {
  const md = themeToMarkdown(themeKey);
  if (designFileHandle) {
    const writable = await designFileHandle.createWritable();
    await writable.write(md);
    await writable.close();
    return true;
  }
  // fallback: trigger a download instead of a silent on-disk rewrite
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'design.md';
  a.click();
  URL.revokeObjectURL(a.href);
  return false;
}

/* ---------------------------------------------------------------
   HOOK-IN POINTS for section 2:

   a) Add one button to the header (near #bSave), e.g.:
        <button class="t" id="bDesignFile">Connect design.md</button>
      wired to:
        $('bDesignFile').onclick = () => pickDesignFile().then(() => writeDesignFile(theme));
      (File System Access requires a real user click to grant
      access the first time — that's what this button is for.)

   b) In the theme segmented-control handler (wherever `theme = b.dataset.th`
      is set, inside the #segTheme click listener), add:
        writeDesignFile(theme);

   c) In the "Load sketch" flow (bLoadGo handler, where the pasted
      Sketch JSON is parsed and applied — it already carries a
      `theme` field per exJSON()), add the same call right after
      `theme` is assigned from the imported JSON:
        writeDesignFile(theme);

   d) On boot, try to silently reconnect the file handle:
        restoreDesignFileHandle();
      If it returns null, design.md changes fall back to downloads
      until the user clicks "Connect design.md" again.
   --------------------------------------------------------------- */
