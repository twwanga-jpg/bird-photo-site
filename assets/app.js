const state={data:null,filter:"all"};
const esc=s=>String(s??"").replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));
const viewport=document.querySelector('meta[name="viewport"]');
const narrowDevice=window.screen.width<=760;

function preferredView(){
  const saved=localStorage.getItem('bird-photo-view');
  return saved==='mobile'||saved==='desktop'?saved:(matchMedia('(max-width:760px)').matches?'mobile':'desktop');
}
function setView(view,persist=false){
  viewport.setAttribute('content',view==='desktop'&&narrowDevice?'width=1040':'width=device-width,initial-scale=1');
  document.body.dataset.view=view;
  document.querySelectorAll('.view-switch button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  if(persist)localStorage.setItem('bird-photo-view',view);
  document.querySelector('.menu').setAttribute('aria-expanded','false');
}
setView(preferredView());
document.querySelectorAll('.view-switch button').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view,true)));

async function load(){try{const r=await fetch(`data/photos.json?v=${Date.now()}`);if(!r.ok)throw new Error();state.data=await r.json();render()}catch{document.querySelector('.empty').hidden=false;document.querySelector('.empty').textContent='尚未產生作品目錄，請先執行同步程式。'}}
function render(){const d=state.data;document.title=`${d.site.name}｜鳥類攝影作品集`;for(const id of['site-name','footer-name'])document.getElementById(id).textContent=d.site.name;document.getElementById('owner').textContent=d.site.owner;document.getElementById('site-intro').textContent=d.site.intro;document.getElementById('year').textContent=new Date().getFullYear();const hero=d.photos.find(p=>p.featured)||d.photos[0];if(hero){const img=document.getElementById('hero-image');img.src=hero.src;img.alt=hero.alt||hero.title}let list=d.photos;if(state.filter!=='all'){if(state.filter.startsWith('loc:')){const location=state.filter.slice(4);list=d.photos.filter(p=>String(p.location||'').includes(location)||String(p.title||'').includes(location))}else if(state.filter.startsWith('species:')){const species=state.filter.slice(8);list=d.photos.filter(p=>String(p.species||'').includes(species)||String(p.title||'').includes(species))}else{list=d.photos.filter(p=>p.category===state.filter)}}const grid=document.getElementById('photo-grid');grid.innerHTML=list.map(p=>`<article class="card"><button data-id="${esc(p.id)}"><figure><img src="${esc(p.src)}" alt="${esc(p.alt||p.title)}" loading="lazy"><b>＋</b></figure><div class="meta"><span><strong>${esc(p.title)}</strong><small>${esc(p.species)}</small></span><em>${esc(p.location)}</em></div></button></article>`).join('');document.querySelector('.empty').hidden=list.length>0;grid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openPhoto(d.photos.find(p=>String(p.id)===b.dataset.id))))}
function openPhoto(p){const dlg=document.getElementById('lightbox');dlg.querySelector('img').src=p.src;dlg.querySelector('img').alt=p.alt||p.title;dlg.querySelector('small').textContent=p.location;dlg.querySelector('h2').textContent=p.title;dlg.querySelector('p').textContent=p.species;dlg.showModal()}
function applyFilter(filter){
  state.filter=filter;
  document.querySelectorAll('.filters button').forEach(button=>button.classList.toggle('active',button.dataset.filter===filter));
  if(state.data)render();
}
document.querySelector('.menu').addEventListener('click',e=>e.currentTarget.setAttribute('aria-expanded',e.currentTarget.getAttribute('aria-expanded')!=='true'));
document.querySelectorAll('nav a').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  document.querySelector('.menu').setAttribute('aria-expanded','false');
  const target=link.getAttribute('href').slice(1);
  const category={gallery:'all',flight:'flight',raptors:'raptors',wetlands:'wetlands'}[target];
  if(category){
    applyFilter(category);
    document.getElementById('gallery').scrollIntoView({behavior:'smooth',block:'start'});
  }else{
    document.getElementById('home').scrollIntoView({behavior:'smooth',block:'start'});
  }
}));
document.querySelectorAll('.filters button').forEach(button=>button.addEventListener('click',()=>applyFilter(button.dataset.filter)));
document.querySelector('.close').addEventListener('click',()=>document.getElementById('lightbox').close());document.getElementById('lightbox').addEventListener('click',e=>{if(e.target.id==='lightbox')e.currentTarget.close()});load();
