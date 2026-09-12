(()=>{
  'use strict';

  const PLACEHOLDER='/car-placeholder.svg';
  const SORT_LABELS={
    recent:'Newest',
    price_asc:'Price ↑',
    price_desc:'Price ↓',
    year_desc:'Year ↓',
    year_asc:'Year ↑',
    mileage_asc:'Mileage ↑'
  };
  const LISTING_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function ensureSortLabel(){
    const select=document.getElementById('sort');
    if(!select)return null;
    let label=document.getElementById('sortLabel');
    if(label)return label;
    label=document.createElement('span');
    label.id='sortLabel';
    label.className='sortlabel';
    label.setAttribute('aria-hidden','true');
    select.before(label);
    return label;
  }

  function updateSortLabel(){
    const select=document.getElementById('sort');
    const label=ensureSortLabel();
    if(!select||!label)return;
    label.textContent=SORT_LABELS[select.value]||'Sort';
  }

  function applyImageFallback(img){
    if(!img||img.getAttribute('src')===PLACEHOLDER)return;
    if(img.dataset?.fallbackApplied==='true')return;
    if(img.dataset)img.dataset.fallbackApplied='true';
    const swap=()=>{
      img.onerror=null;
      img.src=PLACEHOLDER;
      img.style.display='block';
      img.classList.add('photo-fallback');
      img.alt='Vehicle photo unavailable';
    };
    if(typeof queueMicrotask==='function')queueMicrotask(swap);
    else setTimeout(swap,0);
  }

  function scanImages(root=document){
    if(!root?.querySelectorAll)return;
    root.querySelectorAll('img.photo, #galleryMain, .gallerythumb img').forEach(img=>{
      if(!img.getAttribute('src'))applyImageFallback(img);
    });
  }

  function syncGalleryNav(root=document){
    if(!root?.querySelector)return;
    const viewer=root.querySelector('.viewer');
    if(!viewer)return;
    const gallery=viewer.nextElementSibling?.classList?.contains('gallery')?viewer.nextElementSibling:root.querySelector('.gallery');
    const photoCount=gallery?gallery.querySelectorAll('.gallerythumb').length:0;
    const noPaging=photoCount<=1;
    viewer.classList.toggle('single-photo',noPaging);
    viewer.querySelectorAll('.gallerynav').forEach(button=>{
      button.hidden=noPaging;
      button.disabled=noPaging;
      button.setAttribute('aria-hidden',String(noPaging));
      if(noPaging)button.setAttribute('tabindex','-1');
      else button.removeAttribute('tabindex');
    });
  }

  function refresh(root=document){
    scanImages(root);
    syncGalleryNav(root);
    updateSortLabel();
  }

  function listingUrl(id){
    const url=new URL(location.href);
    url.pathname='/';
    url.search='';
    url.hash='';
    url.searchParams.set('listing',id);
    return url.href;
  }

  async function copyText(text){
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch{}
    const input=document.createElement('textarea');
    input.value=text;
    input.setAttribute('readonly','');
    input.style.position='fixed';
    input.style.opacity='0';
    document.body.appendChild(input);
    input.select();
    let copied=false;
    try{copied=document.execCommand('copy')}catch{}
    input.remove();
    return copied;
  }

  function flashButton(button,text){
    const original=button.textContent;
    button.textContent=text;
    button.disabled=true;
    setTimeout(()=>{
      if(!button.isConnected)return;
      button.textContent=original;
      button.disabled=false;
    },1400);
  }

  async function shareListing(button){
    const id=button?.dataset?.shareListing||'';
    if(!LISTING_ID.test(id))return;
    const url=listingUrl(id);
    const title=(button.dataset.shareTitle||'P2PCars listing').trim();
    if(typeof navigator.share==='function'){
      try{
        await navigator.share({title,text:title,url});
        return;
      }catch(error){
        if(error?.name==='AbortError')return;
      }
    }
    const copied=await copyText(url);
    flashButton(button,copied?'Link copied':'Copy failed');
  }

  function openListingFromUrl(attempt=0){
    const id=new URLSearchParams(location.search).get('listing')||'';
    if(!LISTING_ID.test(id))return;
    if(typeof window.detail==='function'){
      window.detail(id,0,'results');
      return;
    }
    if(attempt<20)setTimeout(()=>openListingFromUrl(attempt+1),50);
  }

  document.addEventListener('error',event=>{
    const target=event.target;
    if(target instanceof HTMLImageElement&&target.matches('img.photo, #galleryMain, .gallerythumb img'))applyImageFallback(target);
  },true);

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-share-listing]');
    if(!button)return;
    event.preventDefault();
    shareListing(button);
  });

  const sort=document.getElementById('sort');
  sort?.addEventListener('change',updateSortLabel);

  const observerConfig={childList:true,subtree:true};
  const modal=document.getElementById('modal');
  const cards=document.getElementById('cards');
  if(typeof MutationObserver!=='undefined'){
    if(modal)new MutationObserver(()=>refresh(modal)).observe(modal,observerConfig);
    if(cards)new MutationObserver(()=>scanImages(cards)).observe(cards,observerConfig);
  }

  refresh();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>openListingFromUrl(),{once:true});
  else setTimeout(()=>openListingFromUrl(),0);
})();
