(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);

// -------------------------------------------------- word rise stagger
document.querySelectorAll('.w > i').forEach((el,i)=>{ el.style.animationDelay = (0.10 + i*0.055)+'s'; });

// -------------------------------------------------- vertical column rules
(() => {
  const box = document.getElementById('vrules');
  const n = 12;
  for(let i=1;i<n;i++){
    const s=document.createElement('i');
    s.style.left = (i/n*100)+'%';
    box.appendChild(s);
  }
})();

// -------------------------------------------------- parallax
const dots = document.getElementById('dots');
const dots2 = document.getElementById('dots2');
const win = document.getElementById('win');
const curs = [document.getElementById('c1'),document.getElementById('c2'),document.getElementById('c3')];
let sy = 0, ticking = false;

function onScroll(){
  sy = window.scrollY || 0;
  if(!ticking && !reduce){ ticking = true; requestAnimationFrame(apply); }
}
function apply(){
  ticking = false;
  dots.style.transform = 'translate3d(0,'+(sy*0.16).toFixed(1)+'px,0)';
  if(dots2) dots2.style.transform = 'translate3d(0,'+(sy*-0.05).toFixed(1)+'px,0)';
  const t = Math.max(0, 1 - sy/900);
  win.style.transform = 'translate3d(0,'+(sy*-0.05).toFixed(1)+'px,0)';
  curs.forEach((c,i)=>{ c.style.opacity = t; });
}
addEventListener('scroll', onScroll, {passive:true});
onScroll();

// -------------------------------------------------- live cursors
const PATHS = [
  [[6,132],[26,196],[62,150],[18,240],[6,132]],
  [[88,96],[70,210],[94,268],[60,120],[88,96]],
  [[46,300],[80,258],[24,318],[52,352],[46,300]],
];
curs.forEach((c,i)=>{
  let k=0;
  const hop = () => {
    const p = PATHS[i][k % PATHS[i].length];
    const x = (p[0]/100) * (document.querySelector('.hero .wrap').offsetWidth) - 20;
    c.style.transform = 'translate3d('+x.toFixed(0)+'px,'+p[1]+'px,0)';
    k++;
    setTimeout(hop, 1500 + i*420 + Math.random()*900);
  };
  c.style.left='0'; c.style.top='0';
  setTimeout(hop, 1600 + i*300);
});

// -------------------------------------------------- hero demo loop
const SCENES = [
  { boxes:[[3,4,94,9,'Nav bar']],
    pv:'<div class="p-nav"><b>Northwind</b><span>Docs</span><span>Pricing</span><span class="g">Get started</span></div>' },
  { boxes:[[3,4,94,9,'Nav bar'],[3,17,94,30,'Hero']],
    pv:'<div class="p-nav"><b>Northwind</b><span>Docs</span><span>Pricing</span><span class="g">Get started</span></div>'+
       '<div class="p-hero"><h4>Everything you draw becomes real</h4><p>Position, proportion, and what sits beside what. That is the whole input.</p><span class="b">Start drawing</span></div>' },
  { boxes:[[3,4,94,9,'Nav bar'],[3,17,94,30,'Hero'],[3,52,29,22,'Card grid ×3'],[35,52,29,22,''],[67,52,30,22,'']],
    pv:'<div class="p-nav"><b>Northwind</b><span>Docs</span><span>Pricing</span><span class="g">Get started</span></div>'+
       '<div class="p-hero"><h4>Everything you draw becomes real</h4><p>Position, proportion, and what sits beside what. That is the whole input.</p><span class="b">Start drawing</span></div>'+
       '<div class="p-grid"><div class="p-card"><i>Position</i><h5>Where it sits</h5><p>Top edge means nav.</p></div>'+
       '<div class="p-card"><i>Proportion</i><h5>Tall or wide</h5><p>Narrow means rail.</p></div>'+
       '<div class="p-card"><i>Company</i><h5>What is beside it</h5><p>Three means grid.</p></div></div>' },
  { boxes:[[3,4,94,9,'Nav bar'],[3,17,94,30,'Hero'],[3,52,29,22,'Card grid ×3'],[35,52,29,22,''],[67,52,30,22,''],[3,79,94,13,'Footer']],
    pv:'<div class="p-nav"><b>Northwind</b><span>Docs</span><span>Pricing</span><span class="g">Get started</span></div>'+
       '<div class="p-hero"><h4>Everything you draw becomes real</h4><p>Position, proportion, and what sits beside what. That is the whole input.</p><span class="b">Start drawing</span></div>'+
       '<div class="p-grid"><div class="p-card"><i>Position</i><h5>Where it sits</h5><p>Top edge means nav.</p></div>'+
       '<div class="p-card"><i>Proportion</i><h5>Tall or wide</h5><p>Narrow means rail.</p></div>'+
       '<div class="p-card"><i>Company</i><h5>What is beside it</h5><p>Three means grid.</p></div></div>'+
       '<div class="p-foot"><span>Northwind</span><span>Drawn, not configured</span></div>' },
];

const dL = document.getElementById('demoL'), dR = document.getElementById('demoR'), wStat = document.getElementById('wStat');
let scene = 0, demoOn = true;

function paintScene(){
  const s = SCENES[scene];
  dL.innerHTML = s.boxes.map((b,i)=>{
    const last = i === s.boxes.length-1;
    return '<div class="sbox'+(last?' on grow':'')+'" style="left:'+b[0]+'%;top:'+b[1]+'%;width:'+b[2]+'%;height:'+b[3]+'%">'+
           (b[4] ? '<span class="lab">'+b[4]+'</span>' : '') + '</div>';
  }).join('');
  dR.innerHTML = s.pv;
  Array.prototype.forEach.call(dR.children, (el,i)=>{ el.style.animationDelay = (i*70+90)+'ms'; });
  wStat.textContent = s.boxes.length + (s.boxes.length===1?' box':' boxes');
  scene = (scene+1) % SCENES.length;
}
paintScene();
if(!reduce){
  let timer = setInterval(paintScene, 2100);
  // pause when off screen
  new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(e.isIntersecting && !demoOn){ demoOn=true; timer=setInterval(paintScene,2100); }
      else if(!e.isIntersecting && demoOn){ demoOn=false; clearInterval(timer); }
    });
  },{threshold:0.15}).observe(win);
}

// -------------------------------------------------- component library
const LIB = [
  ['Nav bar',[100,6]],['Hero',[70,10,45,8,30,7]],['Card grid',[33,999]],['Two column',[50,999]],
  ['Text block',[100,5,92,5,74,5]],['Image',[100,60]],['Gallery',[25,999]],['Side nav',[38,8,38,8,38,8]],
  ['Stat row',[25,999]],['Logo row',[16,999]],['Quote',[86,12,44,5]],['Form',[100,8,100,8,46,8]],
  ['Table',[100,6,100,6,100,6]],['Tabs',[26,6,100,20]],['Pricing',[33,999]],['CTA banner',[64,14,32,10]],
  ['Code block',[100,40]],['Button',[34,12]],['Footer',[100,10]],
];
document.getElementById('libGrid').innerHTML = LIB.map(([name,shape])=>{
  let bars = '';
  if(shape[1] === 999){
    bars = '<div style="display:flex;gap:3px;height:100%">'+
      Array.from({length: Math.round(100/shape[0])},()=>'<i style="flex:1;height:100%"></i>').join('')+'</div>';
  } else {
    for(let i=0;i<shape.length;i+=2){
      bars += '<i style="width:'+shape[i]+'%;height:'+shape[i+1]+'px;flex:'+(shape[i+1]>30?'1':'none')+'"></i>';
    }
  }
  return '<div class="lib"><div class="mini">'+bars+'</div><div class="nm2">'+name+'</div></div>';
}).join('');

// -------------------------------------------------- export tabs
const CODE = {
html:
'<span class="c1">&lt;!-- generated by Mirage --&gt;</span>\n'+
'&lt;main class=<span class="c2">"page"</span>&gt;\n'+
'  &lt;<span class="c3">nav</span> class=<span class="c2">"nav"</span>&gt;\n'+
'    &lt;a class=<span class="c2">"brand"</span> href=<span class="c2">"/"</span>&gt;Northwind&lt;/a&gt;\n'+
'    &lt;ul class=<span class="c2">"nav-links"</span>&gt;…&lt;/ul&gt;\n'+
'  &lt;/<span class="c3">nav</span>&gt;\n\n'+
'  &lt;<span class="c3">header</span> class=<span class="c2">"hero"</span>&gt;\n'+
'    &lt;h1&gt;Everything you draw becomes real&lt;/h1&gt;\n'+
'    &lt;p&gt;Supporting sentence.&lt;/p&gt;\n'+
'    &lt;a class=<span class="c2">"btn"</span> href=<span class="c2">"#"</span>&gt;Start drawing&lt;/a&gt;\n'+
'  &lt;/<span class="c3">header</span>&gt;\n\n'+
'  &lt;<span class="c3">section</span> class=<span class="c2">"grid cols-3"</span>&gt;\n'+
'    &lt;article class=<span class="c2">"card"</span>&gt;…&lt;/article&gt;\n'+
'    &lt;article class=<span class="c2">"card"</span>&gt;…&lt;/article&gt;\n'+
'    &lt;article class=<span class="c2">"card"</span>&gt;…&lt;/article&gt;\n'+
'  &lt;/<span class="c3">section</span>&gt;\n\n'+
'  &lt;<span class="c3">footer</span> class=<span class="c2">"foot"</span>&gt;…&lt;/<span class="c3">footer</span>&gt;\n'+
'&lt;/main&gt;',
react:
'<span class="c1">// generated by Mirage</span>\n'+
'<span class="c3">import</span> { Nav, Hero, CardGrid, Footer } <span class="c3">from</span> <span class="c2">\'@mirage/ui\'</span>\n\n'+
'<span class="c3">export default function</span> Page() {\n'+
'  <span class="c3">return</span> (\n'+
'    &lt;main className=<span class="c2">"page"</span>&gt;\n'+
'      &lt;Nav brand=<span class="c2">"Northwind"</span> links={nav} /&gt;\n'+
'      &lt;Hero\n'+
'        title=<span class="c2">"Everything you draw becomes real"</span>\n'+
'        body={copy.hero}\n'+
'      /&gt;\n'+
'      &lt;CardGrid columns={<span class="c2">3</span>} items={items} /&gt;\n'+
'      &lt;Footer brand=<span class="c2">"Northwind"</span> /&gt;\n'+
'    &lt;/main&gt;\n'+
'  )\n'+
'}',
tw:
'<span class="c1">&lt;!-- generated by Mirage · Tailwind --&gt;</span>\n'+
'&lt;main&gt;\n'+
'  &lt;<span class="c3">nav</span> class=<span class="c2">"flex items-center gap-5 px-6 py-3.5\n            border-b border-neutral-200"</span>&gt;\n'+
'    &lt;span class=<span class="c2">"font-bold tracking-tight"</span>&gt;Northwind&lt;/span&gt;\n'+
'  &lt;/<span class="c3">nav</span>&gt;\n\n'+
'  &lt;<span class="c3">header</span> class=<span class="c2">"px-6 py-14 border-b border-neutral-200"</span>&gt;\n'+
'    &lt;h1 class=<span class="c2">"text-4xl md:text-5xl font-extrabold\n           tracking-tight leading-none max-w-[14ch]"</span>&gt;\n'+
'      Everything you draw becomes real\n'+
'    &lt;/h1&gt;\n'+
'  &lt;/<span class="c3">header</span>&gt;\n\n'+
'  &lt;<span class="c3">section</span> class=<span class="c2">"grid grid-cols-1 md:grid-cols-3 gap-3 p-6"</span>&gt;\n'+
'    &lt;article class=<span class="c2">"border border-neutral-200 rounded p-4"</span>&gt;…&lt;/article&gt;\n'+
'  &lt;/<span class="c3">section</span>&gt;\n'+
'&lt;/main&gt;',
};
const codeEl = document.getElementById('code');
codeEl.innerHTML = CODE.html;
document.querySelectorAll('#tabs button').forEach(b=>{
  b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    codeEl.style.opacity = '0';
    setTimeout(()=>{ codeEl.innerHTML = CODE[b.dataset.f]; codeEl.style.opacity='1'; }, 130);
  };
});
codeEl.style.transition = 'opacity .13s';

// -------------------------------------------------- reveal on scroll
const io = new IntersectionObserver(es=>{
  es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:0.12, rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('.rv').forEach((el,i)=>{ el.style.transitionDelay=(i%4*60)+'ms'; io.observe(el); });

// -------------------------------------------------- counters
const cio = new IntersectionObserver(es=>{
  es.forEach(e=>{
    if(!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, target = +el.dataset.n;
    if(target === 0 || reduce){ el.textContent = target; return; }
    const t0 = performance.now(), dur = 1100;
    const step = t => {
      const p = Math.min(1,(t-t0)/dur), e2 = 1-Math.pow(1-p,3);
      el.textContent = Math.round(target*e2).toLocaleString();
      if(p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
},{threshold:0.5});
document.querySelectorAll('[data-n]').forEach(el=>cio.observe(el));
})();
