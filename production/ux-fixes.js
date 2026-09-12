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

  function updateSortLabel(){
    const select=document.getElementById('sort');
    const label=document.getElementById('sortLabel');
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

  document.addEventListener('error',event=>{
    const target=event.target;
    if(target instanceof HTMLImageElement&&target.matches('img.photo, #galleryMain, .gallerythumb img'))applyImageFallback(target);
  },true);

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
})();
