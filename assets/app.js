const state={data:null,filter:"all",visible:[],currentIndex:-1};
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
function render(){const d=state.data;document.title=`${d.site.name}｜鳥類攝影作品集`;for(const id of['site-name','footer-name'])document.getElementById(id).textContent=d.site.name;document.getElementById('owner').textContent=d.site.owner;document.getElementById('site-intro').textContent=d.site.intro;document.getElementById('year').textContent=new Date().getFullYear();let list=d.photos;if(state.filter!=='all'){if(state.filter.startsWith('loc:')){const location=state.filter.slice(4);list=d.photos.filter(p=>String(p.location||'').includes(location)||String(p.title||'').includes(location))}else if(state.filter.startsWith('species:')){const species=state.filter.slice(8);list=d.photos.filter(p=>String(p.species||'').includes(species)||String(p.title||'').includes(species))}else{list=d.photos.filter(p=>p.category===state.filter)}}state.visible=list;const grid=document.getElementById('photo-grid');grid.innerHTML=list.map((p,index)=>`<article class="card"><button data-index="${index}"><figure><img src="${esc(p.src)}" srcset="${esc(p.small||p.src)} 640w, ${esc(p.src)} 1400w, ${esc(p.large||p.src)} 2400w" sizes="(max-width:760px) 100vw, 50vw" alt="${esc(p.alt||p.title)}" loading="${index<2?'eager':'lazy'}" decoding="async" ${index===0?'fetchpriority="high"':''}><b>＋</b></figure><div class="meta"><span><strong>${esc(p.title)}</strong><small>${esc(p.species)}</small></span><em>${esc(p.location)}</em></div></button></article>`).join('');document.querySelector('.empty').hidden=list.length>0;grid.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openPhoto(Number(b.dataset.index))))}
function showCurrentPhoto(){const p=state.visible[state.currentIndex];if(!p)return;const dlg=document.getElementById('lightbox');const img=dlg.querySelector('img');img.src=p.large||p.src;img.alt=p.alt||p.title;img.title='按一下顯示下一張';dlg.querySelector('small').textContent=p.location;dlg.querySelector('h2').textContent=p.title;dlg.querySelector('p').textContent=p.species}
function openPhoto(index){state.currentIndex=index;showCurrentPhoto();const dlg=document.getElementById('lightbox');if(!dlg.open)dlg.showModal()}
function changePhoto(step){if(!state.visible.length)return;state.currentIndex=(state.currentIndex+step+state.visible.length)%state.visible.length;showCurrentPhoto()}
function applyFilter(filter){
  state.filter=filter;
  document.querySelectorAll('.filters button').forEach(button=>button.classList.toggle('active',button.dataset.filter===filter));
  if(state.data)render();
}
document.querySelector('.menu').addEventListener('click',e=>e.currentTarget.setAttribute('aria-expanded',e.currentTarget.getAttribute('aria-expanded')!=='true'));
document.querySelectorAll('nav a').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  document.querySelector('.menu').setAttribute('aria-expanded','false');
  const directFilter=link.dataset.filter;
  const target=link.getAttribute('href').slice(1);
  const category={gallery:'all',flight:'flight',raptors:'raptors',wetlands:'wetlands'}[target];
  if(directFilter||category){
    applyFilter(directFilter||category);
    document.getElementById('gallery').scrollIntoView({behavior:'smooth',block:'start'});
  }else{
    document.getElementById('home').scrollIntoView({behavior:'smooth',block:'start'});
  }
}));
document.querySelectorAll('.filters button').forEach(button=>button.addEventListener('click',()=>applyFilter(button.dataset.filter)));
const lightbox=document.getElementById('lightbox');
document.querySelector('.close').addEventListener('click',()=>lightbox.close());
lightbox.querySelector('img').addEventListener('click',()=>changePhoto(1));
lightbox.addEventListener('click',e=>{if(e.target===lightbox)e.currentTarget.close()});
document.addEventListener('keydown',e=>{if(!lightbox.open)return;if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();changePhoto(-1)}else if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();changePhoto(1)}});
load();
